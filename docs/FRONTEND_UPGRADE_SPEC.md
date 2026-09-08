# BhoomiSetu — Complete Frontend Upgrade Specification

**Status: Phase 0 (§6 pagination, the ownership-history/encumbrance backend work) and Phase 1 (the Home/Citizen-Portal split, both portals' multi-page restructure, and the Raise-Request parcel restriction) are done as of 2026-09-09. Phase 2 (auth/OTP, historical imagery) and Phase 3 (Admin Portal real backend) remain planning-only, blocked as described in §3/§7/§8/§11.**

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

**[DONE] Home ≠ Citizen Portal.** `/` is now a real guest-only `HomePage.tsx` (hero + a "How BhoomiSetu Works" 3-step section + links to `/about`/`/features`); a signed-in user hitting `/` is redirected straight to their own portal (`App.tsx`'s `PORTAL_NAV` map). My Parcels, parcel search (now "Find Parcels"), document verification ("Verify Documents"), and requests all moved behind sign-in into `/citizen/*` - a real multi-page Citizen Portal (`CitizenPortal.tsx` now owns its own relative `<Routes>`: Dashboard/My Parcels/Find Parcels/Raise Request/Requests/Verify Documents/Documents/Notifications/Profile). The two leftover top-level `/parcels/search` and `/map` routes (pre-dating this session's redesign, unguarded and unlinked from anywhere) were removed rather than migrated, since they were the last unguarded path to the old guest-search behavior.

**[RESOLVED] No guest search, anywhere in the flow.** This is a deliberate reversal of what's built and documented today — `docs/FEATURES.md` feature 3 currently states parcel search "needs no account," and the current landing hero literally has a line of copy saying so. That copy and that behavior both go away under this spec. Search happens inside the Citizen Portal, post-login, full stop. (`docs/FEATURES.md` isn't being edited to reflect this yet — it describes what's actually shipped, and nothing has shipped from this document. It'll need updating once this is actually built.)

---

## 2. Public website

Purely informational: Home, About, Features, Sign In, Get Started. No personal parcel data, no document upload, no officer tools, no search interface.

### One single navbar, everywhere — ✅ done

```text
Guest:    Home   About   Features                                    [ Get Started ]
Citizen:  Home   About   Dashboard   My Parcels   Find Parcels   Raise Request
          Requests   Verify Documents   Documents   Notifications   Profile
Officer:  Dashboard   Assigned Requests   Governance Alerts   Map   Documents   Notifications   Profile
Admin:    Admin Portal   (unchanged - single page, Phase 3 not done yet)
```

