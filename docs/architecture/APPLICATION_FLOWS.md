# BhoomiSetu — Application Flows, Routes & Actions

Complete map of every page, who can reach it, where it redirects, and what each
button does. Source of truth: `frontend/src/App.tsx` (routing),
`frontend/src/navConfig.ts` (nav), `frontend/src/features/auth/` (auth/guards),
and the per-portal page components.

- **Router:** `BrowserRouter` (real URLs, no hash).
- **Guard:** `RequireAuth roles={[...]}` — while `/auth/me` loads shows "checking
  session"; if no user **or** role not in `roles` → `Navigate to="/login"`.
- **Session:** JWT in `localStorage['access_token']`; `useAuthUser()` polls
  `GET /auth/me`. A global `bhoomisetu:unauthorized` event → logout + `/login`.

---

## 1. Roles & landing portals

`portalPathForRole(role)` decides where a signed-in user lands. Hitting `/` as a
logged-in non-citizen redirects to their portal.

| Role | Landing URL | Guard on portal |
|---|---|---|
| _(guest, not signed in)_ | `/` (HomePage) | — |
| `CITIZEN` | `/citizen` | `RequireAuth ['CITIZEN']` |
| `ADMIN` | `/admin` | `RequireAuth ['ADMIN']` |
| `VERIFIER` | `/verifier` | `RequireAuth ['VERIFIER']` |
| 8 officer roles → `/officer` | `/officer` | `RequireAuth OFFICER_ROLES` |

Officer roles (`officerAuth.ts`) and their department (drives which tools show):

| Role | Department |
|---|---|
| `LAND_RECORD_OFFICER` | `LAND_RECORDS` |
| `REGISTRATION_OFFICER` | `REGISTRATION` |
| `PLANNING_OFFICER` | `PLANNING` |
| `TAX_OFFICER` | `TAX` |
| `DISPUTE_OFFICER` | `DISPUTE` |
| `RESTRICTION_OFFICER` | `RESTRICTION` |
| `ENCUMBRANCE_OFFICER` | `ENCUMBRANCE` |
| `SURVEY_OFFICER` | `SURVEY` |

`VERIFIER` is intentionally **not** an officer role — it reviews no queue, only
collects field evidence.

---

## 2. Public pages (no sign-in)

| URL | Page | Notable actions |
|---|---|---|
| `/` | HomePage | Guests & citizens see it; other roles redirect to their portal. `Get Started` → `/register`, `Sign in` → `/login`. |
| `/login` | LoginPage | See §3. |
| `/register` | RegisterPage | See §3. |
| `/auth/callback` | OAuthCallbackPage | Google OAuth return handler (§3). |
| `/about` | AboutPage | Static. |
| `/features` | FeaturesPage | Static. |
| `/privacy-policy` | PrivacyPolicyPage | Static. |
| `/terms-of-use` | TermsOfUsePage | Static. |
| `/contact-us` | ContactUsPage | Static / contact form. |
| `/parcels/:id` | Parcel 360 View | **No route guard** — self-gates by role inside (§7). |

The floating **Ask AI** widget appears on all pages **except** `/officer/*`,
`/admin/*`, `/login`, `/register`.

---

## 3. Authentication & first-login flow

### Login — `/login`
Fields: method tabs **EMAIL / MOBILE**, password (show/hide), language selector.

- **Sign In** → `POST /auth/login`, stores JWT, then navigates by role
  (ADMIN→`/admin`, CITIZEN→`/citizen`, VERIFIER→`/verifier`, else→`/officer`).
  401 → invalid-credentials message.
- **Continue with Google** → `GET /auth/google/login` → `window.location = authUrl`.
- **Create account** → `/register`. **Continue as Guest** → `/`.
- **Demo accounts** panel: each button pre-fills an email + shared password
  `Demo@123` (admin, 8 officers, 2 verifiers, 1 citizen).
- No "forgot password" control exists.

