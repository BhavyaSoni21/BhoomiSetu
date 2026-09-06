// Pure polygon math for the irregular cluster-subdivision parcel generator
// (cluster-generator.ts). Kept separate from ../geo-utils.ts, which operates
// on parsed GeoJSON rings at API-request time (point-in-polygon, polygon
// distance) - this operates on plain local-meter coordinates at seed time
// and includes generation-only concerns (convex hulling, half-plane
// clipping, corner nibbling) geo-utils.ts has no reason to expose.
//
// Everything here works in LOCAL METERS (x = east, y = north, relative to a
// cluster's center point) rather than lng/lat, so angle/direction math stays
// plain Euclidean geometry with no per-operation latitude correction -
// lng/lat conversion happens once, at the very end, in cluster-generator.ts.

export type LocalPoint = [number, number];
export type LocalRing = LocalPoint[]; // open while under construction: no repeated first/last point

const DEDUPE_EPSILON_M = 0.01; // 1cm - collapses near-duplicate points from clip-line grazes

function distance(a: LocalPoint, b: LocalPoint): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// Drops consecutive near-duplicate points (can appear when a clip line grazes
// close to an existing vertex) so downstream validation never sees a
// zero-length edge.
export function dedupeRing(ring: LocalRing): LocalRing {
  const out: LocalRing = [];
  for (const p of ring) {
    if (out.length === 0 || distance(out[out.length - 1], p) > DEDUPE_EPSILON_M) out.push(p);
  }
  if (out.length > 1 && distance(out[0], out[out.length - 1]) <= DEDUPE_EPSILON_M) out.pop();
  return out;
}

export function localArea(ring: LocalRing): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

export function localCentroid(ring: LocalRing): LocalPoint {
  let x = 0, y = 0;
  for (const p of ring) { x += p[0]; y += p[1]; }
  return [x / ring.length, y / ring.length];
}

// The polygon's true minimum width: the smallest extent of the shape across
// ALL directions, not just axis-aligned. For a convex polygon this minimum
// is always achieved perpendicular to one of its own edges (the standard
// "rotating calipers" result), so checking just those n directions is exact
// - no need to sample arbitrary angles. This is what actually distinguishes
// a plausible parcel from a paper-thin sliver: a sliver can easily have
// "reasonable" area (long enough to compensate for being narrow) while
// having a near-zero width in the one direction that matters.
export function convexPolygonMinWidth(ring: LocalRing): number {
  const n = ring.length;
  let minWidth = Infinity;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const edgeLen = distance(a, b);
    if (edgeLen < 1e-9) continue;
    const normal: LocalPoint = [-(b[1] - a[1]) / edgeLen, (b[0] - a[0]) / edgeLen];
    let min = Infinity, max = -Infinity;
    for (const p of ring) {
      const proj = p[0] * normal[0] + p[1] * normal[1];
      if (proj < min) min = proj;
      if (proj > max) max = proj;
    }
    const width = max - min;
    if (width < minWidth) minWidth = width;
  }
  return minWidth;
}

export function localBounds(ring: LocalRing): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

// --- Convex hull (Andrew's monotone chain) --------------------------------
// Used to turn a cloud of jittered candidate points into a guaranteed-convex
// envelope. Convexity of the envelope is what guarantees every subdivided
// leaf polygon stays simple/non-self-intersecting by construction (splitting
// a convex polygon with a straight line always yields two convex pieces).
function cross(o: LocalPoint, a: LocalPoint, b: LocalPoint): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

