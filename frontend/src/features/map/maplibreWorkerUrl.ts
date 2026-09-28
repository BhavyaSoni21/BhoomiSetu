import { setWorkerUrl } from 'maplibre-gl';
// maplibre-gl v6 no longer ships the self-contained classic CSP worker
// (dist/maplibre-gl-csp-worker.js is gone). The worker is now
// dist/maplibre-gl-worker.mjs, an ES module that `import`s a sibling
// maplibre-gl-shared.mjs chunk, and maplibre loads it as a module worker.
//
// Under Vite this MUST be imported with `?worker&url` (not plain `?url`):
// `?worker&url` routes it through Vite's worker pipeline, which bundles in
// that shared.mjs dependency and emits a module worker URL. A plain `?url`
// would serve the raw .mjs verbatim, and its first `import ./shared.mjs`
// would 404 at runtime.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// KNOWN_RISKS.md CRIT-1 (maplibre-gl 4 -> 6 upgrade): as of v5/v6 maplibre
// no longer auto-detects its own worker script URL inside a bundler's module
// graph, so every bundler consumer must point it at the worker explicitly,
// once, before the first Map is constructed. Without this, every GeoJSON
// vector layer (parcels, zoning, restriction, infrastructure, cluster
// layers, the admin draw tool) silently never finishes tiling - nothing
// throws, the raster basemap renders fine, isSourceLoaded() just never
// becomes true.
//
// Imported once for this side effect by every file that constructs a
// maplibregl.Map (MapComponent.tsx, LayerGeometryDrawMap.tsx,
// AdminCombinedLayerMap.tsx); repeat calls with the same URL are harmless.
setWorkerUrl(workerUrl);
