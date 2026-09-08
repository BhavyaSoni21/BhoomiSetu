# Citizen Features Upgrade Plan

**Status: planning document only for §1-§7 — nothing there has been implemented. §8 (PS-compliance gaps) is done as of 2026-09-09 — see that section.**

**Update (2026-09-07):** §8 below merges in three additional gaps from `docs/FEATURE_AUDIT.md` §1a/§8 (items 17-19) — surfaced by an audit against the fuller official "Land Stack" PS text, not part of the original citizen-dashboard proposals this document was built from. They're a different kind of work (core department data model and seed geography, not citizen-facing UX), folded in here so there's one combined roadmap instead of two separate ones.

**Update (2026-09-09): §8's three items are now built** (encumbrance/mortgage records, valuation references, the Chandigarh pilot cluster) — see the ✅ markers in that section for what actually shipped vs. the original proposal.

This merges two proposals discussed in the same session — a standalone "Citizen Dashboard" module document, and a follow-up arguing those features should be *inserted into* BhoomiSetu's existing workflow rather than bolted on beside it — into one plan. The second document's instinct is correct and is the governing principle here. But it was written without access to the actual codebase, so its "existing workflow" diagram is a generic idealization (a "Data Ingestion Layer," a "Normalization" stage) that doesn't match what's actually built. This plan replaces that generic diagram with the real one and maps every proposed feature onto real entities, endpoints, and components from `docs/FEATURES.md`.

The governing rule carries over unchanged: **citizens claim existing canonical parcels; they never create geometry.**

---

## 1. The real existing workflow (not the idealized one)

```text
Citizen                          Officer                         Admin
  |                                 |                               |
  v                                 |                               |
Search / Map / Parcel 360           |                               |
  |                                 |                               |
  v                                 |                               |
POST /workflows  ------------->  GET /workflows (by role/dept)      |
  (creates Workflow +               |                               |
   auto-generated step pipeline)    v                               |
                              PATCH /workflows/:id/steps/:stepId     |
                                 (approve/reject, RBAC-checked        |
                                  against step.assignedRole)         |
                                    |                                |
                                    v                                |
                          Workflow.currentStatus recomputed          |
                                    |                                |
                                    v                                |
                         AuditLog row written  -------------->  GET /audit
```

The actual machinery already sitting here that the original proposal didn't know about, and that this plan builds on instead of duplicating:

- **`Workflow` already supports multiple pipeline shapes per `workflowType`.** The 3-step `LAND_RECORDS → REGISTRATION → PLANNING` pipeline and the single-step `DISPUTE`/`DISPUTE_OFFICER` pipeline (added for the Dispute feature) are two different shapes served by the same engine. Adding a new `workflowType` with its own step shape is a proven, low-risk extension point — not new architecture.
- **`WorkflowStep.assignedRole` already exists** and is already enforced by `RolesGuard` (a `LAND_RECORD_OFFICER` gets a real 403 on a `REGISTRATION` step). Routing "by department" is already real; only *auto-assignment to a specific officer* (load balancing) is missing.
- **`GovernanceAlert` creation is already a shared function**, called today from two places (seed-time conditions, and `ChangeDetectionService.analyze`). A third trigger source is additive, not a new engine.
- **`CitizenParcel` (the My Parcels join table) is currently write-only from `seed.ts`.** There is no citizen-facing path that ever inserts a row into it. This is the concrete gap "Land Claim" actually needs to close.
- **`document-verification/verify` is stateless** — it OCRs, checks, and returns a verdict, but persists nothing. There is no document vault today.

---

## 2. Feature-by-feature: what each proposal item actually requires here

