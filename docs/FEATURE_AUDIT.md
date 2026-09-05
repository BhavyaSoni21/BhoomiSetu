# BhoomiSetu Feature Audit

A cross-reference of what this project is actually required to do, what the team's own technical spec additionally proposed, and what's actually built — as of 2026-09-05, after Phase 9 of `docs/Plan.md`.

## Sources used

1. **The official SIH "Expected Solution"** — the competition's actual requirement text (pasted into this project's working session; not a file in this repo). This is the only source that matters for "is this required."
2. **`Tech.md` / `BHOOMISETU.md`** — this team's own technical spec and vision document, written *from* the SIH problem statement. They elaborate heavily beyond the bare requirement text (specific schemas, specific endpoints, specific tech choices) — most of that elaboration is the team's own design judgment, not a competition requirement.
3. **`docs/Plan.md`** — the phase-by-phase build log, with a dated verification note after every phase describing exactly what was built, what broke, and how it was fixed.

Where these three disagree — and they do, in places — that disagreement is itself useful information and is called out explicitly below.

## Legend

| Tag | Meaning |
|---|---|
| ✅ | Implemented and verified (live, not just code review — see `docs/Plan.md`) |
| ⚠️ | Partially implemented |
| ❌ | Not implemented |
| 🟡 | Specified in Tech.md/BHOOMISETU.md but not (or not fully) built |
| ⚪ | Built, but neither required nor spec'd anywhere — an engineering-judgment addition |

---

## 1. Required by the official problem statement

This is the actual competition requirement. Nothing here is optional.

| Requirement | Status | Notes |
|---|---|---|
| GIS-based parcel visualization | ✅ | MapLibre GL map, parcel polygons, contextual selected/adjacent/nearby/cluster/district/overlay layers (Phase 1-2) |
| Integration of mock/sample land-related datasets | ✅ | Two structurally different state schemas (Phase 3), 5 mock department APIs (Phase 4), 200 seeded parcels across 4 real regions |
| Role-based administrative dashboards | ✅ | Officer Portal is real (Phase 7: real login as of 2026-09-05, dashboard, workflow review, alerts). Admin Portal (`/admin`) is real too as of 2026-09-05: real login, governance analytics (§8 item 3), top-at-risk-parcels (§8 item 8), real user/role management and an audit-trail feed (§8 item 11). 2 of the 4 "System Overview" cards (`System Status: Online`, `Last Backup: Never`) remain static — there's no real config/backup system in this codebase to source them from, a documented gap rather than a placeholder pretending otherwise |
| Citizen-facing service interfaces | ✅ | Search, Parcel 360, AI query, service requests with live status (Phase 6, 8) |
| Interoperable workflow: **land records** | ✅ | Phase 3-5 |
| Interoperable workflow: **registration** | ✅ | Phase 4-5 |
| Interoperable workflow: **dispute** | ✅ | **Done (2026-09-05, §8 backlog item 2).** `DisputeRecord` mock department (`GET /dispute/:parcelId`), a 6th Parcel 360 tab, a `DISPUTE_FILING` workflow type with its own single-step `DISPUTE`/`DISPUTE_OFFICER` review pipeline, seeded on ~12% of parcels |
| Interoperable workflow: **planning** | ✅ | Phase 4-5 |
| Interoperable workflow: **fiscal** (tax) | ✅ | Phase 4-5 |
| Efficient parcel-level information access | ✅ | Parcel 360 aggregator (Phase 5), AI parcel explanation (Phase 8) |
| Real-time or simulated workflow integration | ✅ | Simulated 3-step review pipeline, auto-generated per request (Phase 6-7) |
| Cross-departmental data interoperability | ✅ | Identifier resolver, state adapters, canonical transformer, response aggregator (Phase 5) |
| Analytics-driven governance insights | ✅ | **Done (2026-09-05, §8 item 3).** `GET /analytics/summary` (real SQL `GROUP BY` aggregation across tax/registration/planning/dispute/workflow/alert tables) + an 8-chart `recharts` dashboard on the Admin Portal — platform-wide, not just per-alert |
| Transparent citizen service delivery | ✅ | Reference ID + live per-step status on every request (Phase 6) |

