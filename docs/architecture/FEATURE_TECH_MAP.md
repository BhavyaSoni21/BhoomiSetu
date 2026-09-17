# BhoomiSetu — Feature → Library / Endpoint / File Map

A single lookup table: for every feature, which third-party library actually implements it, which real API endpoints back it, and exactly which backend and frontend files it lives in. Verified directly against the source (controllers, `package.json`, imports) on 2026-09-10 — not copied from `docs/architecture/FEATURES.md`'s prose, though the feature numbering matches it 1:1 so the two can be cross-referenced. For narrative "what it does" descriptions see `docs/architecture/FEATURES.md`; for historical gap analysis see `docs/archive/FEATURE_AUDIT.md`.

All backend paths are relative to `backend/src/`, frontend paths to `frontend/src/`, API paths to `/api/v1`.

**Note on feature 9**: `docs/architecture/FEATURES.md` still describes a standalone `POST /document-verification/verify` endpoint and a `DocumentVerificationPanel`/`VerifyDocumentsPage`. Neither exists any more — `DocumentVerificationModule` is not registered in `app.module.ts`, and the frontend files are gone. OCR verification now happens two other ways: (a) automatically, as a pre-check inside `POST /workflows` when filing a `DOCUMENT_VERIFICATION_REQUEST` (`workflows.service.ts`'s `buildVerificationPrecheck`, reusing the same `document-verification/field-matcher.ts` helper), and (b) as the upload-first Land Claim lookup, `POST /parcels/identify-from-document`. This table reflects the real, current routes.

---

## 1. GIS Map & Parcel Visualization

| | |
|---|---|
| **Library (backend)** | `typeorm` raw query builder for `ST_Intersects`/`ST_Contains` on Postgres/PostGIS; plain JS on SQLite |
| **Library (frontend)** | `maplibre-gl` (MapLibre GL JS) |
| **Endpoints** | `GET /gis/parcels`, `GET /gis/parcel-at-location`, `GET /gis/parcels/:id/geometry`, `GET /gis/parcels/:id/restrictions` |
| **Backend** | `gis/gis.controller.ts`, `gis/gis.service.ts` |
| **Frontend** | `features/map/MapComponent.tsx`; mounted on `pages/citizen/FindParcelsPage.tsx` and `pages/officer/OfficerMapPage.tsx` |

## 2. Contextual Spatial Layers (parcel network + overlays)

| | |
|---|---|
| **Library (backend)** | `typeorm` (`ST_Distance`/`ST_DWithin` on Postgres, JS fallback via `common/geo-utils.ts` on SQLite) |
| **Library (frontend)** | `maplibre-gl` (layer toggle panel, same map instance as feature 1) |
| **Endpoints** | `GET /parcels/:id/context`, `GET /gis/zoning-overlays`, `GET /gis/restriction-zones`, `GET /gis/infrastructure`, `GET /gis/change-detection-events` |
| **Backend** | `parcels/parcels.controller.ts` (`getContext`), `parcels/parcels.service.ts` (`getContext`/`getNeighbours`), `gis/gis.controller.ts`, `spatial/spatial.service.ts` |
| **Frontend** | `features/map/MapComponent.tsx` (9-layer toggle panel) |

## 3. Parcel Search

| | |
|---|---|
| **Library (backend)** | `typeorm` `QueryBuilder`/`Like` filters, no external lib |
| **Library (frontend)** | `@tanstack/react-query` (search-as-query-key), `axios` (via `apiService`) |
| **Endpoints** | `GET /parcels?ulpin=&survey_number=&plot_number=&local_identifier=&state=&district=` |
| **Backend** | `parcels/parcels.controller.ts` (`searchParcels`), `parcels/parcels.service.ts` |
| **Frontend** | `features/parcels/ParcelSearch.tsx`, on `pages/citizen/FindParcelsPage.tsx` |

## 4. Parcel 360 (aggregated cross-department view)

| | |
|---|---|
| **Library (backend)** | none beyond `typeorm` — plain parallel `Promise.all` fan-out |
| **Library (frontend)** | `@tanstack/react-query`, `react-router-dom` (`:id` route param) |
| **Endpoints** | `GET /parcels/:id/360` |
| **Backend** | `parcels/parcels.controller.ts` (`getParcel360`), `interoperability/response-aggregator.service.ts` |
| **Frontend** | `features/parcels/Parcel360View.tsx`, route `/parcels/:id` |

## 5. Mock State Land Record Schemas

| | |
|---|---|
| **Library (backend)** | `typeorm` (two independent entities, full CRUD) |
| **Library (frontend)** | none — not called directly |
| **Endpoints** | `POST/GET /state-a/land-records`, `GET/PATCH/DELETE /state-a/land-records/:id`; same set under `/state-b/land-records` |
| **Backend** | `land-records/state-a-land-records.controller.ts`, `land-records/state-b-land-records.controller.ts` |
| **Frontend** | none directly — surfaced via Parcel 360's Land Records tab |

## 6. Mock Department APIs

| | |
|---|---|
| **Library (backend)** | `typeorm` |
| **Library (frontend)** | none — not called directly |
| **Endpoints** | `GET /land-records/:parcelId`, `GET /registration/:parcelId`, `GET /planning/:parcelId`, `GET /tax/:parcelId`, `GET /restriction/:parcelId`, `GET /dispute/:parcelId`, `GET /encumbrance/:parcelId` |
| **Backend** | `departments/land-records-lookup.controller.ts`, `departments/registration.controller.ts`, `departments/planning.controller.ts`, `departments/tax.controller.ts`, `departments/restriction.controller.ts`, `departments/dispute.controller.ts`, `departments/encumbrance.controller.ts` |
| **Frontend** | none directly — each is a tab inside Parcel 360 |

## 6a. Ownership History

| | |
|---|---|
| **Library (backend)** | `typeorm` |
| **Library (frontend)** | `@tanstack/react-query` (lazy-fetched only when the tab opens) |
| **Endpoints** | `GET /parcels/:id/ownership-history` (JWT + role-gated: staff always, citizen only if `citizen_parcels`-linked — 403 otherwise) |
| **Backend** | `parcels/parcels.controller.ts` (`getOwnershipHistory`), `parcels/ownership-history-record.entity.ts` |
| **Frontend** | "Ownership History" tab in `features/parcels/Parcel360View.tsx` |

## 7. Interoperability Layer

| | |
|---|---|
| **Library (backend)** | none — pure TypeScript adapters/transformers, no external lib |
| **Library (frontend)** | n/a |
| **Endpoints** | surfaced entirely through `GET /parcels/:id/360` (feature 4) |
| **Backend** | `interoperability/` — identifier resolver, State A/B adapters, canonical transformer, `response-aggregator.service.ts` |
| **Frontend** | none directly — this is what makes feature 4 possible |

## 8. Citizen Service Requests & Officer Review Workflow

| | |
|---|---|
| **Library (backend)** | `typeorm`; Groq via `ai/groq.service.ts` for request routing (feature 28, same client as feature 17) |
| **Library (frontend)** | `@tanstack/react-query` (mutations + cache invalidation), `axios` |
| **Endpoints** | `POST /workflows`, `GET /workflows`, `GET /workflows/mine`, `GET /workflows/:id`, `GET /workflows/:id/evidence`, `PATCH /workflows/:id/status`, `PATCH /workflows/:workflowId/steps/:stepId`, `POST /workflows/:workflowId/steps/:stepId/escalate`, `POST /workflows/:workflowId/steps/:stepId/reopen` |
| **Backend** | `workflows/workflows.controller.ts`, `workflows/workflows.service.ts`, `workflows/workflow.entity.ts`, `workflows/workflow-step.entity.ts` |
| **Frontend** | `features/parcels/ServiceRequestForm.tsx`, `pages/citizen/RaiseRequestPage.tsx`, `pages/citizen/RequestsPage.tsx`, `features/officer/WorkflowReviewPanel.tsx` (shared by `pages/officer/AssignedRequestsPage.tsx` and `pages/admin/AdminWorkflowOversightPage.tsx`) |

## 9. Document Verification (OCR)

*(see the note at the top of this file — this is now folded into feature 8, not a standalone endpoint)*

| | |
|---|---|
| **Library (backend)** | `tesseract.js` (OCR, fully local, no external API/key) |
| **Library (frontend)** | n/a — no dedicated UI, this is a server-side pre-check |
| **Endpoints** | none of its own — runs inside `POST /workflows` when `workflowType: 'DOCUMENT_VERIFICATION_REQUEST'` |
| **Backend** | `document-verification/ocr.ts`, `document-verification/field-matcher.ts` (`textContainsIdentifier`/`textContainsName`/`textContainsApproxNumber`), called from `workflows/workflows.service.ts` (`buildVerificationPrecheck`) |
| **Frontend** | `features/parcels/ServiceRequestForm.tsx` (the "Verify Documents" request type) |

## 10. Governance Alerts

| | |
|---|---|
| **Library (backend)** | `typeorm` (`Not`/`In` for the `ACTIVE` pseudo-status query) |
| **Library (frontend)** | `@tanstack/react-query`, `lucide-react` (stage/severity icons) |
| **Endpoints** | `GET /governance-alerts` (filters: `severity`, `status` incl. pseudo-value `ACTIVE`), `GET /governance-alerts/:id`, `PATCH /governance-alerts/:id/status` |
| **Backend** | `governance/governance-alerts.controller.ts`, `governance/governance-alerts.service.ts` (`VALID_TRANSITIONS`, `CLOSED_ALERT_STATUSES`), `governance/governance-alert.entity.ts` |
| **Frontend** | `features/officer/GovernanceAlertsPanel.tsx`, `features/officer/GovernanceAlertDetailModal.tsx`, `features/officer/GovernanceAlertReasonPrompt.tsx` (shared `AlertStage`/`STAGE_CONFIG`/`NEXT_ACTIONS`), on `pages/officer/GovernanceAlertsPage.tsx` |

## 11. Authentication (+ Citizen Registration & OTP Verification)

| | |
|---|---|
| **Library (backend)** | `@nestjs/jwt` + `passport` + `passport-jwt` (JWT auth), `bcryptjs` (password + OTP hashing), `nodemailer` (SMTP email OTP, Zoho Mail relay by default); mobile OTP via `SmsService`'s own `fetch` call to TextBee's HTTP API (`textbee.dev`) - no SDK needed |
| **Library (frontend)** | `axios` (`services/apiService.ts`), `@tanstack/react-query` (session cache) |
| **Endpoints** | `POST /auth/login`, `POST /auth/register`, `POST /auth/verify-otp`, `POST /auth/resend-otp`, `POST /auth/profile/contact`, `POST /auth/profile/details`, `GET /auth/me` |
| **Backend** | `auth/auth.controller.ts`, `auth/auth.service.ts`, `auth/jwt.strategy.ts`, `auth/jwt-auth.guard.ts`, `auth/optional-jwt-auth.guard.ts`, `notifications/sms.service.ts` (TextBee), `notifications/email.service.ts` (nodemailer/SMTP, Zoho Mail) |
| **Frontend** | `pages/LoginPage.tsx`, `pages/RegisterPage.tsx`, `features/auth/OtpEntryForm.tsx`, `features/auth/RequireAuth.tsx`, `features/auth/auth.ts` |

## 12. Citizen Sign-In / My Parcels

| | |
|---|---|
| **Library (backend)** | `typeorm` (`citizen_parcels` join table) |
| **Library (frontend)** | `@tanstack/react-query` |
| **Endpoints** | `GET /parcels/mine` (citizen-only) |
| **Backend** | `parcels/parcels.controller.ts` (`getMyParcels`), `parcels/parcels.service.ts` (`findMine`) |
| **Frontend** | `features/citizen/MyParcels.tsx`, `pages/citizen/MyParcelsPage.tsx` |

## 13. Authorization (RBAC)

| | |
|---|---|
| **Library (backend)** | `@nestjs/common` (`CanActivate` guard), `reflect-metadata` (custom `@Roles()` decorator metadata) |
| **Library (frontend)** | none — enforced only by not rendering/routing, no separate lib |
| **Endpoints** | cross-cutting guard, not its own route |
| **Backend** | `auth/roles.guard.ts`, `auth/roles.decorator.ts`, `auth/roles.constants.ts` |
| **Frontend** | `features/auth/RequireAuth.tsx` |

## 14. Audit Logging

| | |
|---|---|
| **Library (backend)** | `typeorm` |
| **Library (frontend)** | `@tanstack/react-query` |
| **Endpoints** | `GET /audit` (admin-only, filterable), `GET /parcels/:id/audit` (staff-only) |
| **Backend** | `audit/audit.controller.ts`, `audit/audit.service.ts`, `audit/audit-log.entity.ts` |
| **Frontend** | `features/admin/RecentActivity.tsx`, on `pages/admin/SystemMonitoringPage.tsx` |

## 15. Admin Portal

| | |
|---|---|
| **Library (backend)** | `typeorm`, `bcryptjs` (new-user password hashing in `users.controller.ts`) |
| **Library (frontend)** | `react-router-dom` (nested `<Routes>`), `@tanstack/react-query` |
| **Endpoints** | `GET/POST /users`, `PATCH /users/:id/role`, `DELETE /users/:id`; `GET/POST /admin/departments`, `PATCH/DELETE /admin/departments/:id`; `GET /analytics/summary`, `GET /analytics/officer-monitoring` |
| **Backend** | `users/users.controller.ts`, `admin/departments-admin.controller.ts`, `analytics/analytics.controller.ts`, `analytics/analytics.service.ts` |
| **Frontend** | `pages/AdminPortal.tsx` + `pages/admin/AdminDashboardPage.tsx`, `AdminDepartmentsPage.tsx`, `SystemMonitoringPage.tsx`, `AdminWorkflowOversightPage.tsx`, `AdminMapLayerAuthoringPage.tsx`, `AdminOfficerMonitoringPage.tsx`; `features/admin/UserManagement.tsx`, `DepartmentManagement.tsx`, `OfficerMonitoring.tsx` |

## 16. Officer Portal

| | |
|---|---|
| **Library (backend)** | composed from `workflows/`, `governance/`, `ai/`, `analytics/` — no library of its own |
| **Library (frontend)** | `react-router-dom` (nested `<Routes>`) |
| **Endpoints** | composed from features 8/10/17/19 |
| **Backend** | none directly |
| **Frontend** | `pages/OfficerPortal.tsx` + `pages/officer/OfficerDashboardPage.tsx`, `AssignedRequestsPage.tsx`, `GovernanceAlertsPage.tsx`, `HistoricalImageryPage.tsx`, `OfficerMapPage.tsx`, `OfficerNotificationsPage.tsx`, `OfficerProfilePage.tsx` |

## 17. AI Assistant (Groq)

| | |
|---|---|
| **Library (backend)** | `openai` SDK (pointed at Groq's OpenAI-compatible API base URL), `zod` (response schema validation) |
| **Library (frontend)** | `@tanstack/react-query`, `lucide-react` (widget icons) |
| **Endpoints** | `POST /ai/query`, `POST /ai/parcels/:parcelId/explain`, `POST /ai/alerts/:alertId/explain` (officer/admin-only) |
| **Backend** | `ai/ai.controller.ts`, `ai/groq.service.ts` (also reused standalone as `ai/groq.module.ts` by `workflows/request-routing.service.ts`, feature 28) |
| **Frontend** | `features/ai/AskAiWidget.tsx`, `features/ai/AiExplanationCard.tsx` |

## 18. Change Detection

| | |
|---|---|
| **Library (backend)** | `sharp` (image decode/resize), hand-rolled pixel diff (`common/image-diff.ts`), `@nestjs/platform-express` `FileInterceptor` (multipart upload) |
| **Library (frontend)** | none — component exists but is unmounted (see note below) |
| **Endpoints** | `POST /change-detection/analyze` (multipart `before`/`after`, 5MB cap each, rate-limited 30/min) |
| **Backend** | `change-detection/change-detection.controller.ts`, `change-detection/change-detection.service.ts`, `common/image-diff.ts` |
| **Frontend** | `features/change-detection/ChangeDetectionPanel.tsx` — **not mounted in any route as of 2026-09-09**; still covered by its own test suite |

## 19. Governance Analytics Dashboard

| | |
|---|---|
| **Library (backend)** | `typeorm` `QueryBuilder` (`GROUP BY` aggregation, the `groupCount` helper) |
| **Library (frontend)** | `recharts` (the 8-chart dashboard), `@tanstack/react-query` |
| **Endpoints** | `GET /analytics/summary` |
| **Backend** | `analytics/analytics.controller.ts`, `analytics/analytics.service.ts` |
| **Frontend** | `features/analytics/AnalyticsDashboard.tsx`, on `pages/admin/AdminDashboardPage.tsx` |

## 20. Predictive Analytics (Risk Score)

| | |
|---|---|
| **Library (backend)** | none — plain hand-weighted arithmetic, no ML library |
| **Library (frontend)** | `@tanstack/react-query` |
| **Endpoints** | `GET /parcels/:id/risk-score`, `GET /predictive-analytics/top-risk-parcels` |
| **Backend** | `predictive-analytics/predictive-analytics.controller.ts`, `predictive-analytics/predictive-analytics.service.ts` |
| **Frontend** | Risk Assessment card in `features/parcels/Parcel360View.tsx`, `features/analytics/TopRiskParcels.tsx` |

## 21. Spatial Layer Authoring

| | |
|---|---|
| **Library (backend)** | `typeorm`; `common/geo-utils.ts` (hand-rolled `ringsOverlap` polygon-vs-polygon test, centroid-in-ring containment) — no external geometry library |
| **Library (frontend)** | `maplibre-gl` + `@mapbox/mapbox-gl-draw` (the drawing tool) |
| **Endpoints** | `GET/POST/PATCH/DELETE /spatial/zoning-overlays[/:id]`, `.../restriction-zones[/:id]`, `.../infrastructure[/:id]`, `.../admin-notes[/:id]` (admin-notes fully ADMIN-gated incl. reads) |
| **Backend** | `spatial/spatial.controller.ts`, `spatial/spatial.service.ts`, `common/geo-utils.ts` |
| **Frontend** | `features/admin/MapLayerManagement.tsx`, `features/admin/LayerGeometryDrawMap.tsx`, `features/admin/AdminCombinedLayerMap.tsx`, on `pages/admin/AdminMapLayerAuthoringPage.tsx` |

## 22. Multilingual UI (11 languages, Bhashini-backed)

| | |
|---|---|
| **Library (backend)** | `httpx` (calls to Bhashini's ULCA/Dhruva APIs) |
| **Library (frontend)** | none — plain `fetch` + React Context, no i18n library (replaced `i18next`/`react-i18next` 2026-09-15) |
| **Endpoints** | `GET /api/v1/multilingual/ui-text/{lang}` (cached static text), plus live `translate`/`transliterate`/`tts`/`asr` endpoints for dynamic content |
| **Backend** | `app/services/bhashini.py`, `app/routers/multilingual.py`, `app/services/ui_text.py`, `static/ui_strings_<lang>.json` (11 files), `scripts/batch_translate_ui.py` |
| **Frontend** | `context/LanguageContext.tsx` — wired throughout every portal via `navConfig.ts`'s `labelKey` pattern; `components/SpeakerButton.tsx`/`components/MicButton.tsx` (TTS/ASR, wired into 8+ call sites as of 2026-09-16) |

## 23. Rate Limiting

| | |
|---|---|
| **Library (backend)** | `@nestjs/throttler` |
| **Library (frontend)** | none |
| **Endpoints** | cross-cutting (global `APP_GUARD`, per-route `@Throttle()` overrides) |
| **Backend** | `app.module.ts` (`ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }])`, `APP_GUARD: ThrottlerGuard`); `@Throttle({ default: { limit: 30, ttl: 60000 } })` on `ai/ai.controller.ts`, `change-detection/change-detection.controller.ts`, `historical-imagery/historical-imagery.controller.ts`; `@Throttle({ default: { limit: 20, ttl: 60000 } })` on `parcels/parcels.controller.ts` (`identify-from-document`); `main.ts` (`trust proxy`) |
| **Frontend** | none |

## 24. PostGIS / Production Database Support

| | |
|---|---|
| **Library (backend)** | `pg` (Postgres driver) + `typeorm` (raw `ST_*` query fragments) vs `sqlite3` + `common/geo-utils.ts` (hand-rolled JS fallback) |
| **Library (frontend)** | none — entirely transparent |
| **Endpoints** | none of its own — a routing decision inside `GisService.findAll`/`findParcelAtLocation`, `ParcelsService.getNeighbours`, `ChangeDetectionService.analyze` |
| **Backend** | `common/postgis.ts`, `common/geo-utils.ts`, `database.config.ts` |
| **Frontend** | none |

## 25. Docker / Deployment Hardening

| | |
|---|---|
| **Library (backend)** | n/a — infra, not a code library |
| **Library (frontend)** | n/a |
| **Endpoints** | none |
| **Backend/infra** | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` |
| **Frontend** | none |

## 26. Historical Imagery Comparison

| | |
|---|---|
| **Library (backend)** | `openai` SDK pointed at **OpenRouter** (`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`, text-only — a separate client from Groq/feature 17, since Groq's model here takes no image/needs no image); `earthengine-api` for the real satellite-photo toggle (added 2026-09-16, see feature 9) — the seed-time `sharp`/`cluster-snapshot-generator.ts` PNG-rasterization path was removed 2026-09-15 (`docs/architecture/BACKLOG.md` item 10, done) |
| **Library (frontend)** | `maplibre-gl` (`features/map/MapComponent.tsx`, extended with `parcelColors`/`parcelLabels` props) |
| **Endpoints** | `GET /historical-imagery/clusters`, `GET /historical-imagery/clusters/:clusterId/years/:year/parcels`, `POST /historical-imagery/clusters/:clusterId/compare` (rate-limited 30/min, staff-only, locked to the most recent year pair only); `GET /change-detection/clusters/:clusterId/satellite-image?date=` (added 2026-09-16, real true-color Earth Engine photo for the Satellite Photo toggle) |
| **Backend** | `app/routers/historical_imagery.py`, `app/services/historical_comparison_service.py`, `app/services/narrative_service.py`, `app/common/parcel_generation/parcel_category.py`, `app/services/earth_engine_service.py` (`get_true_color_visual_png`, added 2026-09-16) |
| **Frontend** | `features/officer/HistoricalImageryPanel.tsx` (`pages/officer/HistoricalImageryPage.tsx`), `features/officer/HistoricalMapView.tsx` (Parcel Map / Satellite Photo toggle, added 2026-09-16), `features/officer/HistoricalYearCompare.tsx` (also embedded inline in `features/parcels/Parcel360View.tsx`) |

## 27. In-App Notifications

| | |
|---|---|
| **Library (backend)** | `typeorm` |
| **Library (frontend)** | `@tanstack/react-query` |
| **Endpoints** | `GET /notifications`, `PATCH /notifications/:id/read` |
| **Backend** | `notification-feed/notification-feed.controller.ts`, `notification-feed/notification-feed.service.ts`, `notification-feed/notification.entity.ts` — written to by `workflows/workflows.service.ts` (`notifyAssignedOfficers`/`notifyCitizenOfStepDecision`/`escalateStep`) and `governance/governance-alerts.service.ts` |
| **Frontend** | `features/notifications/NotificationFeed.tsx`, on `pages/citizen/NotificationsPage.tsx` and `pages/officer/OfficerNotificationsPage.tsx` |

## 28. AI-Based Request Routing

| | |
|---|---|
| **Library (backend)** | `openai` SDK via the shared `ai/groq.service.ts`/`ai/groq.module.ts` (Groq) |
| **Library (frontend)** | n/a — invisible to the caller, folded into `POST /workflows` |
| **Endpoints** | none of its own — runs inside `POST /workflows` |
| **Backend** | `workflows/request-routing.service.ts` |
| **Frontend** | none directly |

## 29. Governance Alert Review Reason

*(superseded by feature 10 — `reason` is now mandatory on every stage transition, not a separate feature)*

| | |
|---|---|
| **Library (backend)** | none |
| **Library (frontend)** | none |
| **Endpoints** | folded into `PATCH /governance-alerts/:id/status` (feature 10) |
| **Backend** | `governance/governance-alerts.service.ts` (`alertDepartmentFor`) |
| **Frontend** | `features/officer/GovernanceAlertReasonPrompt.tsx` |

## 30. Verifier Role & Field Evidence Capture

| | |
|---|---|
| **Library (backend)** | none new — plain multipart upload, same pattern as evidence upload elsewhere |
| **Library (frontend)** | `navigator.geolocation` (new usage — GPS capture) |
| **Endpoints** | `PATCH /workflows/:id/assign-verifier`, `GET /workflows/assigned-to-me`, `POST /workflows/:id/field-evidence`, `GET /workflows/:id/field-evidence` |
| **Backend** | `app/auth/roles.py` (`VERIFIER_ROLE`), `app/models/verification_evidence.py`, `app/services/workflows_service.py` (`assign_verifier`, `find_assigned_to_verifier`, `add_field_evidence`, `list_field_evidence`), `app/routers/workflows.py` |
| **Frontend** | `pages/VerifierPortal.tsx`, `pages/verifier/AssignedVisitsPage.tsx`, `features/verifier/FieldEvidenceCaptureForm.tsx`, `pages/verifier/VerifierProfilePage.tsx` |

---

## Libraries declared but not actually used anywhere in the frontend

Found while building this table — worth knowing before reaching for them: `zustand`, `react-hook-form`, and `zod` are all listed in `frontend/package.json`'s dependencies but have zero imports anywhere in `frontend/src`. State is handled with plain `useState`/React Query cache instead, and forms are hand-rolled controlled inputs, not `react-hook-form`. `zod` is used only on the **backend** (`ai/groq.service.ts`'s response validation) — the frontend copy is dead weight.

## Cross-cutting libraries (used by many features, not called out per-row above)

| Library | Where | Purpose |
|---|---|---|
| `@nestjs/typeorm` + `typeorm` | almost every backend module | ORM, entities, migrations-free schema sync |
| `class-validator` + `class-transformer` | every DTO (`*.dto.ts`) | request body validation (`ValidationPipe` in `main.ts`) |
| `@nestjs/swagger` | `main.ts` | OpenAPI docs generation (`/api-docs`) |
| `axios` | `frontend/src/services/apiService.ts` | the one HTTP client instance every feature's API calls go through |
| `@tanstack/react-query` | almost every frontend feature/page | server-state cache, mutations, invalidation |
| `lucide-react` | 51 frontend files | icon set, used throughout every portal |
| `react-router-dom` | `App.tsx`, `OfficerPortal.tsx`, `AdminPortal.tsx`, `CitizenPortal.tsx` | routing, nested portal `<Routes>` |
| `tailwindcss` + `postcss` + `autoprefixer` | build-time only | styling, no runtime import |
