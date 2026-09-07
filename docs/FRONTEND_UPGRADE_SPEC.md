# BhoomiSetu — Complete Frontend Upgrade Specification

**Status: planning document only — nothing here has been implemented. Scheduled to start 2026-09-09.**

This is the master frontend-IA document, superseding both `docs/flow.md`'s original IA (which treated Home and the Citizen Portal as one route, and assumed guest search) and most of `docs/AUTH_VERIFICATION_UPGRADE.md`'s "previously agreed" list (folded in here with more detail and now-resolved open questions). `docs/design.md` (the Bauhaus visual system — colors, borders, shadows, typography) is **not** superseded — this document is about structure and flow, not visual style; the redesign already built stays the visual reference.

The governing principle, in the user's own words: **the public website explains BhoomiSetu; the Citizen Portal manages a citizen's own parcels and requests; the Officer Portal manages verification and governance work; the Admin Portal manages the platform.** No page mixes these responsibilities.

Five previously-open questions (from `docs/AUTH_VERIFICATION_UPGRADE.md` §10) are now answered by the user and resolved throughout this document — marked **[RESOLVED]** at each relevant point.

---

## 1. Four frontend experiences, not one

```text
                        BHOOMISETU
                             |
        +--------------------+--------------------+
        |                    |                    |
        v                    v                    v
   PUBLIC WEBSITE       AUTHENTICATION        ROLE PORTALS
                                                 |
                              +------------------+------------------+
                              |                  |                  |
                              v                  v                  v
                       CITIZEN PORTAL      OFFICER PORTAL      ADMIN PORTAL
```

- **Public website**: explains the platform, no personal data, no functional tools.
- **Authentication**: registration, sign-in, OTP/verification, password recovery — no main navbar.
- **Citizen Portal**: the authenticated citizen workspace.
- **Officer Portal**: the authenticated officer workspace.
- **Admin Portal**: platform administration.

**[RESOLVED] Home ≠ Citizen Portal.** Today, `/` and `/citizen` render the exact same `CitizenPortal.tsx` component at different auth states — that's the model this document replaces. The public home page becomes purely informational; My Parcels, parcel search, document verification, and requests all move behind sign-in into a real multi-page Citizen Portal. **The user has confirmed this direction but flagged the exact mechanics ("routes, what About/Features actually contain") as still open for discussion before implementation** — treat the split as decided, its details as not yet final.

**[RESOLVED] No guest search, anywhere in the flow.** This is a deliberate reversal of what's built and documented today — `docs/FEATURES.md` feature 3 currently states parcel search "needs no account," and the current landing hero literally has a line of copy saying so. That copy and that behavior both go away under this spec. Search happens inside the Citizen Portal, post-login, full stop. (`docs/FEATURES.md` isn't being edited to reflect this yet — it describes what's actually shipped, and nothing has shipped from this document. It'll need updating once this is actually built.)

---

## 2. Public website

Purely informational: Home, About, Features, Sign In, Get Started. No personal parcel data, no document upload, no officer tools, no search interface.

### Minimal navbar

```text
[ BhoomiSetu Logo ]   Home   About   Features              [ Sign In ]  [ Get Started ]
```