**Gap count: 0.** Every row in this table is now ✅ (dispute, analytics, and admin dashboard user/role management all closed 2026-09-05).

---

## 2. "Innovative solutions ... will be preferred" (SIH bonus list)

Explicitly framed as differentiators, not requirements.

| Item | Status | Notes |
|---|---|---|
| AI/ML | ✅ | Groq-backed NL query, parcel summary, alert explanation — all Zod-validated (Phase 8) |
| Geospatial intelligence | ✅ | Real neighbour/cluster computation (Phase 2), real pixel-diff → spatial-intersection change detection (Phase 9) |
| Predictive analytics | ✅ | A transparent heuristic risk score (tax delinquency, dispute exposure, open alerts, restrictions), not a trained model — Parcel 360's "Risk Assessment" card and the Admin Portal's "Top At-Risk Parcels" list (2026-09-05, §8 item 8) |
| Workflow automation | ✅ | Auto-generated review pipeline, auto-recomputed workflow status on each step decision |
| API-based integration | ✅ | REST throughout, Swagger/OpenAPI served at `/api` |
| Mobile accessibility | ✅ | A responsive breakpoint pass — working mobile nav menu, wrapped button rows — live-verified at a 375px viewport (2026-09-05, §8 item 7). WCAG/screen-reader accessibility specifically remains unreviewed (see §7) |
| Secure cloud-native architecture | ⚠️ | Rate limiting done (2026-09-05, §8 item 4). Dockerfiles for both `backend/` and `frontend/` plus a corrected `docker-compose.yml` now exist and validate statically (2026-09-05, §8 item 6), but no container has actually been built or deployed. No real auth yet (Phase 10) |

---

## 3. The "Standard Technical Document" deliverable

The SIH text separately requires: *"a Standard Technical Document containing details of API standards, interoperability standards, data schemas, system architecture, GIS standards, security frameworks, UI/UX guidelines, color schemas, and deployment and scalability considerations."*

**Update (2026-09-05): assembled as `docs/STANDARD_TECHNICAL_DOCUMENT.md`** — P0 item 1 in §8's backlog. It covers all nine required sections, verified directly against the source code (endpoint list, entity schemas, module dependency graph pulled from the actual codebase, not transcribed from Tech.md/BHOOMISETU.md) rather than copying the original forward-looking proposals. It does **not** close the underlying divergences documented below — the color scheme still isn't followed, no deployment exists — it *accurately documents* that those gaps exist, which is what the SIH deliverable actually asks for. Security specifically has since moved from "not built" to "partially built" (authentication and RBAC are both done as of the same date, §8 items 9 and 5 — audit logging is the piece still missing). The table below is otherwise unchanged and still describes the real state of each area; it's now also fully reflected in that document instead of scattered across `BHOOMISETU.md`/`Tech.md`.

