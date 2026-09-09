# BhoomiSetu — Complete Frontend Upgrade Specification

**Status: Phase 0 (§6 pagination, the ownership-history/encumbrance backend work), Phase 1 (the Home/Citizen-Portal split, both portals' multi-page restructure, and the Raise-Request parcel restriction), Phase 2 (§3's auth/OTP piece and §8's historical-imagery piece, including the 2026-09-09 map-zoom/citizen-embed follow-up), Phase 3's Departments + System Monitoring pieces (§7), and §11's in-app notifications/AI request routing/governance-alert reasons/Profile restructure bundle are all done as of 2026-09-09. Phase 3's Users/Officers split, Workflow Configuration, and Governance Rules remain planning-only - real engine rewrites, scoped as their own separate effort per §7's own recommended sequencing.**

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
Admin:    Dashboard   Departments   System Monitoring   (split into multiple pages 2026-09-09, §7)
```

**Revised twice.** First built as a guest-only conditional navbar (guests got Home/About/Features, signed-in users kept a single "Citizen/Officer/Admin Portal" link while each portal grew its *own* second, portal-owned sub-nav underneath it for its multi-page structure — §4/§5's original build). **The user then explicitly rejected the two-navbar result**: *"i want a single navbar in all the portals i dont want 2 diffrent navbars fit the things in the orignal navbar only."* Fixed by deleting both portals' own sub-nav bars entirely (`CitizenPortal.tsx`/`OfficerPortal.tsx` are now just their own `<Routes>`, no nav markup) and rendering every page either portal owns directly in this one `App.tsx` header instead — the same header row a guest already had, now populated per role via `navConfig.ts` (`CITIZEN_NAV_ITEMS`/`OFFICER_NAV_ITEMS`) and `navItemsFor()`. Horizontally scrollable (`overflow-x-auto`), not wrapping, since a citizen's full 11-item list doesn't fit one line at every width — **known rough edge: no visible scroll affordance (arrow/fade) hints that "Profile" etc. are reachable off-screen on narrower viewports**, worth a follow-up polish pass.

**Also removed in the same pass: the BhoomiSetu logo/wordmark, from the navbar entirely** — the user's explicit *"remove bhoomisetu from the nav bar and add that to the landing home page"*. It now lives at the top of `LandingHero.tsx`'s hero content instead (logo image + wordmark + tagline, same visual treatment, just relocated) — so it's visible on `/` but nowhere in the persistent chrome.

**Citizens can now reach Home and About while signed in** — the user's explicit *"the citizens should be able to see the home and about page"*. `App.tsx`'s `"/"` route no longer redirects a signed-in citizen away (only officer/admin still get redirected to their portal); `LandingHero.tsx` is auth-aware, swapping the guest Get-Started/Sign-In CTA pair for a single "Go to My Dashboard" link when a citizen is signed in, so the page stays coherent either way. Officers/admins were not asked for this and still don't see Home/About in their nav.

**Also removed from the navbar for guests** (unchanged from the original pass): Citizen Portal / Officer Portal / Admin Portal links, My Parcels, Document Verification, Search Records, Analyze Imagery. After sign-in, the backend-identified role redirects automatically (unchanged: `LoginPage.tsx` already does `ADMIN→/admin`, `CITIZEN→/citizen`, officer roles`→/officer`).

Covered by `App.test.tsx` (per-role nav content, the citizen no-redirect-off-"/" behaviour, no-logo-in-navbar for every role, sign-out returns to guest Home) and `OfficerPortal.test.tsx` (its own former Logout button and header are gone - logout is the single global "Sign Out" in the utility bar now, unit-tested at the `useLogout()` level in `auth.test.tsx` and at the click-wiring level in `App.test.tsx`).

### Landing page header — ✅ done

Value proposition over feature cards — "what is this, what problem does it solve, who uses it, what do I do next," not a grid of clickable feature tiles. `LandingHero.tsx`'s old 4-feature-card grid (which promised anonymous search) is gone; the hero now ends in two CTAs (Get Started → `/register`, Sign In → `/login`) and `HomePage.tsx` follows it with a 3-step "How BhoomiSetu Works" section and links into `/about`/`/features`.

---

## 3. Authentication — ✅ registration/OTP/login/Profile done (2026-09-08), Forgot/Reset Password still open

Sign In, Register, Mobile OTP Verification, Email Verification — built, and get no main navbar, a lightweight logo-only strip instead (`App.tsx`'s `isAuthPage` check on `/login`/`/register`). Forgot Password, Reset Password still don't exist in this codebase in any form.

**[RESOLVED] Applies to Citizens only.** Officer/Admin accounts stay exactly as they are — admin-created (`docs/flow.md` rule 5), email + password, no mobile/OTP concept; `UsersController.create()` sets `emailVerified: true` on every staff account it creates, since no OTP step ever applies to them.

### Registration: mobile OR email, not both required — ✅ done

`POST /auth/register` (`RegisterDto`: `name`, `method: 'EMAIL'|'MOBILE'`, `email?`, `mobileNumber?`, `password`, `confirmPassword`) creates the `CITIZEN` account and **returns a session immediately** (a JWT, same shape as login) — verification of the chosen method happens right after as a separate step, not a login gate (see "OTP verification" below for why). `RegisterPage.tsx`'s method-selector toggle (`Register with Email` / `Register with Mobile`) shows only the relevant single field; on submit it moves straight into the OTP step (`OtpEntryForm`), pre-filled with the value just registered.

**[Refined, per the user's follow-up, done] A method-selector, not both fields shown at once.** Both `LoginPage.tsx` and `RegisterPage.tsx` have the 2-button toggle at the top; only the relevant field renders below it.

Fields (once a method is picked): Full Name, the selected contact field, Password, Confirm Password (mismatch caught client-side before the request, and again server-side) — every password field has a show/hide eye-icon toggle (registration's two password fields, sign-in's one). Forgot/reset password doesn't exist yet, so that field type never appears there.

**[RESOLVED, done] "Login with Mobile" is password-based.** `POST /auth/login`'s `LoginDto` accepts `email?`/`mobileNumber?` (exactly one expected) + `password` - both field names kept (not consolidated into one generic `identifier`) so every pre-existing email-based login call site kept working unchanged. `AuthService.validateUser()` looks up by whichever identifier was sent and checks the same bcrypt hash either way - one unified path, not two mechanisms.

### OTP verification — ✅ done

6-digit code entry (`OtpEntryForm.tsx`, shared by the post-registration step and Profile's add/change flow), a client-side countdown (10 minutes, matching the email side's real server-enforced expiry - mobile's Fast2SMS-side expiry is set to match via `otp_expiry`), a 30-second resend cooldown, and a clear invalid-code / locked-out-after-5-attempts error. `mobileVerified`/`emailVerified` are stored **independently** per contact method on the `users` row. Email OTP is code-only (no link option built - the "OTP or a link" branch in the original spec wasn't pursued, code-only was simpler and matches mobile's UX exactly as the "identical for both channels" goal asked).

**How the two channels actually differ under the hood**: mobile OTP is delegated entirely to Fast2SMS (`SmsService` calls `/dev/otp/send` then `/dev/otp/verify` - the code itself never touches this codebase's database). Email OTP is generated, bcrypt-hashed, and checked locally (`AuthService`, `User.emailOtpCodeHash`/`emailOtpExpiresAt`/`emailOtpAttempts`), sent via `EmailService` (nodemailer over plain SMTP - works with any SMTP-capable provider by changing env vars only, not a vendor-specific API the way Fast2SMS is for SMS). Both services follow `GroqService`'s existing "unset env var → 503 at call time" pattern (`FAST2SMS_API_KEY`/`FAST2SMS_OTP_ID`, `SMTP_HOST` - see `.env.example`) - **a failed send never fails the surrounding registration/add/change request itself** (the account/contact value is already saved either way), so the citizen still reaches the OTP screen and can Resend once real credentials exist.

### Add/change contact method later (Profile) — ✅ done

`POST /auth/profile/contact` (`ContactDto`: `method`, `email?`/`mobileNumber?`), citizen-only. `AuthService.addOrChangeContact()` decides add-vs-change from the signed-in user's own current state, not a client-sent flag: an empty slot is written directly; an already-verified slot is staged into `pendingEmail`/`pendingMobileNumber` instead, and only copied over (`AuthService.verifyOtp()`) once its own OTP succeeds - **the old verified value is never dropped before the new one is confirmed working**. `ProfilePage.tsx`'s `ContactMethodCard` walks a citizen through Add/Change/Verify per method, and surfaces a persistent "verification pending for X" note (from the now-public `pendingEmail`/`pendingMobileNumber` fields) even across a reload.

### Backend reality — ✅ done

- `users.email` is now nullable+unique (was required+unique); `mobileNumber` (nullable+unique), `mobileVerified`, `emailVerified`, `pendingEmail`, `pendingMobileNumber`, `emailOtpCodeHash`, `emailOtpExpiresAt`, `emailOtpSentAt`, `emailOtpAttempts` added to `User`. "At least one of email/mobile present" is enforced by `RegisterDto`'s method-conditional validators, not a DB constraint.
- **[RESOLVED, done] SMS gateway: Fast2SMS**, confirmed against `docs.fast2sms.com`: sign up → API key from the dashboard's **Dev API** section → create an **OTP Template** under **Smart OTP** → an **OTP ID**. `SmsService` wraps `POST /dev/otp/send` (`{mobile, otp_id, otp_length, otp_expiry}`) and `POST /dev/otp/verify` (`{mobile, otp}` → `{return}`) exactly as documented. **Still open**: the actual API key/OTP ID (the user is providing these) and whether the SMS channel needs its own TRAI DLT entity/sender-ID registration, or gets a ready-made shared template via Fast2SMS's "free DLT support" - unconfirmed, needs checking in the Fast2SMS dashboard/support directly. Until the real key is set, `FAST2SMS_API_KEY`/`FAST2SMS_OTP_ID` being blank makes `SmsService` 503 (verified live) - registration/Profile still work end-to-end otherwise.
- **[RESOLVED, done] Email gateway: plain SMTP via `nodemailer`** (`EmailService`), not a vendor-specific API - `SMTP_HOST`/`PORT`/`SECURE`/`USER`/`PASS`/`FROM` in `.env`. This was this document's own choice (the user asked for the email side to be built while Fast2SMS credentials were pending), picked specifically for not locking into one vendor - any SMTP-capable provider (Gmail, Outlook, a transactional service's SMTP relay) works by changing only env vars.

---

## 4. Citizen Portal — ✅ done (this pass), Documents/Notifications still placeholders

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
- **Profile** (`ProfilePage.tsx`) — ✅ done, §3: real signed-in account info (name/email/role) plus a working add/change-contact flow (mobile via Fast2SMS OTP, email via SMTP link) - no longer blocked, both delivery providers are live.

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
Dashboard · Departments · System Monitoring   (built)
Users · Officers · Workflow Configuration · Governance Rules   (still planning-only, see below)
```

**✅ Done (2026-09-09): Departments + System Monitoring, per the sequencing this section itself recommended.** The Admin Portal is now multi-page (`/admin/*`, same `<Routes>`-per-portal pattern as `OfficerPortal.tsx`/`CitizenPortal.tsx`), reachable from the global navbar's `ADMIN_NAV_ITEMS` (`navConfig.ts`) instead of the old single `/admin` link — the Admin Portal's own header Logout button was also dropped in the same pass, for the same reason Officer/Citizen dropped theirs (the global navbar's "Sign Out" already covers it).

- **Departments**: a genuinely new `departments` table (`backend/src/admin/department.entity.ts` - `code`/`name`/`description`/`contactEmail`/`contactPhone`), admin-only CRUD at `/admin/departments` (`DepartmentsAdminController`/`DepartmentsAdminService`, every mutation audit-logged via the same `AuditService` pattern `UsersController` already uses). Exactly the "pragmatic prototype choice" this section originally called for: display/admin metadata only, seeded with one row per existing hardcoded department code (`LAND_RECORDS`/`REGISTRATION`/`PLANNING`/`TAX`/`RESTRICTION`/`DISPUTE`/`ENCUMBRANCE`) so the CRUD page has real starting data, but `ROLE_DEPARTMENT`/the mock department domain modules/the workflow pipeline keep reading their own hardcoded strings exactly as before - this table doesn't feed into any of that. Frontend: `features/admin/DepartmentManagement.tsx` (list/add/edit/delete, mirroring `UserManagement.tsx`'s established shape) on the new `AdminDepartmentsPage`.
- **System Monitoring**: no new backend needed, as predicted - reuses `GET /analytics/summary` and `GET /audit` verbatim. The System Overview cards (Total Users/Logins 24h/System Status/Last Backup) and the Recent Activity feed both moved off the Dashboard onto their own `SystemMonitoringPage`, out from under User Management as this section originally asked. `RecentActivity.tsx` (moved here, previously embedded in the Dashboard) gained an `entityType` filter dropdown (the `/audit` endpoint already accepted that query param, just unused by the frontend until now) and lost its old 50-entry display cap, both only sensible once it had a full page's room instead of a shared card's.
- **Backend**: 303/303 tests passing (12 new in `test/admin-departments.e2e-spec.ts` - CRUD + audit-logging + RBAC). **Frontend**: `tsc --noEmit` clean, 208/208 tests passing (`DepartmentManagement.test.tsx` new, `RecentActivity.test.tsx`/`AdminPortal.test.tsx`/`App.test.tsx` updated for the filter and the multi-page structure).

**[RESOLVED] Real backend, not just a nav restructure — user has confirmed "the backend can be created."** The rest of this section (Users/Officers split, Workflow Configuration, Governance Rules) is unchanged from the original plan below and remains planning-only. This is genuinely the largest architectural lift in this whole spec, larger than the auth/OTP work, because none of these three concepts exist as data today — they're hardcoded in application code:

- **Departments**: ✅ done above.
- **Workflow Configuration** (still planning-only): which departments review which workflow type, and in what order, is currently `workflows.service.ts`'s hardcoded `pipelineFor()`/`PIPELINES_BY_TYPE`. Making this admin-editable needs a `WorkflowPipelineConfig` table (workflow type → ordered department/role steps) and `pipelineFor()` reading from it instead of a hardcoded map — a real, non-trivial rework of the workflow engine's own source of truth, not additive the way most of this spec is.
- **Governance Rules** (still planning-only): conditions like "flood-zone parcel → alert" or a tax-overdue threshold are currently hardcoded in `seed.ts` and the change-detection/governance-alert creation logic. **[Confirmed by the user: admin must be able to edit these, not just view them]** — a real `GovernanceRule` table (condition type, threshold, resulting alert severity) with full admin CRUD (create/edit/delete a rule from the UI), and every rule-evaluation call site (tax-overdue check, restriction-zone overlap, the §8 unauthorized-change check) reading live from that table instead of a hardcoded condition. This is the equivalent lift to Workflow Configuration above — the engine rewrite is in making the *evaluation* logic data-driven, not just in adding a settings page.
- **System Monitoring**: ✅ done above.

**Sequencing note (as originally recommended, now followed):** System Monitoring and a real `departments` table (metadata-only, not replacing existing hardcoded logic) were cheap and went first. Workflow Configuration and Governance Rules are genuine engine rewrites and remain scoped as their own separate multi-session piece of work, not yet started.

---

## 8. "Analyze Imagery" — remove from the frontend, replace with an on-demand historical comparison — ✅ done (2026-09-08)

**As built, redesigned 2026-09-08** (see "[RESOLVED, redesign]" below for the original pixel-diff version this replaced): a self-contained `historical-imagery` backend module plus an Officer Portal "Historical Imagery" page (`/officer/historical-imagery`), deep-linkable from Parcel 360's new "View Historical Imagery" action for staff viewing a parcel that belongs to a cluster.

- `ParcelHistoricalState` (per-parcel per-year `landUse`/`zoningStatus`/`restrictionStatus`/`taxStatus`) is a real, seeded table — `GET /parcels/:id/history` exposes it publicly; `seed.ts` generates 5 years (2022-2026, 2026 being `CURRENT_YEAR`) per parcel, walking backward from the current computed state with small independent mutation chances per year.
- `common/parcel-generation/parcel-category.ts` is the single source of truth for a parcel's `ParcelCategory` in a given year - `NONE`/`RESTRICTED`/`DISPUTE_OWNERSHIP`/`DISPUTE_BOUNDARY`/`DISPUTE_INHERITANCE`/`DISPUTE_ENCROACHMENT`, each with its own fill color (green/blue/purple/burnt-orange/gold/crimson). It's real, data-driven: `restrictionStatus` from that year's `ParcelHistoricalState` row, plus (current year only - `DisputeRecord` has no per-year history) the parcel's real active dispute type. The exact same function colors the seed-time snapshot render AND decides what "changed" means when comparing two years - they can never disagree with each other.
- `ClusterHistoricalSnapshot` (`clusterId`, `year`, `imagePath`, `bounds` as JSON) stores one rendered PNG per cluster per year (2022-2026), built at seed time by `common/parcel-generation/cluster-snapshot-generator.ts` (SVG polygons rasterized via `sharp`, identical bounding box every year, each polygon colored by its real `ParcelCategory` for that year).
- `HistoricalComparisonService.compare(clusterId, fromYear, toYear)` has **no pixel math at all** - "what's different" is a plain data comparison: every parcel in the cluster gets its `ParcelCategory` computed for both years; a parcel is "affected" if the category differs. No bounding box, no spatial intersection - the category is keyed directly by parcel id, so there's nothing to localize. A newly-appearing (or worsened) category creates a `GovernanceAlert` (`DISPUTE_DETECTED` or `RESTRICTION_DETECTED`, `source: 'HISTORICAL_IMAGERY'`, severity `CRITICAL` for a dispute on a parcel that also currently has an active restriction, `HIGH` for a dispute alone, `MEDIUM` for a restriction alone); a category that improved back to `NONE` is still reported but never gets a fresh alert.
- `NarrativeService` (renamed from `VisionService` once it stopped taking image input - see below) wraps OpenRouter (`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`) to turn each affected parcel's real facts (an actual `DisputeRecord` or `ParcelHistoricalState` restriction flip - never invented) into one grounded, readable sentence - e.g. "This parcel now has an active boundary dispute filed in 2026," not an aggregate "9.7% of the cluster changed" statistic. It never decides which parcels are affected, only how the explanation reads. **The two snapshot images are deliberately NOT sent to this call** - a live latency test measured the identical prompt at ~62-95s with both images attached vs ~11-25s text-only (for 10 and 31 parcels respectively), for zero information gain, since the facts already fully determine the narrative. A failed/unconfigured call falls back to the same real facts, plainly phrased, so the result is never blocked by or dependent on the LLM. The call is also capped to the 20 most severe affected parcels (disputes prioritized) to bound worst-case latency - every parcel beyond the cap still gets its real fallback narrative.
- `GET /historical-imagery/clusters`, `GET /historical-imagery/clusters/:clusterId/years/:year/image`, `GET /historical-imagery/clusters/:clusterId/years/:year/parcels`, `POST /historical-imagery/clusters/:clusterId/compare` are all staff-only (`ALL_STAFF_ROLES`). **[Added 2026-09-08, per a further follow-up]** the `.../parcels` endpoint returns real parcel geometry + a real `ParcelCategory` per parcel for one year (same `categoryFor` function) - the frontend now renders a cluster's *actual* boundaries on the live MapLibre map (`features/map/MapComponent.tsx`, extended with `parcelColors`/`parcelLabels` props) colored by category, with a single year `<select>` above it, instead of only ever showing the flat snapshot PNG. The `.../image` endpoint and its PNG archive are unchanged and still used for the raw snapshot serving, just no longer the primary way a year's data is presented in the UI. The frontend panel (`features/officer/HistoricalImageryPanel.tsx`) lets an officer pick a cluster, view any year's real boundaries on the map, and separately pick two years via a segmented year-toggle to run the comparison on demand, seeing one row per affected parcel: its category-change badge and its real narrative sentence, plus an "Alert raised" tag where one was created.
- Backend: 287/287 tests passing (13 in `test/historical-imagery.e2e-spec.ts`, covering severity/alertType branching by category, the cleared-with-no-alert case, and dispute status never leaking into a purely-historical year comparison). Frontend: `tsc --noEmit` clean, 196/196 tests passing. Live-verified against a real Supabase instance and the real OpenRouter API: a 100-parcel cluster's widest possible comparison (2022→2026, 31 affected parcels) completes in ~40s; a typical adjacent-year comparison in under 10s.

**[RESOLVED, redesign 2026-09-08] Original pixel-diff version, superseded**: the first working version of this feature (built earlier the same day) reused `ChangeDetectionService`'s hand-rolled pixel-diff (`image-diff.ts`) to find a bounding box of visually-"changed" pixels between two snapshots, mapped that to a geo region, and used spatial intersection (`findParcelsInRegion`, since moved back into `ChangeDetectionService` as its only remaining caller) to find affected parcels - the AI only added one paragraph of narration on top. The user's follow-up rejected this: the output read like "fetched from the dataset" (a raw percentage + generic paragraph), not like real per-parcel information, and asked for the LLM to do the actual "finding" and for the map's colors to depict *why* a parcel is flagged (which kind of dispute), not just *that* something changed. The redesign above answers both: detection became a real data comparison (more reliable than approximating from a synthetic pixel-diff, since the images were never real photos anyway), and the LLM's role narrowed to what it's actually good at - turning real facts into a readable sentence - which incidentally also fixed a latency problem the old design never surfaced (a single generic paragraph is cheap; 31 individually-narrated parcels with two images attached was not).

**Original framing (superseded by the above; kept for context)**: The original spec (§23 of the source document) said "remove entirely" because the current feature's name overpromises ("Analyze Imagery" implies real satellite-imagery analysis; the actual pipeline is a hand-rolled pixel-diff between two manually-uploaded images — accurate per `docs/FEATURE_AUDIT.md` §6, "a deliberate simplification, not an oversight"). The user refined this: **remove the current standalone panel from the frontend only**, and separately **add a historical-comparison feature that compares a previous year's photo against the current image, triggered on-demand** — either when a citizen/officer explicitly asks for it, or when a request is raised that needs it — rather than existing as an always-visible bulk-upload tool on the Officer Portal.

This connects to two things already on record and not yet resolved:

- `docs/FEATURE_AUDIT.md` §7's **"historical parcel-boundary versioning"** gap (geometry over time — score 0, no source document asks for it).
- `docs/CITIZEN_FEATURES_UPGRADE_PLAN.md` §3.4's **"historical spatial state"** (deliberately attribute-only versioning — land use/zoning/restriction/tax per year, explicitly *not* geometry).

The new "historical feature" idea is a **third, distinct thing** — image-based, not attribute-based, and not full geometry-versioning either. It doesn't replace either of the other two; it complements them, and genuinely elevates `docs/FEATURE_AUDIT.md` §7's "historical parcel-boundary versioning" from "score 0, unscoped by anyone" to "scoped, pending implementation."

### [RESOLVED] The design, per the user's follow-up (2026-09-08)

**Store a small, fixed archive, not a per-parcel one.** One snapshot image per **cluster** per year — 2022/2023/2024/2025/2026 (5 years × the existing 5 clusters, ~25 images total, not one per parcel) — fetched on demand when a comparison is actually requested (from a governance-alert check or a citizen/officer-raised request), rather than requiring a fresh upload every time the way today's `ChangeDetectionPanel` does.

```text
New entity: ClusterHistoricalSnapshot
  id, clusterId, year, imagePath, bounds (minLng/minLat/maxLng/maxLat), generatedAt
```

**Every year's snapshot for a cluster uses the identical bounding box.** This is the key simplification: because all 5 years are rendered from the same fixed coordinates, no image registration/alignment step is needed before comparing them — a real satellite-imagery pipeline would need to handle camera angle/zoom/crop differences between captures; this one doesn't, by construction.

**[RESOLVED] How the images themselves get generated**: simplified server-rendered polygons, confirmed by the user — a seed-time (or admin-triggered) script server-side-renders each cluster's parcels for a given year as abstract colored polygon shapes (not a live headless-browser screenshot of the real MapLibre map), with a deliberately-chosen subset of parcels drawn in a different fill color to represent "this parcel changed this year." Fast, fully deterministic, easy to seed, no new browser-automation dependency — using the same kind of image manipulation (`sharp`) already a backend dependency for change-detection.

**Which changes are "legitimate" vs. worth a governance alert — reuses `docs/CITIZEN_FEATURES_UPGRADE_PLAN.md` §3.4's `ParcelHistoricalState` table.** That table (parcelId, year, landUse, zoningStatus, restrictionStatus, taxStatus) was already scoped to track attribute history — this is exactly the data needed to answer "was this parcel's change actually recorded." The logic: for each parcel the image marks as visually changed in year Y, check whether `ParcelHistoricalState` shows a corresponding recorded attribute change for that parcel/year.

- **If yes** (a real registration/land-use/tax update is on record for that year) → the change is accounted for, nothing alarming.
- **If no** (the image shows a change, but no record reflects one) → this is the interesting case: create a `GovernanceAlert` of the existing `UNAUTHORIZED_CHANGE_DETECTED` type, reusing the same shared alert-creation function already called from two other places (`docs/FEATURES.md` feature 10) — this is exactly the "third call site" `docs/CITIZEN_FEATURES_UPGRADE_PLAN.md` item 11 already anticipated, just arriving via a different trigger (a yearly image comparison) than originally imagined (a rule-engine evaluation).

**Cross-reference with restricted zones — a real, valuable combination, not extra scope.** `restriction-record.hasRestriction`/`restrictionType` already exists (flood/protected-area/etc.). An unauthorized visual change on a parcel that *also* has an active restriction is a natural higher-severity case worth its own alert framing ("unauthorized activity in a restricted zone") — reuses two datasets that already exist, no new schema needed for this part.

**Surfacing on the frontend**: unauthorized changes show up in the Governance Alerts tab (§6 above) like any other alert — with the two snapshot images (or a before/after crop) as the map-preview content for that specific alert card, instead of (or alongside) the live-map preview other alert types get.

**[New, per the user's follow-up] A year-toggle control next to the map, wherever a cluster's historical snapshots are shown.** A small segmented control — `Current | 2022 | 2023 | 2024 | 2025` — positioned near the map on the Governance Alert detail view and the Officer Portal's Parcel Verification page (§5). Selecting a year swaps the displayed content from the live MapLibre map to that year's stored `ClusterHistoricalSnapshot` image for the parcel's cluster, so an officer can actually step through 2022→2025 one year at a time rather than only seeing a single before/after pair. `Current` (the default) shows the live, real map exactly as today. If the control is reached from a specific parcel's context (an alert, or Parcel 360/Parcel Verification), that parcel should stay visually highlighted/outlined across every year's snapshot so it's the same parcel being tracked, not just "some image of the cluster."

**AI-based comparison instead of pixel-diff** — replacing `image-diff.ts`'s hand-rolled pixel-threshold approach with an AI vision model comparing the two same-bounds images and identifying changed regions. **[RESOLVED, partially]** confirmed: the existing `GroqService`/model this project already uses does **not** support image input — so this cannot reuse the current AI integration as-is. The user is providing a different AI service/model specifically for this image-comparison purpose; a new service module (separate from `GroqService`, or a `GroqService` extension once the new provider's details arrive) will be needed once that's in hand. Until then, this feature's comparison step has no confirmed AI path — the existing pixel-diff (`image-diff.ts`) remains the fallback to build against first, with the AI-comparison step slotted in once the new provider is specified.

**[RESOLVED] Current-year (2026) snapshot with dispute coloring — per the user's 2026-09-08 follow-up.** Beyond the four purely-synthetic historical years, every cluster also gets a 2026 render — the app's "now" — so the year-toggle always has a real current state to compare against, not just a closed 2022-2025 window. This year's render is colored differently from the rest: each parcel with a real, current `DisputeRecord.hasActiveDispute` renders in a third, distinct fill color (dark red) instead of the plain baseline/changed two-color scheme the other four years use. This is deliberately current-state-only, not per-year - dispute status has no historical dimension anywhere in this schema (unlike `ParcelHistoricalState`'s land use/zoning/restriction), so coloring an earlier year by *today's* dispute status would misrepresent it as having been true back then. The frontend panel shows a small color-swatch legend (Baseline/Visually changed/Active dispute) so the meaning isn't left to guesswork.

