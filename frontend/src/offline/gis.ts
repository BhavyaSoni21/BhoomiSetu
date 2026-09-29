import { db, CachedArea } from './db';
import { currentUserId } from './queue';
import apiService, { apiBase } from '../services/apiService';

// Selective offline GIS (spec §10). "Download area" warms the browser caches
// for a cluster/district's bounds so the map renders offline. We don't invent a
// second tile store: the PWA service worker already caches `/api/tiles/*.pbf`
// (CacheFirst) and `/gis/parcels` (NetworkFirst) - fetching each URL here
// populates those caches, and the map later serves them offline unchanged.
// db.areas just records what's downloaded for the management UI + freshness.

const TILE_LAYERS = ['roads', 'buildings', 'landcover', 'elevation'] as const;
const MAX_TILES = 600; // ponytail: hard cap so a wide bbox can't spawn 10k fetches

type Bounds = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

function lon2tile(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function lat2tile(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

export function tilesForBounds(b: Bounds, minZoom = 11, maxZoom = 14): { z: number; x: number; y: number }[] {
  const [minLng, minLat, maxLng, maxLat] = b;
  const out: { z: number; x: number; y: number }[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const x0 = lon2tile(minLng, z), x1 = lon2tile(maxLng, z);
    const y0 = lat2tile(maxLat, z), y1 = lat2tile(minLat, z); // y inverted
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        out.push({ z, x, y });
        if (out.length >= MAX_TILES) return out;
      }
  }
  return out;
}

// Small concurrency gate so we don't fire hundreds of fetches at once.
async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]).catch(() => {});
  });
  await Promise.all(workers);
}

export interface DownloadProgress { done: number; total: number; }

export async function downloadArea(
  area: { id: string; label: string; bounds: Bounds },
  onProgress?: (p: DownloadProgress) => void,
): Promise<CachedArea> {
  const tiles = tilesForBounds(area.bounds);
  const total = tiles.length + 1; // +1 for the parcels GeoJSON
  let done = 0;
  const tick = () => onProgress?.({ done: ++done, total });

  // Parcels GeoJSON for the bbox (warms the NetworkFirst /api cache + RQ store).
  const bbox = area.bounds.join(',');
  let parcelIds: string[] = [];
  try {
    const r = await apiService.get<{ parcels?: { id?: string }[]; features?: { id?: string }[] }>(
      '/gis/parcels', { params: { bbox, limit: 1000 } },
    );
    const rows = r.data.parcels ?? r.data.features ?? [];
    parcelIds = rows.map((p) => String(p.id)).filter(Boolean);
  } catch { /* offline / server down - area still records what tiles we got */ }
  tick();

  // MVT tiles across all terrain layers. Same absolute URL MapComponent
  // requests (see apiService.apiBase), so the service worker caches under
  // the same key.
  const urls = tiles.flatMap((t) => TILE_LAYERS.map((l) => `${apiBase}/tiles/${l}/${t.z}/${t.x}/${t.y}.pbf`));
  await pool(tiles, 8, async (t) => {
    await Promise.all(TILE_LAYERS.map((l) =>
      fetch(`${apiBase}/tiles/${l}/${t.z}/${t.x}/${t.y}.pbf`, { cache: 'reload' }).catch(() => {})));
    tick();
  });

  const row: CachedArea = {
    id: area.id,
    ownerUserId: currentUserId(),
    label: area.label,
    bounds: area.bounds,
    parcelIds,
    estimatedBytes: urls.length * 20_000, // rough: ~20KB/tile, for the UI only
    cachedAt: Date.now(),
  };
  await db.areas.put(row);
  return row;
}

export function listAreas(): Promise<CachedArea[]> {
  return db.areas.where('ownerUserId').equals(currentUserId()).toArray();
}

// Drops the bookkeeping record. The SW's workbox expiration (maxEntries/maxAge
// in vite.config) reclaims the actual tile bytes - we don't hand-evict Cache
// Storage entry-by-entry. ponytail: precise per-area eviction if quota bites.
export async function deleteArea(id: string): Promise<void> {
  await db.areas.delete(id);
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
}
