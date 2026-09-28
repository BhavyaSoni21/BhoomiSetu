# 10 — SIH Demo Readiness

**Date:** 2026-09-28. Problem statement: SIH26014 (Land Stack). Pilots: Chandigarh + Tamil Nadu (launched 31 Dec 2025). Deliverable: Standard Technical Document.

## Overall: GO, with a short pre-demo fix list

The core flows (citizen request → officer workflow → verifier field evidence → decision) are wired end-to-end, the evidence pipeline is unified (real photo bytes reach the officer panel), the frontend builds, and no secrets are exposed. The blockers below are cosmetic-but-visible or a single-line reliability fix, not architectural.

## Must-fix before a live judged demo

| # | ID | Why it matters on stage | Effort |
|---|---|---|---|
| 1 | UI-01 | Raw i18n key strings show on the **landing page** — first thing judges see | ~15 min |
| 2 | UI-02 | Fake completeness %, fake "last active" on any profile — violates no-fake-data | ~30 min |
| 3 | REL-01 | One AI-provider hiccup → assistant 500s (NameError in error path) | ~5 min |
| 4 | API-01 | Officer task-detail fields render blank (casing mismatch) | ~15 min |

## Should-fix if time allows
- **SEC-01** case-document IDOR — only matters if judges probe cross-role access.
- **UI-03** dark-mode contrast — if demoing in dark theme, several icons/links vanish.

## Safe to defer (won't affect a controlled demo)
- SEC-04/05/06 dependency upgrades, DB-01 indexes, DEP-01 reaper/readiness, UI-04/05, API-02 offline replay, TEST-01 legacy suite.

## Demo hygiene
- Demo in **light theme** unless UI-03 is fixed.
- Pre-warm the AI providers; have the deterministic fallback path confirmed working (REL-01).
- Seed data present; verifier assignment works at DepartmentTask level.
