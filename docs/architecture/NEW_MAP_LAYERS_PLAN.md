# New Map Layers — Implementation & Scaling Plan

**Project:** BhoomiSetu (SIH 2026 — Integrated GIS-based Digital Public Infrastructure for Land Governance)
**Scope of this document:** six new map layers to add on top of the existing platform. Every layer below is designed to reuse infrastructure that already exists in the codebase (PostGIS, MVT tile pipeline, existing tables, existing alert/governance engine) rather than introduce new architecture. No layer here requires a new datastore, a new framework, or a new external vendor.

**Audience:** this document is written so either a person or an AI coding assistant can pick up any single section and implement it without needing the rest of the codebase explained first. Each layer section is self-contained: what it is, why it matters, exact schema, exact API shape, exact caching strategy, and exact cost/scale reasoning for Indian-scale traffic (assume tens of thousands of concurrent citizen users nationally, on a mix of 4G/patchy connectivity, hitting a modest number of backend instances — the goal is millions of requests/day served cheaply, not thousands of requests/day served expensively).

**Read first, always:** `docs/architecture/BhoomiSetu_Data_Architecture_GIS_Performance_Scalability_Guide.md` and `docs/architecture/DATABASE_IMPLEMENTATION_GUIDE.md`. Every layer below follows the same non-negotiable rule already established in those documents:

> Store authoritative data once → query only what is needed → transmit only what is needed → render only what is visible → cache what does not change frequently → process heavy work asynchronously.

---

## 0. Cross-cutting rules (apply to every layer below)

These are not optional per-layer choices — violating any of these is what turns a demo-fast prototype into a production outage at national scale.