export function convexHull(points: LocalPoint[]): LocalRing {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;

  const lower: LocalPoint[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: LocalPoint[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper); // CCW, open ring
}

// --- Convex polygon half-plane clipping (Sutherland-Hodgman, single line) --
// "Inside" is the side where side() >= 0 (left of lineDir through linePoint).
function side(p: LocalPoint, linePoint: LocalPoint, lineDir: LocalPoint): number {
  return (p[0] - linePoint[0]) * lineDir[1] - (p[1] - linePoint[1]) * lineDir[0];
}

function lineIntersect(a: LocalPoint, b: LocalPoint, linePoint: LocalPoint, lineDir: LocalPoint): LocalPoint {
  const da = side(a, linePoint, lineDir);
  const db = side(b, linePoint, lineDir);
  const t = da / (da - db);
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

// Splits a convex polygon into [insideRing, outsideRing]. Both share the
// exact same two intersection points by construction - the identical
// floating-point coordinates are what let a later exact-coordinate match (or
// a `polygonDistanceMeters` == 0 check) recognize two siblings as touching.
// Returns null if the line doesn't actually cross the polygon (missed it, or
// only grazed a single vertex).
export function splitConvexPolygon(ring: LocalRing, linePoint: LocalPoint, lineDir: LocalPoint): [LocalRing, LocalRing] | null {
  const inside: LocalRing = [];
  const outside: LocalRing = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const curr = ring[i];
    const next = ring[(i + 1) % n];
    const currSide = side(curr, linePoint, lineDir);
    const nextSide = side(next, linePoint, lineDir);

    if (currSide >= 0) inside.push(curr);
    if (currSide <= 0) outside.push(curr);

    if ((currSide > 0 && nextSide < 0) || (currSide < 0 && nextSide > 0)) {
      const intersection = lineIntersect(curr, next, linePoint, lineDir);
      inside.push(intersection);
      outside.push(intersection);
    }
  }
  const insideD = dedupeRing(inside);
  const outsideD = dedupeRing(outside);
  if (insideD.length < 3 || outsideD.length < 3) return null;
  return [insideD, outsideD];
}

// Same idea, but leaves a small real gap of `gapMeters` between the two
// children instead of an exact shared edge: the "outside" child keeps the
// original cut line, the "inside" child is clipped again at a second line
// shifted further into the inside half-plane by gapMeters. Mode B from the
// spec ("small gap parcels") - meaningfully different distance (> the
// existing TOUCH_EPSILON_M convention) from a clean split, so the app's
// existing TOUCHING/NEARBY distance classification tells them apart without
// any special-casing.
export function splitConvexPolygonWithGap(
  ring: LocalRing,
  linePoint: LocalPoint,
  lineDir: LocalPoint,
  gapMeters: number,
): [LocalRing, LocalRing] | null {
  // Gradient of side() w.r.t. p is (lineDir.y, -lineDir.x) - the direction in
  // which side() increases, i.e. toward "inside".
  const inwardNormal: LocalPoint = [lineDir[1], -lineDir[0]];
  const shiftedPoint: LocalPoint = [linePoint[0] + inwardNormal[0] * gapMeters, linePoint[1] + inwardNormal[1] * gapMeters];

  const atOriginalLine = splitConvexPolygon(ring, linePoint, lineDir);
  const atShiftedLine = splitConvexPolygon(ring, shiftedPoint, lineDir);
  if (!atOriginalLine || !atShiftedLine) return null;

  const outside = atOriginalLine[1];
  const inside = atShiftedLine[0];
  if (inside.length < 3 || outside.length < 3) return null;
  return [inside, outside];
}

// Cuts one corner off a convex polygon (replacing vertex i with two points a
// short distance along its adjacent edges), turning e.g. a quadrilateral
// into a pentagon. Always yields another convex, simple polygon for any
// 0 < t < 0.5. Caller is responsible for only nibbling vertices that aren't
// depended on by a neighbouring parcel's exact boundary match (see
// cluster-generator.ts's coordinate-uniqueness check).
export function nibbleCorner(ring: LocalRing, vertexIndex: number, t: number): LocalRing {
  const n = ring.length;
  const prev = ring[(vertexIndex - 1 + n) % n];
  const curr = ring[vertexIndex];
  const next = ring[(vertexIndex + 1) % n];
  const p1: LocalPoint = [curr[0] + (prev[0] - curr[0]) * t, curr[1] + (prev[1] - curr[1]) * t];
  const p2: LocalPoint = [curr[0] + (next[0] - curr[0]) * t, curr[1] + (next[1] - curr[1]) * t];
  const result = [...ring];
  result.splice(vertexIndex, 1, p1, p2);
  return result;
}

// --- Validation ------------------------------------------------------------
// Every leaf ring is convex by construction (convex envelope + convex
// clipping + convexity-preserving corner nibbles), so self-intersection
// should be structurally impossible - this check is a safety net against a
// future bug in the generation pipeline, not a normal-path failure mode.
function segmentsIntersect(p1: LocalPoint, p2: LocalPoint, p3: LocalPoint, p4: LocalPoint): boolean {
  const orientation = (a: LocalPoint, b: LocalPoint, c: LocalPoint) => {
    const val = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
    if (Math.abs(val) < 1e-9) return 0;
    return val > 0 ? 1 : 2;
  };
  const onSegment = (a: LocalPoint, b: LocalPoint, c: LocalPoint) =>
    Math.min(a[0], c[0]) - 1e-9 <= b[0] && b[0] <= Math.max(a[0], c[0]) + 1e-9 &&
    Math.min(a[1], c[1]) - 1e-9 <= b[1] && b[1] <= Math.max(a[1], c[1]) + 1e-9;

  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p3, p2)) return true;
  if (o2 === 0 && onSegment(p1, p4, p2)) return true;
  if (o3 === 0 && onSegment(p3, p1, p4)) return true;
  if (o4 === 0 && onSegment(p3, p2, p4)) return true;
  return false;
}

export interface RingValidationOptions {
  minAreaSqM: number;
  maxAreaSqM: number;
  minWidthMeters: number;
}

export function validateLocalRing(ring: LocalRing, options: RingValidationOptions): string | null {
  if (ring.length < 3) return `fewer than 3 vertices (${ring.length})`;

  const width = convexPolygonMinWidth(ring);
  if (width < options.minWidthMeters) return `sliver shape - minimum width ${width.toFixed(1)}m is below the ${options.minWidthMeters}m floor`;

  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a1 = ring[i], a2 = ring[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Skip the edge itself and both its immediate neighbours (edge i+1
      // shares ring[i+1] with edge i; edge i-1, i.e. j+1===i via wraparound,
      // shares ring[i]) - adjacent edges always touch at that shared vertex,
      // which isn't a self-intersection.
      if (j === i || j === (i + 1) % n || (j + 1) % n === i) continue;
      const b1 = ring[j], b2 = ring[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return `self-intersecting edges ${i} and ${j}`;
    }
  }

  const area = localArea(ring);
  if (!(area > 0)) return `non-positive area (${area})`;
  if (area < options.minAreaSqM * 0.15) return `area ${area.toFixed(1)}sqm is far below the expected minimum (${options.minAreaSqM}sqm)`;
  if (area > options.maxAreaSqM * 4) return `area ${area.toFixed(1)}sqm is far above the expected maximum (${options.maxAreaSqM}sqm)`;

  return null;
}
