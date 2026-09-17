# Graph Report - SIH_2026_BhoomiSetu  (2026-09-14)

## Corpus Check
- Large corpus: 578 files · ~679,195 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2437 nodes · 6582 edges · 121 communities (82 shown, 19 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 430 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Src / Pages
- Common / Parcel Generation
- Pages / Citizen
- Test Auth
- App / Routers
- Frontend / Src
- Auth / Profile Components
- Features / Ai
- App / Services
- Test Departments
- Tests / Routers
- App / Services
- App / Models
- Features / Auth
- Seed
- App / Routers
- App / Services
- Test Analytics
- Features / Admin
- Features / Admin
- Workflowreviewpanel
- App / Auth
- Auth
- App / Routers
- Auth Service
- App / Services
- Test Ai
- Test Workflows
- Features / Officer
- Features / Parcels
- App / Common
- App / Services
- Workflows Service
- Test Governance
- Analyticsdashboard
- Common / Parcel Generation
- App / Services
- App / Schemas
- Tests / Routers
- Package
- Land Records
- Features / Officer
- Test Users
- App / Routers
- Supabase Storage
- Land Records Service
- Departments
- App / Schemas
- Tsconfig
- Test Parcels
- Package
- Mapcomponent.Test
- Test Interoperability
- Test Gis
- Features / Admin
- App / Auth
- Test Workflows
- Conftest
- Test Land Records
- Mapcomponent
- App / Services
- Test Spatial
- Tests / Routers
- Test Parcels
- Test Spatial
- Middleware
- Auth
- Gis
- Governance
- Test Predictive Analytics
- Departments
- Departments Service
- Test Notification Feed
- Package
- Request Routing Service
- Test Change Detection
- Features / Notifications
- Field Matcher
- Test Parcels
- Test Pagination
- Test Parcels
- Test Workflows
- Test Audit
- Test Workflows
- Test Workflows
- Test Workflows
- Test Audit
- Test Workflows
- Test Historical Imagery
- Test Parcels
- Package
- Historicalimagerypanel.Test
- Setup
- Ocr
- Test Parcels
- Test Parcels
- Test Workflows
- Test Workflows
- Bhoomisetulogo
- Mapcomponent.Test
- Vercel

## God Nodes (most connected - your core abstractions)
1. `User` - 131 edges
2. `Parcel` - 104 edges
3. `CamelModel` - 101 edges
4. `react` - 98 edges
5. `create_authenticated_user()` - 93 edges
6. `_seed()` - 77 edges
7. `lucide-react` - 74 edges
8. `apiService` - 64 edges
9. `@tanstack/react-query` - 63 edges
10. `react-i18next` - 53 edges

## Surprising Connections (you probably didn't know these)
- `create_access_token()` --uses--> `User`  [INFERRED]
  backend-py/app/auth/deps.py → backend-py/app/models/user.py
- `get_current_user()` --uses--> `User`  [INFERRED]
  backend-py/app/auth/deps.py → backend-py/app/models/user.py
- `get_current_user_optional()` --uses--> `User`  [INFERRED]
  backend-py/app/auth/deps.py → backend-py/app/models/user.py
- `require_roles()` --uses--> `User`  [INFERRED]
  backend-py/app/auth/deps.py → backend-py/app/models/user.py
- `find_identifier_value()` --uses--> `ParcelIdentifier`  [INFERRED]
  backend-py/app/common/identifier_utils.py → backend-py/app/models/parcel.py

## Import Cycles
- None detected.

## Communities (121 total, 19 thin omitted)

### Community 0 - "Src / Pages"
Cohesion: 0.04
Nodes (44): landRecordsDept, taxDept, ACTION_DOT_CLASS, ACTION_LABEL_KEYS, ENTITY_TYPE_OPTIONS, formatDateTime(), RecentActivity(), mockNavigate (+36 more)

### Community 1 - "Common / Parcel Generation"
Cohesion: 0.08
Nodes (62): _apply_corner_nibbles(), _attempt_generate_cluster_parcels(), _build_envelope(), ClusterGeometryConfig, _deg_to_rad(), generate_cluster_parcels(), GeneratedParcel, _is_reasonably_compact() (+54 more)

### Community 2 - "Pages / Citizen"
Cohesion: 0.08
Nodes (35): BackButton(), BackButtonProps, VARIANT_CLASS, CornerMarker(), DepartmentManagement(), emptyEditForm, emptyForm, formatDateTime() (+27 more)

### Community 3 - "Test Auth"
Cohesion: 0.07
Nodes (14): _clear(), _mock_email_capture(), _mock_send_otp(), _register_and_verify_citizen(), _seed_officer(), TestGetMe, TestLogin, TestRegister (+6 more)

### Community 4 - "App / Routers"
Cohesion: 0.10
Nodes (59): AdminMapNote, Admin-only map annotation - unlike ZoningOverlay/RestrictionZone/…, _area_filter(), create_admin_map_note(), create_infrastructure_feature(), create_restriction_zone(), create_zoning_overlay(), delete_admin_map_note() (+51 more)

### Community 5 - "Frontend / Src"
Cohesion: 0.06
Nodes (40): App(), AppShell(), navItemsFor(), portalPathForRole(), Footer(), SvgIndianEmblem(), setToken(), useLogin() (+32 more)

### Community 6 - "Auth / Profile Components"
Cohesion: 0.05
Nodes (36): activities, ActivityItem, ActivityTimelineProps, AdminActivitySummary(), DocumentItem, documents, DocumentsCredentialsCardProps, GISMapPreview() (+28 more)

### Community 7 - "Features / Ai"
Cohesion: 0.07
Nodes (39): ParcelSearchModal(), ParcelSearchModalProps, searchByAnyIdentifier(), AskAiWidget(), ChatMessage, clamp(), clampButtonPos(), clampPanelPos() (+31 more)

### Community 8 - "App / Services"
Cohesion: 0.08
Nodes (43): DisputeRecord, Environmental zones, protected areas, other restrictions - a per-parcel…, The fifth workflow type named in the SIH problem statement's required…, RestrictionRecord, ClusterHistoricalSnapshot, Ported from backend/src/historical-imagery/cluster-historical-…, ParcelHistoricalState, Attribute-level history, per year, deliberately NOT geometry (the parcel's… (+35 more)

### Community 9 - "Test Departments"
Cohesion: 0.07
Nodes (28): Base, Ported from backend/src/admin/department.entity.ts. Admin Portal "Department…, EncumbranceRecord, PlanningRecord, Ported from backend/src/departments/*.entity.ts. Six mock per-parcel department…, A required "essential layer" of the fuller "Land Stack" problem statement.…, Registration status, transaction records, registration history., Land use, zoning, master plan info. For the Pune cluster, land_use is generated… (+20 more)

### Community 10 - "Tests / Routers"
Cohesion: 0.09
Nodes (33): Department, create(), find_all(), delete, get, patch, post, Session (+25 more)

### Community 11 - "App / Services"
Cohesion: 0.09
Nodes (37): build_canonical_envelope(), Ported from backend/src/interoperability/canonical-transformer.ts. Tech.md #15…, geometry_to_geojson(), Any, WKBElement, Converts a GeoAlchemy2 geometry value (a WKBElement, as read back from a real…, OwnershipHistoryRecord, Parcel (+29 more)

### Community 12 - "App / Models"
Cohesion: 0.09
Nodes (31): GovernanceAlert, Ported from backend/src/governance/governance-alert.entity.ts. The officer-…, CitizenParcel, Ported from backend/src/parcels/*.entity.ts. Geometry columns use GeoAlchemy2's…, Links a citizen's login (User.role == 'CITIZEN') to the parcels associated with…, ChangeDetectionEvent, InfrastructureFeature, Ported from backend/src/spatial/*.entity.ts. Geometry columns use real PostGIS… (+23 more)

### Community 13 - "Features / Auth"
Cohesion: 0.09
Nodes (32): AUTH_QUERY_KEY, AuthUser, clearToken(), ContactMethod, getToken(), PendingRegistration, RegisterParams, useLogout() (+24 more)

### Community 14 - "Seed"
Cohesion: 0.10
Nodes (37): _meters_per_degree(), _on_segment(), _orientation(), point_in_ring(), _point_segment_distance(), polygon_distance_meters(), Point, Ring (+29 more)

### Community 15 - "App / Routers"
Cohesion: 0.13
Nodes (39): get_audit(), get_context(), get_document_file(), get_documents(), get_historical_states(), get_my_parcels(), get_neighbours(), get_ownership_history() (+31 more)

### Community 16 - "App / Services"
Cohesion: 0.08
Nodes (25): include_object(), run_migrations_offline(), run_migrations_online(), get_settings(), Settings, check(), get, complete_json() (+17 more)

### Community 17 - "Test Analytics"
Cohesion: 0.10
Nodes (21): AuditLog, Ported from backend/src/audit/audit-log.entity.ts. `parcel_id` is a pragmatic…, Ported from backend/src/workflows/workflow.entity.ts + workflow-step.entity.ts.…, The simulated review pipeline a workflow moves through (LAND_RECORDS ->…, WorkflowStep, AnalyticsSummary, AnalyticsTotals, Distribution (+13 more)

### Community 18 - "Features / Admin"
Cohesion: 0.06
Nodes (26): BASE_STYLE, boundsOfGeometry(), centeredRectangle(), LayerGeometryDrawMap(), LayerGeometryDrawMapProps, MockDraw, mockDrawInstances, MockLngLatBounds (+18 more)

### Community 19 - "Features / Admin"
Cohesion: 0.09
Nodes (29): ALL_ROLE_LABELS, ALL_ROLES, formatDate(), me, meAsManaged, otherUser, UserManagement(), RISK_BAND_CLASS (+21 more)

### Community 20 - "Workflowreviewpanel"
Cohesion: 0.07
Nodes (32): AdminDecidedStepMode, AdminDecidedStepRow(), AdminDecidedStepRowProps, AdminStepMode, AdminStepRowProps, DEPARTMENT_360_KEY, DepartmentRecordFields(), EscalateStepFormProps (+24 more)

### Community 21 - "App / Auth"
Cohesion: 0.08
Nodes (21): Minimal JWT verification substrate - NOT the full AuthModule.…, Mirrors RolesGuard: a route with no roles declared lets any authenticated user…, require_roles(), get_db(), Session, Commits once the route handler returns successfully (every write endpoint below…, Ported from backend/src/audit/audit.controller.ts. Admin-only…, ChangeAnalysisResultOut (+13 more)

### Community 22 - "Auth"
Cohesion: 0.11
Nodes (28): Ported from backend/src/analytics/analytics.controller.ts. Admin-only - only…, me(), get, Ported from backend/src/auth/auth.controller.ts. KNOWN_RISKS.md HIGH-1: POST…, AnalyticsSummaryOut, AnalyticsTotalsOut, DistributionOut, OfficerMonitoringEntryOut (+20 more)

### Community 23 - "App / Routers"
Cohesion: 0.15
Nodes (32): patch, update_role(), create(), escalate_step(), find_all(), find_mine(), find_one(), get_evidence() (+24 more)

### Community 24 - "Auth Service"
Cohesion: 0.14
Nodes (31): create_access_token(), Mirrors AuthService's jwtService.sign(payload) - no `exp` claim, by design: per…, verify_password(), PendingRegistration, add_or_change_contact(), _email_taken_by_another_user(), _generate_otp_code(), login() (+23 more)

### Community 25 - "App / Services"
Cohesion: 0.09
Nodes (30): alias, analyze_change(), analyze_change_satellite(), post, Session, UploadFile, Same pipeline as /analyze, but the before/after imagery is real Sentinel-2…, analyze() (+22 more)

### Community 26 - "Test Ai"
Cohesion: 0.13
Nodes (7): _seed(), _square(), _stub_groq(), TestPostAlertsExplain, TestPostParcelsExplain, fake_complete_json(), TestPostQuery

### Community 27 - "Test Workflows"
Cohesion: 0.12
Nodes (4): _seed(), TestCreate, TestGetMine, TestReviewStep

### Community 28 - "Features / Officer"
Cohesion: 0.14
Nodes (23): AiExplanationCard(), AiExplanationCardProps, RISK_COLORS, badgeClass(), GovernanceAlertDetailModal(), GovernanceAlertDetailModalProps, SEVERITY_STYLES, AlertStage (+15 more)

### Community 29 - "Features / Parcels"
Cohesion: 0.08
Nodes (19): formatCurrency(), formatDate(), OWNER_ONLY_TAB_KEYS, Parcel360View(), RISK_BAND_CLASS, TabKey, TABS, citizen (+11 more)

### Community 30 - "App / Common"
Cohesion: 0.15
Nodes (21): find_identifier_value(), Session, Ported from backend/src/common/identifier-utils.ts. Shared by…, adapt_land_records_result(), adapt_state_a(), adapt_state_b(), AdaptedLandRecord, Ported from backend/src/interoperability/land-record-adapters.ts. (+13 more)

### Community 31 - "App / Services"
Cohesion: 0.12
Nodes (23): Ported from backend/src/users/user.entity.ts. Real accounts backing…, # NOTE: explicit name= overrides map Python snake_case attrs to the, AiExplanationIn, AssistantResponseIn, ask_assistant(), explain_alert(), explain_parcel(), _normalize_district_code() (+15 more)

### Community 32 - "Workflows Service"
Cohesion: 0.22
Nodes (26): A citizen service request, e.g. "request a copy of the RoR" or "correction…, Workflow, NotificationPayload, notify_users(), Callers (WorkflowsService, GovernanceAlertsService) resolve their own recipient…, escalate_step(), find_all(), find_by_parcel() (+18 more)

### Community 33 - "Test Governance"
Cohesion: 0.15
Nodes (7): _fresh_alert(), GovernanceAlert, Ported from backend/test/governance-alerts.e2e-spec.ts. The original spec…, _seed(), TestFindAll, TestFindOne, TestUpdateStatusFourStageVerification

### Community 34 - "Analyticsdashboard"
Cohesion: 0.11
Nodes (21): ALERT_SEVERITY_COLORS, ALERT_STATUS_COLORS, ALERT_STATUS_LABELS, AnalyticsDashboard(), BRAND_PALETTE, colorFor(), ComplianceDonut(), countFor() (+13 more)

### Community 35 - "Common / Parcel Generation"
Cohesion: 0.14
Nodes (22): ClusterBounds, compute_cluster_bounds(), _project_ring(), Ring, Ported from backend/src/common/parcel-generation/cluster-snapshot-generator.ts.…, `categories[i]` is the real, data-driven ParcelCategory for `rings[i]` in this…, render_cluster_snapshot(), category_for() (+14 more)

### Community 36 - "App / Services"
Cohesion: 0.16
Nodes (25): User, get_officer_monitoring(), get_summary(), get, Session, create(), find_all(), delete (+17 more)

### Community 37 - "App / Schemas"
Cohesion: 0.14
Nodes (22): Ported from backend/src/app.module.ts's ThrottlerModule/APP_GUARD wiring + the…, explain_alert(), explain_parcel(), limit, post, Request, Session, UUID (+14 more)

### Community 38 - "Tests / Routers"
Cohesion: 0.11
Nodes (7): create_authenticated_user(), Session, TestListClusters, TestYearPairRestriction, Admin-only layer - unlike zoning/restriction/infrastructure above, GET is…, TestAdminNotes, TestUpdateAndDeleteZoningOverlay

### Community 39 - "Package"
Cohesion: 0.09
Nodes (21): description, name, private, version, autoprefixer, i18next, jsdom, postcss (+13 more)

### Community 40 - "Land Records"
Cohesion: 0.21
Nodes (22): create_state_a(), create_state_b(), find_all_state_a(), find_all_state_b(), find_one_state_a(), find_one_state_b(), _not_found_a(), _not_found_b() (+14 more)

### Community 41 - "Features / Officer"
Cohesion: 0.17
Nodes (17): useCategorizedParcels(), useCompareHistoricalYears(), useHistoricalClusters(), HistoricalImageryPanel(), CATEGORY_COLORS, CATEGORY_LABELS, CategorySwatch(), HistoricalMapView() (+9 more)

### Community 42 - "Test Users"
Cohesion: 0.15
Nodes (5): _seed(), TestCreate, TestDelete, TestFindAll, TestUpdateRole

### Community 43 - "App / Routers"
Cohesion: 0.18
Nodes (15): Ported from backend/src/auth/roles.constants.ts., compare(), get_image(), get_parcels_for_year(), list_clusters(), get, post, Session (+7 more)

### Community 44 - "Supabase Storage"
Cohesion: 0.18
Nodes (18): download_from_storage(), ensure_storage_bucket_exists(), _get_client(), _is_storage_configured(), Ported from backend/src/common/supabase-storage.ts. Object storage for every…, Idempotent - safe to call on every backend-py startup. A no-op when storage…, `key` is normally a relative object path, e.g. 'cluster-snapshots/pune-…, _resolve_local_path() (+10 more)

### Community 45 - "Land Records Service"
Cohesion: 0.23
Nodes (19): An urban plot-style record - different field names, different units (sqft vs…, StateBLandRecord, CreateStateALandRecord, CreateStateBLandRecord, UpdateStateALandRecord, UpdateStateBLandRecord, create_state_a(), create_state_b() (+11 more)

### Community 46 - "Departments"
Cohesion: 0.24
Nodes (17): DisputeRecordOut, EncumbranceRecordOut, IdentifierUsed, LandRecordsLookupOut, PlanningRecordOut, Ported from backend/src/departments/*.entity.ts response shapes + land-records-…, RegistrationRecordOut, RestrictionRecordOut (+9 more)

### Community 47 - "App / Schemas"
Cohesion: 0.13
Nodes (13): find_all(), get, Session, Ported from backend/src/users/users.controller.ts. Admin-only throughout…, CreateUser, PublicUserOut, field_validator, Ported from backend/src/users/users.controller.ts's `toPublicUser` +… (+5 more)

### Community 48 - "Tsconfig"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, incremental, isolatedModules, jsx (+10 more)

### Community 49 - "Test Parcels"
Cohesion: 0.19
Nodes (4): _base_fixtures(), parcelA/parcelB + a citizen-linked parcel, matching the TS spec's module-level…, TestGetOwnershipHistory, TestSearch

### Community 50 - "Package"
Cohesion: 0.11
Nodes (18): dependencies, autoprefixer, axios, i18next, lucide-react, @mapbox/mapbox-gl-draw, maplibre-gl, postcss (+10 more)

### Community 51 - "Mapcomponent.Test"
Cohesion: 0.11
Nodes (10): contextResponse, MockLngLatBounds, mockMapInstances, MockNavigationControl, MockPopup, p1Feature, p2Feature, p3Feature (+2 more)

### Community 52 - "Test Interoperability"
Cohesion: 0.21
Nodes (6): ResolveParcelIdQuery, _seed(), _square(), TestGetParcel360EndToEnd, TestIdentifierResolverService, TestResponseAggregatorBuildParcel360

### Community 53 - "Test Gis"
Cohesion: 0.18
Nodes (6): _poly(), Ported from backend/test/gis.e2e-spec.ts. The original spec seeds 3 fixtures…, _seed_fixture_parcels(), TestGetParcelGeometry, TestGetParcelRestrictions, TestGetParcels

### Community 54 - "Features / Admin"
Cohesion: 0.14
Nodes (15): AdminCombinedLayerMap(), BASE_STYLE, boundsOfFeatureCollections(), CombinedLayerKey, EMPTY_FC, LAYER_KEYS, setSourceData(), ClusterParcelEntry (+7 more)

### Community 55 - "App / Auth"
Cohesion: 0.16
Nodes (14): get_current_user(), get_current_user_optional(), Session, Mirrors JwtStrategy.validate(): looks the user up fresh on every request…, Mirrors OptionalJwtAuthGuard: same 'jwt' strategy as get_current_user, but…, find_mine(), mark_read(), get (+6 more)

### Community 56 - "Test Workflows"
Cohesion: 0.26
Nodes (7): ParcelDocumentFields, Ported from backend/src/common/parcel-generation/parcel-document-generator.ts.…, render_parcel_document_image(), test_render_parcel_document_image_escapes_xml_special_characters(), test_render_parcel_document_image_produces_a_valid_png(), TestDisputeFilingExemptionAndConflictFlow, TestEvidenceUpload

### Community 57 - "Conftest"
Cohesion: 0.15
Nodes (11): client(), db(), fixture, Session, A real session against the bhoomisetu_py/PostGIS database, wrapped in an outer…, A TestClient whose requests are served using the same transactional `db`…, _build_throttled_app(), FastAPI (+3 more)

### Community 58 - "Test Land Records"
Cohesion: 0.21
Nodes (5): Ported from backend/test/land-records.e2e-spec.ts. Fully self-contained (no…, _seed(), TestStateALandRecords, TestStateBLandRecords, TestTheTwoStateApisOperateIndependently

### Community 59 - "Mapcomponent"
Cohesion: 0.17
Nodes (14): BASE_STYLE, Basemap, boundsOfFeatures(), DEFAULT_LAYER_VISIBILITY, DEFAULT_STATE_COLORS, EMPTY_FC, ensureLayer(), escapeHtml() (+6 more)

### Community 60 - "App / Services"
Cohesion: 0.23
Nodes (10): hash_password(), Shared bcrypt hashing, used by UsersModule (admin-provisioned staff accounts)…, _generate_code(), is_configured(), Ported from backend/src/notifications/sms.service.ts. SMS OTP delivery via…, send_otp(), SmsOtpResult, fake_send_otp() (+2 more)

### Community 61 - "Test Spatial"
Cohesion: 0.21
Nodes (4): _clear_spatial(), TestCreateInfrastructure, TestCreateRestrictionZone, TestCreateZoningOverlay

### Community 62 - "Tests / Routers"
Cohesion: 0.21
Nodes (9): Notification, Ported from backend/src/notification-feed/notification.entity.ts. In-app…, find_mine(), mark_read(), Session, Ported from backend/src/notification-feed/notification-feed.service.ts., _clear(), Ported from backend/test/workflows.e2e-spec.ts. The original spec builds one… (+1 more)

### Community 64 - "Test Spatial"
Cohesion: 0.19
Nodes (4): _poly(), Real spatial overlap -> real GovernanceAlert, and no-overlap validation.…, TestReads, TestRestrictionZoneOverlapAndAlerts

### Community 65 - "Middleware"
Cohesion: 0.22
Nodes (11): FastAPI, Request, Mirrors backend/src/common/request-id.middleware.ts: honors a caller-supplied…, Mirrors backend/src/common/all-exceptions.filter.ts's response shape -…, register_exception_handlers(), http_exception_handler(), unhandled_exception_handler(), validation_exception_handler() (+3 more)

### Community 66 - "Auth"
Cohesion: 0.26
Nodes (13): login(), logout(), limit, post, Request, Session, register(), resend_otp() (+5 more)

### Community 67 - "Gis"
Cohesion: 0.32
Nodes (11): get_parcel_geometry(), get_parcel_restrictions(), get_parcels(), _parse_bbox(), get, Session, UUID, Ported from backend/src/gis/gis.controller.ts + gis.service.ts. backend-py has… (+3 more)

### Community 68 - "Governance"
Cohesion: 0.26
Nodes (11): find_all(), find_one(), get, patch, Session, UUID, Ported from backend/src/governance/governance-alerts.controller.ts.…, update_status() (+3 more)

### Community 69 - "Test Predictive Analytics"
Cohesion: 0.24
Nodes (4): _seed(), _square(), TestGetRiskScore, TestGetTopRiskParcels

### Community 70 - "Departments"
Cohesion: 0.45
Nodes (11): get_dispute(), get_encumbrance(), get_land_records(), get_planning(), get_registration(), get_restriction(), get_tax(), get (+3 more)

### Community 71 - "Departments Service"
Cohesion: 0.32
Nodes (10): find_dispute_by_parcel(), find_encumbrance_by_parcel(), find_planning_by_parcel(), find_registration_by_parcel(), find_restriction_by_parcel(), find_tax_by_parcel(), Session, Ported from backend/src/departments/{registration,planning,tax,restriction,… (+2 more)

### Community 72 - "Test Notification Feed"
Cohesion: 0.27
Nodes (4): Ported from backend/test/notification-feed.e2e-spec.ts. Fully self-contained -…, _seed(), TestFindMine, TestMarkRead

### Community 73 - "Package"
Cohesion: 0.17
Nodes (12): devDependencies, jsdom, @testing-library/jest-dom, @testing-library/react, @types/mapbox__mapbox-gl-draw, @types/node, @types/react, @types/react-dom (+4 more)

### Community 74 - "Request Routing Service"
Cohesion: 0.27
Nodes (10): _parse_result(), PipelineStage, Ported from backend/src/workflows/request-routing.service.ts. Replaces the…, RoutingResult, suggest_pipeline(), create(), CreateWorkflowInput, _pipeline_for() (+2 more)

### Community 75 - "Test Change Detection"
Cohesion: 0.29
Nodes (5): make_image(), A solid background, optionally with a colored rectangle painted into it,…, _seed_parcels(), square(), TestAnalyze

### Community 76 - "Features / Notifications"
Cohesion: 0.27
Nodes (7): formatDateTime(), NotificationFeed(), officer, read, unread, TYPE_ICON, AppNotification

### Community 77 - "Field Matcher"
Cohesion: 0.27
Nodes (9): _normalize(), Ported from backend/src/document-verification/field-matcher.ts. Pure, OCR/DB-…, Identifiers (survey numbers, ULPINs, plot numbers) are short, distinctive…, Names are harder: OCR can misread individual characters, and a real document…, Finds any number in the OCR text within a tolerance of the expected value -…, text_contains_approx_number(), text_contains_identifier(), text_contains_name() (+1 more)

### Community 78 - "Test Parcels"
Cohesion: 0.20
Nodes (3): square(), far_square(), TestGetContext

### Community 79 - "Test Pagination"
Cohesion: 0.36
Nodes (7): Ported from backend/src/common/pagination.ts - KNOWN_RISKS.md HIGH-6. Every…, Returns (take, skip)., resolve_pagination(), test_caps_limit_at_the_ceiling(), test_defaults_when_nothing_supplied(), test_honors_a_supplied_limit_and_offset(), test_ignores_a_non_positive_limit_or_offset()

### Community 81 - "Test Workflows"
Cohesion: 0.25
Nodes (3): _square(), TestGetParcelWorkflows, TestLandClaimRequest

### Community 90 - "Package"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, test

### Community 93 - "Ocr"
Cohesion: 0.67
Nodes (3): extract_text(), OcrResult, Ported from backend/src/document-verification/ocr.ts. Thin wrapper around…

## Knowledge Gaps
- **256 isolated node(s):** `name`, `version`, `description`, `private`, `dev` (+251 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 695 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `App / Services` to `Test Auth`, `App / Routers`, `Test Departments`, `Tests / Routers`, `App / Models`, `Seed`, `App / Routers`, `Test Analytics`, `App / Auth`, `Auth`, `App / Routers`, `Auth Service`, `App / Services`, `Workflows Service`, `App / Schemas`, `Tests / Routers`, `Test Users`, `App / Routers`, `App / Schemas`, `App / Auth`, `App / Services`, `Auth`, `Governance`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Why does `Parcel` connect `App / Services` to `App / Routers`, `App / Services`, `Test Departments`, `App / Models`, `Seed`, `App / Routers`, `Test Analytics`, `App / Services`, `Test Ai`, `Test Workflows`, `App / Common`, `App / Services`, `Workflows Service`, `Test Parcels`, `Test Interoperability`, `Test Gis`, `Test Workflows`, `Tests / Routers`, `Test Parcels`, `Test Spatial`, `Gis`, `Test Predictive Analytics`, `Departments Service`, `Request Routing Service`, `Test Change Detection`, `Field Matcher`, `Test Parcels`, `Test Workflows`, `Test Audit`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `create_authenticated_user()` connect `Tests / Routers` to `App / Services`, `Test Departments`, `Tests / Routers`, `App / Services`, `App / Models`, `Test Analytics`, `Auth Service`, `Test Ai`, `Test Workflows`, `Test Governance`, `App / Services`, `Test Users`, `Test Parcels`, `Test Interoperability`, `Test Workflows`, `Test Spatial`, `Tests / Routers`, `Test Spatial`, `Test Predictive Analytics`, `Test Notification Feed`, `Test Change Detection`, `Test Parcels`, `Test Workflows`, `Test Audit`, `Test Workflows`, `Test Audit`, `Test Historical Imagery`, `Test Parcels`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Are the 92 inferred relationships involving `User` (e.g. with `create_access_token()` and `get_current_user()`) actually correct?**
  _`User` has 92 INFERRED edges - model-reasoned connections that need verification._
- **Are the 42 inferred relationships involving `Parcel` (e.g. with `build_canonical_envelope()` and `get_parcel_geometry()`) actually correct?**
  _`Parcel` has 42 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _256 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Src / Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.036996336996337 - nodes in this community are weakly interconnected._