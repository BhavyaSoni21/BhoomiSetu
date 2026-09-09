# Admin Panel — Requirements & Issues (open, not yet started)

Raised by the user on 2026-09-09, after the Phase 3 Admin Portal work (Departments + System Monitoring, `docs/FRONTEND_UPGRADE_SPEC.md` §7) was already complete. Each item below was verified against the actual code (and, where noted, a live API call) before being logged here — this is a punch list to work through, not a batch of guesses.

---

## 1. Single active session per user + session timeout

**Requirement**: only one active login session per user (including admins); add a session timeout.

**Status: not implemented.** JWT is stateless with a flat 24-hour expiry (`JWT_EXPIRES_IN = '24h'`, `backend/src/auth/jwt.constants.ts`, wired into `signOptions` in `backend/src/auth/auth.module.ts`). No session table, no server-side token tracking, no revocation, no idle timeout, no enforcement that a new login invalidates a prior token — for any role. Every "session" mention in `auth.service.ts` is just a code comment, not a real mechanism.

**Would need**: a real session concept (e.g. a `sessions` table keyed by user + token/jti, checked in `JwtStrategy`; login either revokes the previous session or the previous token stops validating) plus a shorter, enforced timeout distinct from the JWT's own expiry. This is a real auth-architecture change, not a config tweak — worth scoping carefully since it touches every authenticated request path.

## 2. Citizen-service actions leaking into Admin

**Requirement**: "Request Documents", "Report Issue", "File a Dispute", "Back to Search" are citizen actions and should not appear in the Admin Panel.

**Status: 3 of 4 fixed (2026-09-09), as a side effect of unrelated work.** The land-claim/document-verification/profile feature work required gating Parcel 360's "Request Documents"/"Report Issue"/"File a Dispute" buttons (`frontend/src/features/parcels/Parcel360View.tsx`) on the signed-in citizen actually owning that specific parcel (`isOwnParcel`, checked against `GET /parcels/mine`) — not just on `isCitizen`, since the new Verify Documents/Land Claim design needed that distinction anyway. That gate also means an admin/officer viewing the same screen (e.g. via Top At-Risk Parcels) no longer sees any of these three buttons at all, since `isOwnParcel` is never true for a non-citizen. Verified live in `Parcel360View.test.tsx`.

**Still open**: "Back to Search" is untouched — it's a plain navigation control (`window.history.back()`), not a citizen-service action tied to a specific parcel, so it wasn't in scope of the buttons the new design needed to gate. If the user still wants it hidden from Admin specifically, that's a small separate change (same `isOwnParcel`-style gate, or just `isCitizen`).

## 3. "Explain with AI" giving predefined answers

**Status: reported as broken, but not reproducible as described — tested live and it works.** Live-verified 2026-09-09 against the real Supabase data and real Groq key: called `POST /ai/parcels/:id/explain` for two different parcels, got back genuinely distinct, data-grounded explanations (different owners, tax amounts, restriction details, risk levels) in ~1-1.4s each. `backend/src/ai/ai.service.ts`'s `explainParcel`/`explainAlert` have no hardcoded/mock fallback path — every call goes through `GroqService.completeJson()` for real. `frontend/src/features/ai/AiExplanationCard.tsx` is a pure display component driven entirely by the API response, no static content.

**Open question, not yet resolved**: since this doesn't reproduce locally, the user's original report may be from a different environment (e.g. a deployed instance without `GROQ_API_KEY` set — though that path shows an explicit "AI is not configured" error, not fake content, so it doesn't fully match either) or a specific screen not yet identified. **Needs the user to specify exactly where they saw this** before further action.

## 4. Officer monitoring (how officers handle citizen issues)

**Requirement**: admin should be able to monitor officer activity, especially request handling/resolution.

**Status: does not exist.** No officer-specific view anywhere in the backend or Admin Portal. The only related surface is the generic audit feed (System Monitoring's `RecentActivity`), which lists individual log entries filterable only by entity type — not by officer, and with no aggregation (requests handled, resolution time, approve/reject rate, etc. per officer or department).

**Would need**: a real new feature — likely a backend aggregation over `workflows`/`workflow_steps` grouped by officer/department (counts, avg. time-to-decision, pending vs. decided) plus a new Admin Portal page to show it. Scoped as new work, not a fix.

## 5. Admin navigation (no back button; wants a hamburger/nav menu)

**Status: confirmed gap.** No back button or breadcrumb anywhere in any admin page (`frontend/src/pages/admin/*`). A hamburger toggle does exist, but it's the one shared navbar every portal uses (`frontend/src/App.tsx`, collapses only at mobile widths) — Admin has no dedicated nav treatment beyond reusing that same top bar with its 3 links (Dashboard/Departments/System Monitoring).

**Open question**: does the user want a proper Admin-specific sidebar/hamburger nav (distinct from the shared top navbar), and/or an in-page Back control? Worth confirming scope before building — this is new nav UX, not a bug fix.

## 6. Duplicate Logout / Sign Out

**Status: already fixed.** Verified in code: Admin Portal's own header Logout button was removed when it was restructured into multiple pages (Phase 3, 2026-09-09) — there is exactly one "Sign Out" control now, in the shared global navbar (`frontend/src/App.tsx`). If this is still being seen, it's from a build predating that change.

## 7. Hindi language not working on Admin Panel

**Status: confirmed, root cause identified.** Almost none of the Admin Portal's text goes through i18n. Checked every admin page/component (`AdminDashboardPage.tsx`, `AdminDepartmentsPage.tsx`, `SystemMonitoringPage.tsx`, `UserManagement.tsx`, `DepartmentManagement.tsx`, `RecentActivity.tsx`, `SystemMonitoring.tsx`, and `ADMIN_NAV_ITEMS` in `navConfig.ts`) — only the two "coming soon" placeholder cards on the Dashboard use `t()`; every other string (page headings, "User Management", "Department Directory", the nav labels themselves) is hardcoded English. The Hindi system itself works fine elsewhere (Citizen Portal is fully localized) — Admin was simply never wired into it.

**Would need**: add i18n keys for every hardcoded Admin string (mirroring the `citizenPortal.*`/`citizenNav.*` pattern in `frontend/src/i18n/locales/{en,hi}.json`) and switch `ADMIN_NAV_ITEMS` from `label` to `labelKey`. Mechanical but touches many files.

---

## Suggested sequencing (not yet agreed with the user)

Cheapest/safest first:
1. **#2** (gate the citizen buttons) — 3 of 4 done 2026-09-09 (see above); "Back to Search" is the one small remaining piece if still wanted.
2. **#7** (Hindi wiring) — mechanical, no design decisions needed.
3. **#5** (nav) — needs a scope decision first (see open question above).
4. **#1** (sessions) and **#4** (officer monitoring) — genuine new features/architecture, each worth its own planning pass.
5. **#3** — blocked on the user clarifying where they saw the issue; **#6** — already done, no action needed.