1. **MVT vector tiles, never raw GeoJSON, for anything rendered on the map.** GeoJSON is fine for a single parcel's detail response (`/parcel/{id}`), never for "everything visible in the viewport." One India-scale district can have tens of thousands of parcels; sending that as JSON to a mobile browser on a 4G connection in a village is the single most common way this kind of project fails a live demo or a real pilot.
2. **Every new attribute added to a layer must go into the existing MVT query as one extra column, not a separate endpoint per layer where avoidable.** Fewer round trips = fewer requests = lower cost at scale. Where a layer's attribute is expensive to compute (see rule 3), it lives in a precomputed column on the parcel row itself, not calculated inside the tile query.
3. **Precompute, don't compute-on-read.** Anything derived (a score, a mismatch flag, a bucketed value) is computed by a background job (Celery, already in the stack — see `DATABASE_IMPLEMENTATION_GUIDE.md` §2.3) on write/update, and stored as a plain column. The tile query and the detail endpoint then just `SELECT` a column — no live computation inside a request that might be hit millions of times a day.
4. **GIST index on every new geometry column, composite `(state_code, district_code)` index on every new attribute table.** This is already the project's own stated P0 requirement (`AUDIT_REPORT.md`, `DATABASE_IMPLEMENTATION_GUIDE.md` §2.1) — every layer below inherits it, not repeated per-layer below except where a layer needs something extra.
5. **Version every tile URL** (`/tiles/v{n}/legal-status/{z}/{x}/{y}.pbf`), same pattern already used for parcels. This lets a CDN cache tiles essentially forever and only busts cache on an explicit version bump after a data refresh — this is what actually makes "millions of requests/day" cheap: almost none of them should reach your database at all.
6. **CDN in front of every tile endpoint.** Cloudflare's free tier already works for this (static-content caching by URL, no origin server involved once cached) and costs nothing at hackathon/pilot scale, and the same setup carries into a real state-wide deployment without re-architecture. This is the actual answer to "how do you serve millions of requests/day cheaply" — it is a caching/CDN answer, not a bigger-database answer.
7. **Redis only where a specific measured hot path justifies it** (per the project's own existing rule in the Data Architecture guide §6/§14) — do not add a cache layer for a layer that's already served by a versioned, CDN-cached tile. Redis is for things that can't be tile-cached, e.g. a live per-parcel risk-score lookup at very high zoom before the next batch recompute.
8. **Attribute payload per tile stays minimal.** Every layer's MVT tile should carry only `parcel_id` + the 1-2 fields that layer needs to render color/severity — never the full parcel row. Detail (case number, bank name, mismatch description) is fetched only on click, from the existing per-parcel detail endpoints, exactly as the current dispute/encumbrance data already works inside Parcel 360.
9. **Every layer that can raise a citizen/officer-facing signal reuses the existing `GovernanceAlert` pipeline** (`governance/`, feature 10) rather than inventing a second alert system. One alert model, one stage lifecycle (OPEN → ACKNOWLEDGED → FIELD_VERIFIED → RESOLVED/DISMISSED), one notification path.
10. **Nothing here needs a new department code, new role, or new frontend portal.** All six layers plug into the existing `MapComponent.tsx` 9-layer toggle panel (feature 2) as additional toggles, and the existing Officer/Admin/Citizen role split already covers who can see what (a "govt/private/community land" layer is public; nothing here needs to be officer-only unless stated).

---

## 1. Legal Status Layer (Dispute + Encumbrance, combined)

**What it shows:** every parcel colored by its worst current legal-status severity — clear (no color/green outline), disputed (orange/red by dispute type), encumbered/mortgaged (a distinct hatch or secondary badge color), so a viewer can see legal risk across a whole village/ward at a glance instead of clicking every parcel.

**Why it matters:** this is the single feature closest to what real estate due-diligence users actually want, and it is the layer most directly promised by the problem statement's "restrictions... transparent transactions" language. It is also the cheapest of all six to build — the underlying data already exists.

**Data source:** already exists. `DisputeRecord` (~12% of seeded parcels) and `EncumbranceRecord` (~17% of seeded parcels) are both live department mock tables (feature 6). Nothing new to model.

**Schema change:** none required, but add one precomputed column to `parcels` for fast tile rendering:

```sql
ALTER TABLE parcels ADD COLUMN legal_status_severity SMALLINT DEFAULT 0;
-- 0 = clear, 1 = encumbered only, 2 = dispute (low severity), 3 = dispute (high severity)
CREATE INDEX parcels_legal_status_idx ON parcels (legal_status_severity);
```

**Computation:** a Celery task (`recompute_legal_status_severity`) runs whenever a `DisputeRecord` or `EncumbranceRecord` is created/updated for a parcel — updates that one parcel's `legal_status_severity` column. Also runs as a nightly batch sweep for safety (idempotent, same pattern already used elsewhere in the codebase per `DATABASE_IMPLEMENTATION_GUIDE.md` §2.3's idempotent-retry rule).

**API:**
- Extend the existing parcel MVT query (`/tiles/{z}/{x}/{y}.pbf`) to include `legal_status_severity` as one extra tile attribute — do **not** create a separate tile endpoint. One more `SELECT` column costs nothing extra per request.
- Detail on click: reuse the existing `GET /parcels/:id/360` Dispute/Encumbrance tabs — no new endpoint needed.

