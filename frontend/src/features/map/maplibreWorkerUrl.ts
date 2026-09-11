import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// KNOWN_RISKS.md CRIT-1 (maplibre-gl 4.7.1 -> 6.9.0 upgrade): as of v5/v6,
// maplibre-gl no longer reliably auto-detects its own worker script's URL
// inside a bundler's module graph (import.meta.url doesn't resolve there the
// way it does for a plain <script> tag) - every bundler consumer must point
// it at the worker explicitly, once, before the first Map is constructed.
//
// Without this, every GeoJSON vector layer this app draws - parcels,
// zoning, restriction, infrastructure, the selected/adjacent/nearby/cluster
// layers, the admin draw tool - silently never finishes loading. Nothing
// throws, nothing logs to the console; the raster basemap and controls
// render fine, `Map.isSourceLoaded()` just never becomes true, so it reads
// as "the map works" until someone notices no parcels are actually drawn.
// Confirmed live (real browser, real backend data) while verifying this
// upgrade - `queryRenderedFeatures()` returned zero results with no error.
//
// `?worker&url` (not plain `?url`) is required specifically under Vite: the
// worker bundle imports a sibling maplibre-gl-shared.mjs chunk that a plain
// `?url` import doesn't bring along, so the worker fails on its first
// `import` once actually running - `?worker&url` routes it through Vite's
// own worker pipeline instead, which inlines that dependency.
//
// Imported once, for this side effect, by every file that constructs a
// maplibregl.Map (MapComponent.tsx, LayerGeometryDrawMap.tsx,
// AdminCombinedLayerMap.tsx) - calling setWorkerUrl more than once with the
// same URL is harmless, so no extra "did this already run" guard is needed.
setWorkerUrl(workerUrl);
