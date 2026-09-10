# BhoomiSetu — Application Flow & Role Feature Distribution

**Status: historical planning document — almost everything below is now built.** This was written before any of the Citizen/Officer/Admin portal restructuring happened; `docs/FRONTEND_UPGRADE_SPEC.md` (frontend IA), `docs/FEATURES.md` (what's actually built, where), and `docs/ADMIN_PANEL_ISSUES.md` (the 2026-09-10 Admin/Officer follow-up round) are the current living references — read those first for anything you're relying on being accurate. Kept here for the original reasoning, and because §1's rules (login has no role selector, registration always creates a citizen account, only an admin can create staff accounts) are all still true today. The **[Built]**/**[Placeholder]** markers throughout §6-§7 are stale: registration (§4), Land Claim, Citizen Profile, Workflow/Alerts oversight on the Admin dashboard, and Spatial Layer Write APIs' UI are all **Built** now, not placeholders — see `docs/FEATURES.md` features 8, 15, 21, and `docs/ADMIN_PANEL_ISSUES.md` for what actually shipped.

Grounded in what's actually built today (see [FEATURES.md](FEATURES.md) for the full 25-feature inventory) and the existing citizen-dashboard restructuring plan already scoped in [CITIZEN_FEATURES_UPGRADE_PLAN.md](CITIZEN_FEATURES_UPGRADE_PLAN.md) — this document doesn't duplicate that plan, it sits above it and slots it in where relevant.

---

## 1. Rules this flow is built from (as given)

1. Flow starts at the **login page**.
2. A visitor who doesn't want to log in can **continue to the Home page** without an account.
3. Login has **no role selector** — the account itself carries the role, and a successful login redirects by role.
4. **Self-service registration always creates a Citizen account.** There is no "register as Officer/Admin" path.
5. **Officer and Admin accounts can only be created by an existing Admin.**
6. After login, each role lands on **a dashboard showing only the features associated with that role** — with overlap allowed where a feature is genuinely shared.
7. The login/register page keeps a **demo accounts panel** (dev-phase only) — refined, not removed.
8. **Only what's actually built today ships as real, working UI.** Anything new — a feature that doesn't exist yet, or an "upgrade" to one that only partly exists — does not get implemented in this pass. It gets a clearly-marked **placeholder** in the layout (a disabled card, a "Coming Soon" badge) so the dashboard's shape already accounts for it, but nothing fake: no invented data, no form that looks submittable but silently does nothing, no wired-looking button with no backend behind it.

Rules 3–5 are already how the backend is built (`POST /auth/login` returns a role, no role field is accepted; `POST /users` is `@Roles('ADMIN')`-guarded — see [users.controller.ts](../backend/src/users/users.controller.ts)). Rule 4 is **new** — no `POST /auth/register` endpoint exists yet (`auth.controller.ts` currently only has `login` and `me`). Under rule 8, that makes registration itself a **placeholder for this phase** — see §4.

Every section below is now marked **[Built]** (restyle only — it works today, wire it to the real API) or **[Placeholder]** (new/upgraded — UI shell only, no backend call, visibly marked as coming soon). This is the single fact that should decide, page by page, whether you're skinning something real or drawing a stub.

---

## 2. Entry flow

```text
                              ┌─────────────────┐
                              │   Login page     │  (route: /login)
                              │  (default entry)  │
                              └─────────┬────────┘
                                        │
              ┌─────────────────────────┼──────────────────────────┐
              │                         │                          │
     "Continue as Guest"         Sign in (email+pw)         "New here? Register"
              │                         │                          │
              v                         v                          v
        ┌───────────┐          role read from JWT           Registration form
        │ Home page  │                 │                  (name, email, password)
        │  (/,       │        ┌────────┼────────┐                  │
        │  guest      │        │        │        │           always creates
        │  mode)      │     CITIZEN  OFFICER   ADMIN           role = CITIZEN
        └───────────┘        │        │        │                  │
                              v        v        v                  │
                        /citizen  /officer   /admin  <──── auto-signed-in, same redirect
                        (Citizen  (Officer   (Admin          as a CITIZEN login
                        Dashboard) Dashboard) Dashboard)
```

The "Register" branch is a **[Placeholder]** this phase (rule 8, detailed in §4) — the route and page exist, but it doesn't create an account yet.

Key point: **Home and the Citizen Dashboard are the same route** (`/`, `/citizen`), same as today (`App.tsx` maps both to `CitizenPortal`). A guest and a signed-in citizen see the same page shell; the citizen just sees more (My Parcels, claim actions, their own request history) because those sections check `useAuthUser()` and render conditionally — this already matches how `MyParcels.tsx` behaves. There's no separate "marketing site" to build; Home *is* the Citizen surface at low information level.

---

## 3. Login page (`/login`) — [Built]

Real, working page — restyle it, don't rebuild the mechanics:

- Single form: email, password. **No role field, no role toggle** — matches current `LoginPage.tsx` exactly; nothing to change in the login mechanics itself.
- On success, redirect by `user.role` (already implemented in `LoginPage.tsx` line 18): `ADMIN → /admin`, `CITIZEN → /citizen`, any officer role → `/officer`.
- "Continue as Guest" link/button → `/` (Home), no account created, no token stored.
- "New here? Register" link → `/register`, the **[Placeholder]** page from §4 (or an inline tab-switch on the same page — see open decision in §9).
- Demo accounts panel stays on this page (see §8) — registration is a placeholder this phase, so the demo accounts are the only way to see Officer/Admin dashboards until real staff accounts exist beyond the seed data.

---

## 4. Registration (`/register`) — [Placeholder] — new surface, not built this phase

**Superseded (2026-09-08): see `docs/FRONTEND_UPGRADE_SPEC.md` (the master IA doc) and `docs/AUTH_VERIFICATION_UPGRADE.md` (the auth/OTP backend detail).** The simple name/email/password design below is replaced by a flexible mobile-OR-email registration with OTP/link verification, add/change-contact-later flows, and no main navbar on auth pages — citizen accounts only, staff unaffected. This whole document's §1-§2 framing (Home and the Citizen Portal as one route, guest search allowed) is also now superseded: the user has confirmed Home and the Citizen Portal become genuinely separate, and guest search is dropped entirely — see `docs/FRONTEND_UPGRADE_SPEC.md` §1. Left below for history/context, not as the active design.


Per rule 8, this is drawn but not wired. The route exists and looks finished — same design system, same form fields laid out — but:

- The submit action is disabled or shows a clear "Registration opens soon — sign in with a demo account below, or ask an administrator for a staff account" notice instead of calling an API.
- No `POST /auth/register` call is made, because that endpoint doesn't exist yet (`auth.controller.ts` currently only has `login` and `me`).
- Nothing about this placeholder should look broken or unfinished — it should read as "not open yet," not "not built yet." A disabled-but-styled submit button plus the notice above is enough; don't grey out the whole page.

The rest of this section is the **target spec for when registration is actually built** — kept here so the eventual backend work has a settled design, not because it's happening now.

**Fields:** Name, Email, Password, Confirm Password. Nothing else. (Phone/address collection was already flagged as a deferred, PII-sensitive decision in `CITIZEN_FEATURES_UPGRADE_PLAN.md` item 2 — this flow doesn't reopen that; registration stays minimal and matches the `users` table's existing columns, no schema change required.)

**Backend — future `POST /auth/register` (not built this phase):**
- Public endpoint, rate-limited (same posture as other public write endpoints like document verification).
- **Role is hardcoded server-side to `CITIZEN`.** Even if a `role` field were present in the request body, it must be ignored/stripped, never read from client input — this is the one place a role-confusion bug would be a real privilege-escalation hole, so it's worth stating explicitly rather than leaving implicit.
- Same email-uniqueness check as `POST /users` (409 on duplicate), same password rule (bcrypt hash, min 8 chars).
- On success: create the user, then **log them in immediately** (return the same `{ accessToken, user }` shape `POST /auth/login` returns) so registration ends on the Citizen Dashboard, not a second login prompt.
- Audit trail: log a distinct `AUTH_REGISTER` action (not `USER_CREATED`, which today always means *an admin created this account*) — keeps "who created this account" honest in the audit log (self vs. admin-provisioned).

**What registration explicitly does not do:** create Officer/Admin accounts, accept a role, or touch the `users`/role-management screen. That entire surface (`UserManagement.tsx`, `POST /users`) stays Admin-only and untouched by this change — it remains the *only* way an Officer or Admin account comes into existence, per rule 5.

---

## 5. Role → landing route

| Role | Lands on | Portal component |
|---|---|---|
| *(guest, no account)* | `/` | `CitizenPortal.tsx` (guest mode) |
| `CITIZEN` | `/citizen` | `CitizenPortal.tsx` (signed-in mode) |
| `LAND_RECORD_OFFICER` / `REGISTRATION_OFFICER` / `PLANNING_OFFICER` / `DISPUTE_OFFICER` | `/officer` | `OfficerPortal.tsx`, scoped to that department |
| `ADMIN` | `/admin` | `AdminPortal.tsx` |

No change from what's already implemented — this table just makes the existing behavior explicit as the contract the rest of this doc builds on.

---

## 6. Feature distribution by role

Legend: ● full access · ◐ partial/read-only or scoped · — not applicable. "Guest" = no account at all. **Status** follows rule 8: `Built` = real, wired to the actual API, just restyled; `Placeholder` = shown in the layout, marked "coming soon," no backend call.

| # | Feature ([FEATURES.md](FEATURES.md) ref) | Guest | Citizen | Officer | Admin | Status |
|---|---|:-:|:-:|:-:|:-:|---|
| 1 | GIS Map & Parcel Visualization | ● | ● | ● | ● | Built |
| 2 | Contextual Spatial Layers (overlays) | ● | ● | ● | ● | Built |
| 3 | Parcel Search | ● | ● | ● | ● | Built |
| 4 | Parcel 360 view | ● | ● | ●(staff tabs + audit) | ●(staff tabs + audit) | Built |
| 8 | Service Requests — file (request/correction/dispute) | ●* | ● | — | — | Built |
| 8 | Service Requests — review/approve/reject | — | — | ●(own department) | ●(any department — RBAC bypass) | Built |
| 9 | Document Verification (OCR) | ● | ● | — | — | Built |
| 10 | Governance Alerts — view/action | — | — | ● | ● | Built |
| 12 | My Parcels | — | ● | — | — | Built |
| 14 | Audit Log — view | — | — | — | ● | Built |
| 15 | User Management (create/promote/delete staff) | — | — | — | ● | Built |
| 16 | Officer dashboard stats (pending/verified/alerts) | — | — | ● | ◐(system-wide totals via Analytics instead) | Built |
| 17 | AI Assistant widget (chat) | ●(citizen-facing routes only, current behavior) | ● | — | — | Built |
| 17 | AI "Explain with AI" (parcel/alert) | — | ●(parcel only) | ● | ● | Built |
| 18 | Change Detection (analyze imagery) | — | — | ● | — | Built (Officer); see below for Admin |
| 19 | Governance Analytics Dashboard | — | — | — | ● | Built |
| 20 | Predictive Risk Score — per parcel | ●(on Parcel 360) | ●(on Parcel 360) | ●(on Parcel 360) | ●(on Parcel 360 + Top-Risk list) | Built |
| 22 | Multilingual UI (EN/HI) | ● | ● | ● | ● | Built |
| — | Dark mode toggle (new, design.md §5) | ● | ● | ● | ● | Built (this redesign) |
| — | Registration | ●(guest sees the form) | — | — | — | **Placeholder** — §4 |
| — | Land Claim (`CITIZEN_FEATURES_UPGRADE_PLAN.md` §3.1) | — | ◐(card visible, disabled) | — | — | **Placeholder** |
| — | My Requests, aggregated across parcels (upgrade of feature 8's notification panel) | — | ◐(card visible, disabled) | — | — | **Placeholder** — per-parcel version (on Parcel 360) is Built today |
| — | Citizen Profile (phone/address) | — | ◐(nav entry visible, disabled) | — | — | **Placeholder** |
| — | Workflow/Alerts oversight on Admin dashboard (RBAC already permits it — see below) | — | — | — | ◐(card visible, disabled) | **Placeholder** |
| 21 | Spatial Layer Write APIs (map-layer authoring) | — | — | — | ◐(card visible, disabled) | **Placeholder** — API exists, no UI |

*Guest filing a service request is how the app behaves today (`POST /workflows` creation is intentionally public/anonymous — see `FEATURES.md` feature 8). Now that real accounts exist end-to-end, whether that should stay true is flagged as an open decision in §9, not silently changed here.

**Reading the Officer/Admin overlap:** the backend already lets `ADMIN` approve *any* department's workflow step (RBAC bypass, `roles.guard.ts` behavior per feature 13) — an Admin is a superset of Officer capability today, but `AdminPortal.tsx` doesn't currently expose a workflow-review, alerts, or change-detection UI at all. Per rule 8, that gap becomes a **placeholder card** on the Admin dashboard (e.g. "Workflow Oversight — coming soon") rather than either silently building it now or silently pretending the RBAC capability doesn't exist.

---

## 7. Dashboard composition per role

Each dashboard = the existing portal page, reorganized around what that role actually uses. Not a rewrite of what exists — a reassembly of already-built components (per `CITIZEN_FEATURES_UPGRADE_PLAN.md` §4, which already scoped the citizen side of this):

**Citizen Dashboard** (`/citizen`, also `/` for guests at reduced scope)
- Hero / guest CTA (guests only — hidden once signed in, replaced by a compact welcome header) — **Built**
- My Parcels (signed-in only) — **Built**
- Find / Search parcels (guest + citizen) — **Built**
- Map view (guest + citizen) — **Built**
- Document Verification (guest + citizen) — **Built**
- My Requests — the existing per-parcel panel on Parcel 360 stays **Built** and linked-to as today; an aggregated "all my requests in one place" card on the dashboard itself is **Placeholder** (needs the query change `CITIZEN_FEATURES_UPGRADE_PLAN.md` §4 describes)
- Land Claim — **Placeholder** (needs the `PARCEL_CLAIM` workflow type from the upgrade plan §3.1)
- Floating AI Assistant — **Built**

**Officer Dashboard** (`/officer`)
- Overview stat cards (pending workflows, verified today, open alerts, documents processed) — department-scoped — **Built**
- Assigned Workflows list + Workflow Review panel — **Built**
- Governance Alerts panel — **Built**
- Change Detection panel — **Built**

**Admin Dashboard** (`/admin`)
- System Overview (total users, logins/24h, system status) — **Built**
- User Management (create/promote/demote/delete Officer & Admin accounts — the *only* staff-provisioning surface, per rule 5) — **Built**
- Recent Activity (audit log feed) — **Built**
- Governance Analytics (8-chart dashboard) — **Built**
- Top At-Risk Parcels — **Built**
- Workflow / Alerts / Change-Detection oversight (RBAC already allows it — see §6) — **Placeholder**
- Map layer authoring (feature 21's API, no UI yet) — **Placeholder**

---

## 8. Demo accounts panel — refinement

Kept, since the product is still in development, but tightened:

- **Dev-only gate**: only render when the build isn't production (e.g. `import.meta.env.DEV`, or an explicit `VITE_SHOW_DEMO_ACCOUNTS` flag) — today's `LoginPage.tsx` renders this block unconditionally with no environment check at all, which is the one concrete thing worth calling a bug rather than a style choice; it must not ship to a real deployment.
- **Grouped, not flat**: Admin / Officers (by department) / Citizens, password shown once at the top ("all demo accounts: `Demo@123`") instead of repeated per row.
- **Collapsed by default** (disclosure/accordion) so it doesn't visually compete with the actual sign-in form — opens on click.
- **Optional nice-to-have**: clicking a demo account row fills the email/password fields rather than requiring the tester to retype them. Proposing this, not assuming it — confirm in §9 if wanted.

---

## 9. Open decisions before implementation

- **Guest service-request filing**: stays anonymous/public (today's behavior), or now requires a Citizen account since real accounts exist? This is a behavior change to something already **Built**, not a new feature, so rule 8 doesn't auto-resolve it — affects whether "File a Dispute"/"Request Documents" shows a sign-in gate.
- **Admin dashboard placeholder cards** (§6/§7): confirmed as **Placeholder** under rule 8 by default — but should the "Workflow Oversight" and "Map Layer Authoring" cards actually appear on the Admin dashboard at all, or is surfacing not-yet-built capability there more clutter than it's worth for a v1 restyle? Either is consistent with rule 8; this is about whether to show the placeholder or omit the section entirely.
- **AI widget on Officer/Admin routes**: currently hidden there by design (`App.tsx`) — keep hidden, or extend it (it already supports alert-explanation for officers/admins, just not the general chat widget)? Extending it is a scope change to a **Built** feature, not a new one.
- **Login vs. Register as one page or two routes**: a tab-switcher on `/login` (less navigation) vs. separate `/login` and `/register` routes (cleaner URLs, easier to deep-link). Register is a **Placeholder** either way — this only affects routing shape.
- **Demo-account click-to-fill**: yes/no, per §8. Pure frontend convenience, not gated by rule 8 since it needs no new backend.

*Waiting for confirmation on these before touching auth backend or portal components.*