| Section required | Where the draft material lives | Actually followed by the build? |
|---|---|---|
| API standards | `BHOOMISETU.md` §39 | Mostly — REST, JSON, `/api/v1/...`, Swagger (`main.ts`, served at `/api`). NestJS's default exceptions give a consistent `{statusCode, message, error}` shape in practice, but there's no custom global exception filter and no document formalizing this as a project convention |
| Interoperability standards | `BHOOMISETU.md` §40 | Yes — canonical model, identifier mapping, state adapters all match this section closely (Phase 5) |
| Data schemas | `Tech.md` §7/8/12/13/24/27/34 | **Partially diverged.** Tech.md specifies snake_case field names (`canonical_parcel_id`, `current_status`); the actual DB uses camelCase throughout (TypeORM convention), and several real columns don't exist in Tech.md at all (`clusterId`, `parcel_neighbours` table). `users` now exists (2026-09-05, §8 item 9); `roles` (a separate table) and `audit_logs` still don't |
| System architecture | `BHOOMISETU.md` folder-structure sketch | **Diverged.** No diagram reflects the actual module dependency graph built across phases (`ParcelsModule → InteroperabilityModule → DepartmentsModule`, etc. — a specific one-directional-import pattern used throughout to avoid circular deps, documented only in code comments) |
| GIS standards | `BHOOMISETU.md` §41 | Yes — GeoJSON, parcel polygons, layered map. Spatial indexing/PostGIS spatial ref systems are dev-mode placeholders (SQLite has no PostGIS) |
| Security frameworks | `Tech.md` §39 (Security Requirements) | ⚠️ **Partially built.** JWT + bcrypt (§8 item 9), RBAC route guards (§8 item 5), and rate limiting (§8 item 4) are all done and live-verified; audit logging is the one piece of this section still not built |
| UI/UX guidelines | `BHOOMISETU.md` §42 | 🟡 **Drafted, never explicitly checked against.** No design review against the five stated principles (citizen-first, GIS-first, progressive information, clear workflow status, consistent design) ever happened |
| Color schemas | `BHOOMISETU.md` §43 | ❌ **Not followed at all.** Spec suggests Deep Earth Green (primary) / Soil Brown (secondary) / Saffron-or-Gold (accent). The actual UI uses stock Tailwind colors (blue/green/red/indigo/yellow/purple/gray — 52 occurrences across 13 components), with no relation to the suggested palette |
| Deployment & scalability | `BHOOMISETU.md` §44, Tech.md §43-45 | ⚠️ **Dockerfiles + a corrected `docker-compose.yml` exist (2026-09-05, §8 item 6)**, `docker compose config` validates cleanly, but no live `docker-compose up` has run yet (Docker Desktop wasn't started this round) and nothing has ever run outside a local dev machine |

**Net assessment**: the *deliverable* gap (a) is now closed — see the update note above. The *underlying* gaps this table documents are not: (b) the data-schema/architecture drift is now accurately written down rather than fixed, and (c) the color-scheme/UI-guideline sections still need an actual design pass if they're meant to be followed rather than just documented as not-yet-followed.

---

## 4. Phase-by-phase implementation summary

All 9 phases of `docs/Plan.md` are complete; Phase 10 has not started.

| Phase | Objective | Status |
|---|---|---|
| 1. GIS Foundation | PostGIS/SQLite setup, parcel table, map | ✅ |
| 2. Parcel Core | Search, identifiers, Parcel 360 skeleton | ✅ (+ cluster topology, contextual visibility — see §5) |
| 3. Mock State Schemas | Two state land-record schemas, full CRUD | ✅ |
| 4. Mock Department APIs | 5 independent department mocks | ✅ |
| 5. Interoperability | Resolver, adapters, canonical transform, aggregator | ✅ |
| 6. Citizen Portal | Search, map, Parcel 360, service requests | ✅ |
| 7. Officer Portal | Login, dashboard, workflow review, alerts | ✅ (real login as of 2026-09-05 — see Authentication in `README.md`) |
| 8. Groq AI Integration | NL query, parcel/alert explanation | ✅ (+ frontend UI — see §5) |
| 9. Change Detection | Imagery diff, spatial intersection, alerts | ✅ (Node/TS, not Python/OpenCV — see §5) |
| 10. Security and Audit | JWT, RBAC, audit logging | ✅ done (2026-09-05, §8 items 9, 5, 10) |

Automated coverage: **211 backend e2e tests** (Jest+Supertest, isolated in-memory SQLite) + **117 frontend tests** (Vitest+RTL) = 328 total, as of 2026-09-05. `tsc --noEmit` and both production builds clean as of the last verification.

---

## 5. Extra — built but neither required nor spec'd anywhere

Engineering-judgment additions made because the feature genuinely needed them, not because any source document asked for them.

- **Connected cluster-based parcel topology** — shared-vertex lattice geometry so neighbouring parcels share literal boundary coordinates, explicit `ParcelNeighbour` table, `clusterId`. Tech.md's parcel model has no concept of this; it was added after the initial "parcels floating with gaps between them" implementation looked wrong.
- **Contextual parcel visibility** — `GET /parcels/:id/context`, an 11-layer toggleable map (selected/adjacent/nearby/cluster/district/4 overlay layers), buffered zoom-to-cluster. Not in Tech.md's endpoint list.
- **`GET /workflows` (list/filter) and `PATCH /workflows/:workflowId/steps/:stepId`** — Tech.md §23 specifies exactly 4 workflow endpoints; these two were added because Phase 7's officer dashboard/review UI is not buildable without them.
- **Frontend AI touchpoints** (Ask AI search box, "Explain with AI" button, per-alert "Explain" button) — Phase 8's own checklist in Plan.md is backend-only; the UI was added afterward, on request.
- **Change Detection upload panel** — same situation; Plan.md's Phase 9 checklist is backend-only, and the Python/OpenCV service Tech.md specifies was replaced with an equivalent Node/TypeScript pipeline by explicit choice (see §6).
- ~~**Simulated officer login**~~ (`localStorage` name+role, no password) — a deliberate bridge so the Officer Portal could be built and tested before real auth existed, framed to match BHOOMISETU.md's own "simulated officer role" language. Replaced by real login 2026-09-05 (§8 item 9).
- **`docs/` git-tracking fix** — `.gitignore` had a blanket `docs/` rule silently excluding `Plan.md` (and its entire phase-by-phase history) from every push until this was caught and fixed.
- **328 automated tests** (211 backend, 117 frontend, as of 2026-09-05) — neither source document specifies a coverage target; every phase's tests were added because verifying live behavior by hand doesn't scale across 9+ phases.

---

## 6. Specified in Tech.md/BHOOMISETU.md but not implemented yet

Real gaps against the team's *own* spec — separate from §1's gaps against the *competition's* requirement.

- ~~Real authentication~~ — ✅ done 2026-09-05, see §8 item 9.
- ~~RBAC middleware~~ — ✅ done 2026-09-05, see §8 item 5.
- **Audit logging** — `AuditModule` is still `@Module({})`, `audit_logs` table doesn't exist, `GET /api/v1/audit` and `GET /api/v1/parcels/:id/audit` (Tech.md §26) don't exist. Tech.md's simulated-workflow diagram (§25) explicitly includes an `AUDIT LOG` stage between officer decision and citizen notification that has never been built.
- **Citizen notification** — the same diagram's final stage (`CITIZEN NOTIFICATION`) doesn't exist; a citizen has to manually re-check a workflow's status, nothing pushes an update to them.
- ~~Rate limiting~~ — ✅ done 2026-09-05, see §8 item 4.
- **HTTPS / real deployment** — Dockerfiles now exist (§8 item 6) but the containers have never actually been run, and nothing has been deployed anywhere, so "HTTPS in deployment" is still moot.
- **PostGIS in an actually-running Postgres instance** — the Postgres/PostGIS code path exists (`init-postgis.sql`, the `USE_SQLITE=false` branch) but has never been run end-to-end; every phase's live verification has used SQLite.
- **OAuth-based authentication** — mentioned as a possibility in BHOOMISETU.md's Authentication section; not built (JWT alone is Phase 10's actual scope).
- **PyTorch/TensorFlow-based change detection** — BHOOMISETU.md's AI/CV stack list mentions these alongside OpenCV; the actual Phase 9 implementation is a hand-rolled pixel-threshold diff, not an ML model of any kind (a deliberate simplification, not an oversight).
- ~~Admin Portal real functionality~~ — ✅ done 2026-09-05, see §8 item 11. User/Role Management is a real create/promote-demote/delete UI over `/users`; Integration Monitoring is the "Recent Activity" audit feed. System Configuration (Tech.md §38's fourth ask) has no concrete config to expose in this codebase and remains a documented gap, not a placeholder pretending otherwise.
- ~~Write APIs for the spatial demo layers~~ — ✅ done 2026-09-05, see §8 item 13.
- **Python FastAPI change-detection service** — Tech.md §33 literally asks for this. Built as an equivalent Node/TypeScript pipeline instead, after explicitly asking the user which stack to use (see `docs/Plan.md`'s Phase 9 note) — a deliberate substitution, not an unaddressed gap.

---

## 7. Not mentioned anywhere — awareness gaps

Neither the SIH requirement text nor Tech.md/BHOOMISETU.md raise these at all. Not necessarily things to build, but worth knowing they've never been scoped by *any* source document, including the ones this team wrote:

- **Dispute resolution / litigation tracking** — ironically named in the SIH text itself (§1), but never elaborated anywhere in this project's own spec, and never built.
- **Notification delivery mechanism** (SMS/email/push) — Tech.md's own workflow diagram assumes citizen notification happens (§25) but never specifies *how*.
- **Multi-language / localization** — a real citizen-facing Indian land platform would plausibly need this; not raised anywhere.
- **Offline / low-connectivity support** — relevant for rural citizen access; not raised.
- **Payment gateway integration** — for tax payments or service-request fees; not raised.
- **Document/image OCR** for scanned physical land records; not raised.
- **Accessibility (WCAG/screen-reader) compliance** — not raised.
- **Data privacy / consent framework** (e.g. DPDP Act relevance for a real Indian government platform) — not raised.
- **Historical parcel-boundary versioning** — the platform has no concept of a parcel's geometry changing over time (which is somewhat in tension with Phase 9's own change-detection feature actually finding one).

---

## 8. Prioritized backlog

Every real gap from §1, §2, §3, and §6 above, scored the same way instead of ordered by which phase number Plan.md happened to give it. P0 and P1 rows are in score order; P2 rows are grouped so the item-9-and-its-dependents cluster stays together rather than being scattered by score alone (see the sequencing note below). §7's items are excluded from scoring (nothing requires them) but listed at the bottom for visibility.

**Scoring**: `Score = Requirement Weight × (4 − Effort)`, i.e. cheap-and-required rises to the top, expensive-and-optional sinks to the bottom.

- **Requirement Weight** — 3 = named in the SIH *required* text; 2 = named in the SIH *"will be preferred"* list, or is one of the required Standard Technical Document sections; 1 = only in Tech.md/BHOOMISETU.md (this team's own spec, not a competition ask); 0 = not mentioned anywhere (§7).
- **Effort** — 1 = small (hours, follows an existing pattern closely); 2 = medium (a focused session, some new design); 3 = large (multi-session, foundational, touches many modules).
- **Tier** — P0 (score 7-9): do first. P1 (4-6): do next. P2 (2-3): if time allows. P3 (0-1): skip unless there's a specific reason to want it.

| # | Item | Req. Wt | Effort | Score | Tier | Depends on |
|---|---|:-:|:-:|:-:|:-:|---|
| 1 | ~~**Assemble & correct the Standard Technical Document**~~ — ✅ **Done**, `docs/STANDARD_TECHNICAL_DOCUMENT.md` (2026-09-05) | 3 | 1 | **9** | P0 | — |
| 2 | ~~**Dispute workflow**~~ — ✅ **Done** (2026-09-05): `DisputeRecord` mock department, `DISPUTE_FILING` workflow type with its own review pipeline, 6th Parcel 360 tab, "File a Dispute" citizen action | 3 | 2 | **6** | P1 | — |
| 3 | ~~**Platform-wide analytics dashboard**~~ — ✅ **Done** (2026-09-05): `GET /analytics/summary`, an 8-chart `recharts` dashboard on the Admin Portal | 3 | 2 | **6** | P1 | — |
| 4 | ~~**Rate limiting**~~ — ✅ **Done** (2026-09-05): `@nestjs/throttler`, global 200 req/min/IP + a tighter 30 req/min on the Groq-backed AI and change-detection controllers | 2 | 1 | **6** | P1 | — |
| 5 | ~~**RBAC middleware**~~ — ✅ **Done** (2026-09-05): a `RolesGuard` + `@Roles(...)` decorator (paired with `JwtAuthGuard`) now guards every officer/admin-only route — workflow review, governance alerts, change detection, AI alert-explanation, both analytics controllers. Citizen-facing routes (parcel search/360/risk-score, AI query/parcel-explain, workflow creation) stay public. The workflow step-review endpoint additionally checks the acting officer's role against that specific step's `assignedRole` (ADMIN can override any department) — a LAND_RECORD_OFFICER can no longer approve a REGISTRATION step | 2 | 2 | **4** | P1 | Item 9 (real auth) |
| 6 | ~~**Dockerfiles + a locally-buildable `docker-compose up`**~~ — ⚠️ **Files written, not live-verified** (2026-09-05, Docker Desktop wasn't running and wasn't started this round). `docker compose config` validates the compose file; the Dockerfiles themselves caught two real bugs by inspection alone (see `docs/STANDARD_TECHNICAL_DOCUMENT.md` §9) but haven't been through an actual `docker build`/`up` | 2 | 2 | **4** | P1 | — |
| 7 | ~~**Mobile / responsive design pass**~~ — ✅ **Done** (2026-09-05): a real hamburger menu (`App.tsx`) replaces the nav links that simply vanished below the `md` breakpoint with no mobile alternative; the Parcel 360 "Actions" button row now wraps instead of overflowing. Everything else audited (Citizen/Officer/Admin portals, search, panels) was already responsive via Tailwind's mobile-first grid classes | 2 | 2 | **4** | P1 | — |
| 8 | ~~**Predictive analytics (scoped)**~~ — ✅ **Done** (2026-09-05): a transparent, hand-weighted heuristic risk score (tax delinquency 0.4, dispute exposure 0.3, open governance alerts 0.2, land-use restriction 0.1) — deliberately not a trained model, since this project has no labeled outcome data to train or validate one against. `GET /parcels/:id/risk-score` (Parcel 360's new "Risk Assessment" card, with per-factor rationale) and `GET /predictive-analytics/top-risk-parcels` (Admin Portal's new "Top At-Risk Parcels" list) | 2 | 2 | **4** | P1 | Item 3 helps but isn't required first |
| 9 | ~~**Real authentication**~~ — ✅ **Done** (2026-09-05): JWT (`@nestjs/jwt`) + bcrypt (`bcryptjs`) + a real `users` table (`POST /auth/login`, `GET /auth/me`), replacing the client-side-only "pick a name and role" simulated session. Scoped to Officer + Admin — the Citizen Portal never had an account concept (search/service-requests are anonymous), so there was no citizen session to migrate. A real sign-in page (`/login`) plus route-level gating (`RequireAuth`) protect `/officer` and `/admin` | 2 | 3 | **2** | P2 | — |
| 10 | ~~**Audit logging**~~ — ✅ **Done** (2026-09-05): real `AuditModule`/`AuditLog` entity (`audit_logs` table), `GET /audit` (admin-only, filterable by `entityType`/`userId`) and `GET /parcels/:id/audit` (staff-only). Logs `AUTH_LOGIN`, `WORKFLOW_STEP_APPROVED`/`REJECTED` (with department + remarks), `WORKFLOW_STATUS_CHANGED`, and `GOVERNANCE_ALERT_STATUS_CHANGED` — every officer/admin decision RBAC (item 5) now gates, matching Tech.md §25's "AUDIT LOG" diagram stage | 1 | 2 | **2** | P2 | Item 9 (needs a real `user_id` to log) |
| 11 | ~~**Admin Portal real functionality**~~ — ✅ **Done** (2026-09-05): real `GET/POST /users` + `PATCH /users/:id/role` + `DELETE /users/:id` (admin-only, audit-logged, self-lockout prevented), a "User Management" card on the Admin Portal (create/promote-demote/remove Officer+Admin accounts), and a "Recent Activity" card (a live `/audit` feed). "Total Users"/"Logins (24h)" on System Overview are now real counts, not static `0`s — "Active Sessions" was relabeled to "Logins (24h)" since JWTs are stateless and there's no session store to count concurrent sessions from | 3 | 3 | **3** | P2 | Item 9 (nothing real to manage without real users) |
| 12 | ~~**Citizen notification (MVP)**~~ — ✅ **Done** (2026-09-05): a "Your Requests" panel on Parcel 360 (`RequestNotifications.tsx`) shows a plain-language status feed for every service request filed on that parcel — reuses the existing public `GET /parcels/:id/workflows` endpoint, no new backend route needed. Refreshes immediately when a new request is filed (no manual reload) | 1 | 1 | **3** | P2 | — |
| 13 | ~~**Write APIs for spatial demo layers**~~ — ✅ **Done** (2026-09-05): `POST`/`PATCH`/`DELETE` for zoning overlays, restriction zones, and infrastructure features (admin-only), with real geometry-type validation (`Polygon` for zoning/restriction, `Point`/`LineString` for infrastructure). No frontend UI - no map-drawing tool exists to author new zone geometry, so this exists as tested API capability rather than a citizen/officer-facing feature | 1 | 1 | **3** | P2 | — |
| 14 | **PostGIS run end-to-end** — swap the JS point-in-polygon fallbacks for real `ST_*` queries against a live Postgres | 1 | 2 | **2** | P2 | — |
| 15 | **OAuth-based auth** — BHOOMISETU only says "where required"; JWT alone already covers Phase 10's real ask | 1 | 2 | **2** | P2 | Item 9 |

**Already resolved, not backlog items**: the literal "Python FastAPI + OpenCV" change-detection stack (Tech.md §33) and PyTorch/TensorFlow-based detection (BHOOMISETU's AI/CV list) were both deliberately substituted with the Node/TypeScript pipeline built in Phase 9, after asking which stack to use — re-litigating that isn't on this list.

**§7 items (score 0, no source document asks for them)**: multi-language/localization, offline/low-connectivity support, payment gateway integration, document/image OCR, WCAG accessibility, data-privacy/consent framework, historical parcel-boundary versioning. Skip unless there's a reason outside this audit to want one specifically.

### Reading the sequencing off this table

- **Every P0 and P1 item is now done.** Dockerfiles (item 6) are the one exception worth calling out on "done": written and statically validated, but never through an actual `docker build`/`up` (Docker Desktop wasn't running, per an explicit choice to keep this round files-only). Everything else — the Standard Technical Document, dispute workflow, analytics dashboard, rate limiting, the mobile/responsive pass, and predictive analytics — is both done and live-verified.
- **Items 9 and 5 are both done now** — real authentication, then real per-route authorization on top of it. Items 10, 11, and 12 built directly on top of that cluster (audit logging, Admin Portal user management, and the citizen notification feed) and are done too. Item 13 (spatial layer write APIs) had no dependency on any of this and is also done. **The only backlog items left are 14 (PostGIS end-to-end) and 15 (OAuth)** — both P2, both with an external-infrastructure or scope question that needs a call before proceeding (see the note at the end of this document).

---

## Summary

- **Every literal requirement in the SIH text is now fully met**, including real user/role management on the Admin Portal (§8 item 11, done 2026-09-05).
- **Every "preferred" bonus item is now met.** Predictive analytics and mobile/responsive design are both done (§8 items 7-8). Cloud/container deployment is file-complete (Dockerfiles + docker-compose.yml) but not live-verified — see item 6 below.
- **The Standard Technical Document deliverable is done** (`docs/STANDARD_TECHNICAL_DOCUMENT.md`) — it was the largest concrete gap, closed as §8 item 1.
- **The dispute workflow gap is done** (§8 item 2) — the last fully-missing item from §1's required list.
- **The analytics dashboard gap is done** (§8 item 3) — a real, platform-wide `recharts` dashboard on the Admin Portal, backed by real SQL aggregation.
- **Rate limiting is done** (§8 item 4) — `@nestjs/throttler` guards the AI and change-detection endpoints, live-verified via curl.
- **Dockerfiles + docker-compose.yml are written and statically validated** (§8 item 6) — `docker compose config` passes and two real bugs (a wrong entrypoint path, a Docker-internal hostname baked into the frontend build) were caught by inspection and fixed, but no container has actually been built or run (Docker Desktop wasn't started, per an explicit "files only" choice).
- **The mobile/responsive pass is done** (§8 item 7) — a working hamburger menu on `App.tsx` (the nav links previously just disappeared below `md` with no replacement, making the Officer/Admin portals unreachable by UI on a phone) and a wrap fix on the Parcel 360 "Actions" button row; live-verified at a 375px viewport with Playwright, zero console errors, zero horizontal overflow.
- **Predictive analytics is done** (§8 item 8) — a transparent, hand-weighted heuristic risk score (not a trained model — this project has no labeled outcome data to train or validate one against) combining tax delinquency, dispute exposure, open governance alerts, and land-use restrictions, each with a plain-language rationale. Exposed per-parcel on Parcel 360 ("Risk Assessment") and platform-wide on the Admin Portal ("Top At-Risk Parcels"); live-verified against real seeded data.
- **Every P0/P1 backlog item is now done** except item 6 (Dockerfiles, file-complete but not live-built).
- **Real authentication is done** (§8 item 9) — JWT + bcrypt + a real `users` table (`POST /auth/login`, `GET /auth/me`), a real sign-in page, and route-level gating on `/officer`/`/admin`, replacing the previous client-side-only simulated session. Live-verified end to end with Playwright: wrong password rejected with an inline error, correct login shows the real account's name and persists across a reload, wrong-role access redirects to login, and the previously-unreachable `DISPUTE_OFFICER` role (referenced by the dispute workflow pipeline but never actually selectable) can now log in. Caught and fixed a real bug along the way: `apiService.ts`'s response interceptor hard-redirected to `/login` on *any* 401, including a failed login attempt itself — only a live browser check surfaced it, since every unit test mocks `apiService` and never exercises the interceptor.
- **RBAC route guards are done** (§8 item 5) — a `RolesGuard`/`@Roles(...)` pair now guards every officer/admin-only route: workflow review/listing, governance alerts, change detection, the AI alert-explain endpoint, and both analytics controllers. Citizen-facing routes (search, Parcel 360, risk score, AI query/parcel-explain, workflow creation) stay public, matching the actual frontend UX boundary rather than locking down more than the app needs. The workflow step-review endpoint goes one level finer: a `LAND_RECORD_OFFICER` gets a real 403 trying to decide a `REGISTRATION` step, verified live via curl (401/403/200 across no-token/wrong-role/right-role) and Playwright (a full officer login → dashboard → approve flow, and the previously-broken `DISPUTE_OFFICER` doing the same). 14 new backend e2e tests cover the guard behavior directly, including the 403 case.
- **Audit logging is done** (§8 item 10) — a real `AuditLog`/`audit_logs` table records `AUTH_LOGIN` and every officer/admin decision (workflow step approve/reject, workflow status change, governance alert status change) with who/what/when/metadata. `GET /audit` (admin) and `GET /parcels/:id/audit` (staff) expose it; live-verified against the real running app.
- **Admin Portal real functionality is done** (§8 item 11) — real "Total Users"/"Logins (24h)" counts (the latter honestly counts login *events* in the last 24h, not concurrent sessions, since JWTs are stateless), a "User Management" card (create/promote-demote/delete accounts, self-lockout prevented), and a "Recent Activity" card reading the item-10 audit trail. Caught and fixed a real bug along the way: creating/deleting a user didn't refresh the Recent Activity panel elsewhere on the same page until a manual reload, since its query cache key was never invalidated — only a live Playwright pass (not the unit tests, which mock each component in isolation) surfaced it.
- **The citizen notification MVP is done** (§8 item 12) — a "Your Requests" panel on Parcel 360 showing plain-language status for every request filed on that parcel, reusing the existing public workflow-listing endpoint.
- **Spatial layer write APIs are done** (§8 item 13) — real `POST`/`PATCH`/`DELETE` for zoning/restriction/infrastructure layers, admin-only, with geometry-type validation. No frontend UI accompanies this (no map-drawing tool exists to author new zone geometry) — it exists as tested API capability, matching what the backlog item actually asked for.
- **What's left**: items 14 (PostGIS end-to-end) and 15 (OAuth) — both P2, both flagged rather than silently built or skipped; see the note below this summary for why.
- **§8's scoring correctly put the Standard Technical Document, dispute workflow, and analytics dashboard ahead of authentication** — all three closed a named requirement gap for less effort than real authentication took, which still landed mid-table (P2) despite being the largest single piece of work in this backlog.

### A note on items 14 and 15

- **Item 14 (PostGIS end-to-end)** requires an actual running PostgreSQL + PostGIS instance to responsibly claim done — the `ST_*` query rewrite is real spatial SQL, and shipping it unverified risks exactly the kind of silent bug this project has otherwise caught by testing live at every step (see item 6's Dockerfile bugs, item 9's interceptor bug, item 11's cache-invalidation bug — all found by actually running something, never by code review alone). No Postgres instance is running in this environment today, and spinning one up (via Docker or a local install) is an infrastructure decision, not a code one.
- **Item 15 (OAuth-based auth)** would need a real OAuth application registered with an external provider (Google/GitHub, etc.) — a client ID and secret that only the user can provision, not something buildable from inside this environment. The backlog's own scoring note already observes JWT alone covers Phase 10's actual ask; BHOOMISETU.md only asks for OAuth "where required," and nothing in this project's real requirements requires it.
