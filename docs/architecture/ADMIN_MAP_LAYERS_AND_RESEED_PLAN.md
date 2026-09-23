# Admin Combined Map — Layout, Layer Visibility, Edit Authorization & Reseed Plan

**Status:** PLAN ONLY — nothing here is implemented yet.
**Scope:** the Admin "Map Layer Authoring → Combined View" (`/admin/map-layers`), the shared `UnifiedMapWrapper`/`MapComponent`, layer edit authorization across roles, and a cluster re-seed that gives roads thickness-by-type and derives parcels from road blocks.
**Related:** `docs/architecture/NEW_MAP_LAYERS_PLAN.md` (the 6 attribute layers), `docs/architecture/navbar_refactor_checklist.md` (Phase 13 `/admin/map-layers`, Phase 14 separate-nav-from-authz, Phase 19 preserve-Unified-Map). Those stay separate; this doc owns the map card + authorization + reseed work.

---

## A. Map overflows its card ("getting out of the zone") — card larger than map

**Symptom (image.png):** the MapLibre canvas + controls spill past the green bordered card on `/admin/map-layers`.

**Root cause:** `AdminCombinedLayerMap.tsx` wraps the map in `relative w-full border-2 sm:border-4 border-ink` with **no `overflow-hidden`**. `UnifiedMapWrapper` renders a fixed `h-[500px]` flex column, and MapLibre's canvas + navigation control + attribution render at the canvas edge; without a clipping context on the bordered box they visually cross the border. The decorative legend box (`AdminCombinedLayerMap.tsx:29`) is a *second* static legend layered on top of the real one — dead weight and part of the clutter.

**Fix (CSS only, no map re-impl — honors navbar Phase 19):**
1. Add `overflow-hidden` to the bordered wrapper (`AdminCombinedLayerMap.tsx:18`).
2. Give the card a padding frame so the card is visibly larger than the map: wrap the map in `p-2 sm:p-3` inside the border, or let the border sit on the outer card and the map fill an inner `rounded`/inset area. Bump the map height knob (`height="h-[500px]"`) to a responsive `h-[60vh] min-h-[420px]` so it fills the enlarged card without overflowing.
3. Delete the redundant static legend box (`AdminCombinedLayerMap.tsx:29-39`) — `UnifiedMapWrapper`'s own layer panel already lists layers with working checkboxes; the static one duplicates it and never reflects state.

**Self-check:** render `/admin/map-layers`, confirm the canvas + zoom control + attribution are all inside the border at mobile (375px) and desktop widths, no horizontal scroll.

---

## B. Layers not visible to the admin

**Symptom:** on `/admin/map-layers` the layer toggles show but toggling them paints nothing; roads/buildings never appear.

**Root cause (two independent gaps):**
1. `AdminCombinedLayerMap.tsx:20` passes `parcels={[]}` and selects no parcel/cluster. In `UnifiedMapWrapper`, `districtContext` is derived **only** from `parcelsProp[0]` (`UnifiedMapWrapper.tsx:239-246`); an empty array → `districtContext = null` → the zoning / restriction / infrastructure / change-detection queries are all `enabled: !!districtContext` = **false** (`:255,264,273,282`) and never fetch. Admin-notes additionally needs `isAdmin` (true here) **and** a district/parcels context (`:292`) — also false. So four overlays have no data and admin-notes never loads.
2. Roads / buildings / landcover / elevation are MVT vector-tile layers (`layerHasData` = `true` unconditionally, `:308-311`) but they are **off in `DEFAULT_LAYER_VISIBILITY`** and only render inside `MapComponent` when their key is both in `visibleLayerKeys` and toggled on. On first load nothing is toggled → blank.

**Fix:**
1. **Give the combined admin map a real spatial scope.** It is a nationwide authoring map, so scope overlays by the map's current viewport bbox instead of a single parcel's district. Two options:
   - *Lazy (preferred):* let the combined map fetch overlays unscoped (nationwide) the way `MapLayerManagement` already does against the same `/gis/*` endpoints, by passing a `fetchOverlaysUnscoped`/`nationwide` flag into `UnifiedMapWrapper` that flips the four queries' `enabled` to `true` and drops the `state/district` params. The GIS read endpoints already accept no-param calls (they're public, per backend).
   - *Scalable:* switch overlay rendering to the versioned MVT tile path (`NEW_MAP_LAYERS_PLAN.md` rule 1/5) so the viewport, not a district string, drives what loads — better at national zoom, and consistent with roads/buildings which are already tiles.
2. **Default the terrain/OSM tile layers ON for the admin combined map** (or auto-enable the keys listed in `ADMIN_COMBINED_VISIBLE_LAYERS`, `AdminCombinedLayerMap.tsx:10`) so roads + buildings show immediately — this is also exactly the user's "show the OSM roads and buildings we stored" ask (see §D.3).
3. Confirm in `MapComponent` that `roads`/`buildings` keys actually add the `/tiles/roads` and `/tiles/buildings` MVT source+layer (backend `map_tiles.py:61,121`, public). If a key is in the union but has no source wiring, add it — the tiles exist server-side.

