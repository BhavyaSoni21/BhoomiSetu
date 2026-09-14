# BhoomiSetu Feature Audit

A cross-reference of what this project is actually required to do, what the team's own technical spec additionally proposed, and what's actually built — as of 2026-09-07, after Phase 9 of `docs/Plan.md`, plus the frontend design-system/flow redesign and the fuller-PS re-audit described in the update note below.

**Update (2026-09-07):** the competition's actual "Land Stack" problem statement text turns out to be fuller and more specific than the condensed "Expected Solution" text §1 was originally audited against — it adds real background (land as a State subject, format/schema/unit/language diversity across states), the actual pilot rollout (Chandigarh + Tamil Nadu, launched 2025-12-31, scaling to one city + one village per State/UT), and — most usefully for this audit — a concrete **three-tier spatial data model** (Base / Essential / Additional layers) that the shorter text only implied. §1's table below is left as-is (still accurate at the level it was written); the new **§1a** audits specifically against that three-tier model and the pilot narrative, since those are the parts genuinely new information here. It surfaces three real, previously-unnoticed gaps (encumbrance/mortgage records, valuation references, no Chandigarh cluster in seed data) and confirms two gaps §3 previously flagged — color schema and UI/UX guidelines — are now closed by this session's `docs/design.md`/`docs/flow.md` redesign work (see the updated §3 table).

Also from this session, unrelated to the PS re-audit but worth recording here rather than leaving undocumented: filing a citizen service request now requires a signed-in `CITIZEN` account (`POST /workflows` was public/anonymous before — see `docs/flow.md` §9), and a self-service citizen registration page exists as a **placeholder** (`/register` — no `POST /auth/register` endpoint yet, per `docs/flow.md` §4). Neither is a PS requirement; both are this team's own IA decisions and aren't scored in §8.

## Sources used

1. **The official SIH "Expected Solution"** — the competition's actual requirement text (pasted into this project's working session; not a file in this repo). This is the only source that matters for "is this required." As of 2026-09-07 a fuller version of this text (the "Land Stack" background/detailed-description/expected-solution text) was pasted in during a working session — see §1a. It's still not committed as a file anywhere; see the recommendation at the end of §1a.
2. **`Tech.md` / `BHOOMISETU.md`** — this team's own technical spec and vision document, written *from* the SIH problem statement. They elaborate heavily beyond the bare requirement text (specific schemas, specific endpoints, specific tech choices) — most of that elaboration is the team's own design judgment, not a competition requirement.
3. **`docs/Plan.md`** — the phase-by-phase build log, with a dated verification note after every phase describing exactly what was built, what broke, and how it was fixed.
4. **`docs/design.md` / `docs/flow.md`** (2026-09-07) — the frontend design-system and IA rewrite. Directly closes two gaps §3 previously flagged (color schema, UI/UX guidelines) — see the updated §3 table.