**Trade-off, in the user's own framing**: this increases the seed database's size (25-ish stored images instead of zero), but is explicitly valued as a demo/pitch strength — a visually compelling "here's how this parcel changed over 4 years, and here's the one nobody registered" story that ties directly to the SIH PS's own "satellite imagery-based change detection" preferred-item language, and to the restricted-zone monitoring use case named in the PS's essential/additional layers.

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
| ~~Profile page (add/change mobile/email)~~ — **✅ done, §3** | ~~Navbar reduction~~ — **✅ done** (per-role minimum nav, done earlier this session) |
| ~~Raise-Request parcel restricted to the citizen's own associations~~ — **✅ done, §4**: `workflows.controller.ts`'s `isCitizenAssociatedWithParcel` check | ~~Landing hero content simplification~~ — **✅ done, §2** |
| ~~Auto-fetched, read-only parcel details in the request form~~ — **✅ done, §4**: `RaiseRequestPage.tsx` | Governance alert severity grouping (data already has a `severity` field) — still open |
| Per-department notification granularity (citizen-facing) - the Requests page (§4) shows step status per request; a real notification *feed* is still open | |
| Governance alert map previews | |
| ~~Governance alerts pagination~~ — **✅ done, §6** (built earlier this session) | |
| ~~The historical image-comparison feature (§8)~~ — **✅ done, §8** (data-driven category comparison + LLM narrative, redesigned 2026-09-08; map zoom/citizen-embed follow-up 2026-09-09) | |
| Ownership history / previous owners (§8a) — **✅ done** (Phase 0, backend + Parcel 360 tab) | |
| ~~Admin Portal's Departments page~~ — **✅ done, §7** (2026-09-09) | |
| Admin Portal's Workflow Configuration / Governance Rules pages (real engine rewrites, no backend concept exists yet — see §7) | |

