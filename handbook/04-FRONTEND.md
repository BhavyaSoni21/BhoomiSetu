# 04 — Frontend (`frontend/`)

GIS-based land-governance SPA. Root: `frontend/`.

## Stack

| Concern | Technology |
|---------|------------|
| Framework | React 18.2 + TypeScript 5 |
| Build | Vite 4.4 (`@vitejs/plugin-react`) |
| Styling | Tailwind CSS 3.3 |
| Server state | `@tanstack/react-query` v4 (+ persist-client + async-storage-persister for offline) |
| Routing | `react-router-dom` v6 |
| Map | `maplibre-gl` 4.x + `@mapbox/mapbox-gl-draw` (admin geometry drawing) |
| PWA | `vite-plugin-pwa` (Workbox, `autoUpdate`) |
| Client state | Zustand (network/offline store) |
| Offline DB | Dexie + idb-keyval (IndexedDB) |
| Forms | react-hook-form + zod |
| Charts | Recharts |
| Other | axios, recordrtc (evidence capture), driver.js (onboarding), lucide-react |
| Test | Vitest + React Testing Library + MSW; Playwright present for E2E |

## Structure (`frontend/src/`)

`pages/`, `features/`, `components/`, `context/`, `services/`, `offline/`, `hooks/`, `i18n/`, `data/`, `mocks/`, `test/`, `theme/`, `types/`, plus `navConfig.ts`.

- **`main.tsx`** — mounts `App` inside `PersistQueryClientProvider` + `LanguageProvider`; calls `initTheme()`, `startNetworkMonitor()`, `registerSW({ immediate: true })`.
- **`App.tsx`** — `BrowserRouter`, shared `AppShell`/navbar. Every page is `React.lazy` code-split. Portals are splat routes guarded by `RequireAuth`.
- **`navConfig.ts`** — single source of truth for per-role nav items.

## Routing & portals

| Route | Portal | Roles |
|-------|--------|-------|
| `/` | Home (guests/citizens) else redirect to role portal | — |
| `/citizen/*` | CitizenPortal | `CITIZEN` |
| `/officer/*` | OfficerPortal | officer roles |
| `/admin/*` | AdminPortal | `ADMIN` |
| `/verifier/*` | VerifierPortal | `VERIFIER` |
| Public | `/login`, `/register`, `/auth/callback`, `/about`, `/features`, `/privacy-policy`, `/terms-of-use`, `/contact-us`, `/parcels/:id` (Parcel 360) | — |

A global `bhoomisetu:unauthorized` window event (dispatched by the axios 401 interceptor) triggers logout + redirect to `/login`.

**Portals:**
- **Citizen** — Dashboard, My Parcels, Find Parcels, Get Assistance (AI intake), My Cases, Notifications, Profile.
- **Officer** — Dashboard, Tasks, SLA, Performance, Cases, plus department-gated tools (Governance Alerts, Historical Imagery, Change Detection, Map, Documents, Duplicate Registry, Registration Chain, Reassessment Queue, Tax Analytics, Fraud Prevention, Certificate Generator). SPA gating via `OFFICER_TOOLS[department]`; backend independently enforces authz.
- **Admin** — Dashboard, Departments, System Monitoring, Workflow Oversight, Map Layer Authoring, Officer Monitoring, Audit Log, Profile.
- **Verifier** — deliberately narrow: Assigned Visits, task submission, local sync, Profile. One unified `TaskSubmissionPage` (`/verifier/task/:taskId/submit`) captures GPS + photo and structured findings in one step: the photo bytes are uploaded (multipart) to the workflow field-evidence pipeline `POST /workflows/{id}/field-evidence` — the same records the officer's review panel reads back with working images — while findings post to `/cases/{caseId}/findings`. Offline captures queue locally and replay to the same multipart endpoint. The older split Capture-Evidence / Submit-Findings pages (which stored a photo hash only and mis-keyed the case id) were removed; their routes redirect to `/submit`.

## Data layer

- **`services/apiService.ts`** — single axios instance. Base URL `import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'`, 10s timeout. Exports `apiBase` for MapLibre MVT tile URLs that bypass axios.
- **Auth token** — request interceptor reads `localStorage['access_token']` → `Authorization: Bearer`. 401 response → dispatches `bhoomisetu:unauthorized` (except login/demo/`skipAuthRedirect`).
- **react-query** — `queryClient` in `offline/persist.ts` (staleTime 30s, cacheTime 24h). Persistence to IndexedDB restricted to a `PERSIST_KEYS` allowlist (parcels/cases/360 reads only — auth/AI stay in memory).

## Map (`features/map/`)

- `MapComponent.tsx` (maplibre-gl) + `UnifiedMapWrapper.tsx` (react-query wrapper: parcel fetch, cluster dropdown, historical year selector, offline area prefetch).
- Three keyless raster base styles: OpenStreetMap, Esri World Imagery (satellite), Stadia/Stamen terrain.
- **20 layer keys**: `selected, adjacent, nearby, cluster, sameDistrict, zoning, restriction, taxStatus, infrastructure, changeDetection, adminNotes, roads, buildings, landcover, elevation, legalStatus, circleRate, riskScore, mismatch, unauthorized`.
- Vector/MVT tiles from `${apiBase}/tiles/{layer}/{z}/{x}/{y}.pbf`.

## Offline / PWA (`src/offline/`)

- `db.ts` (Dexie), `queue.ts` (offline mutation queue, UUID idempotency keys, user-scoped via JWT `sub`), `sync.ts` (`syncNow()` batches to `POST /api/v1/sync`; per-op `APPLIED`/`DUPLICATE`/`CONFLICT`/`REJECTED`), `network.ts` (zustand + `startNetworkMonitor`), `persist.ts`, `gis.ts`.
- `OfflineStatusIndicator.tsx` — live/offline/syncing chip + SyncCenter panel (queued count, conflicts, "Sync Now", per-conflict discard).
- **Offline sync currently covers case creation only.**

## i18n

11 languages via `LanguageContext.tsx`; text comes from backend `ui_strings_{lang}.json` merged over local fallback strings. Full detail in [06-MULTILINGUAL.md](06-MULTILINGUAL.md).

## Testing

Vitest (`jsdom`), RTL, MSW (`src/mocks/`). Co-located `*.test.tsx`. `npm run test` = `vitest run`. Note: some specs predate a UI redesign and assert older strings — en.json is the source of truth, those specs are being reconciled.
