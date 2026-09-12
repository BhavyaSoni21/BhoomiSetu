// Topology-aware irregular cadastral-subdivision generator, replacing the
// old shared-jittered-lattice grid (rows x cols, always a distorted square
// grid under the hood). Each cluster gets its own irregular convex envelope
// (an urban-block-shaped footprint, oriented along a per-cluster "dominant
// road angle" no real road layer exists to read, so this is a configured
// stand-in per section 2 of the request), which is then recursively split
// into `parcelCount` irregular leaf polygons - triangles through hexagons,
// varied sizes, mostly exact shared edges with an occasional small gap.
//
// Everything in geometry.ts (and most of this file) works in local meters
// relative to the cluster's center point; conversion to lng/lat happens once
// per leaf, in toGeneratedParcel().

import {
  LocalPoint,
  LocalRing,
  convexHull,
  convexPolygonMinWidth,
  dedupeRing,
  localArea,
  localBounds,
  localCentroid,
  nibbleCorner,
  splitConvexPolygon,
  splitConvexPolygonWithGap,
  validateLocalRing,
} from './geometry';

export type Point = [number, number];
export type Ring = Point[]; // lng/lat, closed (first === last)

export interface ClusterGeometryConfig {
  clusterId: string;
  stateCode: string;
  district: string;
  centerLng: number;
  centerLat: number;
  parcelCount: number;
  /** Degrees, 0 = due east, 90 = due north. Stands in for "local road direction" (§4/§7 of the request - no real road geometry is available to this seed script). */
  dominantAngleDeg: number;
  /** Roughly dominant+90, independently jittered so cross-cuts aren't a perfect right angle - what keeps the subdivision from reading as a grid. */
  secondaryAngleDeg: number;
  /** Candidate point count fed to the convex hull; the hull itself may end up with fewer vertices (some candidates fall inside it). 3-8 gives triangular-through-octagonal irregular envelopes. */
  envelopeSides: number;
  /** Nominal circular-equivalent radius before elongation, in meters. */
  radiusMeters: number;
  /** >1 elongates the envelope along the dominant axis (a block running alongside a road), rather than a circle/blob. */
  aspectRatio: number;
  minParcelAreaSqM: number;
  maxParcelAreaSqM: number;
  /** Fraction of internal splits that get a small real gap instead of an exact shared edge (Mode B, §5). */
  gapProbability: number;
  gapMeters: number;
}

// Four clusters, each with a genuinely different orientation/envelope
// shape/density/gap frequency (§2, §7 of the request) rather than one
// template moved around - satisfies "each cluster must have unique spatial
// characteristics". Parcel counts (100/40/40/20 = 200) and approximate
// average area (~10k-45k sqm, similar order of magnitude to the old
// lattice's ~26-28k sqm parcels) are kept close to the previous dataset so
// the map's zoom/scale doesn't need to change.
export const CLUSTER_CONFIGS: ClusterGeometryConfig[] = [
  {
    clusterId: 'MH-PUNE-01', stateCode: 'MH', district: 'Pune', centerLng: 73.8567, centerLat: 18.5204,
    parcelCount: 100, dominantAngleDeg: 22, secondaryAngleDeg: 118, envelopeSides: 7,
    radiusMeters: 1050, aspectRatio: 1.55, minParcelAreaSqM: 11000, maxParcelAreaSqM: 46000,
    gapProbability: 0.12, gapMeters: 6,
  },
  {
    clusterId: 'TN-CHENNAI-01', stateCode: 'TN', district: 'Chennai', centerLng: 80.2707, centerLat: 13.0827,
    parcelCount: 40, dominantAngleDeg: 97, secondaryAngleDeg: 4, envelopeSides: 5,
    radiusMeters: 680, aspectRatio: 1.35, minParcelAreaSqM: 10000, maxParcelAreaSqM: 40000,
    gapProbability: 0.08, gapMeters: 5,
  },
  {
    clusterId: 'KA-BANGALORE-01', stateCode: 'KA', district: 'Bangalore', centerLng: 77.5946, centerLat: 12.9716,
    parcelCount: 40, dominantAngleDeg: 58, secondaryAngleDeg: 152, envelopeSides: 6,
    radiusMeters: 680, aspectRatio: 1.7, minParcelAreaSqM: 9000, maxParcelAreaSqM: 42000,
    gapProbability: 0.16, gapMeters: 7,
  },
  {
    clusterId: 'DL-NEWDELHI-01', stateCode: 'DL', district: 'New Delhi', centerLng: 77.209, centerLat: 28.6139,
    parcelCount: 20, dominantAngleDeg: -18, secondaryAngleDeg: 71, envelopeSides: 4,
    radiusMeters: 480, aspectRatio: 1.2, minParcelAreaSqM: 12000, maxParcelAreaSqM: 44000,
    gapProbability: 0.1, gapMeters: 5,
  },
  // Chandigarh: one of the two real pilot locations named in the fuller
  // "Land Stack" PS text (launched 2025-12-31), previously absent from the
  // seed dataset entirely (docs/FEATURE_AUDIT.md §1a/§8 item 19) - the
  // other, Tamil Nadu, was already represented by the Chennai cluster above.
  {
    clusterId: 'CH-CHANDIGARH-01', stateCode: 'CH', district: 'Chandigarh', centerLng: 76.7794, centerLat: 30.7333,
    parcelCount: 20, dominantAngleDeg: 45, secondaryAngleDeg: 135, envelopeSides: 4,
    radiusMeters: 460, aspectRatio: 1.05, minParcelAreaSqM: 10000, maxParcelAreaSqM: 38000,
    gapProbability: 0.1, gapMeters: 5,
  },
];