---

## 11. Open items still needing a decision before implementation

1. ~~OTP delivery: real provider vs. stubbed/dev-mode~~ — **[RESOLVED, built]** SMS via **Fast2SMS** (`SmsService`), email via **plain SMTP/`nodemailer`** (`EmailService`) — see §3 for both. Registration/verify/resend/Profile add-change are all live end-to-end; only the *live* SMS path is still blocked on the user's actual Fast2SMS API key/OTP ID (email works today against any real SMTP credentials dropped into `.env`).
1a. ~~Does "Login with Mobile" use a password or OTP?~~ — **[RESOLVED]** password, always — OTP is one-time-only, used solely when a contact method is first added/verified (registration or Profile), never on ordinary login. See §3.
2. ~~Exact mechanics of the Home/Citizen-Portal split~~ — **[RESOLVED, built]** `/` is a guest-only `HomePage.tsx` (redirects a signed-in user to their own portal); `/citizen/*` and `/officer/*` are each a self-contained portal with their own relative `<Routes>` (see §4/§5); `/about` and `/features` stay the standalone informational pages already built earlier this session.
3. ~~Historical image-comparison feature: relocate-the-existing-mechanic vs. build a real archive~~ — **[RESOLVED]** a small fixed per-cluster/per-year archive, see §8 for the full design. Both sub-questions from that design are now resolved too:
   - ~~Snapshot generation~~ — **[RESOLVED]** simplified server-rendered abstract polygons, not a headless-browser screenshot.
   - ~~AI-based comparison~~ — **[RESOLVED, redesigned 2026-09-08]** superseded the original pixel-diff-plus-narration plan entirely - detection is now a real data comparison (`categoryFor()`, no pixel math), and the LLM's role narrowed to turning real per-parcel facts into a readable sentence (`NarrativeService`, text-only - see §8's redesign note for why images were dropped from the call).