**Caching:** standard versioned tile caching (rule 5). Bump tile version whenever the nightly severity sweep runs (once/day is enough — legal status doesn't change minute-to-minute).

**Frontend:** one new toggle, "Legal Status," in the existing layer panel. 4-color legend (Clear / Encumbered / Disputed – Low / Disputed – High). Click still opens the existing Parcel 360 popup.

**Cost/scale note:** zero additional live computation per request — this is purely "one more column, same tile, same cache." This should be your first build; it's the best effort-to-impact ratio of all six.

**Priority:** **P0 — build first.**

---

## 2. Property Tax Status Layer

**What it shows:** parcels colored green (paid) / yellow (pending) / red (defaulter), reusing the tax `status` field that already exists in the mock tax record (feature 6).

**Schema change:** none — `status` already exists on the tax record. Optionally denormalize onto `parcels.tax_status` for tile-query speed, same reasoning as Layer 1:

```sql
ALTER TABLE parcels ADD COLUMN tax_status VARCHAR(20) DEFAULT 'unknown';
CREATE INDEX parcels_tax_status_idx ON parcels (tax_status);
```

**Computation:** same trigger pattern as Layer 1 — recompute on tax record write, nightly sweep as backstop.

**API:** same approach — one more MVT tile attribute, no new endpoint.

**Caching:** tax status changes even less frequently than dispute status in reality (annual/quarterly cycles) — version bump can be weekly or on-demand after a bulk tax update, making this layer nearly free to serve at any request volume once cached.

**Frontend:** one toggle, 3-color legend. This layer and Layer 1 can share one combined "Financial & Legal Risk" panel group in the UI if you want to reduce toggle clutter, but keep them as separate boolean layers server-side.

**Cost/scale note:** identical reasoning to Layer 1 — no new live computation, no new endpoint, no new cache layer.

**Priority:** **P0 — build alongside Layer 1, same session.**

---

## 3. Circle Rate / Guidance Value Heatmap

**What it shows:** parcels bucketed into 4-5 value bands (e.g. <₹2000/sqft, ₹2000-5000, ₹5000-10000, ₹10000+) and colored on a sequential scale (light → dark), using the `marketValueReference` field that already exists on the tax record (feature 6, added 2026-09-09).

**Schema change:**

```sql
ALTER TABLE parcels ADD COLUMN value_band SMALLINT DEFAULT 0;
CREATE INDEX parcels_value_band_idx ON parcels (value_band);
```

**Computation:** a Celery task buckets `marketValueReference` into bands per parcel whenever the tax/valuation record changes, plus a nightly sweep. Banding logic (the actual ₹/sqft cutoffs) should be configurable per state/district rather than hardcoded — land values vary by orders of magnitude between, say, rural Chandigarh-pilot villages and urban Chennai/Bangalore clusters. Store cutoffs in a small `valuation_bands` config table keyed by `state_code`, not in application code, so an officer/admin can tune it without a deploy.

**API:** one more MVT tile attribute (`value_band`), same tile, no new endpoint. Detail popup shows the real ₹/sqft figure from the existing tax record, not just the band.

**Caching:** same versioned-tile approach. Circle rates in real life change on a government notification cycle (often annual) — this is one of the least frequently changing layers, so it's one of the cheapest to keep cached at the CDN edge for long periods.

**Frontend:** one toggle, sequential color-scale legend with real ₹/sqft ranges labeled (not just "low/medium/high" — a real estate user needs the actual number).

**Cost/scale note:** because value bands change rarely, this is a good candidate to demonstrate the "cache-first" architecture explicitly to judges — you can show a tile being served with a `cache-hit` response header straight from Cloudflare with zero database round-trip.

**Priority:** **P1 — build after Layers 1-2.**

---

## 4. Composite Risk Score as a Map Layer

**What it shows:** the *existing* Predictive Analytics risk score (feature 20 — tax delinquency 0.4 + dispute exposure 0.3 + open alerts 0.2 + restriction 0.1) rendered spatially instead of only as an admin list ("Top At-Risk Parcels").

**Why this is different from Layer 1:** Layer 1 is raw legal status (is there a dispute, yes/no). This layer is the *weighted composite score* — a parcel can have no active dispute but still show elevated risk from tax delinquency + an open governance alert. This is your strongest "AI/ML, predictive analytics" talking point precisely because the scoring logic is transparent and explainable (a judge can ask "why is this parcel red" and you can show the exact weighted breakdown, not a black box).

**Schema change:** the score already exists (`GET /parcels/:id/risk-score`, feature 20's backend). Add a denormalized column so it's tile-queryable without a join per parcel per request:

```sql
ALTER TABLE parcels ADD COLUMN risk_score NUMERIC(5,2) DEFAULT 0;
CREATE INDEX parcels_risk_score_idx ON parcels (risk_score);
```

**Computation:** the existing `predictive-analytics/` scoring function already computes this — just have it write to `parcels.risk_score` on every recompute instead of (or in addition to) only serving it live on request. Recompute triggers: any dispute/encumbrance/tax/alert change on that parcel (event-driven, same as Layers 1-3), plus a nightly full sweep so scores never silently go stale.

**API:** one more MVT attribute. The existing `/parcels/:id/risk-score` endpoint stays exactly as-is for the detailed breakdown on click (rationale text, per-factor weights) — no change needed there, it's already well-designed for this.

**Caching:** because risk score depends on several fast-changing inputs (a new governance alert can fire at any time), version this tile's cache more aggressively than Layers 1-3 — e.g. bump on every nightly sweep, and consider a shorter CDN TTL (say 6-12 hours) rather than "cache until manually busted." Still vastly cheaper than computing risk per-request.

**Frontend:** one toggle, continuous color scale (green → yellow → red) matching the 0-100 (or whatever range) score already defined in feature 20. Click shows the same rationale card already built for Parcel 360's Risk Assessment panel — reuse the component, don't rebuild it.

**Cost/scale note:** this is the layer most likely to be asked about by judges as "how is this AI/ML" — be ready to show the plain-language rationale (already built, feature 20) alongside the map color, since a heuristic with a shown breakdown is more defensible under judge questioning than an opaque "AI risk score."

**Priority:** **P1 — build after Layers 1-2, same effort tier as Layer 3.**

---

## 5. Master Plan Mismatch Layer (Proposed vs. Current Land Use)

**What it shows:** parcels where the *approved future use* in the Master Plan differs from the *current actual use* — e.g. agricultural land slated for road-widening or industrial rezoning in a future plan cycle. Rendered as a distinct hatched/striped overlay pattern (not a solid fill, so it doesn't visually collide with Layers 1-4) on top of whichever base layer is active.

**Why this is different from your existing zoning choropleth:** the current zoning layer (feature 21) shows *current* land use/zoning only. This layer is specifically about *approved-but-not-yet-implemented* change — a distinct governance signal ("this parcel's use is about to change") that current-use zoning cannot show.

**Schema change:** add a `proposed_land_use` field alongside the existing `zoningOverlay`'s current-use field:

```sql
ALTER TABLE zoning_overlays ADD COLUMN proposed_land_use VARCHAR(50);
ALTER TABLE zoning_overlays ADD COLUMN proposed_effective_year SMALLINT;
```

**Computation:** a Celery task (or the same spatial-authoring write path feature 21 already uses — `SpatialService.createZoningOverlay`/`updateZoningOverlay`) computes `mismatch = (proposed_land_use IS NOT NULL AND proposed_land_use != current_land_use)` at write time, stores it as a boolean column for tile-query speed:

```sql
ALTER TABLE parcels ADD COLUMN masterplan_mismatch BOOLEAN DEFAULT FALSE;
```

**Alert integration:** where a mismatch is newly created or a parcel newly falls inside a mismatched zone, raise an informational-severity `GovernanceAlert` (`type: MASTERPLAN_MISMATCH`, reusing the existing alert pipeline per cross-cutting rule 9) — non-critical severity, since a planned future change isn't itself a violation, just something an officer/citizen should be aware of.

**API:** same tile-attribute pattern (`masterplan_mismatch` boolean). Detail popup on click shows current use, proposed use, and the effective year from the existing zoning-overlay CRUD (feature 21 already has full admin authoring for this table — you're extending an existing form, not building a new one).

**Frontend:** admin authoring form (`MapLayerManagement.tsx`, feature 21) gets two new optional fields (`proposed_land_use`, `proposed_effective_year`) on the existing Zoning Overlay tab — no new tab needed. Map gets one new toggle with a hatch-pattern legend.

**Priority:** **P2 — build after the four above; reuses feature 21's admin UI almost entirely, so it's cheap once you get to it, but it's a smaller demo payoff than Layers 1/4.**

---

## 6. Unauthorized Construction / Layout Detection Layer

**What it shows:** parcels flagged where satellite/change-detection evidence shows new construction, but no matching approved building permission exists on file — your strongest "AI/ML detects real governance violations" talking point.

**Why this is your best differentiator:** every piece this needs already exists in the codebase (change detection, feature 18/26; building-permission/planning department data, feature 6) — this layer is a **cross-check rule**, not a new detection system. That's an important thing to say to judges: you are not claiming to have built a computer-vision system from scratch, you're demonstrating exactly the kind of cross-departmental automated reconciliation the problem statement itself asks for ("cross-departmental data interoperability, analytics-driven governance insights").

**Computation logic (the actual rule):**

```
FOR each parcel flagged as "built up" / "changed" by change-detection (feature 18/26)
   IF parcel has no APPROVED record in the Planning/Building-Permission department data (feature 6)
      OR the approved permission's sanctioned footprint/date predates the detected change
   THEN flag parcel.unauthorized_construction_suspected = TRUE
```

This runs as a step inside the **existing** change-detection pipeline (`app/services/change_detection_service.py`, feature 18) and the **existing** historical year-over-year comparison (feature 26) — not a new service. Add one more field written alongside the `ChangeDetectionEvent`/category classification that's already computed there today.

**Schema change:**

```sql
ALTER TABLE parcels ADD COLUMN unauthorized_construction_suspected BOOLEAN DEFAULT FALSE;
ALTER TABLE change_detection_events ADD COLUMN cross_checked_against_permission BOOLEAN DEFAULT FALSE;
```

**Alert integration:** raise a `GovernanceAlert` (`type: UNAUTHORIZED_CHANGE_DETECTED` — this alert type already exists per `governance/` feature 10's description, so this may just need the new triggering condition wired to the existing type rather than a brand-new alert type) at HIGH severity, following the exact same 4-stage lifecycle (Detected → Acknowledged → Field Verified → Resolved) already built for every other alert.

**API:** one more MVT tile attribute + reuse of the existing `GET /change-detection/...` detail endpoints for the "why was this flagged" explanation. No new endpoint required beyond the one boolean column.

**Frontend:** one toggle, single-color "flag" marker style (this is a binary condition, not a severity gradient) layered on top of whatever base layer is active, exactly like Layer 5's hatch pattern but a distinct icon/color so the two don't get confused.

**Cost/scale note — important:** do **not** build this before fixing the Earth Engine EECU overrun already identified in `AUDIT_REPORT.md` (currently 3-6x over the 150 EECU/month budget). This layer's cross-check logic is cheap (it's a database join, not new satellite calls), but it depends on change-detection events that come from the already-overloaded Earth Engine pipeline. Fix `AUDIT_REPORT.md`'s Priority 1 items (replace `.getInfo()` with server-side aggregation, add GIST indexes on terrain tables, batch parcel profile computation) first, or this layer will simply amplify an existing cost problem rather than add a cheap new feature.

**Priority:** **P1 for the cross-check logic itself (it's cheap), but gated on P0 fixing the Earth Engine pipeline first.**

---

## Build order (recap, with dependency notes)

| Order | Layer | New schema? | New endpoint? | Depends on |
|---|---|---|---|---|
| 1 | Legal Status (dispute + encumbrance) | 1 column | No | Nothing — build first |
| 2 | Tax Status | 1 column | No | Nothing |
| 3 | Risk Score map layer | 1 column | No | Feature 20 already live |
| 4 | Circle Rate / Valuation heatmap | 1 column + 1 config table | No | Nothing |
| 5 | Master Plan Mismatch | 2 columns on zoning_overlays + 1 on parcels | No | Feature 21's existing admin form |
| 6 | Unauthorized Construction | 2 columns | No | **AUDIT_REPORT.md Earth Engine fixes must land first** |

Every layer above adds **at most two new database columns and zero new API endpoints** — the entire cost of "adding a layer" in this design is (a) a Celery recompute task, (b) one more attribute in the existing tile query, (c) one toggle in the existing frontend layer panel. This is deliberate: it's what makes six layers achievable in limited remaining time without touching the core architecture.

---

## Serving millions of requests/day cheaply — the actual answer, spelled out

If a judge asks "how does this scale to millions of requests a day across India," the honest, defensible answer is entirely about **caching and payload size**, not about bigger servers:

1. **Almost no request should reach the database.** A versioned, CDN-cached MVT tile (rule 5/6 above) means the same tile bytes get served to every citizen looking at the same map area, straight from a CDN edge node physically close to them (Cloudflare has edge PoPs across major Indian cities) — the origin backend and PostGIS database see a request only on a genuine cache miss (new tile version, or a genuinely new geographic area nobody's queried yet).
2. **Payload size, not request count, is the real cost driver at Indian mobile-network scale.** A vector tile carrying 6-8 layer attributes per parcel is still a few KB; the same data as GeoJSON with full precision geometry can be hundreds of KB per viewport. This matters more in India specifically because a meaningful share of real users will be on 4G or worse, and a slow map is a demo-killing and adoption-killing failure mode.
3. **Writes are rare, reads are the overwhelming majority.** Land records, disputes, tax status, and zoning change on the order of days-to-months, not seconds. This means a long CDN TTL (hours to days) is not just acceptable but correct — it's the difference between a database that needs to survive a few writes/day and a CDN that absorbs effectively unlimited read traffic for free.
4. **When you do need to scale the database itself** (post-pilot, real multi-state rollout): read replicas for the tile-serving path specifically (per `DATABASE_IMPLEMENTATION_GUIDE.md` §4.2, already the documented plan), never for the write path. Table partitioning by `state_code`/`district_code` only once real data volume justifies it (>10M rows per the existing guide) — do not pre-partition now.
5. **Background jobs absorb the expensive part.** Every "derived" value in all six layers above (risk score, value band, mismatch flag, unauthorized-construction flag) is computed once, asynchronously, by a Celery worker — never inside a user-facing request. A request in the hot path only ever does a `SELECT` against an already-computed column with a GIST/btree index behind it.

---

## What to tell judges if asked about any single layer

- **"Where does this data come from?"** — for Layers 1-4: real department mock APIs already integrated (feature 6); for Layer 5: the existing zoning-overlay admin authoring tool (feature 21), extended with two fields; for Layer 6: the existing change-detection pipeline (feature 18/26) cross-checked against existing planning records. None of the six layers invent a new data source — they all recombine data BhoomiSetu already ingests.
- **"Is this real-time?"** — legal status/tax/risk score/mismatch flags are recomputed on write (near-real-time) plus a nightly safety sweep; the map itself serves cached tiles for read performance, with a bounded staleness window measured in hours, not seconds — an honest and normal tradeoff for this kind of data (dispute status does not need sub-second freshness).
- **"How is the risk score / unauthorized-construction flag 'AI'?"** — be precise and honest: the risk score is an explainable, hand-weighted heuristic (already documented as a deliberate choice in feature 20, since no labeled outcome data exists to train a model against); the unauthorized-construction flag is a deterministic cross-check rule over two existing verified datasets, not a trained classifier. Both are legitimate examples of "analytics-driven governance insight" as the problem statement asks for — you don't need to oversell them as machine learning to make them impressive; the interoperability itself is the actual hard, impressive part.

---

## Definition of done (per layer, before calling it "built")

- [ ] Schema migration applied, GIST/btree index verified with `EXPLAIN ANALYZE` (per project's own existing rule)
- [ ] Recompute logic wired to the correct write path(s) + a nightly safety-sweep job
- [ ] Attribute present in the relevant MVT tile query, verified with a real tile fetch (not just checked in code)
- [ ] Tile version bump strategy decided and documented for that layer's actual data-change frequency
- [ ] Frontend toggle added to the existing layer panel, with a legend that matches the color scheme described above
- [ ] Click-through detail reuses an existing endpoint/component wherever one already exists — no duplicate detail UI built
- [ ] Where applicable, a `GovernanceAlert` is raised through the existing alert service, not a new one
- [ ] One sentence ready for "where does this data come from" and one for "how is this kept current" — both answerable honestly, matching this document
