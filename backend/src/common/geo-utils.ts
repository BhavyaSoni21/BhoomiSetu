// Minimal planar-approximation spatial helpers. SQLite has no PostGIS, so
// "touching"/"nearby" here is computed in application code on a local
// equirectangular projection - accurate enough for parcels a few hundred
// metres apart. Written so the call sites (ParcelsService.getNeighbours,
// polygon area in seed.ts) read the same way a future ST_Touches/ST_DWithin
// migration would: distance in, relationship out.

export type Ring = [number, number][];
export type Bounds = [number, number, number, number]; // minLng, minLat, maxLng, maxLat

export function parseGeometry(geometryText: string): any {
  return JSON.parse(geometryText);
}

// First ring of a Polygon, or the first polygon's first ring of a
// MultiPolygon - good enough for the simple shapes this app generates.
export function outerRing(geometry: any): Ring | null {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') return geometry.coordinates[0];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates[0]?.[0] ?? null;
  return null;
}

export function ringCentroid(ring: Ring): [number, number] {
  const pts = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  const lng = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
  const lat = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
  return [lng, lat];
}

export function ringBounds(ring: Ring): Bounds {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

export function combineBounds(boundsList: Bounds[]): Bounds | null {
  if (boundsList.length === 0) return null;
  return boundsList.reduce<Bounds>(
    (acc, [minLng, minLat, maxLng, maxLat]) => [
      Math.min(acc[0], minLng),
      Math.min(acc[1], minLat),
      Math.max(acc[2], maxLng),
      Math.max(acc[3], maxLat),
    ],
    boundsList[0],
  );
}

function metersPerDegree(refLat: number): { lat: number; lng: number } {
  return { lat: 110540, lng: 111320 * Math.cos((refLat * Math.PI) / 180) };
}

function toLocalMeters(ring: Ring, refLat: number): Ring {
  const { lat, lng } = metersPerDegree(refLat);
  return ring.map(([x, y]) => [x * lng, y * lat]);
}

function pointSegmentDistance(p: [number, number], a: [number, number], b: [number, number]): number {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b;
  const dx = bx - ax, dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function orientation(a: [number, number], b: [number, number], c: [number, number]): number {
  const val = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(val) < 1e-9) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(a: [number, number], b: [number, number], c: [number, number]): boolean {
  return (
    Math.min(a[0], c[0]) - 1e-9 <= b[0] && b[0] <= Math.max(a[0], c[0]) + 1e-9 &&
    Math.min(a[1], c[1]) - 1e-9 <= b[1] && b[1] <= Math.max(a[1], c[1]) + 1e-9
  );
}

export function segmentsIntersect(p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number]): boolean {
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

function segmentDistance(a1: [number, number], a2: [number, number], b1: [number, number], b2: [number, number]): number {
  if (segmentsIntersect(a1, a2, b1, b2)) return 0;
  return Math.min(
    pointSegmentDistance(a1, b1, b2),
    pointSegmentDistance(a2, b1, b2),
    pointSegmentDistance(b1, a1, a2),
    pointSegmentDistance(b2, a1, a2),
  );
}

export function pointInRing([x, y]: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Shortest distance in metres between two polygon rings (edge-to-edge,
// accounting for containment/overlap as 0), projected locally around refLat.
export function polygonDistanceMeters(ringA: Ring, ringB: Ring, refLat: number): number {
  const A = toLocalMeters(ringA, refLat);
  const B = toLocalMeters(ringB, refLat);

  if (pointInRing(A[0], B) || pointInRing(B[0], A)) return 0;

  let min = Infinity;
  for (let i = 0; i < A.length - 1; i++) {
    for (let j = 0; j < B.length - 1; j++) {
      const d = segmentDistance(A[i], A[i + 1], B[j], B[j + 1]);
      if (d < min) min = d;
      if (min === 0) return 0;
    }
  }
  return min;
}