| # | Proposed feature | Classification | What it actually takes in this codebase |
|---|---|:-:|---|
| 1 | Citizen Dashboard shell | **New frontend, small backend** | `CitizenPortal.tsx` is currently one flat page (hero + search + map + verify). A dashboard means restructuring it into sections, most of which already exist as components — see §4. |
| 2 | Citizen Profile (phone/address) | **New, small** | `users` table has no phone/address columns today. Additive columns, or a `citizen_profiles` side table if kept separate from auth. Raises a real question: this is the first PII beyond email this project collects — flag for a data-handling decision, not a blocker. |
| 3 | Digital Land Portfolio / My Parcels | **Already exists** | `features/citizen/MyParcels.tsx`, `GET /parcels/mine`, `CitizenParcel`. Nothing to build — Land Claim (below) becomes its first real write path. |
| 4 | Parcel discovery by ID/ULPIN/survey/plot | **Already exists** | `ParcelSearch.tsx`, `GET /parcels`. |
| 5 | Map-based parcel selection | **Already exists** | `MapComponent.tsx` click → popup/select → `Parcel360View.tsx`. |
| 6 | Address-based fuzzy search + ranking | **New, schema-heavy** | The `Parcel` entity has no street/village/landmark granularity — only state/district codes. Building the scoring algorithm is the *easy* part; adding and backfilling real address fields is the real cost. Lowest priority — see §6. |
| 7 | Land Claim (citizen claims an existing parcel) | **Upgrade, not new system** | Extend `Workflow` with a new `workflowType: 'PARCEL_CLAIM'` and a short review pipeline, instead of new `LandClaim`/`CitizenParcelAssociation` tables. On approval, the existing `CitizenParcel` join table gets its first real insert. See §3.1. |
| 8 | Mandatory document upload for claims | **Upgrade** | Reuses the existing OCR/verification service, but that service needs an optional `workflowId` so results can be persisted against a specific claim (today it's stateless). See §3.2. |
| 9 | AI document summarization | **Small, follows an existing pattern** | Same shape as the two AI-explain endpoints that already exist for parcels/alerts (`ai/`, Zod-validated). Only needs a persisted verification result to explain — depends on item 8. |
| 10 | Intelligent officer routing | **Upgrade** | `WorkflowStep.assignedRole` already filters *by department*. Auto-assigning *to a specific officer* needs a workload query (count of open steps per officer per role/district) — no new `OfficerProfile` entity required; `users` + a `COUNT` query is enough at this scale. See §3.3. |
| 11 | Context-aware governance alerts (rule engine) | **Upgrade** | Reuses the existing `GovernanceAlert` creation function with a third call site: on `PARCEL_CLAIM`/complaint-type workflow creation, evaluate the parcel's real context (land use, restriction, tax — all already fetched by Parcel 360) against a small rule table. Not a new engine. |
| 12 | Historical spatial state + timeline | **Fully new** | Confirmed gap in `docs/FEATURE_AUDIT.md` §7 ("no concept of a parcel's geometry changing over time"). This proposal's framing — versioning *attributes* per year, not geometry — is the tractable version. New `ParcelHistoricalState` table, new endpoint, new Parcel 360 tab. See §3.4. |
| 13 | Bhuvan external layer | **Investigate first** | External ISRO geospatial service; API access/auth/rate limits unverified from here. Not a plan item yet — a spike, not a phase. |
| 14 | Dashboard aggregation endpoint | **New, small** | Legitimate idea from the original doc, same shape as `GET /analytics/summary` (real aggregation query, not N+1 calls from the frontend). |

---

## 3. The four real upgrades, in technical detail

### 3.1 Land Claim → new `Workflow` type, not a new system

- Add `workflowType: 'PARCEL_CLAIM'` alongside the existing types. Auto-generates a short pipeline (e.g. a single `LAND_RECORDS`/`LAND_RECORD_OFFICER` step — claims are simpler than the 3-department service-request pipeline).
- `POST /workflows` already accepts `{parcelId, workflowType, requestDetails}` — a claim is created through the *same endpoint*, no new create path.
- New behavior only on the *approval* side: when a `PARCEL_CLAIM` workflow's step is approved, a hook in `WorkflowsService` inserts a `CitizenParcel` row (citizenId from the JWT, parcelId from the workflow) — the first real writer of that table besides `seed.ts`.
- Requires the claim to know *which citizen* is claiming — `POST /workflows` is currently public/anonymous (by design, for service requests). A `PARCEL_CLAIM` specifically needs `RequireAuth` at the citizen role, since an anonymous claim makes no sense. This is a narrow, type-specific auth requirement, not a change to the endpoint's general public access.

### 3.2 Document upload tied to a claim → persistence added where it's actually needed

- The general-purpose "Verify a Document" panel (existing, ad-hoc, unauthenticated) stays exactly as it is — stateless, no persistence needed there.
- A *new* optional `workflowId` parameter on the verification service: when a document is uploaded as part of a `PARCEL_CLAIM` workflow, the OCR text + extracted fields + verdict are persisted as a `WorkflowDocument` row (new table: `workflowId`, `storageKey`, `documentType`, `verificationResult` JSON). This is the minimum needed for an officer to review the evidence later — not a full generic "document vault" for every interaction.
- File storage: local disk under a gitignored path is sufficient at this project's scale (matches how uploaded images are already handled for Change Detection) — no object-storage service needed yet.

### 3.3 Officer routing → a workload query, not a new entity

- `WorkflowStep` gets an optional `assignedOfficerId` column (nullable — existing unassigned-by-name, department-only steps keep working unchanged).
- On workflow creation, a small routing function: `eligibleOfficers = users WHERE role = step.assignedRole` (district filtering only if/when officers gain a district field — flag as a follow-on, not a blocker), ranked by `COUNT(open WorkflowSteps WHERE assignedOfficerId = officer.id)` ascending, assign the lowest.
- The Officer Portal dashboard's existing "assigned workflows" query just adds an `assignedOfficerId = currentUser.id` filter — no new UI concept, just a narrower existing list.

### 3.4 Historical spatial state → new table, existing tab pattern

- New `ParcelHistoricalState` table: `parcelId`, `year`, `landUse`, `zoningStatus`, `restrictionStatus`, `taxStatus`. Additive, touches no existing table.
- `GET /parcels/:id/history` (list) and `GET /parcels/:id/history?year=` (one snapshot).
- Since there's no real historical data source, `seed.ts` synthesizes 2-3 prior years per Pune-cluster parcel by starting from the current seeded state and applying small plausible deltas (same honesty standard the rest of `seed.ts` already follows — real generated data, not hand-picked fixtures).
- Frontend: one more tab on `Parcel360View.tsx` (it's already tabbed — Land Records/Registration/Planning/Tax/Restriction/Dispute), not a new page. A year selector re-fetches and diffs against current state client-side.

---

## 4. Citizen Dashboard: what's actually new vs. what it just organizes

The dashboard is real frontend work, but most of its content is already built and just needs a home:

```text
Citizen Dashboard (new shell — CitizenPortal.tsx restructured, or a new /dashboard route)
│
├── Overview           NEW — small aggregation endpoint (§5)
├── My Parcels          EXISTS — features/citizen/MyParcels.tsx
├── Find / Claim Land    Find: EXISTS (ParcelSearch/MapComponent) — Claim: NEW (§3.1)
├── My Requests          EXISTS — features/parcels/RequestNotifications.tsx
│                          (currently scoped per-parcel on Parcel 360; dashboard
│                           version needs it aggregated across all of a citizen's
│                           parcels — a query change, not a new component)
├── Documents            PARTIALLY NEW — a list view over §3.2's WorkflowDocument rows
└── Notifications        NOT PLANNED HERE — no push/email delivery exists or is
                          scoped in this plan; "notification" in this system means
                          "poll a status feed," same as Workflows today
```

---

## 5. New API surface (additive only — nothing existing changes shape)

```text
POST /workflows                         (existing — PARCEL_CLAIM is just another workflowType)
GET  /citizen/dashboard                 NEW — aggregation: parcel count, open claims,
                                               active requests, docs needing attention
GET  /parcels/:id/history               NEW
GET  /parcels/:id/history?year=         NEW
POST /document-verification/verify      (existing — gains an optional workflowId field)
GET  /workflows/:id/documents           NEW — the WorkflowDocument rows for a claim
POST /ai/document-verification/:id/explain   NEW — same Zod-validated pattern as the
                                                    two existing AI-explain endpoints
```

## 6. Explicitly deferred, with why

- **Address-based fuzzy search** — real schema gap (no street/locality/landmark fields exist on `Parcel`), largest single lift in this whole plan for the least-certain payoff, since ULPIN/Survey/Plot search already covers how Indian land records are actually identified. Revisit only if a concrete need for free-text address entry shows up.
- **Bhuvan integration** — needs an access/feasibility spike (API availability, auth, rate limits) before it can even become a scoped plan item.
- **Real notification delivery (SMS/email/push)** — out of scope; same gap `docs/FEATURE_AUDIT.md` already flags for the existing Workflow system, not something this plan introduces or solves.
- **District field on officer accounts** — needed to make §3.3's routing genuinely jurisdiction-aware rather than department-only; small but real prerequisite, noted rather than silently assumed.

## 7. Suggested order (dependency-driven, not the original doc's phase numbers)

1. **Land Claim as a new `Workflow` type** (§3.1) — no new tables besides reusing `CitizenParcel`; unlocks the dashboard's "Find/Claim Land" section immediately.
2. **Document persistence for claims** (§3.2) — small, and item 9 (AI doc summary) is blocked on it.
3. **Dashboard aggregation endpoint + shell** (§4, §5) — mostly wiring existing components into a new layout; real value only once Land Claim exists to show in it.
4. **Officer routing** (§3.3) — independent of the above, can run in parallel.
5. **Context-aware alerts** (item 11) — natural follow-on once claims exist as a second alert-trigger source alongside Change Detection.
6. **Historical spatial state** (§3.4) — fully independent of everything else; can be built any time.
7. **AI document summarization** (item 9) — small, once item 2 exists.
8. **Address search, Bhuvan** — deferred per §6.
9. ~~**§8's three PS-compliance gaps**~~ — ✅ done (2026-09-09), see §8.

---

## 8. PS-compliance gaps (merged in from `docs/FEATURE_AUDIT.md` §1a/§8 items 17-19, 2026-09-07) — ✅ done 2026-09-09

Three items an audit against the fuller official "Land Stack" PS text surfaced — not citizen-dashboard UX like everything above, but gaps in the core department data model and seed geography that this plan's citizen-facing work sits on top of either way. All three are now built; kept here (rather than deleted) as a record of what shipped vs. what was originally proposed.

### 8.1 Encumbrance and mortgage records — ✅ done

Built exactly as proposed: a new `EncumbranceRecord` entity (`parcelId`, `hasEncumbrance`, `encumbranceType` `MORTGAGE`/`LIEN`/`CHARGE`, `lenderName`, `instrumentReference`, `registeredDate`, `dischargeDate`), `GET /encumbrance/:parcelId`, wired into the response aggregator (`GET /parcels/:id/360` now carries a `departments.encumbrance` key), a new Parcel 360 tab, seeded on ~17% of parcels. Full e2e coverage (`test/departments.e2e-spec.ts`, `test/interoperability.e2e-spec.ts`, `test/parcels.e2e-spec.ts`).

### 8.2 Valuation references — ✅ done

Built exactly as proposed: `tax-record.entity.ts` gained `marketValueReference`, `valuationDate`, `valuationSource` (`CIRCLE_RATE`/`COMPARABLE_SALE`), kept alongside `assessedValue` rather than replacing it. Surfaced on Parcel 360's Tax tab. Seeded within a plausible spread (85-125%) of each parcel's assessed value.

### 8.3 Chandigarh pilot cluster — ✅ done (city/village pairing not done)

A 5th seed cluster (`CH-CHANDIGARH-01`, 20 parcels, real Chandigarh coordinates) using the existing `parcel-generation` module, bringing the total to 220 seeded parcels across 5 clusters. **The city/village pairing this item also floated was not built** — Chandigarh remains a 5th unrelated single cluster, not paired with an existing state as an explicit city+village pair. Left as a presentation-level nice-to-have; not rescored or reopened as a gap.

### A feature this work unlocked, beyond the original three items

**Ownership history** — not part of the original 8.1-8.3 scope, added the same day at the user's request after reviewing §8's plan: a new `OwnershipHistoryRecord` (`parcelId`, `ownerName`, `transactionType` `ORIGINAL`/`SALE`/`GIFT`/`INHERITANCE`/`PARTITION`, `transactionDate`, `documentReference`), a chain of 1-3 prior owners on a representative ~50% of parcels ending at the same owner name already on file in State A/B records where one exists. Surfaced as a Parcel 360 tab via `GET /parcels/:id/ownership-history`. **Visibility is citizen-restricted** — the user specifically decided this should be visible only to a citizen actually associated with that parcel (`citizen_parcels`), not to any citizen who happens to view it, and not treated as public despite real RoR/mutation history traditionally being public record in India. Staff (officer/admin) access is unaffected by this restriction. This strengthens `docs/FEATURE_AUDIT.md` §1a's already-✅ "Record of Rights" row with the mutation-history dimension a real RoR carries.

Also shipped the same day, unrelated to §8 but from the same working session: a pagination control on the Officer Portal's Governance Alerts list (5/page, previously an unbounded scroll) — see `docs/FRONTEND_UPGRADE_SPEC.md` §6.
