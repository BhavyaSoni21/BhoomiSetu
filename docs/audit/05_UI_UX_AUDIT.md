# 05 — UI/UX Audit

**Date:** 2026-09-28. React 18 + TS + Vite; i18n via `t(key, fallback)` (returns raw key if missing). Verified every `t()` call against en.json + FALLBACK_STRINGS_RAW; only still-present issues reported.

## UI-01 — Raw i18n keys on the public landing page (P0 / High, judge-visible)
- **Route/Role:** `/` · Public.
- **Observed:** "Government alignment" section renders 8 chips via `{[0..7].map(i => t(`landing.govAlignment.departments.${i}`))}` with **no fallback arg** (BhoomiSetuLanding.tsx:544). Keys `landing.govAlignment.departments.0…7` are undefined in en.json **and** FALLBACK_STRINGS_RAW → literal key strings render in the grid.
- **Root cause:** RAW block (LanguageContext.tsx:294-297) defines only `.eyebrow/.heading/.desc/.connectsLabel`; the `departments.*` array was never added; en.json `landing.govAlignment` is `{}`.
- **Fix:** add real department names as `landing.govAlignment.departments.0…7` in en.json (+ hi), or supply real fallback strings at the call site.
- **Regression test:** grep-assert no `landing.govAlignment.departments.` renders literally; snapshot the landing grid.
- **Status:** OPEN

## UI-02 — Fake profile completeness / lastActive / status (P0 / High)
- **Route/Role:** `/profile` · Citizen & Officer.
- **Observed:**
  - Completeness bar fed a hardcoded % — citizen `user.mobileNumber && user.address ? 92 : user.mobileNumber ? 85 : 72` (ProfilePage.tsx:236); officer `user.mobileNumber ? 92 : 82` (OfficerProfilePage.tsx:95). Rendered as a real progress bar (ProfileSummaryCard.tsx:130).
  - `lastActive="11 Sep 2026, 10:24 AM"` hardcoded on both (ProfilePage.tsx:239, OfficerProfilePage.tsx:98).
  - officer `status="Active"` hardcoded (OfficerProfilePage.tsx:99).
- **Root cause:** AdminProfilePage/RoleDashboard were fixed to compute real completeness; these two pages were missed.
- **Fix:** compute completeness from real filled fields (pattern at AdminProfilePage.tsx:47-49); wire `lastActive`/`status` to real data or remove the props. **No fake data / no fake success.**
- **Regression test:** profile with N/M fields filled shows the correct %.
- **Status:** OPEN

## UI-03 — Dark-mode contrast: `text-brand-900` invisible (P1)
- **Observed:** `--brand-900:#06150F` (near-black) used as text/icon color with no `dark:` override on dark surfaces (`--surface-1:#0D261D`). Offenders: AdminDashboardPage.tsx:56,76; CitizenDashboardPage.tsx:104,127; FindParcelsPage.tsx:97; GetAssistancePage.tsx:122; AssignedRequestsPage.tsx:292,488; CertificateGeneratorPage.tsx:301; DocumentsPage.tsx:250; OfficerDashboardPage.tsx:295,301,319,325. Low-contrast `text-brand-700` links: CitizenDashboardPage.tsx:116,139,208,231,321; OfficerDashboardPage.tsx:508.
- **Fix:** use the theme-aware `text-ink` token (remapped to white in dark) or add `dark:text-brand-300`/`dark:text-emerald-400`.
- **Status:** OPEN

## UI-04 — Error masquerades as empty (P2)
- **Observed:** pages have loading + empty states but never reference `isError`; a failed fetch shows "No records found" instead of an error: DuplicateRegistryPage, FraudPreventionPage, OfficerSlaPage, ReassessmentQueuePage, CertificateGeneratorPage, CitizenDashboardPage, GetAssistancePage, DocumentsPage.
- **Fix:** add an `isError` branch with retry.
- **Status:** OPEN

## UI-05 — Precheck table clips on narrow screens (P2)
- **Observed:** WorkflowReviewPanel.tsx:1009-1010 — `field_results` `<table>` inside `overflow-hidden` div with no `overflow-x-auto`.
- **Fix:** add `overflow-x-auto` to the wrapper (match Parcel360View.tsx:401).
- **Status:** OPEN

## Verified already-OK
- Dead UI CLEAN (no `onClick={()=>{}}`, no `href="#"`, no placeholder handlers).
- Raw UUIDs CLEAN (only React keys + intentional truncated parcel id).
- i18n CLEAN except UI-01; all 289 two-arg `t()` calls carry string fallbacks; dynamic key families resolve.
- Responsive tables OK except UI-05.
- Landing "100%" is a decorative marketing claim, not a live metric.
- Verifier `verifierPortal.*`/`verifierAssignment.*` keys live only in FALLBACK_STRINGS_RAW but always with fallbacks → render fine (flag for i18n completeness, not a demo defect).