### Register — `/register`
Two steps: `form → otp`. **The account is not created until the OTP is verified.**

Step 1 (form): method tabs, Full Name, Email or +91 Mobile, Password (with
strength meter), Confirm Password.
- **Create Account** → `POST /auth/register` → returns `registrationId`,
  advances to OTP. 409 → account exists.
- **Continue with Google**, **Sign in** → `/login`, **Terms** / **Privacy** links.

Step 2 (OTP): `OtpEntryForm`.
- **Verify** → `POST /auth/register/verify-otp` — **creates the account**, stores
  JWT, `navigate('/citizen')`. OnboardingGate then fires (§4).
- **Resend** → `POST /auth/register/resend-otp`. **Go back** → step 1.

### OAuth callback — `/auth/callback`
Reads `code`/`state`. On error or missing params → `/login`. On success →
`GET /auth/google/callback`, stores JWT, navigates by role. Failure → error card,
auto-redirect to `/login` after 2s.

---

## 4. New-citizen onboarding (profile setup → site tour)

`OnboardingGate` renders once in the app shell and triggers **only** when
`role === 'CITIZEN'` **and** `onboardingCompleted === false`. Because it reads the
backend flag, it covers password signup, OTP registration, and Google OAuth
without hooking each redirect.

**OnboardingWizard** step order: `welcome → language → profile → intro → features → completion`.

- **welcome**: `Get started` → language.
- **language**: 11 language buttons (`setLanguage`), `Back`/`Continue`.
- **profile**: Name (req), Address (req), Occupation (opt); **Use my current
  location** → browser geolocation + OSM reverse-geocode fills address/coords;
  **Continue** → `POST /auth/profile/details` (incl. home lat/lng) then advances.
- **intro**: static explainer. **features**: 4 feature cards.
  - **Skip tour** → jumps to completion.
  - **Start tour** → runs the interactive tour (driver.js), then completion.
- **completion**: **Go to Dashboard** → `POST /auth/onboarding/complete` — flips
  the backend flag and dismisses the gate. `Retry` on error.

**Interactive tour** (`runCitizenTour`): spotlights visible citizen nav items
(`dashboard, find, parcels, cases, assistance, notifications, profile`). On mobile
it first opens the mobile menu so targets are visible.

**Replay:** the **Take a tour** button in the top utility bar (citizens only)
dispatches `bhoomisetu:start-tour`; the gate replays the tour without resetting
the completion flag.

---

## 5. Citizen portal — `/citizen/*`

Guard: `RequireAuth ['CITIZEN']`. Nav: Dashboard / My Parcels / Find Parcels /
Get Assistance / My Cases / 🔔 Notifications / 👤 Profile.

| URL | Page | Purpose |
|---|---|---|
| `/citizen` | CitizenDashboardPage | Metrics, recent applications, land-claim panel |
| `/citizen/parcels` | MyParcelsPage | Owned/linked parcels |
| `/citizen/find` | FindParcelsPage | Search + GIS map |
| `/citizen/get-assistance` | GetAssistancePage | AI-assisted case filing |
| `/citizen/my-cases` | MyCasesPage | Case list |
| `/citizen/notifications` | NotificationsPage | Notification feed |
| `/citizen/profile` | ProfilePage | Account + Documents tabs |

**Legacy redirects** (still linked from some pages):
`/citizen/raise-request` → `/citizen/get-assistance` (keeps `?parcelId=`);
`/citizen/requests` → `/citizen/my-cases`; `/citizen/verify` →
`/citizen/get-assistance`; `/citizen/documents` → `/citizen/profile?tab=documents`.

### Dashboard — `/citizen`
Data: `GET /parcels/mine`, `/workflows/mine`, `/cases/my`.
- Metric links: land holdings → `/citizen/parcels`; cases → `/citizen/my-cases`.
- Recent applications: **View all** / **Details** → cases; per row 🔊 speaker (TTS).
- **File a Land Claim** → inline SVAMITVA `LandClaimPanel` (`onSubmitted` closes).
- Empty state **Submit first request** → get-assistance.