**Removed from the navbar entirely**: Citizen Portal / Officer Portal / Admin Portal links, My Parcels, Document Verification, Search Records, Analyze Imagery. None of these should be nav items a visitor sees before signing in — after sign-in, the backend-identified role redirects automatically (unchanged from what's already built: `LoginPage.tsx` already does `ADMIN→/admin`, `CITIZEN→/citizen`, officer roles`→/officer`).

This is a real reduction from what exists — `App.tsx`'s current nav has a search box, a CTA button, an app-switcher grid, and all three portal links, all of which this section asks to remove or relocate.

### Landing page header

Value proposition over feature cards — "what is this, what problem does it solve, who uses it, what do I do next," not a grid of clickable feature tiles. This session's `LandingHero.tsx` rebuild (geometric composition, no photo) may satisfy the visual language already; the *content* — dropping the 4-feature-card grid in favor of a clean value statement plus two CTAs — is a real content change, not just restyling.

---

## 3. Authentication

Sign In, Register, Mobile OTP Verification, Email Verification, Forgot Password, Reset Password — none with the main navbar, a lightweight logo/branding only. Forgot/Reset Password don't exist in this codebase in any form yet.

**[RESOLVED] Applies to Citizens only.** Officer/Admin accounts stay exactly as they are — admin-created (`docs/flow.md` rule 5), email + password, no mobile/OTP concept. This confirms the recommendation `docs/AUTH_VERIFICATION_UPGRADE.md` §10 made.

### Registration: mobile OR email, not both required

```text
At least one contact method
        |
   +----+----+
   |         |
   v         v
 Mobile    Email
   |         |
   v         v
Mobile OTP  Email OTP/Link
   |         |
   +----+----+
        |
        v
  Account Verified
```

Three valid cases: mobile only, email only, or both (user picks which to verify now; the other is added/verified later from Profile). Client-side validation blocks submission with "Please provide either a mobile number or an email address" if both are empty.

**[Refined, per the user's follow-up] A method-selector, not both fields shown at once.** Rather than one form showing Mobile *and* Email fields simultaneously, both the Register page and the Login page get a 2-button toggle up top — `Register with Email` / `Register with Mobile`, and `Login with Email` / `Login with Mobile` — and only the relevant single field appears once a method is picked. Cleaner than the original both-fields mockup, and matches how the "both provided → pick a verification method" case already worked.

Fields (once a method is picked): Full Name, the selected contact field (Mobile Number or Email Address), Password, Confirm Password — every password field gets a show/hide toggle (registration, sign-in if present there, forgot/reset/change password).

**[RESOLVED] "Login with Mobile" is password-based, matching the recommendation above.** Confirmed by the user: **OTP is a one-time verification step only** — used once when a contact method is first added (at registration, or later when adding the missing method from Profile). Every actual login, regardless of which identifier (mobile or email) the user signs in with, uses the account's password — there is no OTP-on-every-login / passwordless flow. Concretely: `POST /auth/login` needs to accept either `mobileNumber` or `email` as the identifier (whichever the user's account has verified), look up the same way, and check the same `bcrypt` hash — a single unified login path with two possible identifier fields, not two different auth mechanisms.

### OTP verification

6-digit code entry, visible expiry countdown, rate-limited resend, clear invalid-code error. Email may use OTP or a link; OTP should look/behave identically for mobile and email for UI consistency. Verification state (`mobileVerified`/`emailVerified`) is stored **independently** per contact method.

### Add/change contact method later (Profile)

Add: enter the missing method → verify → added. Change: enter new value → verify new value → **only then** does it replace the old one (the old verified method is never dropped before the new one is confirmed working, to avoid a lockout).

### Backend reality check (unchanged from `docs/AUTH_VERIFICATION_UPGRADE.md` §7 — still accurate)

- `users.email` is currently required+unique — needs to become nullable, with `mobileNumber` (nullable), `mobileVerified`, `emailVerified` added, and an "at least one present" constraint enforced at the service layer.
- **[RESOLVED] No SMS/email delivery mechanism exists in this codebase at all** (`docs/FEATURE_AUDIT.md` §7 already flags this) — **and the decision is a real SMS gateway, not a stub.** The user has identified candidate providers: global/testing-friendly options (Twilio, Sinch, Infobip) and India-specific options (Exotel, Gupshup, Fast2SMS). This still needs an actual account + API key + sender ID/virtual number provisioned by the user before the backend can send a real OTP — same category of external dependency as OAuth (`docs/FEATURE_AUDIT.md` §8 item 15) — nothing here is unblocked until those credentials exist. Recommend picking one India-specific provider (Exotel/Gupshup/Fast2SMS) given this is an Indian land-governance platform, unless the user has a reason to prefer a global one for easier initial testing. Once credentials exist, the backend needs a small `SmsService` (send OTP, independent of `GroqService`/the historical-imagery AI service) — a thin wrapper around whichever provider's Node SDK/REST API is chosen, not a large integration.

---

## 4. Citizen Portal

Multi-page, not the current single scrolling page:

```text
CITIZEN PORTAL
Dashboard · My Parcels · Raise Request · Requests · Documents · Notifications · Profile
```

- **Dashboard**: a summary only — parcel count, pending request count, recent notifications, recent request activity, relevant alerts. Not a replacement for the detailed pages (this is the intended purpose of this session's "aggregated My Requests" placeholder card and `docs/CITIZEN_FEATURES_UPGRADE_PLAN.md`'s `GET /citizen/dashboard` — same target, now with a confirmed page to live on).
- **My Parcels**: a list of parcel cards (ID, survey number, location, area, a "View Details" action) — already exists as `MyParcels.tsx`, needs to become its own page rather than a panel on the shared home/citizen page.
- **Parcel Detail** (Parcel 360, reused): map, basic info, land use, tax, restrictions, documents, request history, relevant alerts, **plus the new Ownership History tab (§8a) and (once built) the Encumbrance tab (`docs/FEATURE_AUDIT.md` §8 item 17)** — structurally close to what `Parcel360View.tsx` already is; read access only, actions gated by role.
- **Raise Request**: **[new restriction]** the parcel selector only lists parcels the citizen is actually associated with (via `citizen_parcels`) — a dropdown, not a free-text parcel ID field. This is a real, additional restriction beyond what this session already built (today, any signed-in citizen can file `ServiceRequestForm` against **any** `parcelId**, not just their own). Selecting a parcel auto-fetches its details (ID, survey number, location, village/district/state, area, land use, restrictions) and displays them read-only in the form — `ServiceRequestForm.tsx` today collects only `createdBy`/`requestDetails` and shows none of this.
- **Requests**: the aggregated cross-parcel request list (same target as the dashboard's placeholder card).
- **Documents**: documents grouped by parcel (registration doc, survey record, tax record, etc.), each with type/upload-date/verification-status, uploadable inline and run through the existing OCR/verification pipeline. This is new structure around data that's currently reachable only via the citizen-initiated document-verification panel and the (not-yet-built) `WorkflowDocument` persistence from `docs/CITIZEN_FEATURES_UPGRADE_PLAN.md` §3.2.
- **Notifications**: request-status changes (received/under review/department approved/department rejected/info requested/fully approved/fully rejected), tracked **per department**, not as one blended "approved/rejected" flag — a multi-step request currently only shows overall `currentStatus`; this asks for per-step notification granularity to be genuinely surfaced to the citizen, not just visible to an officer.
- **Profile**: view + manage mobile/email verification status, add/change either. This is the real feature the placeholder "Profile" pill (added this session) was standing in for.

### Citizen map: associated parcels only

The Citizen Portal's map defaults to the citizen's own linked parcels, not a general search-results view — a genuinely new map mode, not just a restyle of `MapComponent.tsx`'s existing search-driven behavior.

---

## 5. Officer Portal

Also multi-page, replacing the current single dashboard:

```text
OFFICER PORTAL
Dashboard · Assigned Requests · Parcel Verification · Governance Alerts · Map · Documents · Notifications · Profile
```

- **Dashboard**: work summary only (assigned requests, pending doc reviews, pending verification, high-priority alerts, workload) — detail lives on dedicated pages.
- **Assigned Requests**: request ID, parcel, type, status, priority, submission date, per-row → detail/workflow view. Close to what `WorkflowReviewPanel.tsx` already does, needs to become its own page.
- **Parcel Verification**: parcel info + map + documents + request context + alerts, combined — an officer-facing counterpart to Parcel 360.
- **Governance Alerts**: see §6 below — map previews, severity grouping, **and pagination**.
- **Notifications**: new request assigned, new documents submitted, department action on a shared request, high-priority alert — officer-side notification types distinct from citizen-side ones.
- **Profile**: officer's own account info (not the mobile/email OTP flow — that's citizen-only per §3).

---

## 6. Governance alerts: maps, severity grouping, and pagination

Each alert card gets a small embedded map preview (affected parcel + immediate context), grouped by severity (High/Medium/Low), each group independently inspectable.

**New from this session's follow-up conversation: a pagination control on the alerts list.** Today's `GovernanceAlertsPanel.tsx` renders every open alert as one long unpaginated scroll — confirmed directly during this session's verification pass (28 seeded alerts rendered as one continuous list on the Officer Portal screenshot). This is a concrete, scoped, low-risk frontend change: page the list (a page-size control + prev/next or numbered pages), independent of the map-preview and severity-grouping work, and independent of everything else in this document — it could reasonably be built on its own before the rest of this spec, if a quick win is wanted tomorrow.

---

## 7. Admin Portal

```text
ADMIN PORTAL
Dashboard · Users · Officers · Departments · Workflow Configuration · Governance Rules · System Monitoring
```

**[RESOLVED] Real backend, not just a nav restructure — user has confirmed "the backend can be created."** This is genuinely the largest architectural lift in this whole spec, larger than the auth/OTP work, because none of these three concepts exist as data today — they're hardcoded in application code:

- **Departments**: today, department names (`LAND_RECORDS`/`REGISTRATION`/`PLANNING`/`TAX`/`RESTRICTION`/`DISPUTE`) are string literals referenced directly throughout the backend (`ROLE_DEPARTMENT` in `auth/roles.constants.ts`, the workflow-pipeline definitions, the 6 mock department controllers). A real "Department management" admin page needs a `departments` table (name, description, contact info) — the harder part isn't the table, it's that every place currently hardcoding a department string would need to read from it instead, or the table becomes descriptive metadata layered on top of the existing hardcoded set without actually replacing it (the pragmatic prototype choice — a `departments` table for display/admin purposes, while `ROLE_DEPARTMENT`/pipeline logic stays as-is underneath).
- **Workflow Configuration**: which departments review which workflow type, and in what order, is currently `workflows.service.ts`'s hardcoded `pipelineFor()`/`PIPELINES_BY_TYPE`. Making this admin-editable needs a `WorkflowPipelineConfig` table (workflow type → ordered department/role steps) and `pipelineFor()` reading from it instead of a hardcoded map — a real, non-trivial rework of the workflow engine's own source of truth, not additive the way most of this spec is.
- **Governance Rules**: conditions like "flood-zone parcel → alert" or a tax-overdue threshold are currently hardcoded in `seed.ts` and the change-detection/governance-alert creation logic. **[Confirmed by the user: admin must be able to edit these, not just view them]** — a real `GovernanceRule` table (condition type, threshold, resulting alert severity) with full admin CRUD (create/edit/delete a rule from the UI), and every rule-evaluation call site (tax-overdue check, restriction-zone overlap, the new §8 unauthorized-change check) reading live from that table instead of a hardcoded condition. This is the equivalent lift to Workflow Configuration above — the engine rewrite is in making the *evaluation* logic data-driven, not just in adding a settings page.
- **System Monitoring**: the most tractable of the four — this can genuinely reuse `GET /analytics/summary` and `GET /audit`, just presented as its own page rather than cards sharing space with User Management.

**Recommend sequencing this last**, or explicitly phasing it: System Monitoring and a real `departments` table (metadata-only, not replacing existing hardcoded logic) are cheap and can go early; Workflow Configuration and Governance Rules are genuine engine rewrites and should be scoped as their own multi-session piece of work, not folded into the same pass as the Citizen/Officer portal restructuring.

---

## 8. "Analyze Imagery" — remove from the frontend, replace with an on-demand historical comparison

**[RESOLVED, refined by the user]** The original spec (§23 of the source document) said "remove entirely" because the current feature's name overpromises ("Analyze Imagery" implies real satellite-imagery analysis; the actual pipeline is a hand-rolled pixel-diff between two manually-uploaded images — accurate per `docs/FEATURE_AUDIT.md` §6, "a deliberate simplification, not an oversight"). The user has since refined this: **remove the current standalone panel from the frontend only**, and separately **add a historical-comparison feature that compares a previous year's photo against the current image, triggered on-demand** — either when a citizen/officer explicitly asks for it, or when a request is raised that needs it — rather than existing as an always-visible bulk-upload tool on the Officer Portal.

This connects to two things already on record and not yet resolved:

- `docs/FEATURE_AUDIT.md` §7's **"historical parcel-boundary versioning"** gap (geometry over time — score 0, no source document asks for it).
- `docs/CITIZEN_FEATURES_UPGRADE_PLAN.md` §3.4's **"historical spatial state"** (deliberately attribute-only versioning — land use/zoning/restriction/tax per year, explicitly *not* geometry).

The new "historical feature" idea is a **third, distinct thing** — image-based, not attribute-based, and not full geometry-versioning either. It doesn't replace either of the other two; it complements them, and genuinely elevates `docs/FEATURE_AUDIT.md` §7's "historical parcel-boundary versioning" from "score 0, unscoped by anyone" to "scoped, pending implementation."

### [RESOLVED] The design, per the user's follow-up (2026-09-08)

**Store a small, fixed archive, not a per-parcel one.** One snapshot image per **cluster** per year — 2022/2023/2024/2025 (4 years × the existing 4-5 clusters, ~16-20 images total, not one per parcel) — fetched on demand when a comparison is actually requested (from a governance-alert check or a citizen/officer-raised request), rather than requiring a fresh upload every time the way today's `ChangeDetectionPanel` does.

```text
New entity: ClusterHistoricalSnapshot
  id, clusterId, year, imagePath, bounds (minLng/minLat/maxLng/maxLat), generatedAt
```

**Every year's snapshot for a cluster uses the identical bounding box.** This is the key simplification: because all 4 years are rendered from the same fixed coordinates, no image registration/alignment step is needed before comparing them — a real satellite-imagery pipeline would need to handle camera angle/zoom/crop differences between captures; this one doesn't, by construction.

**[RESOLVED] How the images themselves get generated**: simplified server-rendered polygons, confirmed by the user — a seed-time (or admin-triggered) script server-side-renders each cluster's parcels for a given year as abstract colored polygon shapes (not a live headless-browser screenshot of the real MapLibre map), with a deliberately-chosen subset of parcels drawn in a different fill color to represent "this parcel changed this year." Fast, fully deterministic, easy to seed, no new browser-automation dependency — using the same kind of image manipulation (`sharp`) already a backend dependency for change-detection.

**Which changes are "legitimate" vs. worth a governance alert — reuses `docs/CITIZEN_FEATURES_UPGRADE_PLAN.md` §3.4's `ParcelHistoricalState` table.** That table (parcelId, year, landUse, zoningStatus, restrictionStatus, taxStatus) was already scoped to track attribute history — this is exactly the data needed to answer "was this parcel's change actually recorded." The logic: for each parcel the image marks as visually changed in year Y, check whether `ParcelHistoricalState` shows a corresponding recorded attribute change for that parcel/year.

- **If yes** (a real registration/land-use/tax update is on record for that year) → the change is accounted for, nothing alarming.
- **If no** (the image shows a change, but no record reflects one) → this is the interesting case: create a `GovernanceAlert` of the existing `UNAUTHORIZED_CHANGE_DETECTED` type, reusing the same shared alert-creation function already called from two other places (`docs/FEATURES.md` feature 10) — this is exactly the "third call site" `docs/CITIZEN_FEATURES_UPGRADE_PLAN.md` item 11 already anticipated, just arriving via a different trigger (a yearly image comparison) than originally imagined (a rule-engine evaluation).

**Cross-reference with restricted zones — a real, valuable combination, not extra scope.** `restriction-record.hasRestriction`/`restrictionType` already exists (flood/protected-area/etc.). An unauthorized visual change on a parcel that *also* has an active restriction is a natural higher-severity case worth its own alert framing ("unauthorized activity in a restricted zone") — reuses two datasets that already exist, no new schema needed for this part.

**Surfacing on the frontend**: unauthorized changes show up in the Governance Alerts tab (§6 above) like any other alert — with the two snapshot images (or a before/after crop) as the map-preview content for that specific alert card, instead of (or alongside) the live-map preview other alert types get.

**[New, per the user's follow-up] A year-toggle control next to the map, wherever a cluster's historical snapshots are shown.** A small segmented control — `Current | 2022 | 2023 | 2024 | 2025` — positioned near the map on the Governance Alert detail view and the Officer Portal's Parcel Verification page (§5). Selecting a year swaps the displayed content from the live MapLibre map to that year's stored `ClusterHistoricalSnapshot` image for the parcel's cluster, so an officer can actually step through 2022→2025 one year at a time rather than only seeing a single before/after pair. `Current` (the default) shows the live, real map exactly as today. If the control is reached from a specific parcel's context (an alert, or Parcel 360/Parcel Verification), that parcel should stay visually highlighted/outlined across every year's snapshot so it's the same parcel being tracked, not just "some image of the cluster."

**AI-based comparison instead of pixel-diff** — replacing `image-diff.ts`'s hand-rolled pixel-threshold approach with an AI vision model comparing the two same-bounds images and identifying changed regions. **[RESOLVED, partially]** confirmed: the existing `GroqService`/model this project already uses does **not** support image input — so this cannot reuse the current AI integration as-is. The user is providing a different AI service/model specifically for this image-comparison purpose; a new service module (separate from `GroqService`, or a `GroqService` extension once the new provider's details arrive) will be needed once that's in hand. Until then, this feature's comparison step has no confirmed AI path — the existing pixel-diff (`image-diff.ts`) remains the fallback to build against first, with the AI-comparison step slotted in once the new provider is specified.

**Trade-off, in the user's own framing**: this increases the seed database's size (20-ish stored images instead of zero), but is explicitly valued as a demo/pitch strength — a visually compelling "here's how this parcel changed over 4 years, and here's the one nobody registered" story that ties directly to the SIH PS's own "satellite imagery-based change detection" preferred-item language, and to the restricted-zone monitoring use case named in the PS's essential/additional layers.

---

## 8a. Ownership history (previous owners) — new, per the user's follow-up

Show a parcel's chain of past owners, not just the current one.

**Current state**: today's ownership data is current-owner-only. State A/B land records (`ownerName`/`holderName`) hold one name each; `registration-record.entity.ts` has `lastTransactionType`/`lastTransactionDate` (SALE/GIFT/INHERITANCE/PARTITION) but only the single *most recent* transaction, not a history of every prior one. `docs/FEATURE_AUDIT.md` §1a already marks "Record of Rights (ownership)" ✅ against the PS — this feature makes that row genuinely stronger (a real RoR/7-12-extract in India shows a full mutation history, not just the current name) rather than closing a gap it previously missed.

**Proposed shape**: a new `OwnershipHistoryRecord` entity — `parcelId`, `ownerName`, `transactionType` (`ORIGINAL` | `SALE` | `GIFT` | `INHERITANCE` | `PARTITION`), `transactionDate`, optional `documentReference`. Multiple rows per parcel, ordered by date, the most recent being the current owner already shown elsewhere (State A/B records / `registration-record`) — this table doesn't replace those, it's the history sitting behind the "current" values they already expose.

**Surfacing on the frontend**: a new tab/section on Parcel 360 (both the citizen's own Parcel Detail page, §4, and the officer's Parcel Verification page, §5) — "Ownership History," a simple timeline: past owner → transaction type/date → next owner → ... → current owner. Sits alongside the encumbrance tab (`docs/FEATURE_AUDIT.md` §8 item 17) and the year-toggle historical view (§8 above) as one more Parcel 360 tab, not a new page.

**Seed data**: 1-3 prior owners per parcel (or a representative subset, not necessarily all 200), with a plausible transaction chain ending at the owner name already seeded in State A/B records — same synthetic-but-honest approach as every other mock dataset in this codebase.

**[RESOLVED] Visibility: citizen-specific, not public.** Confirmed by the user — only a citizen who is actually associated with that parcel (i.e. it appears in their own `citizen_parcels` link, same as "My Parcels") can see its Ownership History tab; it is **not** open to any citizen who happens to view the parcel, and not treated as a public record in this product's model even though real RoR/mutation history is traditionally public in India. Officers/admins are unaffected by this restriction — they already need full record access for verification work, and the open question was specifically about the citizen-facing side. Backend implication: the endpoint serving this (Parcel 360, or a dedicated `GET /parcels/:id/ownership-history`) needs a citizen-role check against `citizen_parcels`, not just the existing CITIZEN-role gate alone — the same shape as the "requests restricted to the citizen's own parcels" rule in §4.

---

## 9. Design principles (restated from the source spec)

1. **Role separation** — public/citizen/officer/admin each own a distinct concern, never mixed on one page.
2. **Auth flexibility** — mobile OTP or email verification, never both mandatory (citizens only, §3).
3. **Minimum data entry** — select a parcel, the system auto-fetches what it already knows; the citizen adds only new context.
4. **Parcel access control** — a citizen can only raise a request against a parcel actually associated with their account.
5. **Contextual notifications** — one department's approval is communicated as exactly that, not as if the whole multi-department request were resolved.
6. **Spatial context** — governance alerts carry a map, not text alone.
7. **Accurate feature naming** — a feature is named for what it actually does (directly drives §8 above).

---

## 10. What's genuinely new vs. what's a restyle/restructure of something built

To keep tomorrow's planning honest about effort:

| Genuinely new (no equivalent exists today) | Restructure of something that already works |
|---|---|
| Mobile OTP + email OTP/link verification, SMS/email delivery | Citizen Portal becoming multi-page (the components mostly already exist: MyParcels, ParcelSearch, Parcel360View, DocumentVerificationPanel, ServiceRequestForm, RequestNotifications) |
| Forgot/Reset Password flow | Officer Portal becoming multi-page (WorkflowReviewPanel, GovernanceAlertsPanel, ChangeDetectionPanel already exist as components) |
| Profile page (add/change mobile/email) | Navbar reduction (removing links, not adding architecture) |
| Raise-Request parcel restricted to the citizen's own associations (a real new backend check) | Landing hero content simplification (visual work already done this session, content trim still open) |
| Auto-fetched, read-only parcel details in the request form | Governance alert severity grouping (data already has a `severity` field) |
| Per-department notification granularity (citizen-facing) | |
| Governance alert map previews | |
| Governance alerts pagination | |
| The historical image-comparison feature (§8), including the year-toggle control next to the map | |
| Ownership history / previous owners (§8a) | |
| Admin Portal's Departments / Workflow Configuration / Governance Rules pages (no backend concept exists for most of these yet) | |

---

## 11. Open items still needing a decision before implementation

1. ~~OTP delivery: real provider vs. stubbed/dev-mode~~ — **[RESOLVED]** a real SMS gateway, candidates identified (Twilio/Sinch/Infobip globally, Exotel/Gupshup/Fast2SMS for India) — see §3. Credentials will be provided by the user "when we are actually working" (i.e. at implementation time, not during planning) — nothing further to decide here until then.
1a. ~~Does "Login with Mobile" use a password or OTP?~~ — **[RESOLVED]** password, always — OTP is one-time-only, used solely when a contact method is first added/verified (registration or Profile), never on ordinary login. See §3.
2. Exact mechanics of the Home/Citizen-Portal split (what routes, what "About"/"Features" actually contain) — user has flagged this as "we can discuss," not yet decided.
3. ~~Historical image-comparison feature: relocate-the-existing-mechanic vs. build a real archive~~ — **[RESOLVED]** a small fixed per-cluster/per-year archive, see §8 for the full design. Both sub-questions from that design are now resolved too:
   - ~~Snapshot generation~~ — **[RESOLVED]** simplified server-rendered abstract polygons, not a headless-browser screenshot.
   - ~~AI-based comparison~~ — **[RESOLVED, blocked on external input]** the existing Groq model doesn't support image input; the user is providing a different AI service for this specifically. Build against the existing pixel-diff fallback first; slot in the new provider once its details arrive.
4. ~~Admin Portal's scope~~ — **[RESOLVED]** real backend, confirmed by the user. Workflow Configuration and Governance Rules are genuine engine rewrites (see §7) — worth a firm sequencing decision (last, or a separate multi-session effort) rather than folding into the same pass as everything else.
5. Notification delivery mechanism itself (not just OTP) — `docs/FEATURE_AUDIT.md` §7 already flagged push/SMS/email notification delivery as unscoped; this spec's "citizen and officer notifications" (§29-30 of the source) reads as in-app feed notifications (matching what `RequestNotifications.tsx`/`GovernanceAlertsPanel.tsx` already do, just more structured), not push/SMS/email — worth confirming that reading is correct before assuming a bigger delivery mechanism is in scope.

---

*Nothing in this document has been built. `docs/AUTH_VERIFICATION_UPGRADE.md` stays as the backend-schema-level detail on the auth/OTP piece specifically; this document is the full-site IA it now sits inside.*