**Self-check:** load `/admin/map-layers` as ADMIN with a seeded DB; roads + buildings render at open; toggling Zoning/Restriction/Infrastructure/ChangeDetection/AdminNotes paints features somewhere in India.

---

## C. All layers visible to everyone; edit gated by role + department

Two separate axes — keep them separate (navbar Phase 14: hiding a control ≠ denying the action; backend enforces).

### C.1 Visibility — everyone sees every layer (read-only)
- **Today:** GIS reads (`/gis/zoning-overlays`, `/restriction-zones`, `/infrastructure`, `/change-detection-events`) are already public; only `/gis/admin-notes` read is ADMIN-only. On the frontend, citizens are restricted to `visibleLayerKeys={['zoning']}` (Parcel360View non-historical branch).
- **Change:** drop the citizen `['zoning']` restriction so every role gets the full legend (leave `adminNotes` gated — it's genuinely admin-only server-side and 403s for others, `UnifiedMapWrapper.tsx:170,292`). This **overrides** the earlier "citizens see only Zoning" decision — call it out in the PR; update `frontend_test_i18n_drift`-adjacent tests (`Parcel360View.test.tsx` citizen-layer-keys assertion) to the new policy.
- **Result:** viewing is universal; editing is not (below).

### C.2 Edit authorization — layer ownership matrix
Only ADMIN + the owning officer department may write a given layer. Proposed ownership:

| Layer (endpoint) | Owning officer role/dept | Admin |
|---|---|---|
| Zoning Overlays (`/gis/zoning-overlays`) | `PLANNING_OFFICER` | edit + monitor |
| Restriction Zones (`/gis/restriction-zones`) | `RESTRICTION_OFFICER` | edit + monitor |
| Infrastructure (`/gis/infrastructure`) | `SURVEY_OFFICER` (or Planning — confirm) | edit + monitor |
| Change Detection (`/gis/change-detection-events`) | `SURVEY_OFFICER` / `DISPUTE_OFFICER` | edit + monitor |
| Admin Notes (`/gis/admin-notes`) | — (admin only) | edit + monitor |
| Master Plan Mismatch (proposed use on zoning) | `PLANNING_OFFICER` | edit + monitor |

> Confirm the exact role↔layer mapping against `docs/bhoomisetu_officer_roles.md` before wiring — the table above is the proposal, not settled.

**Backend (the real enforcement point):**
- Today every write is `Depends(require_roles("ADMIN"))` (`app/routers/spatial.py`). Change each layer's POST/PATCH/DELETE to `require_roles("ADMIN", "<owning role>")`, and for the officer case also check the officer's own department matches the layer (and optionally that `stateCode`/`district` is within their jurisdiction) — an authorization guard in the write path, not per-caller.
- Keep it one shared dependency (e.g. `require_layer_editor(layer_key)`) rather than duplicating the role list at every endpoint.

**Frontend (surfacing, not enforcing):**
- `MapLayerManagement.tsx` is already config-driven (`LayerTypeConfig`), and admin authoring mounts one tab per layer. Reuse it: expose the authoring UI to owning officers too, filtered to *their* layer(s) — a Planning officer sees only the Zoning tab, a Restriction officer only the Restriction tab; admin sees all. This is a nav/route exposure change (navbar Phase 8/9 dynamic officer tools), driven by the same ownership matrix.
- The map itself never gains drawing for non-editors — the drawing tool stays inside the authoring screen (`LayerGeometryDrawMap`), exactly as today.

**Self-check:** a Planning officer can PATCH a zoning overlay but a Tax officer gets 403 on the same call; both (and a citizen) can GET/see it on the map.

---

## D. Reseed: road thickness by type, parcels from road blocks, render OSM roads/buildings

### D.0 What exists today (from backend inventory)
- Parcels are **not** random and **not** currently built from road boundaries. `app/common/parcel_generation/cluster_generator.py` builds an irregular envelope → recursively subdivides into `parcel_count` leaves → nibbles corners → converts to lng/lat → **snaps vertices to nearby OSM roads** (`_snap_parcels_to_roads`). Road *bearings* already orient the envelope (`resolve_road_angles`).
- Roads: `RoadNetwork` (`app/models/terrain.py:17`) — has `road_type` (HIGHWAY/PRIMARY/…/TRACK) and full `osm_tags` JSON, **no width column**. Imported by `scripts/extract_osm_roads.py` from Geofabrik PBFs. Served as MVT by `map_tiles.py:61` (public).
- Buildings: `BuildingFootprint` (`terrain.py:40`), served by `map_tiles.py:121` (public).

### D.1 Road thickness by type — two meanings, do the cheap one first
- **Rendering thickness (do this, no reseed):** style road width in MapLibre with a `road_type`-keyed `line-width` expression (e.g. HIGHWAY 6 → PRIMARY 4 → SECONDARY 3 → RESIDENTIAL 2 → SERVICE/TRACK 1), zoom-interpolated. Pure frontend/tile-style change in `MapComponent`'s roads layer paint; `road_type` is already in the tile (`map_tiles.py:84`). This alone makes roads read as "thick by type."
- **Geometric width (only if parcels-from-roads needs it):** a per-type width lookup in meters (`ROAD_WIDTH_M = {HIGHWAY: 20, PRIMARY: 15, SECONDARY: 10, ...}`). Used to buffer road LINESTRINGs into polygons for block-cutting (D.2). Keep it as a config dict, not a new DB column, unless a later feature needs to query it.

### D.2 Parcels from the outer boundary of roads (blocks → random polygons)
New generation mode in `cluster_generator.py` (keep the existing snap mode; add this as an alternative, gated per cluster config):
1. For a cluster's bbox, load `RoadNetwork` LINESTRINGs.
2. Buffer each road by half its `ROAD_WIDTH_M[road_type]` (PostGIS `ST_Buffer` in a metric CRS, e.g. 3857 or a local UTM) → union → the road polygons.
3. `ST_Difference(cluster_envelope, road_union)` → the leftover **blocks** (the land between roads). Each block's outer boundary is the road edge — this is "parcels from the outer boundary of the road."
4. Subdivide each block into random polygons (reuse the existing `_subdivide_envelope`/`_split_balanced` on each block instead of one global envelope) so parcels stay irregular/random as requested.
5. Reuse the rest of the pipeline (validate, to-lng/lat, neighbour computation, historical states).

> `ponytail:` this is real geometry work with an accuracy ceiling — buffered-road blocks approximate cadastral blocks, they aren't survey-accurate. Fine for demo/seed; note it in the generator. Guard against empty/degenerate blocks (road union covering the whole envelope) with a fallback to the current snap mode.

**Self-check:** a small unit test on one cluster config: assert every generated parcel is inside a block (disjoint from the buffered road union) and parcels don't overlap roads.

### D.3 Show stored OSM roads + buildings on the admin map
Largely the same work as §B.2 — the `roads` and `buildings` MVT layers already exist and are public; the admin combined map just needs them enabled by default and confirmed wired in `MapComponent`. No new endpoint. If the roads layer should read as thick-by-type there too, D.1's paint expression covers it everywhere the roads layer renders.

---

## E. What else to change / reconstruct (recommendations)

1. **Fix the SRID-0 test, don't touch seeding.** `tests/legacy/test_mvt_tiles.py` errors on `ST_Transform(ST_Extent(geometry),3857)` — `ST_Extent` returns a `box2d` with SRID 0. No insert path is wrong (every parcel write sets `srid=4326`). Fix in the test: `ST_Transform(ST_SetSRID(ST_Extent(geometry),4326),3857)`. Cheap, unblocks the `--ignore`'d file.
2. **Kill the duplicate static legend** in `AdminCombinedLayerMap` (see §A.3) — one legend, the interactive one.
3. **`districtContext` from a single parcel is fragile** (`UnifiedMapWrapper.tsx:239`). Any nationwide/multi-district map (admin combined, cluster overview) can't scope overlays this way. Move overlay scoping to viewport bbox (or MVT tiles) — this is the general fix that §B.1 is a special case of.
4. **Layer authorization belongs in one matrix** (§C.2) consumed by both backend guards and frontend nav — don't hardcode role lists in two places. This is the same "separate nav from authz" the navbar refactor Phase 14 calls for; build it once.
5. **Consider promoting the GIS overlays to versioned MVT tiles** (`NEW_MAP_LAYERS_PLAN.md` rules 1/5/6) if the admin map is expected to show them nationwide — GeoJSON-per-viewport won't scale to all-India zoom.
6. **Road width as data, not just style:** if officers will ever query/report by road width or use it in analytics, promote `ROAD_WIDTH_M` into a real (nullable) `width_m` column on `RoadNetwork` populated at import from `osm_tags` (lanes/width) with the per-type fallback. Skip until a feature needs it (YAGNI).

---

## F. Build order & constraints

1. §A (card/overflow) + §B.2 default-on roads/buildings — pure frontend, immediate visible win.
2. §B.1 overlay scoping (nationwide/bbox) — unblocks admin layer visibility.
3. §C.1 universal visibility + §C.2 backend edit guards + officer authoring exposure.
4. §D.1 render thickness (frontend) — cheap.
5. §D.2 parcels-from-roads generation mode + reseed — largest/riskiest; do last, behind a per-cluster flag so existing clusters aren't disturbed until validated.
6. §E.1 SRID test fix — anytime.

**Constraints:** no new map implementation — everything routes through `UnifiedMapWrapper`/`MapComponent` (navbar Phase 19). Backend is PostGIS (no SQLite). Reseed is destructive (`seed.py` clears spatial tables) — gate behind explicit confirmation and run only on demand, never in CI. Keep the current snap-mode generator working as fallback. Preserve the ≥323 frontend / dept+verifier backend test baselines; update only the tests whose spec actually changes (citizen layer-keys, any admin-map assertions).