### My Parcels — `/citizen/parcels`
Data: `GET /parcels/mine`.
- **+ New Parcel** → inline `ParcelVerificationFlow` (link/verify a parcel).
- Per card: **View 360° Cadastral Record** → `/parcels/{id}`.
  - Registered → **Raise Complaint / Request** → `/citizen/raise-request?parcelId={id}`.
  - Not registered → **Delete Pending Submission** → confirm modal →
    `DELETE /parcels/mine/{id}`.
- **Profile** → `/citizen/profile`; **Sign Out** → logout.

### Find Parcels — `/citizen/find`
- View toggle **Split / List / Map** (layout only).
- `ParcelSearch` + `UnifiedMapWrapper`; selecting a parcel highlights it. Clicking
  a parcel on the map can open its 360 view.

### Get Assistance — `/citizen/get-assistance`
- **Guard:** citizen with **zero registered parcels** → redirect
  `/citizen/parcels?from=get-assistance`.
- Reads `?parcelId=` (locks to a parcel) and `?case=` (resume a case).
- Parcel selector when >1; renders `AiChat` (conversational case filing).

### My Cases — `/citizen/my-cases`
Data: `GET /cases/my`.
- Per row: **Book Appointment** → `AppointmentBookingModal`; **View** →
  `/citizen/get-assistance?case={id}`.
- Empty state **Start a new case** → get-assistance.

### Notifications — `/citizen/notifications`
Data: `GET /notifications`.
- Click a notification → if unread `PATCH /notifications/{id}/read`; if it has a
  `parcelId` → `/parcels/{parcelId}`.

### Profile — `/citizen/profile`
Tabs **Account / Documents** (reads `?tab=`).
- Account: editable details card (per-card save → `POST /auth/profile/details`),
  contact verification (EMAIL/MOBILE OTP), linked parcels, documents summary
  (**View documents** → Documents tab), preferences. Security card buttons (2FA /
  sessions / recovery) are placeholder toasts.
- Documents: per parcel **View** Record of Rights →
  `GET /parcels/{id}/documents/official-pdf` (PDF modal); uploaded docs as
  thumbnails.
- Action bar: **Edit** (scroll to details), **Download Summary** (client `.txt`),
  **Contact Support** → `/contact-us`.

---

## 6. Officer portal — `/officer/*`

Guard: `RequireAuth OFFICER_ROLES`. Every officer sees **Dashboard / Cases /
Tasks / Analytics(SLA, Performance) / 🔔 / 👤**; department-specific **Tools**
appear only when the department has any. In-app each tool route is also gated by
department (`gate()` → redirects to `/officer` if not allowed); backend enforces
independently.

### Tools by department

| Department | Tools |
|---|---|
| LAND_RECORDS | _(none — works via Cases/Tasks/Parcel 360)_ |
| REGISTRATION | `/officer/duplicate-registry`, `/officer/registration-chain` |
| PLANNING | `/officer/map` |
| TAX | `/officer/reassessment-queue`, `/officer/tax-analytics`, `/officer/map` |
| RESTRICTION | `/officer/alerts` |
| ENCUMBRANCE | `/officer/fraud-prevention`, `/officer/certificate-generator` |
| DISPUTE | `/officer/alerts`, `/officer/historical-imagery` |
| SURVEY | `/officer/map`, `/officer/change-detection`, `/officer/documents`, `/officer/alerts`, `/officer/historical-imagery` |

### All officer routes

