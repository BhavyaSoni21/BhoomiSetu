# 06 — GIS Audit

**Date:** 2026-09-28. maplibre-gl + MVT vector tiles, PostGIS geometry, historical/satellite imagery via Earth Engine pipeline.

## Findings

No new **functional** GIS defects surfaced beyond the dependency and UI issues tracked elsewhere:
- **SEC-04 (Critical, dependency):** maplibre-gl carries an XSS advisory — upgrade. This is the highest-impact GIS-adjacent item. Tracked in `02_SECURITY_AUDIT.md`.
- **UI-05 (P2):** workflow precheck table (map-review context) clips on narrow screens. Tracked in `05_UI_UX_AUDIT.md`.

## Verified already-OK
- Layer visibility control, parcel selection, and layer control work as intended.
- MVT tile serving path is functional (the only MVT failure is a **test-fixture** DB error in `tests/legacy/test_mvt_tiles.py`, not a runtime defect — see TEST-01).
- 3 spatial layer categories per the SIH problem statement (SIH26014) are present.
- Geometry validity: layer create/update validates geometry **type**; consider adding `ST_IsValid`/self-intersection checks (plan item B6) before demoing user-drawn overlays — not a current blocker.

## Recommendations (non-blocking)
- Add `audit_service.log()` to layer create/update/delete (currently none) so map-layer mutations are traceable.
- Return affected `parcel_ids` count on overlay delete for a confirmation UI.