4. ~~Admin Portal's scope~~ — **[RESOLVED]** real backend, confirmed by the user. Departments and System Monitoring are done (§7, 2026-09-09); Workflow Configuration and Governance Rules are genuine engine rewrites, still scoped as a separate multi-session effort rather than folded into the same pass as everything else.
5. ~~Notification delivery mechanism itself (not just OTP)~~ — **[RESOLVED, built 2026-09-09]** in-app only, confirmed by the user. `backend/src/notification-feed/` (`Notification` entity, `NotificationFeedService.notifyUsers()`, `GET/PATCH /notifications`) - a real per-user row, not push/SMS/email. Two triggers: a new service request notifies every officer holding the assigned department's role (`WorkflowsService.notifyAssignedOfficers`); an officer's step decision notifies the citizen back (resolved via `citizen_parcels`, not `workflow.createdBy` - that field is a display name, not a user id). A governance alert being reviewed/dismissed also notifies its derived department's officer(s) (§6). Frontend: `features/notifications/NotificationFeed.tsx`, shared by both portals' Notifications pages (previously `ComingSoonCard` placeholders).

6. **[NEW, built 2026-09-09] AI-based request routing.** `POST /workflows` now analyses `requestDetails` with Groq (`RequestRoutingService`, `GroqService.completeJson` - extracted into its own `GroqModule` so `WorkflowsModule` can reuse it without pulling in all of `AiModule`) and picks the real department(s) a request concerns, rather than always the same hardcoded 3-department default. Live-verified: a `CORRECTION_REQUEST` whose details described an overdue tax bill was correctly routed to `TAX` alone, with a one-sentence rationale stored on the workflow (`routingNotes`) and surfaced in the officer's notification. The original deterministic `pipelineFor()` is the unconditional fallback (AI unconfigured/failed/empty) - never removed, still what every existing workflow test exercises (no `GROQ_API_KEY` in the test environment). Required every department to have a real officer role first - `TAX_OFFICER`/`RESTRICTION_OFFICER`/`ENCUMBRANCE_OFFICER` added to `OFFICER_ROLES` (previously only 4 of the 7 departments had one), with a seeded demo account each.