| URL | Page | Access |
|---|---|---|
| `/officer` | OfficerDashboardPage | all officers |
| `/officer/requests` | AssignedRequestsPage (Cases) | all |
| `/officer/tasks` | OfficerTasksPage | all |
| `/officer/sla` | OfficerSlaPage | all |
| `/officer/performance` | OfficerPerformancePage | all |
| `/officer/notifications` | OfficerNotificationsPage | all |
| `/officer/profile` | OfficerProfilePage | all |
| `/officer/map` | OfficerMapPage | PLANNING / TAX / SURVEY |
| `/officer/alerts` | GovernanceAlertsPage | RESTRICTION / DISPUTE / SURVEY |
| `/officer/historical-imagery` | HistoricalImageryPage | DISPUTE / SURVEY |
| `/officer/change-detection` | ChangeDetectionPage | SURVEY |
| `/officer/documents` | DocumentsPage | SURVEY |
| `/officer/duplicate-registry` | DuplicateRegistryPage | REGISTRATION |
| `/officer/registration-chain` | RegistrationChainPage | REGISTRATION |
| `/officer/reassessment-queue` | ReassessmentQueuePage | TAX |
| `/officer/tax-analytics` | TaxAnalyticsPage | TAX |
| `/officer/fraud-prevention` | FraudPreventionPage | ENCUMBRANCE |
| `/officer/certificate-generator` | CertificateGeneratorPage | ENCUMBRANCE |

### Key actions

**Dashboard — `/officer`**: department-specific stat tiles + charts (read-only).
**Open Full Desk** → `/officer/requests`. Pending-queue row **Action** →
`/officer/requests?workflow={id}`. Focus widget **Previous/Next** paginate.

**Cases — `/officer/requests`**: case list + `WorkflowReviewPanel`. Reads
`?workflow=` to preselect. Controls: **Pending only** checkbox, **Layout/Table**
toggle, click a case → loads it in the panel.
Review panel: **View Parcel** → `/parcels/{id}`; **Approve / Reject** (require
remarks) → `PATCH /workflows/{id}/steps/{stepId}`; **Assign Verifier** select →
`PATCH /cases/{taskId}/assign-verifier`.

**Tasks — `/officer/tasks`**: `GET /cases/tasks/my`. **Manage** → task modal (5
tabs):
- Overview: advance status `PATCH .../advance`; verification checklist; assign
  field verifier; appointment Confirm / Docs Reviewed / No Show; **Parcel 360°** →
  opens `/parcels/{id}`.
- Documents: **Download Application / Verification Report** (PDF blobs).
- Database Updates: per proposal **Approve / Reject** → `POST .../field-proposals/{id}/...`.
- Decision: radio APPROVE / REJECT / RETURN_FOR_REVIEW + remarks → **Submit
  Decision** → `POST .../resolve`. Completed → **Download Decision Order**.

**Map — `/officer/map`**: `UnifiedMapWrapper` with cluster dropdown, year
selector, layer panel.

---

## 7. Verifier portal — `/verifier/*`

Guard: `RequireAuth ['VERIFIER']`. Nav shows only Dashboard + Profile, but the
portal mounts 5 routes.

| URL | Page | In nav |
|---|---|---|
| `/verifier` | AssignedVisitsPage | ✅ |
| `/verifier/task/:taskId/evidence` | EvidenceCapturePage | (linked from a task) |
| `/verifier/task/:taskId/findings` | VerifierFindingsPage | (linked from a task) |
| `/verifier/local-sync` | VerifierLocalSync | ❌ (offline sync) |
| `/verifier/profile` | VerifierProfilePage | ✅ |

**Assigned Visits — `/verifier`**: `GET /cases/verifier/tasks` + parcel map.
Per task card: **Capture Evidence** → `/verifier/task/{id}/evidence`; **Submit
Findings** → `/verifier/task/{id}/findings`; **Get Case Package** →
`GET /cases/{caseId}/verifier-package` (offline package panel).

**Evidence Capture**: photo (camera), **Capture Location** (GPS), notes. **Submit**
→ `POST /cases/{taskId}/evidence/capture`; on failure queues offline. **Back to
Dashboard** → `/verifier`.

