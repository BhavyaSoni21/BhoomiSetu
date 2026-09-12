import sharp from 'sharp';
import { Ring } from './cluster-generator';
import { CATEGORY_COLORS, ParcelCategory } from './parcel-category';

// Historical parcel-imagery comparison (docs/FRONTEND_UPGRADE_SPEC.md §8) -
// "simplified server-rendered polygons, confirmed by the user" rather than a
// live headless-browser map screenshot: each cluster's real, already-saved
// parcel boundaries (lng/lat) rendered as a flat SVG of colored polygons,
// then rasterized via `sharp` (already a backend dependency, already used
// this way by ChangeDetectionService). Every year for a given cluster uses
// the identical bounding box, computed once from the cluster's own parcels -
// the deliberate simplification that avoids needing any image-registration/
// alignment step before comparing two years (docs/FRONTEND_UPGRADE_SPEC.md
// §8: "the key simplification").
export const SNAPSHOT_SIZE = 512;
const STROKE = '#1f2417';

export interface ClusterBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export function computeClusterBounds(rings: Ring[]): ClusterBounds {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  // A small margin so edge parcels aren't clipped flush against the image
  // border - purely cosmetic, doesn't affect the bounds stored/used for
  // pixel<->geo mapping (that math accounts for the same margin, see
  // projectRing below).
  const marginFrac = 0.04;
  const lngPad = (maxLng - minLng) * marginFrac || 0.001;
  const latPad = (maxLat - minLat) * marginFrac || 0.001;
  return { minLng: minLng - lngPad, minLat: minLat - latPad, maxLng: maxLng + lngPad, maxLat: maxLat + latPad };
}

function projectRing(ring: Ring, bounds: ClusterBounds, size: number): string {
  const { minLng, minLat, maxLng, maxLat } = bounds;
  const points = ring.map(([lng, lat]) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * size;
    // Image y grows downward; latitude grows upward - flip.
    const y = ((maxLat - lat) / (maxLat - minLat)) * size;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return points.join(' ');
}

// `categories[i]` is the real, data-driven ParcelCategory (see
// parcel-category.ts) for `rings[i]` in this particular year's render - the
// same function HistoricalComparisonService uses to decide which parcels
// changed between two years, so the rendered color and the "what's
// different" detection can never disagree (2026-09-08 redesign: this
// replaces the old randomly-"changed" pixel set - no more synthetic visual
// noise standing in for a real cause).
export async function renderClusterSnapshot(rings: Ring[], bounds: ClusterBounds, categories: ParcelCategory[]): Promise<Buffer> {
  const polygons = rings
    .map((ring, i) => {
      const fill = CATEGORY_COLORS[categories[i]] ?? CATEGORY_COLORS.NONE;
      return `<polygon points="${projectRing(ring, bounds, SNAPSHOT_SIZE)}" fill="${fill}" stroke="${STROKE}" stroke-width="1.5" />`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SNAPSHOT_SIZE}" height="${SNAPSHOT_SIZE}">` +
    `<rect width="100%" height="100%" fill="#f4f1ea" />${polygons}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