7. **[NEW, built 2026-09-09] Governance alert review reason.** `GovernanceAlert` gained a `reason` column, settable via `PATCH /governance-alerts/:id/status`. A review/dismissal now also notifies the alert's *derived* department (from `alertType` - no new manual field) via the notification system above - `GovernanceAlertsPanel.tsx`/`GovernanceAlertDetailModal.tsx` both gained a reason `<textarea>`.

8. **[NEW, built 2026-09-09] Citizen Profile restructure.** Tabbed (`Account`/`Documents`/`Verify Documents`, deep-linkable via `?tab=`) - Documents (still a placeholder) and Verify Documents (the real OCR feature) both moved in from their own top-level nav items (`CITIZEN_NAV_ITEMS` 9 → 7; old `/citizen/documents`/`/citizen/verify` routes redirect rather than 404). Account gained "more info": member-since (`createdAt`, newly exposed on `/auth/me`), linked-parcel count, total request count.

Backend: 313/313 tests passing (12 new - `notification-feed.e2e-spec.ts` plus extensions to `workflows.e2e-spec.ts`/`governance-alerts.e2e-spec.ts`). Frontend: `tsc --noEmit` clean, 222/222 tests passing. Live-verified end-to-end against the real Supabase database and real Groq API (not mocked) - the tax-routing example above, the officer→citizen notification round trip, and the alert-review→department-notification path were all exercised live, not just in tests. Not verified: a real browser click-through of the frontend UI (no browser-automation tool available in this environment) - the API surface every page calls has been verified directly instead.

---

*§1/§2 (public site + navbar), §3 (registration/OTP/login/Profile - Forgot/Reset Password excepted), §4/§5 (Citizen/Officer Portal IA split and multi-page restructure), §6's pagination item, §7's Departments + System Monitoring pieces, and §8/§8a (historical imagery + ownership history) are built, as marked above. Still planning-only: Forgot/Reset Password (§3), governance-alert map previews/severity grouping (§6), and §7's Users/Officers split, Workflow Configuration, and Governance Rules. `docs/AUTH_VERIFICATION_UPGRADE.md` stays as the backend-schema-level detail on the auth/OTP piece specifically; this document is the full-site IA it sits inside.*
