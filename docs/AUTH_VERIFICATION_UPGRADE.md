# Auth & Verification Upgrade + Frontend Upgrade List

**Status: ✅ built (2026-09-08)**, except Forgot/Reset Password (§8's `POST /auth/verify-mobile-otp`/`verify-email-otp` ended up consolidated into one `POST /auth/verify-otp` with a `method` field — see `docs/FRONTEND_UPGRADE_SPEC.md` §3 for the as-built endpoint list, schema, and provider detail; this document stays as the original design capture). This captures a spec the user provided (`BhoomiSetu_Updated_Authentication_Frontend_Upgrade.md`) plus a list of "previously agreed" frontend upgrades referenced in the same document but not previously written down anywhere in this repo.

This **supersedes** `docs/flow.md` §4's registration design, which assumed a simple name/email/password form (itself a placeholder, since no backend existed for it either). The rules below replace that design; `docs/flow.md` §4 should be treated as outdated once work on this starts.

**Update (2026-09-08): `docs/FRONTEND_UPGRADE_SPEC.md` is now the master document** — a fuller "Complete Frontend Upgrade Specification" the user provided afterward, covering the full site IA (public website, all three portals, notifications, governance-alert maps and pagination, the Analyze Imagery replacement) that this auth/OTP spec now sits inside. §10's open questions below have mostly been answered there — see the cross-references added inline below rather than duplicating the resolutions here.

---

## 1. The core rule

Registration needs **at least one** verified contact method — mobile OR email, not both. Either one alone is sufficient; a user can add the other later from their profile.

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

If both are provided at registration, the user picks which one to verify now; the other stays unverified until added/verified later (same flow as adding a missing method from the profile).

## 2. Registration form

Full Name, Mobile Number (optional), Email Address (optional), Password, Confirm Password. Client-side validation: if both mobile and email are empty, block submission with "Please provide either a mobile number or an email address." Password fields need a show/hide toggle (§8).

## 3. OTP verification (mobile and email, same interaction pattern)

- 6-digit code entry (6 individual boxes), a visible expiry countdown, rate-limited resend, a clear invalid-code error.
- Email may use OTP or a verification link — for UI consistency, email OTP should follow the same 6-box pattern as mobile when OTP is the chosen method.
- Verification state is stored **independently per contact method** — a user can have a verified mobile and an unverified (or absent) email, or vice versa; both combinations are valid as long as at least one is verified.

## 4. Add / change a contact method later (from profile)

- **Add**: enter the missing method → verify it (same OTP flow) → it's added.
- **Change**: enter the new value → verify the new value → only then does it replace the old one. The old verified contact method is never dropped before the new one is confirmed working — this avoids a user getting locked out mid-change.

## 5. No main navbar on authentication pages

Sign In, Registration, Mobile OTP verification, Email OTP verification, Email verification, Forgot Password, Reset Password should all render without the app's main navbar — a lightweight logo/branding only. Forgot Password and Reset Password don't exist in this codebase at all yet (there's no password-reset flow of any kind today).

## 6. Password show/hide

A visibility toggle on every password field, everywhere one appears: registration, sign-in (if the design calls for it there), forgot/reset/change password.

---

## 7. What this actually requires — backend

None of this exists today. Concretely, against the current schema (`backend/src/users/user.entity.ts`):

- `email` is currently a **required, unique** column — it needs to become nullable, with `mobileNumber` added alongside it (also nullable), plus `mobileVerified`/`emailVerified` boolean columns. A DB-level constraint (or just service-layer validation) needs to enforce "at least one of email/mobile is present."
- New endpoints needed: registration accepting either field, `POST /auth/verify-mobile-otp`, `POST /auth/verify-email-otp` (or a link-based equivalent), `POST /auth/resend-otp`, plus profile-side `POST /auth/profile/add-email`, `POST /auth/profile/add-mobile`, and change-mobile/change-email equivalents.
- **A real SMS/email delivery mechanism doesn't exist in this codebase at all.** `docs/FEATURE_AUDIT.md` §7 already flags this as a known, unscoped gap ("Notification delivery mechanism (SMS/email/push) — not raised"). **[RESOLVED, see §10 item 1]** a real gateway, not a stub — **Fast2SMS**, chosen 2026-09-08. Real email delivery (for `emailVerified`) is still unaddressed - no provider chosen for that side yet.
- Open question: does this apply to Officer/Admin accounts too, or CITIZEN registration only? The source spec reads citizen-registration-focused throughout; staff accounts are always admin-created (`docs/flow.md` rule 5) and have never needed self-service verification. Recommend keeping staff accounts on email+password only, unaffected — but confirm before building.

## 8. What this actually requires — frontend

- `RegisterPage.tsx` (currently a `[Placeholder]` per `docs/flow.md` §4 — drawn but disabled) becomes the real target: mobile/email fields with the "at least one" validation, OTP entry screens, expiry countdown, resend, and a preferred-method choice when both are given.
- New screens: mobile OTP verify, email OTP verify — likely sub-states of the register flow rather than fully separate routes, but that's a layout decision for tomorrow.
- Forgot Password / Reset Password: entirely new, nothing like this exists today.
- Profile page: doesn't exist yet — `docs/flow.md`'s Citizen dashboard currently has only a disabled "Profile" pill placeholder (added this session). This spec turns that into a real, scoped feature (view mobile/email verification status, add/change either).
- A route-level layout split: `App.tsx`'s `AppShell` currently wraps *every* route in the same nav+trust-bar header. Auth pages need a distinct layout with no main nav — likely a lightweight `AuthLayout` wrapper used only for `/login`, `/register`, `/forgot-password`, `/reset-password`, and any OTP-verification routes, leaving every other route on the existing `AppShell`.
- Password show/hide toggle: not present on `LoginPage.tsx`/`RegisterPage.tsx` today — small, mechanical addition (an eye-icon button toggling `type="password"`/`type="text"`).

---

## 9. The "previously agreed" frontend upgrades — reviewed against current state

These were referenced as already-agreed in the source document but hadn't been written into any doc in this repo before now. Reviewing each against what's actually built:

| Item | Current state | What changes |
|---|---|---|
| Minimal public navbar | `App.tsx`'s nav is full-featured: search box, CTA button, app switcher, all three portal links, language + theme toggles | A real reduction, not a restyle — needs deciding what's cut vs. moved elsewhere |
| Improved landing page header | `LandingHero.tsx` was rebuilt this session (geometric composition, no photo) | May already partially satisfy this, or may need a further pass — worth a fresh look tomorrow rather than assuming done |
| Removal of portal buttons from the navbar | Citizen/Officer/Admin Portal links are currently in the main nav (`App.tsx`) | Direct reversal of current nav structure — where do these go instead (the app-switcher grid only? Nowhere, reachable only via login redirect)? |
| No My Parcels on the public home page | `MyParcels.tsx` is currently the first panel on `CitizenPortal.tsx`, which **is** the public home page (`/` and `/citizen` render the same component) | Implies Home and the Citizen Portal need to actually become separate surfaces — see the open question below, this is the biggest structural change in this list |
| No document verification interface on the public home page | `DocumentVerificationPanel` is currently on the same shared `CitizenPortal.tsx` | Same as above — moves into a citizen-only, multi-page portal |
| Parcel search inside the Citizen Portal | `ParcelSearch` is currently on the same shared, guest-accessible page | **Tension worth flagging**: `docs/flow.md` and the hero copy itself ("No login needed for parcel search...") repeatedly establish that search needs no account. Does this item mean search moves to a *route* called "Citizen Portal" that's still reachable without login, or does it mean search becomes citizen-only? Needs a real answer before implementation, not an assumption either way |
| Citizen map focused on associated parcels | `MapComponent` today shows general search results, not a citizen's own linked parcels specifically | A real new behavior — the map needs a "my parcels" mode, not just its current search-driven mode |
| Removal of Analyze Imagery | This is `ChangeDetectionPanel` on the Officer Portal (heading "Analyze Imagery") — a fully built, tested feature, listed in `docs/FEATURE_AUDIT.md` §2 as a "preferred" bonus item already met | **Flagging clearly**: removing this would reopen a gap `FEATURE_AUDIT.md` currently marks closed. Confirm whether "removal" means deleted entirely, or relocated/renamed, before touching it |
| Multi-page Citizen Portal | Currently one long scrolling page (this session's redesign kept the existing single-page structure, just restyled it) | Confirms the Home/Citizen-Portal split above; a real routing change, not done yet |
| Clear Officer Portal navigation | `OfficerPortal.tsx` is a single dashboard page, no internal sub-navigation | New — needs a shape (tabs? sub-routes?) decided tomorrow |
| Governance alert map previews | `GovernanceAlertsPanel`/`GovernanceAlertDetailModal` show text detail only today, no map | New — a small embedded map showing the affected parcel per alert |
| Citizen and officer notifications | Partially exists: `RequestNotifications.tsx` (per-parcel, citizen-facing) and `GovernanceAlertsPanel` (officer-facing) both already show live status feeds | Likely means a more unified notification concept (a bell icon / count?) rather than a from-scratch build — worth confirming scope |
| Requests restricted to the citizen's own parcels | `ServiceRequestForm` (as of this session's redesign) requires citizen sign-in, but any signed-in citizen can currently file a request against **any** `parcelId**, not just their own | A real, additional restriction beyond what was just built — needs a backend check (citizen must own/have claimed the parcel) layered on top of the existing CITIZEN-role gate |
| Auto-fetched parcel information in request forms | `ServiceRequestForm` today only collects `createdBy`/`requestDetails` — it doesn't display the parcel it's being filed against at all | A real UX addition — show parcel identifiers/summary inline in the form, fetched from the already-selected parcel |

---

## 10. Open questions — status as of 2026-09-08

1. ~~**OTP delivery (SMS)**~~ — **[RESOLVED]** a real SMS gateway, not a stub — **Fast2SMS**, chosen 2026-09-08 (the user was already using it). API reference confirmed: `POST /dev/otp/send` + `POST /dev/otp/verify`, `otp_id`-template-based, server-side code storage (no `otpCode` column needed in `users`). Still blocked on the user completing Fast2SMS account/OTP-template setup (API key + `otp_id`) and confirming whether the SMS channel needs their own DLT registration or gets a ready-made shared template — see `docs/FRONTEND_UPGRADE_SPEC.md` §3/§11 item 1 for the full detail. **Email OTP delivery remains a separate, still-unresolved gap** — no provider chosen for that side.
2. ~~**Staff accounts**~~ — **[RESOLVED]** citizen-only, confirmed by the user; staff stays admin-created email+password. See `docs/FRONTEND_UPGRADE_SPEC.md` §3.
3. ~~**Home vs. Citizen Portal split**~~ — **[RESOLVED, details still open]** confirmed as a real split by the user ("the home page should not be same as the citizen portal") — the exact routes/content are flagged by the user as "we can discuss on that," so the split itself is decided, its mechanics aren't. See `docs/FRONTEND_UPGRADE_SPEC.md` §1/§11 item 2.
4. ~~**Guest search**~~ — **[RESOLVED]** dropped entirely, confirmed by the user ("there should be no guest search in the flow"). This is a deliberate reversal of `docs/FEATURES.md` feature 3's current documented behavior — not yet edited there since nothing has shipped. See `docs/FRONTEND_UPGRADE_SPEC.md` §1.
5. ~~**"Removal of Analyze Imagery"**~~ — **[RESOLVED, with a new sub-question]** frontend removal only, replaced by an on-demand historical image-comparison feature (not a standalone panel). This raises a real new implementation-shape question — see `docs/FRONTEND_UPGRADE_SPEC.md` §8 and §11 item 3.

New from the same follow-up: a pagination control for the Officer Portal's governance-alerts list — see `docs/FRONTEND_UPGRADE_SPEC.md` §6.

---

*Nothing in this document has been built. `docs/FRONTEND_UPGRADE_SPEC.md` is now the fuller reference — revisit both tomorrow (2026-09-09) before writing any code.*