**Submit Findings**: repeatable findings (verdict select), overall finding, notes,
mandatory declaration checkbox. **+ Add Finding** / **Remove**. **Submit Findings**
→ `POST /cases/{taskId}/findings` → back to `/verifier`.

**Local Sync — `/verifier/local-sync`**: **Sync Now** replays queued offline
evidence; **Clear Queue** (confirm).

---

## 8. Admin portal — `/admin/*`

Guard: `RequireAuth ['ADMIN']`. Nav: Dashboard / Departments / Workflows /
Officer Monitoring / System Monitoring / Map Layers / 👤 Profile.

| URL | Page | Key actions |
|---|---|---|
| `/admin` | AdminDashboardPage | User Management + analytics + high-risk parcels |
| `/admin/departments` | AdminDepartmentsPage | Department CRUD |
| `/admin/workflows` | AdminWorkflowOversightPage | Cross-department workflow review |
| `/admin/officer-monitoring` | AdminOfficerMonitoringPage | Officer workload (read-only) |
| `/admin/system-monitoring` | SystemMonitoringPage | System overview (read-only) |
| `/admin/map-layers` | AdminMapLayerAuthoringPage | GIS layer authoring |
| `/admin/profile` | AdminProfilePage | Profile + stub security actions |

**Dashboard — `/admin`** (User Management): **Add User** → create form →
`POST /users`; per-user role select → `PATCH /users/{id}/role`; **Delete** →
confirm → `DELETE /users/{id}` (self disabled).

**Departments**: **Add Department** → `POST /admin/departments`; per-row
**Edit** → `PATCH /admin/departments/{id}`; **Delete** → confirm →
`DELETE /admin/departments/{id}`.

**Workflows**: department filter + pending-only; click a workflow → shared
`WorkflowReviewPanel` in **admin oversight mode** (approve/reject any department's
pending steps; also Alert Officer / Decide Myself / Send Back rows that don't show
in the officer portal).

**Map Layers**: tabs Zoning / Restriction / Infrastructure / Admin Notes
(admin-only) / Combined View. Create/edit/delete GeoJSON features via
`MapLayerManagement`.

**Profile**: editable details + contact verification. **Download Summary** (`.txt`),
**Contact Support** → `/contact-us`. 2FA / Sessions / Access Matrix / History are
placeholder toasts (no backend).

---

## 9. Parcel 360 View — `/parcels/:id`

**No route guard** — reachable by guests. Content is role-gated inside via
`useAuthUser()`:
- `isOwnParcel` (citizen owner), `isStaffViewer` (officer/admin).
- Six owner-only tabs (Planning, Tax, Restriction, Dispute, Encumbrance,
  Ownership History) hidden when `restrictedForViewer`; Ownership History also
  server-gated.

Data: `GET /parcels/{id}/360`, risk score (owner/staff only), ownership history
(lazy).

Actions:
- **Owner**: Request Documents / Report Issue / File a Dispute / Verify Documents
  → `ServiceRequestForm` modals.
- **Owner or staff**: **View / Download Official Document** →
  `GET /parcels/{id}/documents/official-pdf`.
- **Any viewer**: **Explain with AI** → `POST /ai/parcels/{id}/explain`.
- **Officer + historical cluster**: **Compare Years** (inline).
- **Back** → `window.history.back()`. Map: clicking another parcel →
  `/parcels/{clickedId}`.

---

## 10. Cross-cutting flows (summary)

- **New citizen sign-up:** register → OTP verify (account created) → `/citizen` →
  OnboardingGate → wizard (profile setup) → optional site tour → dashboard.
- **Citizen files a case:** must have a registered parcel → Get Assistance
  (AI chat) → case appears in My Cases → book appointment → officer reviews.
- **Officer case review:** Cases → pick case → Approve/Reject step, or assign a
  Verifier → Verifier captures evidence + submits findings → officer resolves in
  Tasks → citizen notified.
- **Session expiry:** any 401 fires `bhoomisetu:unauthorized` → logout → `/login`.