export interface GeneratedParcel {
  ring: Ring; // lng/lat, closed
  areaSqM: number;
  centroid: Point; // lng/lat
}

function metersPerDegree(refLat: number): { lat: number; lng: number } {
  return { lat: 110540, lng: 111320 * Math.cos((refLat * Math.PI) / 180) };
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// STEP 1+2: an irregular convex envelope standing in for "the urban block
// bounded by nearby roads" (§3). Built from jittered points around an
// ellipse elongated along dominantAngleDeg, then hulled - the hull
// guarantees convexity (and therefore guarantees every subsequent leaf
// polygon is simple/non-self-intersecting) regardless of how much the
// jitter perturbs individual points.
function buildEnvelope(config: ClusterGeometryConfig): LocalRing {
  const dominantRad = degToRad(config.dominantAngleDeg);
  const rx = config.radiusMeters * Math.sqrt(config.aspectRatio);
  const ry = config.radiusMeters / Math.sqrt(config.aspectRatio);
  const candidateCount = Math.max(config.envelopeSides, 6) + 2;

  const candidates: LocalPoint[] = [];
  for (let k = 0; k < candidateCount; k++) {
    const theta = (k / candidateCount) * 2 * Math.PI + (Math.random() - 0.5) * ((2 * Math.PI) / candidateCount) * 0.6;
    const radialJitter = 0.72 + Math.random() * 0.45; // 0.72x-1.17x
    const localX = Math.cos(theta) * rx * radialJitter;
    const localY = Math.sin(theta) * ry * radialJitter;
    // Rotate so the ellipse's long axis aligns with the dominant angle.
    const x = localX * Math.cos(dominantRad) - localY * Math.sin(dominantRad);
    const y = localX * Math.sin(dominantRad) + localY * Math.cos(dominantRad);
    candidates.push([x, y]);
  }
  return convexHull(candidates);
}

// Neither child of a split may end up smaller than this fraction of the
// parent's area, NOR narrower than MIN_PARCEL_WIDTH_METERS in its thinnest
// direction - area alone doesn't rule out slivers (a long-enough thin strip
// can have perfectly "reasonable" area). Attempts a handful of randomized
// (angle, offset) combinations, narrowing the offset range each time, before
// falling back to a plain centroid bisection - which, for any convex
// polygon, is always valid and reasonably balanced, though not guaranteed to
// clear the width floor for a pathologically thin parent (rare enough in
// practice that generateClusterParcels' whole-cluster retry is the backstop
// for that case rather than an even-further fallback here).
const MIN_SPLIT_RATIO = 0.22;
const MIN_PARCEL_WIDTH_METERS = 22;
const MAX_SPLIT_ATTEMPTS = 14;

// A flat width floor alone still allows a technically-valid but visually
// "ribbon-like" parcel (narrow and very long, since a long-enough sliver can
// have perfectly reasonable area). Bounding width against sqrt(area) instead
// bounds the aspect ratio directly regardless of the parcel's absolute
// scale: MIN_COMPACTNESS=0.42 caps the long:short side ratio at roughly 6:1
// for a rectangle-like shape, which still allows genuinely narrow corner/
// leftover lots (real subdivisions have some) without letting elongated
// ribbons dominate the cluster's look.
const MIN_COMPACTNESS = 0.42;

function isReasonablyCompact(ring: LocalRing): boolean {
  const width = convexPolygonMinWidth(ring);
  if (width < MIN_PARCEL_WIDTH_METERS) return false;
  return width >= MIN_COMPACTNESS * Math.sqrt(localArea(ring));
}

function splitBalanced(target: LocalRing, config: ClusterGeometryConfig): [LocalRing, LocalRing] {
  const targetArea = localArea(target);
  const centroid = localCentroid(target);
  const bounds = localBounds(target);
  const extent = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

  for (let attempt = 0; attempt < MAX_SPLIT_ATTEMPTS; attempt++) {
    const useSecondaryAxis = Math.random() < 0.4;
    const baseAngle = useSecondaryAxis ? config.secondaryAngleDeg : config.dominantAngleDeg;
    const angleRad = degToRad(baseAngle + (Math.random() - 0.5) * 24);
    const dir: LocalPoint = [Math.cos(angleRad), Math.sin(angleRad)];
    const normal: LocalPoint = [-dir[1], dir[0]];

    // Shrink the allowed offset range on later attempts, converging toward
    // a centered (well-balanced) cut if the earlier wider attempts all
    // produced too lopsided a split.
    const maxOffsetFrac = 0.26 * (1 - attempt / MAX_SPLIT_ATTEMPTS);
    const offsetFrac = (Math.random() * 2 - 1) * maxOffsetFrac;
    const linePoint: LocalPoint = [centroid[0] + normal[0] * extent * offsetFrac, centroid[1] + normal[1] * extent * offsetFrac];

    const useGap = Math.random() < config.gapProbability;
    const children = useGap
      ? splitConvexPolygonWithGap(target, linePoint, dir, config.gapMeters)
      : splitConvexPolygon(target, linePoint, dir);
    if (!children) continue;

    const minRatio = Math.min(localArea(children[0]), localArea(children[1])) / targetArea;
    if (minRatio < MIN_SPLIT_RATIO) continue;
    if (!children.every(isReasonablyCompact)) continue;
    return children;
  }

  // A line through the true centroid of a convex polygon always crosses its
  // boundary exactly twice, so this is guaranteed to succeed (though, as
  // noted above, not guaranteed to clear the width floor - the whole-cluster
  // retry in generateClusterParcels is what backstops that rare case).
  const angleRad = degToRad(config.dominantAngleDeg);
  const fallback = splitConvexPolygon(target, centroid, [Math.cos(angleRad), Math.sin(angleRad)]);
  if (!fallback) throw new Error(`parcel-generation: failed to split a polygon in cluster ${config.clusterId} even via the centroid fallback`);
  return fallback;
}

// STEP 3+4: recursively split the envelope into exactly parcelCount leaf
// polygons. Always splits the current-largest piece (a greedy balanced
// space partition) - this alone produces natural size variance (pieces
// split earlier/more often end up smaller) without needing to hand-author a
// size distribution. Cuts alternate between the dominant and secondary
// orientation (each independently angle-jittered) so the result reads as
// "two crossing street grains locally", never a single uniform grid.
function subdivideEnvelope(envelope: LocalRing, config: ClusterGeometryConfig): LocalRing[] {
  const pending: LocalRing[] = [envelope];

  while (pending.length < config.parcelCount) {
    let targetIndex = 0;
    let bestArea = -1;
    for (let i = 0; i < pending.length; i++) {
      const a = localArea(pending[i]);
      if (a > bestArea) { bestArea = a; targetIndex = i; }
    }

    const children = splitBalanced(pending[targetIndex], config);
    pending.splice(targetIndex, 1, children[0], children[1]);
  }

  return pending;
}

const NIBBLE_PROBABILITY = 0.35;

// STEP 4 (vertex variety): cuts one corner off a random subset of leaves,
// turning some quadrilaterals into pentagons/hexagons (and some triangles
// into quadrilaterals). Only ever targets a vertex whose coordinate isn't
// used by any other leaf in the cluster - since an exact shared boundary
// depends on both sides having byte-identical coordinates, this guarantees
// nibbling can never silently turn an intended TOUCHING edge into a gap or
// overlap.
function applyCornerNibbles(leaves: LocalRing[]): LocalRing[] {
  const keyOf = (p: LocalPoint) => `${p[0].toFixed(2)}:${p[1].toFixed(2)}`; // 1cm precision in local meters
  const usageCount = new Map<string, number>();
  for (const ring of leaves) {
    for (const p of ring) {
      const k = keyOf(p);
      usageCount.set(k, (usageCount.get(k) ?? 0) + 1);
    }
  }

  return leaves.map((ring) => {
    if (Math.random() > NIBBLE_PROBABILITY) return ring;
    const safeIndices = ring.map((_, i) => i).filter((i) => (usageCount.get(keyOf(ring[i])) ?? 0) === 1);
    if (safeIndices.length === 0) return ring;
    const vertexIndex = safeIndices[Math.floor(Math.random() * safeIndices.length)];
    const t = 0.15 + Math.random() * 0.15; // shave 15%-30% off each adjacent edge
    const nibbled = dedupeRing(nibbleCorner(ring, vertexIndex, t));
    // A corner nibble can't create a sliver in the general case, but skip it
    // anyway if it would somehow push this specific (already-thin-ish) leaf
    // below the compactness bar, rather than risk it.
    return isReasonablyCompact(nibbled) ? nibbled : ring;
  });
}

function toGeneratedParcel(localRing: LocalRing, config: ClusterGeometryConfig): GeneratedParcel {
  const areaSqM = localArea(localRing);
  const { lat: mPerLat, lng: mPerLng } = metersPerDegree(config.centerLat);
  const lngLatRing: Point[] = localRing.map(([x, y]) => [config.centerLng + x / mPerLng, config.centerLat + y / mPerLat]);
  const closed: Ring = [...lngLatRing, lngLatRing[0]];
  const centroid: Point = closed.slice(0, -1).reduce<Point>(
    (acc, [lng, lat], _i, arr) => [acc[0] + lng / arr.length, acc[1] + lat / arr.length],
    [0, 0],
  );
  return { ring: closed, areaSqM, centroid };
}

const MAX_CLUSTER_ATTEMPTS = 5;

function attemptGenerateClusterParcels(config: ClusterGeometryConfig): GeneratedParcel[] {
  const envelope = buildEnvelope(config);
  const leaves = subdivideEnvelope(envelope, config);
  const nibbled = applyCornerNibbles(leaves);

  for (let i = 0; i < nibbled.length; i++) {
    const problem = validateLocalRing(nibbled[i], {
      minAreaSqM: config.minParcelAreaSqM,
      maxAreaSqM: config.maxParcelAreaSqM,
      minWidthMeters: MIN_PARCEL_WIDTH_METERS,
    });
    if (problem) throw new Error(`invalid parcel #${i} in cluster ${config.clusterId}: ${problem}`);
    if (!isReasonablyCompact(nibbled[i])) throw new Error(`invalid parcel #${i} in cluster ${config.clusterId}: too elongated (ribbon-like) relative to its area`);
  }

  return nibbled.map((ring) => toGeneratedParcel(ring, config));
}

// Full pipeline for one cluster (§16's "Cluster -> envelope -> subdivision ->
// parcels -> validate" flow). `splitBalanced`'s ratio guard makes a sliver
// parcel very unlikely, but every step here involves randomness, so this
// retries the *entire* cluster (a fresh envelope and subdivision, not just
// the one offending split) a bounded number of times before genuinely
// failing - regenerating is cheap (a few hundred ms at most) and simpler
// than trying to patch a single bad leaf after the fact.
export function generateClusterParcels(config: ClusterGeometryConfig): GeneratedParcel[] {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_CLUSTER_ATTEMPTS; attempt++) {
    try {
      return attemptGenerateClusterParcels(config);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`parcel-generation: cluster ${config.clusterId} failed validation ${MAX_CLUSTER_ATTEMPTS} times in a row: ${(lastError as Error)?.message}`);
}