Where these disagree — and they do, in places — that disagreement is itself useful information and is called out explicitly below.

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
| Integration of mock/sample land-related datasets | ✅ | Two structurally different state schemas (Phase 3), 7 mock department APIs (Phase 4 + §8 item 17's Encumbrance), 220 seeded parcels across 5 real regions (§8 item 19 added Chandigarh 2026-09-09) |
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

## 1a. The three-tier spatial layer model (fuller "Land Stack" PS text, 2026-09-07)

The fuller PS text organizes all governance data into three explicit tiers around a parcel-centric spatial framework, and separately narrates the actual pilot rollout. Both are more specific than §1's paraphrased list and are audited here for the first time.

### Base layer — georeferenced cadastral maps, parcel boundaries, unique identifiers (ULPIN)

| Item | Status | Notes |
|---|---|---|
| Georeferenced cadastral maps / parcel boundaries | ✅ | GeoJSON polygons, WGS84, a real connected coordinate lattice per cluster — adjacent parcels share literal boundary vertices, not independently-drawn polygons that happen to sit near each other (`docs/STANDARD_TECHNICAL_DOCUMENT.md` §6) |
| ULPIN as a unique parcel identifier | ✅ | `parcel_identifiers` table; ULPIN is searchable (`GET /parcels?ulpin=`) and shown throughout Parcel 360/search — one of several identifiers a parcel resolves by (survey/plot/local), matching the PS's own wording ("unique parcel identifiers **such as** ULPIN" / "ULPIN serving as **the suggested** common identifier") rather than a ULPIN-only model, which also matches how Indian land records are actually identified in practice |

### Essential layers — RoR, registration, master plan, building permissions, encumbrance/mortgage, land use/zoning

| Item | Status | Notes |
|---|---|---|
| Record of Rights (ownership) | ✅ | State A/B land-record schemas (`ownerName`/`holderName`, survey/plot number, area) — functionally the RoR/7-12-extract equivalent; the frontend copy already calls it "7/12 extract." **Strengthened 2026-09-09**: a new `OwnershipHistoryRecord` (§5) adds the mutation-history dimension a real RoR carries, on a representative subset of parcels |
| Registration data | ✅ | `registration-record.entity.ts` — status, number, date, last transaction type/date |
| Master plan | ⚠️ | `planning-record.entity.ts` has a `masterPlanReference` field (a reference/pointer), not a full master-plan document or geometry dataset — reasonable for a prototype, but worth naming as partial rather than full |
| Building permissions and approvals | ⚠️ | `planning-record.entity.ts`'s `buildingPermissionStatus` (`APPROVED`/`PENDING`/`NOT_REQUIRED`) is a status field, not a permit-application workflow — no permit number, application date, approving authority, or citizen-facing "apply for a building permit" flow exists |
| **Encumbrance and mortgage records** | ✅ | **Done (2026-09-09, §8 item 17).** `encumbrance-record.entity.ts` — a 7th mock department (`hasEncumbrance`/`encumbranceType`/`lenderName`/`instrumentReference`/`registeredDate`/`dischargeDate`), `GET /encumbrance/:parcelId`, wired into `GET /parcels/:id/360`'s `departments` object, a new Parcel 360 tab, seeded on ~17% of parcels |
| Land use and zoning | ✅ | `planning-record.entity.ts`'s `landUse`/`zoningClassification`, plus a real zoning-overlay map layer (Pune cluster) |

### Additional / use-case layers — utility infrastructure, taxation, valuation, infrastructure networks, environmental/restriction zones, other service linkages

| Item | Status | Notes |
|---|---|---|
| Utility infrastructure | ✅ | GIS infrastructure overlay layer (road/water-line/electricity points, Pune cluster) |
| Property taxation records | ✅ | `tax-record.entity.ts` — assessed value, annual tax, status, outstanding amount, last payment |
| **Valuation references** | ✅ | **Done (2026-09-09, §8 item 18).** `tax-record.entity.ts` gained `marketValueReference`/`valuationDate`/`valuationSource` (`CIRCLE_RATE`/`COMPARABLE_SALE`), independent of `assessedValue` — surfaced on Parcel 360's Tax tab |
| Infrastructure networks | ✅ | Same dataset as utility infrastructure above — the PS text names both terms, the build has one dataset serving both |
| Environmental / restriction zones | ✅ | `restriction-record.entity.ts` + the restriction-zone map overlay (a flood-prone zone affecting ~8 parcels) |
| Other service linkages | ⚪ | Open-ended by design in the PS text; this project's actual "other" linkages are the dispute workflow and governance-alerts system — both built, but not built *because* of this heading |

**Net for §1a's layer model (updated 2026-09-09): 10 of 12 named items are fully ✅**, encumbrance/mortgage and valuation references both closed as §8 items 17/18. The remaining 2 (master plan, building permissions) are ⚠️ partial by deliberate scope — a reference field and a status field respectively are reasonable depth for a prototype; a full permit-application workflow or master-plan document store was never the ask.

### Pilot-location alignment

The PS names **Chandigarh and Tamil Nadu** as the actual launched pilot locations (2025-12-31), scaling to "one city and one village in every State/UT." The seed data's 5 clusters are Pune (MH), **Chennai (TN)**, Bangalore (KA), New Delhi (DL), **Chandigarh (CH)**:

- Tamil Nadu (Chennai) ✅ already represented.
- Chandigarh ✅ **Done (2026-09-09, §8 item 19)** — a 5th seed cluster (`CH-CHANDIGARH-01`, 20 parcels), same generation pipeline as the other 4.
- "One village" per State/UT: still not literally modeled — the seed's 5 clusters remain 5 unrelated single clusters in 5 different states/UTs, not a city+village pair sharing one state's schema. Left as-is; §8 item 19 scoped Chandigarh's addition specifically, not the city/village pairing, and the interoperability layer doesn't care which real place a cluster represents either way.

### Recommendation

This fuller PS text has never been saved into the repo — it exists only as text pasted into two different working sessions (the original condensed version, and this fuller one). Worth committing verbatim as `docs/PROBLEM_STATEMENT.md` so future audits stop depending on session memory of what was pasted when and can diff against a real source file instead.

---

## 1b. Cross-check against `docs/CITIZEN_FEATURES_UPGRADE_PLAN.md` (already-planned, not yet built)

That document is a separate, already-scoped roadmap for citizen-dashboard upgrades (Land Claim, document persistence, officer routing, context-aware alerts, historical spatial state, a dashboard aggregation endpoint, deferred address search, a Bhuvan integration spike) — none of it competition-required, all of it this team's own planned future work, governed by its own rule ("citizens claim existing canonical parcels; they never create geometry"). It doesn't change any status in §1/§1a — nothing in it is named by the PS text — but two real connections are worth recording so the two documents don't silently drift apart:

- **Land Claim (that plan's §3.1)**: this session's frontend redesign added a visible "Land Claim" placeholder card to the Citizen dashboard (`docs/flow.md` §6/§7) — purely a "Coming Soon" UI shell, no backend behind it. That plan's `PARCEL_CLAIM` workflow-type design is the real target this placeholder is standing in for; the backend work it describes (§3.1-3.2) is unchanged and still fully open.
- **Historical spatial state (that plan's §3.4) vs. §7's "Historical parcel-boundary versioning" below**: these are related but *not* the same gap. §7's bullet is about a parcel's **geometry** changing over time (no source document asks for this, score 0). That plan's §3.4 deliberately proposes **attribute-only** versioning instead (`landUse`/`zoningStatus`/`restrictionStatus`/`taxStatus` per year, explicitly *not* geometry) — its own text frames this as "the tractable version" of a similar concern. So: attribute history has a real, scoped plan elsewhere; geometry history (§7) is still genuinely unscoped by anyone.
- **Dashboard aggregation endpoint (that plan's §5, `GET /citizen/dashboard`)**: this is what would make this session's aggregated "My Requests" placeholder card real — right now that card has the same "Coming Soon" status as Land Claim, for the same reason (no backend aggregation query exists yet).
- Everything else in that plan (document persistence tied to a claim, officer workload-based routing, a third governance-alert trigger, deferred address search, the Bhuvan spike) is a refinement to a feature this audit already marks ✅ against the PS, not a new PS gap — that plan's own §7 sequencing is the right place to track sequencing for those, not this document's §8.

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
| Secure cloud-native architecture | ✅ | Rate limiting (2026-09-05, §8 item 4), real JWT+bcrypt auth with RBAC (§8 items 9/5), and a live-verified `docker compose up --build` (2026-09-06, §8 item 6) are all done. Public-demo hosting hardening — JWT_SECRET fail-fast, CORS allowlisting, no exposed DB port — is also done (§8 item 16) |

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
| GIS standards | `BHOOMISETU.md` §41 | Yes — GeoJSON, parcel polygons, layered map. Real PostGIS `ST_*` spatial queries now run against a live Postgres instance (Supabase) when configured (§8 item 14); SQLite dev mode still uses the JS fallback, since SQLite has no PostGIS |
| Security frameworks | `Tech.md` §39 (Security Requirements) | ⚠️ **Partially built.** JWT + bcrypt (§8 item 9), RBAC route guards (§8 item 5), and rate limiting (§8 item 4) are all done and live-verified; audit logging is the one piece of this section still not built |
| UI/UX guidelines | `BHOOMISETU.md` §42; superseded by `docs/design.md`/`docs/flow.md` | ✅ **Done (2026-09-07).** A real design system (`docs/design.md`) and IA/flow spec (`docs/flow.md`) now exist and were followed for a full restyle of every page — citizen-first search/map/verify, a GIS-first map treatment, progressive Parcel-360 tabs, and color-coded workflow-status badges were all explicitly re-verified during the redesign (screenshotted in both light/dark themes across all three role dashboards, logged in against real seeded data). The fifth principle (consistent design/terminology) is now structurally enforced rather than hoped for: every component reads color off five shared semantic Tailwind tokens (`primary`/`secondary`/`accent`/`ink`/`surface`, CSS-variable-backed for dark mode) instead of hand-picked hex values, so visual drift would require deliberately bypassing the token system, not just copy-pasting a slightly different value |
| Color schemas | `BHOOMISETU.md` §43; superseded by `docs/design.md` §2 | ✅ **Done (2026-09-07).** `docs/design.md` formalizes almost exactly the palette `BHOOMISETU.md` §43 proposed — deep forest green (primary), terracotta/soil brown (secondary), gold/amber (accent) — derived from the project's own logo rather than invented from scratch, then wired as CSS-variable-backed Tailwind tokens with a working dark-mode variant (which §43 never asked for but is a natural extension of the same token system). All three portals plus login/register were rebuilt against it. The "52 raw color-utility occurrences, no relation to the proposed schema" problem this row used to describe no longer describes the current codebase for the pages rebuilt this session |
| Deployment & scalability | `BHOOMISETU.md` §44, Tech.md §43-45 | ✅ **`docker compose up --build` live-verified from a fresh volume (2026-09-06, §8 item 6)** — all 3 containers build and start, real demo data seeds inside the container, spatial/auth API responses confirmed working through the published ports. Public-demo hosting hardening also done (§8 item 16). Still nothing deployed to an actual public host — no platform has been chosen |

**Net assessment**: the *deliverable* gap (a) is now closed. Two of the three underlying gaps this table originally documented are now also genuinely closed, not just accurately written down: (c) the color-scheme and UI-guideline sections are now actually followed, verified live across every page. (b) The data-schema/architecture drift is still just accurately documented rather than fixed — nobody has renamed `stateCode`→`state_code` to match Tech.md's snake_case convention or drawn the module dependency diagram, and doing either now would be pure naming/documentation churn against a stable, working schema, not a real functional gap.

**Note:** `docs/STANDARD_TECHNICAL_DOCUMENT.md` itself (the actual SIH deliverable file) still describes the *old* pre-redesign state in its own §8 (Color Schema) and UI/UX sections — this table has been updated here, but that document's own text hasn't been re-synced to match yet. Flagging so it doesn't silently drift; not fixed as part of this pass since it wasn't the file asked for.

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

Automated coverage: **238 backend e2e tests** (Jest+Supertest, isolated in-memory SQLite) + **141 frontend tests** (Vitest+RTL) = 379 total, as of 2026-09-09 (up from 328 as of 2026-09-05 — the growth is the citizen-auth-gated workflow-creation tests from the frontend redesign, plus §8 items 17-19's new encumbrance/ownership-history coverage). `tsc --noEmit` and both production builds clean as of the last verification.

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
- **Ownership history** (2026-09-09) — a new `OwnershipHistoryRecord` (`parcelId`/`ownerName`/`transactionType`/`transactionDate`/`documentReference`), a chain of 1-3 prior owners on a representative subset of parcels ending at the same name State A/B records already carry, surfaced as a new Parcel 360 tab. Citizen-visibility is deliberately restricted to a citizen actually associated with that parcel (`citizen_parcels`) — confirmed with the user rather than assumed, since previous-owner names are personal information about people other than the viewing citizen. No source document named this; it strengthens §1a's already-✅ Record of Rights row rather than closing a gap.
- **Governance alerts pagination** (2026-09-09) — `GovernanceAlertsPanel.tsx` paged client-side (5/page) instead of rendering every open alert in one unbounded scroll, confirmed live against 28 seeded alerts (6 pages). Not required by any source document; a UX fix the user asked for directly after seeing the unpaginated list during this session's earlier verification pass.
- **238 backend / 141 frontend automated tests (379 total, as of 2026-09-09)** — up from 372 (2026-09-07): §8 items 17-19's new encumbrance/ownership-history coverage added 7 backend e2e tests. Neither source document specifies a coverage target; every phase's tests were added because verifying live behavior by hand doesn't scale across 9+ phases.

---

## 6. Specified in Tech.md/BHOOMISETU.md but not implemented yet

Real gaps against the team's *own* spec — separate from §1's gaps against the *competition's* requirement.

- ~~Real authentication~~ — ✅ done 2026-09-05, see §8 item 9.
- ~~RBAC middleware~~ — ✅ done 2026-09-05, see §8 item 5.
- **Audit logging** — `AuditModule` is still `@Module({})`, `audit_logs` table doesn't exist, `GET /api/v1/audit` and `GET /api/v1/parcels/:id/audit` (Tech.md §26) don't exist. Tech.md's simulated-workflow diagram (§25) explicitly includes an `AUDIT LOG` stage between officer decision and citizen notification that has never been built.
- **Citizen notification** — the same diagram's final stage (`CITIZEN NOTIFICATION`) doesn't exist; a citizen has to manually re-check a workflow's status, nothing pushes an update to them.
- ~~Rate limiting~~ — ✅ done 2026-09-05, see §8 item 4.
- **HTTPS / real deployment** — `docker compose up --build` is now live-verified (§8 item 6) and public-demo hosting hardening is done (§8 item 16), but nothing has actually been deployed to a public host yet — no platform has been chosen, and the right HTTPS approach depends entirely on that choice (a PaaS with automatic TLS vs. a self-managed box needing nginx+certbot).
- ~~PostGIS in an actually-running Postgres instance~~ — ✅ done 2026-09-06, see §8 item 14.
- **OAuth-based authentication** — mentioned as a possibility in BHOOMISETU.md's Authentication section; not built (JWT alone is Phase 10's actual scope).
- **PyTorch/TensorFlow-based change detection** — BHOOMISETU.md's AI/CV stack list mentions these alongside OpenCV; the actual Phase 9 implementation is a hand-rolled pixel-threshold diff, not an ML model of any kind (a deliberate simplification, not an oversight).
- ~~Admin Portal real functionality~~ — ✅ done 2026-09-05, see §8 item 11. User/Role Management is a real create/promote-demote/delete UI over `/users`; Integration Monitoring is the "Recent Activity" audit feed, given its own dedicated System Monitoring page 2026-09-09 (`docs/FRONTEND_UPGRADE_SPEC.md` §7) rather than sharing a card with User Management, alongside a new real "Departments" admin CRUD page (`/admin/departments`, display/admin metadata over the existing hardcoded department codes). System Configuration (Tech.md §38's fourth ask) still has no concrete config to expose in this codebase and remains a documented gap - Workflow Configuration and Governance Rules (`docs/FRONTEND_UPGRADE_SPEC.md` §7) would be the real version of this, and are still planning-only, scoped as their own separate engine-rewrite effort.
- ~~Write APIs for the spatial demo layers~~ — ✅ done 2026-09-05, see §8 item 13.
- **Python FastAPI change-detection service** — Tech.md §33 literally asks for this. Built as an equivalent Node/TypeScript pipeline instead, after explicitly asking the user which stack to use (see `docs/Plan.md`'s Phase 9 note) — a deliberate substitution, not an unaddressed gap.

---

## 7. Not mentioned anywhere — awareness gaps

Neither the SIH requirement text nor Tech.md/BHOOMISETU.md raise these at all. Not necessarily things to build, but worth knowing they've never been scoped by *any* source document, including the ones this team wrote:

- **Dispute resolution / litigation tracking** — ironically named in the SIH text itself (§1), but never elaborated anywhere in this project's own spec, and never built.
- **Notification delivery mechanism** (SMS/email/push) — Tech.md's own workflow diagram assumes citizen notification happens (§25) but never specifies *how*.
- ~~Multi-language / localization~~ — ✅ built anyway: a real English/Hindi UI (`i18next`/`react-i18next`, `frontend/src/i18n/`) covers the navbar, landing hero, parcel search, Citizen Portal panels, and the map's layer labels/click popup, with the language choice persisted across visits. Marathi/Kannada are scaffolded but intentionally not enabled until their locale files exist. Not required by any source document, but a genuinely reasonable call for a real citizen-facing Indian land platform, matching the OCR item's precedent above.
- **Offline / low-connectivity support** — relevant for rural citizen access; not raised.
- **Payment gateway integration** — for tax payments or service-request fees; not raised.
- ~~Document/image OCR~~ — ✅ built 2026-09-06 anyway, at the user's explicit request, as a citizen-facing "Document Verification" feature (`tesseract.js` OCR + cross-check against actual parcel records) — see `docs/Plan.md` Phase 11. Score-0 items are "skip unless there's a reason to want one specifically"; the user provided one.
- **Accessibility (WCAG/screen-reader) compliance** — not raised.
- **Data privacy / consent framework** (e.g. DPDP Act relevance for a real Indian government platform) — not raised.
- ~~Historical parcel-boundary versioning~~ — the platform has no concept of a parcel's *geometry* changing over time (somewhat in tension with Phase 9's own change-detection feature actually finding one). Not the same gap as `docs/CITIZEN_FEATURES_UPGRADE_PLAN.md` §3.4's "historical spatial state," which deliberately scopes *attribute*-only history instead — see §1b above. **Now scoped, not implemented** (2026-09-08): `docs/FRONTEND_UPGRADE_SPEC.md` §8 designs a small per-cluster/per-year image archive (a `ClusterHistoricalSnapshot` entity, ~16-20 stored images) cross-checked against §3.4's `ParcelHistoricalState` table to flag visually-changed-but-unrecorded parcels as `UNAUTHORIZED_CHANGE_DETECTED` governance alerts. This is image-based, not the geometry-versioning this bullet describes, and not yet built — moving this row from §7 (score 0) would be premature until it exists.

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
| 6 | ~~**Dockerfiles + a locally-buildable `docker-compose up`**~~ — ✅ **Done, live-verified** (2026-09-06): a real `docker compose up --build` from a completely fresh volume now builds all 3 images and starts frontend/backend/PostGIS successfully, seeds real demo data inside the container, and serves working spatial/auth API responses through the published ports. Two real bugs only a live run could catch (static review, including this document's own prior pass, missed both) — see the note below this table | 2 | 2 | **4** | P1 | — |
| 16 | ~~**Public-demo hosting hardening**~~ — ✅ **Done** (2026-09-06): fail-fast startup check refuses to boot under `NODE_ENV=production` with an unset/placeholder `JWT_SECRET` (live-verified: both the refuse-to-start and starts-normally paths); CORS now restricts to an explicit allowlist via `CORS_ORIGIN` when set, wide-open (unchanged) when it isn't (live-verified: an allowed origin gets the reflected header, a disallowed one gets none); `trust proxy` set so `@nestjs/throttler`'s per-IP limiting reads the real client IP behind a reverse proxy; `docker-compose.yml` no longer publishes PostGIS's `5432` to the host, which put a database with default `postgres`/`postgres` credentials directly on the public internet on any host with a public IP | 3 | 1 | **9** | P0 | — |
| 7 | ~~**Mobile / responsive design pass**~~ — ✅ **Done** (2026-09-05): a real hamburger menu (`App.tsx`) replaces the nav links that simply vanished below the `md` breakpoint with no mobile alternative; the Parcel 360 "Actions" button row now wraps instead of overflowing. Everything else audited (Citizen/Officer/Admin portals, search, panels) was already responsive via Tailwind's mobile-first grid classes | 2 | 2 | **4** | P1 | — |
| 8 | ~~**Predictive analytics (scoped)**~~ — ✅ **Done** (2026-09-05): a transparent, hand-weighted heuristic risk score (tax delinquency 0.4, dispute exposure 0.3, open governance alerts 0.2, land-use restriction 0.1) — deliberately not a trained model, since this project has no labeled outcome data to train or validate one against. `GET /parcels/:id/risk-score` (Parcel 360's new "Risk Assessment" card, with per-factor rationale) and `GET /predictive-analytics/top-risk-parcels` (Admin Portal's new "Top At-Risk Parcels" list) | 2 | 2 | **4** | P1 | Item 3 helps but isn't required first |
| 9 | ~~**Real authentication**~~ — ✅ **Done** (2026-09-05): JWT (`@nestjs/jwt`) + bcrypt (`bcryptjs`) + a real `users` table (`POST /auth/login`, `GET /auth/me`), replacing the client-side-only "pick a name and role" simulated session. Scoped to Officer + Admin — the Citizen Portal never had an account concept (search/service-requests are anonymous), so there was no citizen session to migrate. A real sign-in page (`/login`) plus route-level gating (`RequireAuth`) protect `/officer` and `/admin` | 2 | 3 | **2** | P2 | — |
| 10 | ~~**Audit logging**~~ — ✅ **Done** (2026-09-05): real `AuditModule`/`AuditLog` entity (`audit_logs` table), `GET /audit` (admin-only, filterable by `entityType`/`userId`) and `GET /parcels/:id/audit` (staff-only). Logs `AUTH_LOGIN`, `WORKFLOW_STEP_APPROVED`/`REJECTED` (with department + remarks), `WORKFLOW_STATUS_CHANGED`, and `GOVERNANCE_ALERT_STATUS_CHANGED` — every officer/admin decision RBAC (item 5) now gates, matching Tech.md §25's "AUDIT LOG" diagram stage | 1 | 2 | **2** | P2 | Item 9 (needs a real `user_id` to log) |
| 11 | ~~**Admin Portal real functionality**~~ — ✅ **Done** (2026-09-05): real `GET/POST /users` + `PATCH /users/:id/role` + `DELETE /users/:id` (admin-only, audit-logged, self-lockout prevented), a "User Management" card on the Admin Portal (create/promote-demote/remove Officer+Admin accounts), and a "Recent Activity" card (a live `/audit` feed). "Total Users"/"Logins (24h)" on System Overview are now real counts, not static `0`s — "Active Sessions" was relabeled to "Logins (24h)" since JWTs are stateless and there's no session store to count concurrent sessions from | 3 | 3 | **3** | P2 | Item 9 (nothing real to manage without real users) |
| 12 | ~~**Citizen notification (MVP)**~~ — ✅ **Done** (2026-09-05): a "Your Requests" panel on Parcel 360 (`RequestNotifications.tsx`) shows a plain-language status feed for every service request filed on that parcel — reuses the existing public `GET /parcels/:id/workflows` endpoint, no new backend route needed. Refreshes immediately when a new request is filed (no manual reload) | 1 | 1 | **3** | P2 | — |
| 13 | ~~**Write APIs for spatial demo layers**~~ — ✅ **Done** (2026-09-05): `POST`/`PATCH`/`DELETE` for zoning overlays, restriction zones, and infrastructure features (admin-only), with real geometry-type validation (`Polygon` for zoning/restriction, `Point`/`LineString` for infrastructure). No frontend UI - no map-drawing tool exists to author new zone geometry, so this exists as tested API capability rather than a citizen/officer-facing feature | 1 | 1 | **3** | P2 | — |
| 14 | ~~**PostGIS run end-to-end**~~ — ✅ **Done** (2026-09-06): connected to a live Supabase Postgres+PostGIS instance (via its IPv4 connection pooler — the direct-connection host is IPv6-only and doesn't resolve from this environment); all 4 JS spatial-fallback call sites (`GisService.findAll` bbox, `GisService.findParcelAtLocation`, `ParcelsService.getNeighbours`, `ChangeDetectionService.analyze`'s spatial intersection) now branch on `isPostgisAvailable()` and run real parameterized `ST_Intersects`/`ST_Contains`/`ST_Distance`/`ST_DWithin`/`ST_Centroid` queries against it, falling back to the original JS geometry helpers unchanged when running on SQLite | 1 | 2 | **2** | P2 | — |
| 15 | **OAuth-based auth** — BHOOMISETU only says "where required"; JWT alone already covers Phase 10's real ask | 1 | 2 | **2** | P2 | Item 9 |
| 17 | ~~**Encumbrance and mortgage records**~~ — ✅ **Done** (2026-09-09): `EncumbranceRecord` mock department (`hasEncumbrance`/`encumbranceType`/`lenderName`/`instrumentReference`/`registeredDate`/`dischargeDate`), `GET /encumbrance/:parcelId`, wired into the response aggregator and a new Parcel 360 tab, seeded on ~17% of parcels, full e2e test coverage | 3 | 2 | **6** | P1 | — |
| 18 | ~~**Valuation references**~~ — ✅ **Done** (2026-09-09): `tax-record.entity.ts` gained `marketValueReference`/`valuationDate`/`valuationSource`, independent of `assessedValue`, surfaced on Parcel 360's Tax tab | 2 | 1 | **6** | P1 | — |
| 19 | ~~**Chandigarh pilot cluster**~~ — ✅ **Done** (2026-09-09): a 5th seed cluster (`CH-CHANDIGARH-01`, 20 parcels, `parcel-generation` module, same pattern as the other 4). The explicit city/village pairing this item also floated is *not* done — left as a presentation-level nice-to-have, not rescored | 2 | 2 | **4** | P1 | — |

**Already resolved, not backlog items**: the literal "Python FastAPI + OpenCV" change-detection stack (Tech.md §33) and PyTorch/TensorFlow-based detection (BHOOMISETU's AI/CV list) were both deliberately substituted with the Node/TypeScript pipeline built in Phase 9, after asking which stack to use — re-litigating that isn't on this list.

**§7 items (score 0, no source document asks for them)**: offline/low-connectivity support, payment gateway integration, WCAG accessibility, data-privacy/consent framework, historical parcel-boundary versioning. Skip unless there's a reason outside this audit to want one specifically. (Document/image OCR and multi-language/localization were also on this list but are now built — see above.)

### Reading the sequencing off this table

- **Every P0 and P1 item is now done, live-verified, not just statically reviewed.** Item 6 (Dockerfiles) was the one long-standing pre-existing exception — closed 2026-09-06 with a real `docker compose up --build` from a fresh volume, which surfaced two real bugs neither a code read nor `docker compose config` had caught (see the note below).
- **Items 9 and 5 are both done now** — real authentication, then real per-route authorization on top of it. Items 10, 11, and 12 built directly on top of that cluster (audit logging, Admin Portal user management, and the citizen notification feed) and are done too. Item 13 (spatial layer write APIs) had no dependency on any of this and is also done. Item 14 (PostGIS end-to-end) is now done too. Item 16 (public-demo hosting hardening) closes out the concrete gaps a public demo deployment would actually hit. Item 15 (OAuth) remains P2, with a scope question that needs a call before proceeding (see the note at the end of this document).
- **Items 17-19, surfaced by the fuller PS text (2026-09-07), are now also done (2026-09-09).** 17 (encumbrance/mortgage records) and 18 (valuation references) followed an existing, well-trodden department-mock pattern; 19 (Chandigarh cluster) reused the existing `parcel-generation` module. **Item 15 (OAuth) is the only backlog item genuinely open right now.**

---

## Summary

- **Every literal requirement in the condensed SIH text (§1) is still fully met**, including real user/role management on the Admin Portal (§8 item 11, done 2026-09-05). **Against the fuller "Land Stack" PS text's three-tier spatial layer model (§1a), 10 of 12 named data layers are now fully built** (encumbrance/mortgage records and valuation references both closed 2026-09-09, §8 items 17-18) — the remaining 2 (master plan, building permissions) are deliberately partial-depth, not gaps. The Chandigarh pilot cluster (§8 item 19) is also done.
- **Every "preferred" bonus item is now met.** Predictive analytics and mobile/responsive design are both done (§8 items 7-8). Cloud/container deployment is done and live-verified (§8 item 6) — see below.
- **The Standard Technical Document deliverable is done** (`docs/STANDARD_TECHNICAL_DOCUMENT.md`) — it was the largest concrete gap, closed as §8 item 1. **Two of the three underlying gaps that document's own audit table still flagged are now also genuinely closed (2026-09-07): color schema and UI/UX guidelines are both followed, not just documented as not-yet-followed** — see the updated §3 table. (`docs/STANDARD_TECHNICAL_DOCUMENT.md`'s own text hasn't been re-synced to say so yet — flagged there too.)
- **The dispute workflow gap is done** (§8 item 2) — the last fully-missing item from §1's required list.
- **The analytics dashboard gap is done** (§8 item 3) — a real, platform-wide `recharts` dashboard on the Admin Portal, backed by real SQL aggregation.
- **Rate limiting is done** (§8 item 4) — `@nestjs/throttler` guards the AI and change-detection endpoints, live-verified via curl.
- **Dockerfiles + docker-compose.yml are done and live-verified** (§8 item 6) — an earlier static-only pass caught two bugs by inspection (a wrong entrypoint path, a Docker-internal hostname baked into the frontend build); a real `docker compose up --build` on 2026-09-06 caught two more that inspection alone had missed — see the note below this summary.
- **The mobile/responsive pass is done** (§8 item 7) — a working hamburger menu on `App.tsx` (the nav links previously just disappeared below `md` with no replacement, making the Officer/Admin portals unreachable by UI on a phone) and a wrap fix on the Parcel 360 "Actions" button row; live-verified at a 375px viewport with Playwright, zero console errors, zero horizontal overflow.
- **Predictive analytics is done** (§8 item 8) — a transparent, hand-weighted heuristic risk score (not a trained model — this project has no labeled outcome data to train or validate one against) combining tax delinquency, dispute exposure, open governance alerts, and land-use restrictions, each with a plain-language rationale. Exposed per-parcel on Parcel 360 ("Risk Assessment") and platform-wide on the Admin Portal ("Top At-Risk Parcels"); live-verified against real seeded data.
- **Every P0/P1 backlog item is now done**, including item 6 (Dockerfiles, live-verified 2026-09-06).
- **Real authentication is done** (§8 item 9) — JWT + bcrypt + a real `users` table (`POST /auth/login`, `GET /auth/me`), a real sign-in page, and route-level gating on `/officer`/`/admin`, replacing the previous client-side-only simulated session. Live-verified end to end with Playwright: wrong password rejected with an inline error, correct login shows the real account's name and persists across a reload, wrong-role access redirects to login, and the previously-unreachable `DISPUTE_OFFICER` role (referenced by the dispute workflow pipeline but never actually selectable) can now log in. Caught and fixed a real bug along the way: `apiService.ts`'s response interceptor hard-redirected to `/login` on *any* 401, including a failed login attempt itself — only a live browser check surfaced it, since every unit test mocks `apiService` and never exercises the interceptor.
- **RBAC route guards are done** (§8 item 5) — a `RolesGuard`/`@Roles(...)` pair now guards every officer/admin-only route: workflow review/listing, governance alerts, change detection, the AI alert-explain endpoint, and both analytics controllers. Citizen-facing routes (search, Parcel 360, risk score, AI query/parcel-explain, workflow creation) stay public, matching the actual frontend UX boundary rather than locking down more than the app needs. The workflow step-review endpoint goes one level finer: a `LAND_RECORD_OFFICER` gets a real 403 trying to decide a `REGISTRATION` step, verified live via curl (401/403/200 across no-token/wrong-role/right-role) and Playwright (a full officer login → dashboard → approve flow, and the previously-broken `DISPUTE_OFFICER` doing the same). 14 new backend e2e tests cover the guard behavior directly, including the 403 case.
- **Audit logging is done** (§8 item 10) — a real `AuditLog`/`audit_logs` table records `AUTH_LOGIN` and every officer/admin decision (workflow step approve/reject, workflow status change, governance alert status change) with who/what/when/metadata. `GET /audit` (admin) and `GET /parcels/:id/audit` (staff) expose it; live-verified against the real running app.
- **Admin Portal real functionality is done** (§8 item 11) — real "Total Users"/"Logins (24h)" counts (the latter honestly counts login *events* in the last 24h, not concurrent sessions, since JWTs are stateless), a "User Management" card (create/promote-demote/delete accounts, self-lockout prevented), and a "Recent Activity" card reading the item-10 audit trail. Caught and fixed a real bug along the way: creating/deleting a user didn't refresh the Recent Activity panel elsewhere on the same page until a manual reload, since its query cache key was never invalidated — only a live Playwright pass (not the unit tests, which mock each component in isolation) surfaced it.
- **The citizen notification MVP is done** (§8 item 12) — a "Your Requests" panel on Parcel 360 showing plain-language status for every request filed on that parcel, reusing the existing public workflow-listing endpoint.
- **Spatial layer write APIs are done** (§8 item 13) — real `POST`/`PATCH`/`DELETE` for zoning/restriction/infrastructure layers, admin-only, with geometry-type validation. No frontend UI accompanies this (no map-drawing tool exists to author new zone geometry) — it exists as tested API capability, matching what the backlog item actually asked for.
- **PostGIS end-to-end is done** (§8 item 14) — connected to a live Supabase Postgres+PostGIS instance and rewrote all 4 JS spatial-fallback call sites to real `ST_*` queries, live-verified via curl against the running app (bbox filtering, point-at-location, neighbour distance/classification, and change-detection spatial intersection all confirmed against real seeded data, then cleaned up). Caught and fixed two real cross-driver bugs along the way — see item 14's own note below.
- **Dockerized `docker compose up --build` is done and live-verified** (§8 item 6, closed 2026-09-06) — see the note below for the two real bugs a live run caught that static review had missed.
- **Public-demo hosting hardening is done** (§8 item 16, 2026-09-06): JWT_SECRET fail-fast, CORS allowlisting, `trust proxy`, and no longer publishing PostGIS's port to the host — each live-verified, each a non-breaking opt-in that changes nothing about local dev/test.
- **Items 17-19 (encumbrance/mortgage records, valuation references, Chandigarh pilot cluster) are done** (2026-09-09) — see §1a and §8. **What's left: item 15 (OAuth) only** — P2, flagged rather than silently built or skipped; see the note below this summary for why.
- **§8's scoring correctly put the Standard Technical Document, dispute workflow, and analytics dashboard ahead of authentication** — all three closed a named requirement gap for less effort than real authentication took, which still landed mid-table (P2) despite being the largest single piece of work in this backlog.

### A note on item 14 (now done) and item 15

- **Item 14 (PostGIS end-to-end)** needed an actual running PostgreSQL + PostGIS instance to responsibly claim done — the `ST_*` query rewrite is real spatial SQL, and shipping it unverified risks exactly the kind of silent bug this project has otherwise caught by testing live at every step (see item 6's Dockerfile bugs, item 9's interceptor bug, item 11's cache-invalidation bug — all found by actually running something, never by code review alone). The user provisioned a Supabase Postgres+PostGIS project to unblock this. Two real, driver-specific bugs were caught only by actually connecting and running the seed script and full e2e suite against it — neither would have surfaced from code review alone:
  - Supabase's direct-connection hostname (`db.<ref>.supabase.co`) is IPv6-only and doesn't resolve from this environment; fixed by switching to Supabase's IPv4-compatible connection pooler (`aws-0-<region>.pooler.supabase.com`, with a `postgres.<ref>`-style username).
  - TypeORM's `'datetime'` column type (used for every `createdAt`/`updatedAt` field) isn't recognized under the `postgres` driver at all — fixed via `@CreateDateColumn()`/`@UpdateDateColumn()`. One nullable non-lifecycle timestamp (`WorkflowStep.completedAt`) has the opposite problem in reverse: sqlite only accepts `'datetime'`, postgres only accepts `'timestamp'`, no single literal satisfies both — fixed by picking the type per-driver via `isSqliteConfigured()` at class-definition time, caught when re-running the SQLite e2e suite right after the Postgres fix and finding it had silently broken SQLite instead.
  - (Also fixed, same effort: TypeORM's `Repository.clear()` issues a bare `TRUNCATE`, which Postgres refuses whenever another table has a live FK pointing at the target regardless of clearing order — `seed.ts` now uses `DELETE` instead; and `seed.ts` never actually loaded `.env`, a latent bug invisible under SQLite's env-var-optional defaults.)

  All 4 target call sites (`GisService.findAll` bbox filter, `GisService.findParcelAtLocation`, `ParcelsService.getNeighbours`'s live-distance fallback, `ChangeDetectionService.analyze`'s spatial intersection) now branch on a shared `isPostgisAvailable()` check and run real parameterized `ST_Intersects`/`ST_Contains`/`ST_Distance`/`ST_DWithin`/`ST_Centroid`/`ST_MakeEnvelope`/`ST_GeomFromGeoJSON` queries against Postgres, falling back to the original hand-rolled JS geometry helpers (`common/geo-utils.ts`) completely unchanged on SQLite. Live-verified against the running app pointed at Supabase: bbox filtering returns real intersecting parcels and an empty set for an empty region; point-at-location resolves the correct parcel and returns nothing over open ocean; the neighbours fallback (exercised via a temporary probe parcel with no precomputed `ParcelNeighbour` rows) correctly found only the 3 genuinely nearby parcels with real geography-based distances, not all 200; and the change-detection endpoint (driven end-to-end through real auth, a real multipart image upload, and real pixel-diffing) correctly flagged exactly the 100 Pune-cluster parcels plus the probe parcel as affected, with zero contamination from the other 3 clusters. All test/probe data was cleaned up afterward, confirming the seed's 200-parcel invariant held. The full 211-test SQLite e2e suite passes unchanged, confirming the SQLite path (which every automated test still exercises) wasn't affected by the branching logic. No automated Postgres-specific test suite exists — committing live Supabase credentials to CI wasn't in scope — so this verification was a one-time live pass, the same honesty standard already applied to item 6's Docker verification.
- **Item 15 (OAuth-based auth)** would need a real OAuth application registered with an external provider (Google/GitHub, etc.) — a client ID and secret that only the user can provision, not something buildable from inside this environment. The backlog's own scoring note already observes JWT alone covers Phase 10's actual ask; BHOOMISETU.md only asks for OAuth "where required," and nothing in this project's real requirements requires it.

### A note on item 6 (now done) and item 16 (now done)

- **Item 6 (Dockerfiles)** sat "files written, statically validated" for a full round because Docker Desktop wasn't running on the dev machine — an explicit choice at the time, flagged rather than silently claimed as done. Closing it for real (2026-09-06, prompted by the user wanting the app ready to demo publicly) meant actually running `docker compose up --build` from a completely fresh volume, which surfaced two real bugs that `docker compose config` and every prior code read had missed — exactly the pattern this document keeps finding (item 9's interceptor bug, item 11's cache-invalidation bug, item 14's two driver bugs: static review and passing tests are not the same as the thing actually running):
  - **`init-postgis.sql` (mounted into the PostGIS container's `docker-entrypoint-initdb.d/`) predates this project's current TypeORM-managed schema and directly conflicts with it.** It hand-creates a `parcels` table with snake_case columns and a native `GEOMETRY` type, while the real `Parcel` entity uses TypeORM's default camelCase columns and a `text` column for geometry (see item 14 — geometry is deliberately never a native PostGiS column). On a genuinely fresh volume, Postgres runs this script first, then the backend's `synchronize: true` tries to add the entity's actual (differently-named, non-nullable) columns to the now-populated table — which Postgres correctly refuses (`column "stateCode" of relation "parcels" contains null values`), and the backend crash-loop-retries forever, never starting. This is not a corner case: it is what happens on *every* fresh `docker compose up`, which is exactly the scenario a public demo host would hit. Fixed by deleting `init-postgis.sql` and its volume mount entirely — it was already fully redundant (the `postgis/postgis` Docker image auto-enables the `postgis` extension itself on first boot, verified live via `SELECT PostGIS_Version()`, and TypeORM's `synchronize: true` builds the complete real schema, all 15+ entities, not just the 6 tables the old script knew about).
  - **`npm run seed` (the same command documented for every other environment) could not run inside the built container at all** — the final image only ever copied `dist/` and `node_modules`, but `seed.ts` is a standalone `ts-node` script that imports directly from `./src/*.ts`, none of which existed in the final stage. A public demo with zero data defeats the purpose of a demo. Fixed by also copying `seed.ts`, `tsconfig.json`, and `src/` into the final image (`ts-node`/`typescript` were already present in `node_modules`, since the builder stage's `npm ci` runs before `NODE_ENV=production` is set and installs devDependencies too) — trades some final-image size for running the identical seed command as every other environment, rather than maintaining a second seeding path.

  Live-verified end to end on a truly fresh volume after both fixes: `docker compose up --build` builds all 3 images and starts frontend/backend/PostGIS with no errors; `docker compose exec backend npm run seed` populates the real 200-parcel dataset (identical output to every other environment); `GET /api/v1/gis/parcels` with a bbox over Pune returns real parcels via the actual `ST_Intersects` PostGIS path (item 14); `POST /api/v1/auth/login` with a seeded officer account returns a real JWT; the frontend container serves the built SPA. Tested on host ports 3001/5174 to avoid colliding with an already-running local dev server, then reverted to the real `3000`/`5173` — the port number has no bearing on any of the bugs found or fixed.
- **Item 16 (public-demo hosting hardening)** is the direct answer to "is it ready to host publicly" — four small, independent, non-breaking changes, each live-verified rather than assumed correct:
  - `main.ts` now refuses to start when `NODE_ENV=production` and `JWT_SECRET` is unset or still the public placeholder (`change_this_in_production`) — verified both ways: it exits with a clear error in that state, and starts normally the moment a real secret is set. Local dev/test never set `NODE_ENV=production`, so neither is affected.
  - CORS now honors `CORS_ORIGIN` (comma-separated) when set, restricting the API to that origin's browser requests only; unset (the local-dev/test default) stays wide open, unchanged from before. Verified via a real preflight `OPTIONS` request from both an allowed and a disallowed `Origin` header — the allowed one gets `Access-Control-Allow-Origin` reflecting itself back, the disallowed one gets no such header at all, which is what actually causes a browser to block the response.
  - `trust proxy` is now set on the underlying Express app, so `req.ip` (and therefore `@nestjs/throttler`'s per-IP rate limiting) reads the real client IP from `X-Forwarded-For` when deployed behind exactly one reverse proxy, instead of rate-limiting every visitor together as the proxy's own IP. Harmless locally, where there's no proxy in front to set that header.
  - `docker-compose.yml` no longer publishes PostGIS's `5432` to the host — it was previously reachable with the default `postgres`/`postgres` credentials from the public internet on any host with a public IP, entirely unrelated to whether the app itself was ever visited. The backend still reaches it over the internal Docker network by service name, unaffected.

  Two items raised in the same hosting-readiness assessment are explicitly **not** something this environment can resolve: HTTPS (depends entirely on which hosting platform is chosen — a PaaS with automatic TLS needs nothing further, a self-managed box needs nginx+certbot — no platform has been chosen yet) and rotating the Supabase database password shared earlier in this project's setup (an action only the user can take in their own Supabase dashboard).