**Revised twice.** First built as a guest-only conditional navbar (guests got Home/About/Features, signed-in users kept a single "Citizen/Officer/Admin Portal" link while each portal grew its *own* second, portal-owned sub-nav underneath it for its multi-page structure — §4/§5's original build). **The user then explicitly rejected the two-navbar result**: *"i want a single navbar in all the portals i dont want 2 diffrent navbars fit the things in the orignal navbar only."* Fixed by deleting both portals' own sub-nav bars entirely (`CitizenPortal.tsx`/`OfficerPortal.tsx` are now just their own `<Routes>`, no nav markup) and rendering every page either portal owns directly in this one `App.tsx` header instead — the same header row a guest already had, now populated per role via `navConfig.ts` (`CITIZEN_NAV_ITEMS`/`OFFICER_NAV_ITEMS`) and `navItemsFor()`. Horizontally scrollable (`overflow-x-auto`), not wrapping, since a citizen's full 11-item list doesn't fit one line at every width — **known rough edge: no visible scroll affordance (arrow/fade) hints that "Profile" etc. are reachable off-screen on narrower viewports**, worth a follow-up polish pass.

**Also removed in the same pass: the BhoomiSetu logo/wordmark, from the navbar entirely** — the user's explicit *"remove bhoomisetu from the nav bar and add that to the landing home page"*. It now lives at the top of `LandingHero.tsx`'s hero content instead (logo image + wordmark + tagline, same visual treatment, just relocated) — so it's visible on `/` but nowhere in the persistent chrome.

**Citizens can now reach Home and About while signed in** — the user's explicit *"the citizens should be able to see the home and about page"*. `App.tsx`'s `"/"` route no longer redirects a signed-in citizen away (only officer/admin still get redirected to their portal); `LandingHero.tsx` is auth-aware, swapping the guest Get-Started/Sign-In CTA pair for a single "Go to My Dashboard" link when a citizen is signed in, so the page stays coherent either way. Officers/admins were not asked for this and still don't see Home/About in their nav.

**Also removed from the navbar for guests** (unchanged from the original pass): Citizen Portal / Officer Portal / Admin Portal links, My Parcels, Document Verification, Search Records, Analyze Imagery. After sign-in, the backend-identified role redirects automatically (unchanged: `LoginPage.tsx` already does `ADMIN→/admin`, `CITIZEN→/citizen`, officer roles`→/officer`).

Covered by `App.test.tsx` (per-role nav content, the citizen no-redirect-off-"/" behaviour, no-logo-in-navbar for every role, sign-out returns to guest Home) and `OfficerPortal.test.tsx` (its own former Logout button and header are gone - logout is the single global "Sign Out" in the utility bar now, unit-tested at the `useLogout()` level in `auth.test.tsx` and at the click-wiring level in `App.test.tsx`).

### Landing page header — ✅ done

Value proposition over feature cards — "what is this, what problem does it solve, who uses it, what do I do next," not a grid of clickable feature tiles. `LandingHero.tsx`'s old 4-feature-card grid (which promised anonymous search) is gone; the hero now ends in two CTAs (Get Started → `/register`, Sign In → `/login`) and `HomePage.tsx` follows it with a 3-step "How BhoomiSetu Works" section and links into `/about`/`/features`.

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
- **[RESOLVED] No SMS/email delivery mechanism exists in this codebase at all** (`docs/FEATURE_AUDIT.md` §7 already flags this) — **and the decision is a real SMS gateway, not a stub.** **[RESOLVED, 2026-09-08] Provider: Fast2SMS** (the user is already using it) — global options (Twilio/Sinch/Infobip) and the other India-specific candidates (Exotel/Gupshup) are no longer under consideration. Full REST API reference confirmed against Fast2SMS's own docs (`docs.fast2sms.com`):
  - **Account setup (not yet done)**: sign up at fast2sms.com → API key lives in the dashboard's **Dev API** section → create an **OTP Template** under **Smart OTP** (channel SMS or WhatsApp, with the other as an optional fallback) → save it to get an **OTP ID**. **Open sub-question, unconfirmed**: whether the SMS channel needs the user's own TRAI DLT entity/sender-ID registration, or whether Fast2SMS's "free DLT support" gives a ready-made shared template that skips that — needs checking directly in the Fast2SMS dashboard/support before assuming either way, since DLT registration (if actually required) can take a few days.
  - **Send**: `POST https://www.fast2sms.com/dev/otp/send`, header `Authorization: <API key>`, body `{mobile, otp_id, otp_length?, otp_expiry?}` → `{return, status_code, request_id, message}`.
  - **Verify**: `POST https://www.fast2sms.com/dev/otp/verify`, same header, body `{mobile, otp}` → `{return, status_code, message}`. Fast2SMS stores and checks the code server-side — BhoomiSetu's own `users` table never needs an `otpCode` column, only the `mobileVerified` boolean once a verify call returns `return: true`.
  - **Still blocked on**: the actual API key + OTP ID, which only exist once the user completes the account/template setup above (and resolves the DLT sub-question) — same category of external dependency as OAuth (`docs/FEATURE_AUDIT.md` §8 item 15). Once those two values exist, the backend needs a small `SmsService` (independent of `GroqService`/the historical-imagery AI service) wrapping the two endpoints above, reading `FAST2SMS_API_KEY`/`FAST2SMS_OTP_ID` from `.env` — not a large integration.

---

## 4. Citizen Portal — ✅ done (this pass), Documents/Notifications/full Profile still placeholders

Multi-page, replacing the old single scrolling page. `CitizenPortal.tsx` is now just its own relative `<Routes>` (no nav markup of its own - see §2, single navbar), mounted once at `/citizen/*` by `App.tsx`, with every page below reachable from the one global navbar instead:

```text
CITIZEN PORTAL
Dashboard · My Parcels · Find Parcels · Raise Request · Requests · Verify Documents · Documents · Notifications · Profile
```

(Two extra tabs beyond the original list - **Find Parcels** and **Verify Documents** - carry the already-built `ParcelSearch`/`MapComponent`/`DocumentVerificationPanel` pieces that used to share the single home/citizen page; the source spec's page list didn't explicitly name a page for them, but "no guest search, anywhere in the flow" (§1) requires *somewhere* post-login for them to live.)

- **Dashboard** (`CitizenDashboardPage.tsx`) — ✅ summary only: linked-parcel count (`GET /parcels/mine`) and pending-request count (`GET /workflows/mine`), quick-action links into the other pages, and the still-unbuilt **Land Claim** feature as a `ComingSoonCard`. Recent-notifications/recent-activity feed is not part of this summary yet — that's downstream of the still-unbuilt Notifications feature below.
- **My Parcels** (`MyParcelsPage.tsx`) — ✅ `MyParcels.tsx` as its own page.
- **Find Parcels** (`FindParcelsPage.tsx`) — ✅ `ParcelSearch` + `MapComponent`, moved as-is from the old single-page CitizenPortal.
- **Parcel Detail** (Parcel 360, reused, unchanged by this pass): map, basic info, land use, tax, restrictions, documents, request history, relevant alerts, the Ownership History tab (§8a) and the Encumbrance tab (`docs/FEATURE_AUDIT.md` §8 item 17) — reached via `/parcels/:id` from My Parcels/Find Parcels, same route as before.
- **Raise Request** (`RaiseRequestPage.tsx`) — ✅ **[new restriction, built]** the parcel selector lists only `GET /parcels/mine` results (a dropdown, not free text), auto-fills read-only details (ULPIN/canonical ID/state-district-local body/area) from that same response once one is picked, then the same three request-type buttons `Parcel360View.tsx` already had, reusing `ServiceRequestForm.tsx` unchanged. The restriction is enforced server-side too, not just hidden in the UI: `POST /workflows` now 400s on a nonexistent parcel and 403s on a real parcel the citizen isn't linked to (`workflows.controller.ts`'s `isCitizenAssociatedWithParcel` check, backed by `WorkflowsService.isCitizenAssociatedWithParcel`/`parcelExists`) - so `Parcel360View`'s own request buttons (which file against whatever parcel is currently open, for any signed-in citizen) are retroactively covered by the same check, not just this new page.
- **Requests** (`RequestsPage.tsx`) — ✅ the aggregated cross-parcel request list, backed by the new `GET /workflows/mine` endpoint (`WorkflowsService.findMineForCitizen` - joins `citizen_parcels` to every workflow across every one of the citizen's parcels). Shows each request's overall status plus a per-department step-status pill row.
- **Verify Documents** (`VerifyDocumentsPage.tsx`) — ✅ `DocumentVerificationPanel`, moved from the old single-page CitizenPortal, with an added optional "which parcel is this for" dropdown (previously that context came for free from the shared page's own search selection).
- **Documents** (`DocumentsPage.tsx`) — still a `ComingSoonCard`. Documents grouped by parcel (registration doc, survey record, tax record, etc.), each with type/upload-date/verification-status, uploadable inline and run through the existing OCR/verification pipeline, is new structure around data reachable today only via Verify Documents and the (not-yet-built) `WorkflowDocument` persistence from `docs/CITIZEN_FEATURES_UPGRADE_PLAN.md` §3.2.
- **Notifications** (`NotificationsPage.tsx`) — still a `ComingSoonCard`. Request-status changes tracked **per department** as a genuine structured feed (received/under review/department approved/department rejected/info requested/fully approved/fully rejected) — the Requests page above already surfaces per-department step status *on each request*, but a real notification feed on top of that is still unbuilt.
- **Profile** (`ProfilePage.tsx`) — partially built: shows the real signed-in account info (name/email/role) - the actual feature the placeholder "Profile" pill (`MyParcels.tsx`, added earlier this session) was standing in for - but mobile/email add-and-verify is still a `ComingSoonCard`, blocked on the SMS gateway decision (§3).

### Citizen map: associated parcels only

The Citizen Portal's map defaults to the citizen's own linked parcels, not a general search-results view — a genuinely new map mode, not just a restyle of `MapComponent.tsx`'s existing search-driven behavior.

---

## 5. Officer Portal — ✅ done (this pass), Parcel Verification/Documents/Notifications still open

Also multi-page, replacing the old single dashboard. `OfficerPortal.tsx` follows the same own-`<Routes>`-no-nav-of-its-own pattern as `CitizenPortal.tsx` (§2), mounted at `/officer/*`; "Welcome, {name}" moved to `OfficerDashboardPage.tsx` and the portal's own Logout button was removed (the global "Sign Out" in `App.tsx`'s utility bar covers it):

```text
OFFICER PORTAL
Dashboard · Assigned Requests · Governance Alerts · Map · Documents · Notifications · Profile
```

- **Dashboard** (`OfficerDashboardPage.tsx`) — ✅ trimmed to a work summary only (pending-workflow/verified-today/alert/documents-processed stat cards + quick links) - the pending-workflow list and its review panel that used to sit directly on this same page moved to Assigned Requests below.
- **Assigned Requests** (`AssignedRequestsPage.tsx`) — ✅ the pending-workflow list + `WorkflowReviewPanel.tsx`, as its own page now (request ID/parcel/type still shown per-row; priority/submission-date sorting is not added).
- **Parcel Verification** — still open, unbuilt. An officer-facing counterpart to Parcel 360 (parcel info + map + documents + request context + alerts combined) doesn't exist as its own page yet; officers reach `/parcels/:id` (Parcel 360 itself, unguarded, role-aware) the same way citizens do.
- **Governance Alerts** (`GovernanceAlertsPage.tsx`) — ✅ its own page now. See §6 below for its own status — pagination done, map previews/severity grouping still open.
- **Map** (`OfficerMapPage.tsx`) — ✅ new page, general `MapComponent` view (no parcel scoping) - reachable inside the portal now rather than only via the removed top-level `/map` route.
- **Documents** / **Notifications** (`OfficerDocumentsPage.tsx` / `OfficerNotificationsPage.tsx`) — still `ComingSoonCard`s (the dashed-border staff-surface variant, matching `AdminPortal.tsx`'s existing placeholder convention, not the Citizen Portal's circular-badge one).
- **Profile** (`OfficerProfilePage.tsx`) — ✅ officer's own account info (name/email/role/department) - not the mobile/email OTP flow, that's citizen-only per §3.

**Also decided in this pass**: `ChangeDetectionPanel` ("Analyze Imagery") is no longer mounted anywhere in the Officer Portal's navigation, per §8's already-[RESOLVED] decision to remove the standalone panel pending the on-demand historical-comparison replacement. The component and its backend route are untouched (`image-diff.ts` stays the fallback §8 names to build that replacement against) - it's unmounted from the nav, not deleted.

---

## 6. Governance alerts: maps, severity grouping, and pagination

Each alert card gets a small embedded map preview (affected parcel + immediate context), grouped by severity (High/Medium/Low), each group independently inspectable. **Not yet built** — this part of the section is still just planning, same status as the rest of this document.

**✅ Done (2026-09-09): pagination.** `GovernanceAlertsPanel.tsx` was rendering every open alert as one long unpaginated scroll (confirmed live — 28 seeded alerts in one continuous list). Pulled forward and built independently of the rest of this spec, since it was scoped, low-risk, and self-contained: 5 alerts/page, client-side, with Prev/Next controls, live-verified across 6 pages. The map-preview and severity-grouping work above is still open.

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

To keep tomorrow's planning honest about effort. Items built this pass are struck through with a ✅ pointer to where they landed:

| Genuinely new (no equivalent exists today) | Restructure of something that already works |
|---|---|
| Mobile OTP + email OTP/link verification, SMS/email delivery | ~~Citizen Portal becoming multi-page~~ — **✅ done, §4** |
| Forgot/Reset Password flow | ~~Officer Portal becoming multi-page~~ — **✅ done, §5** |
| Profile page (add/change mobile/email) — page ✅ built (§4/§5), add/change mobile/email itself still open | ~~Navbar reduction~~ — **✅ done** (per-role minimum nav, done earlier this session) |
| ~~Raise-Request parcel restricted to the citizen's own associations~~ — **✅ done, §4**: `workflows.controller.ts`'s `isCitizenAssociatedWithParcel` check | ~~Landing hero content simplification~~ — **✅ done, §2** |
| ~~Auto-fetched, read-only parcel details in the request form~~ — **✅ done, §4**: `RaiseRequestPage.tsx` | Governance alert severity grouping (data already has a `severity` field) — still open |
| Per-department notification granularity (citizen-facing) - the Requests page (§4) shows step status per request; a real notification *feed* is still open | |
| Governance alert map previews | |
| ~~Governance alerts pagination~~ — **✅ done, §6** (built earlier this session) | |
| The historical image-comparison feature (§8), including the year-toggle control next to the map | |
| Ownership history / previous owners (§8a) — **✅ done** (Phase 0, backend + Parcel 360 tab) | |
| Admin Portal's Departments / Workflow Configuration / Governance Rules pages (no backend concept exists for most of these yet) | |

---

## 11. Open items still needing a decision before implementation

1. ~~OTP delivery: real provider vs. stubbed/dev-mode~~ — **[RESOLVED]** a real SMS gateway, **Fast2SMS** (chosen 2026-09-08 — see §3 for the confirmed API reference: `/dev/otp/send` + `/dev/otp/verify`, `otp_id` template-based). Still blocked on the user actually completing account/OTP-template setup and confirming the DLT sub-question §3 flags — nothing further to decide here until then, only to provision.
1a. ~~Does "Login with Mobile" use a password or OTP?~~ — **[RESOLVED]** password, always — OTP is one-time-only, used solely when a contact method is first added/verified (registration or Profile), never on ordinary login. See §3.
2. ~~Exact mechanics of the Home/Citizen-Portal split~~ — **[RESOLVED, built]** `/` is a guest-only `HomePage.tsx` (redirects a signed-in user to their own portal); `/citizen/*` and `/officer/*` are each a self-contained portal with their own relative `<Routes>` (see §4/§5); `/about` and `/features` stay the standalone informational pages already built earlier this session.
3. ~~Historical image-comparison feature: relocate-the-existing-mechanic vs. build a real archive~~ — **[RESOLVED]** a small fixed per-cluster/per-year archive, see §8 for the full design. Both sub-questions from that design are now resolved too:
   - ~~Snapshot generation~~ — **[RESOLVED]** simplified server-rendered abstract polygons, not a headless-browser screenshot.
   - ~~AI-based comparison~~ — **[RESOLVED, blocked on external input]** the existing Groq model doesn't support image input; the user is providing a different AI service for this specifically. Build against the existing pixel-diff fallback first; slot in the new provider once its details arrive.
4. ~~Admin Portal's scope~~ — **[RESOLVED]** real backend, confirmed by the user. Workflow Configuration and Governance Rules are genuine engine rewrites (see §7) — worth a firm sequencing decision (last, or a separate multi-session effort) rather than folding into the same pass as everything else.
5. Notification delivery mechanism itself (not just OTP) — `docs/FEATURE_AUDIT.md` §7 already flagged push/SMS/email notification delivery as unscoped; this spec's "citizen and officer notifications" (§29-30 of the source) reads as in-app feed notifications (matching what `RequestNotifications.tsx`/`GovernanceAlertsPanel.tsx` already do, just more structured), not push/SMS/email — worth confirming that reading is correct before assuming a bigger delivery mechanism is in scope.

---

*§1/§2 (public site + guest navbar), §4/§5 (Citizen/Officer Portal IA split and multi-page restructure), and §6's pagination item are built, as marked above. §3 (auth/OTP), §7 (Admin Portal backend), and §8/§8a's imagery/AI-comparison piece (ownership history itself is done) remain planning-only. `docs/AUTH_VERIFICATION_UPGRADE.md` stays as the backend-schema-level detail on the auth/OTP piece specifically; this document is the full-site IA it sits inside.*
