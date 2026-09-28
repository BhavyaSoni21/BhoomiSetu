# 05 — Database Schema

**59 tables**, PostgreSQL + PostGIS. Extracted directly from the SQLAlchemy models in `backend-py/app/models/` (introspected, not conceptual). Every table has a `uuid` primary key `id` unless noted (`state_a/b_land_records` use `record_id`).

## Type legend

The columns below show SQLAlchemy generic types; the PostgreSQL storage is:

| Shown | PostgreSQL |
|-------|-----------|
| `UUID` | `uuid` |
| `DATETIME` | `timestamp` (stored naive-UTC by convention) |
| `DATE` | `date` |
| `NUMERIC(p,s)` | `numeric(p,s)` |
| `VARCHAR(n)` / `VARCHAR` | `varchar(n)` / `text` |
| `JSON` / `JSONB` | `json` / `jsonb` |
| `ARRAY` | array column |
| `geometry(TYPE,4326)` | PostGIS geometry, SRID 4326, GIST-indexed |
| `SMALLINT` / `INTEGER` / `FLOAT` / `BOOLEAN` | as named |

Notation below: `PK` primary key, `NN` not null, `→ table.col` foreign key.

---

## Base spatial layer

### `parcels` — the hub
```
id UUID PK NN
canonical_parcel_id VARCHAR(50)
cluster_id VARCHAR(50)
ulpin VARCHAR(50)
state_code VARCHAR(10) NN
district_code VARCHAR(20) NN
local_body_code VARCHAR(20) NN
geometry geometry(POLYGON,4326) NN
area_sq_m NUMERIC(15,2) NN
street_address VARCHAR(200)
locality VARCHAR(100)
landmark VARCHAR(100)
pincode VARCHAR(20)
tax_status VARCHAR(20)
masterplan_mismatch BOOLEAN NN
unauthorized_construction_suspected BOOLEAN NN
current_state JSON                      # denormalized snapshot
legal_status_severity SMALLINT NN       # precomputed governance columns
value_band SMALLINT NN
risk_score NUMERIC(5,2) NN
created_at DATETIME NN
updated_at DATETIME NN
```

### `parcel_identifiers` — multi-key identity
```
id UUID PK NN
parcel_id UUID NN → parcels.id
identifier_type VARCHAR(50) NN          # ULPIN / SURVEY_NUMBER / PLOT_NUMBER / LOCAL_PARCEL_ID
identifier_value VARCHAR(100) NN
source_state VARCHAR(10) NN
source_department VARCHAR(50) NN
```

### `parcel_neighbours`
```
id UUID PK NN · parcel_id VARCHAR NN · neighbour_parcel_id VARCHAR NN
relationship_type VARCHAR(20) NN        # adjacent / nearby / ...
```

### `road_networks`
```
id UUID PK NN · osm_id INTEGER NN · name VARCHAR(200) NN · road_type VARCHAR(30) NN
state_code VARCHAR(10) NN · district VARCHAR(40) NN
geometry geometry(LINESTRING,4326) NN · source VARCHAR(30) NN · osm_tags JSON · created_at DATETIME NN
```

### `building_footprints`
```
id UUID PK NN · building_type VARCHAR(30) NN · height_m NUMERIC(6,2) · confidence NUMERIC(3,2) NN
state_code VARCHAR(10) NN · district VARCHAR(40) NN
geometry geometry(POLYGON,4326) NN · source VARCHAR(30) NN · created_at DATETIME NN
```

### `land_cover`
```
id UUID PK NN · class_code INTEGER NN · class_name VARCHAR(50) NN · year INTEGER NN
state_code VARCHAR(10) NN · district VARCHAR(40) NN
geometry geometry(POLYGON,4326) NN · source VARCHAR(30) NN · created_at DATETIME NN
```

### `elevation_tiles`
```
id UUID PK NN · min/max/mean_elevation_m NUMERIC(8,2) NN · mean_slope_deg NUMERIC(5,2) NN
max_slope_deg NUMERIC(5,2) NN · slope_histogram JSON
state_code VARCHAR(10) NN · district VARCHAR(40) NN
geometry geometry(POLYGON,4326) NN · source VARCHAR(30) NN · ee_asset_id VARCHAR(200) · created_at DATETIME NN
```

### `parcel_terrain_profiles` — per-parcel derived terrain
```
id UUID PK NN · parcel_id UUID NN → parcels.id
mean/min/max_elevation_m NUMERIC(8,2) NN · elevation_range_m NUMERIC(8,2) NN
mean_slope_deg NUMERIC(5,2) NN · max_slope_deg NUMERIC(5,2) NN · steep_slope_percentage NUMERIC(5,2) NN
dominant_land_cover VARCHAR(50) NN · land_cover_mix JSON NN
nearest_road_distance_m NUMERIC(10,2) NN · nearest_road_type VARCHAR(30) · road_access_score NUMERIC(3,2) NN
building_count INTEGER NN · building_coverage_percentage NUMERIC(5,2) NN · building_density_per_ha NUMERIC(6,2) NN
```
---

## Essential governance — current records + history mirrors

Each department has a **current** record table and (for the mutable ones) a **`*_history_records`** append-only mirror capturing `changed_by` / `change_reason` / `case_id` per change.

### `ownership_history_records` (Record of Rights)
```
id UUID PK NN · parcel_id VARCHAR NN · owner_name VARCHAR(100) NN
transaction_type VARCHAR(20) NN · transaction_date DATE NN
document_reference VARCHAR(60) · khata_number VARCHAR(20)
```

### `registration_records` / `registration_history_records`
```
registration_records: id PK · parcel_id NN · registration_status VARCHAR(20) NN
  registration_number VARCHAR(40) · registration_date DATE
  last_transaction_type VARCHAR(30) · last_transaction_date DATE
registration_history_records: same + changed_by · change_reason VARCHAR(500) · case_id UUID · created_at NN
```

### `planning_records`
```
id PK · parcel_id NN · land_use VARCHAR(20) NN · zoning_classification VARCHAR(40) NN
master_plan_reference VARCHAR(60) NN · building_permission_status VARCHAR(20) NN
```

### `tax_records` / `tax_history_records`
```
tax_records: id PK · parcel_id NN · assessed_value NUMERIC(14,2) NN · annual_tax_amount NUMERIC(10,2) NN
  tax_status VARCHAR(20) NN · outstanding_amount NUMERIC(10,2) NN · last_payment_date DATE
  market_value_reference NUMERIC(14,2) · valuation_date DATE · valuation_source VARCHAR(60)
tax_history_records: same + year INTEGER NN · changed_by · change_reason VARCHAR(500) · case_id UUID · created_at NN
```

### `restriction_records` / `restriction_history_records`
```
restriction_records: id PK · parcel_id NN · has_restriction BOOLEAN NN · restriction_type VARCHAR(30)
  restriction_details VARCHAR(200) · imposing_authority VARCHAR(60)
restriction_history_records: same + changed_by · change_reason VARCHAR(500) · case_id UUID · created_at NN
```

### `encumbrance_records` / `encumbrance_history_records` / `encumbrance_certificates`
```
encumbrance_records: id PK · parcel_id NN · has_encumbrance BOOLEAN NN · encumbrance_type VARCHAR(20)
  lender_name VARCHAR(100) · instrument_reference VARCHAR(60) · registered_date DATE · discharge_date DATE
encumbrance_history_records: same + changed_by · change_reason · case_id · created_at NN
encumbrance_certificates: id PK · parcel_id NN · certificate_number VARCHAR(40) NN
  period_from/to DATE · has_encumbrance BOOLEAN NN · encumbrances_snapshot JSON
  storage_key VARCHAR(200) NN · issued_by VARCHAR(100) · issued_at DATETIME NN
```

### `dispute_records` / `dispute_history_records`
```
dispute_records: id PK · parcel_id NN · has_active_dispute BOOLEAN NN · dispute_type VARCHAR(30)
  case_status VARCHAR(20) · filing_date/resolution_date DATE · resolution_summary VARCHAR(200)
dispute_history_records: + dispute_id UUID · resolved_by · resolution_reason VARCHAR(500) · case_id · changed_by · created_at NN
```

### `survey_records` / `survey_documents`
```
survey_records: id PK · parcel_id NN · survey_status VARCHAR(20) NN · survey_type VARCHAR(30)
  measured_area_sq_m / original_area_sq_m / area_delta_sq_m NUMERIC(14,2)
  geometry_updated BOOLEAN NN · survey_date DATE · surveyor_notes VARCHAR(500) · reference_document VARCHAR(60)
survey_documents: id PK · parcel_id NN · survey_id VARCHAR · document_type VARCHAR(40) NN
  file_name VARCHAR(200) NN · content_type · storage_key VARCHAR(200) NN · description TEXT
  gps_lat/gps_lng FLOAT · verified BOOLEAN NN · verified_at · verified_by · uploaded_by · uploaded_at NN
```

### Spatial governance zones
```
zoning_overlays / restriction_zones: id PK · name VARCHAR(100) NN · restriction_type VARCHAR(30) NN
  state_code · district · geometry geometry(POLYGON,4326) NN · affected_parcel_ids ARRAY · created_at NN
```
> (`zoning_overlays` follows the same shape as `restriction_zones`.)

### `crop_records`
```
id PK · parcel_id NN · agricultural_year VARCHAR(10) NN · season VARCHAR(20) NN
crop_type VARCHAR(30) NN · crop_name VARCHAR(60) NN
irrigated_area_sq_m / unirrigated_area_sq_m / uncultivable_area_sq_m NUMERIC(12,2) NN
irrigation_source VARCHAR(30) · remark VARCHAR(120)
```

### `parcel_historical_states`
```
id PK · parcel_id NN · year INTEGER NN · land_use VARCHAR(40) · zoning_status VARCHAR(30)
restriction_status VARCHAR(30) · tax_status VARCHAR(20)
```

---

## Additional / derived layers

### `infrastructure_features`
```
id PK · name VARCHAR(100) NN · feature_type VARCHAR(30) NN · state_code · district
geometry geometry(GEOMETRY,4326) NN · created_at NN
```

### `change_detection_events`
```
id PK · description TEXT NN · state_code · district · geometry geometry(POLYGON,4326) NN
affected_parcel_ids ARRAY · detected_at DATETIME NN
```

### `governance_alerts` / `governance_rules`
```
governance_alerts: id PK · parcel_id NN · alert_type VARCHAR(40) NN · severity VARCHAR(20) NN
  source VARCHAR(40) NN · status VARCHAR(20) NN · explanation TEXT NN · reason TEXT · created_at NN
governance_rules: id PK · alert_type VARCHAR(40) NN · name VARCHAR(100) NN · description TEXT NN
  condition_config TEXT NN · default_severity VARCHAR(20) NN · explanation_template TEXT NN
  is_active BOOLEAN NN · department VARCHAR(40) · created_at/updated_at NN
```

### `admin_map_notes`
```
id PK · name VARCHAR(100) NN · notes TEXT · state_code NN · district NN
geometry geometry(GEOMETRY,4326) NN · created_by_user_id VARCHAR · created_at NN
```

---

## Users & identity

### `users`
```
id UUID PK NN
email VARCHAR · mobile_number VARCHAR · email_verified BOOLEAN NN · mobile_verified BOOLEAN NN
pending_email · pending_mobile_number
email_otp_code_hash · email_otp_expires_at · email_otp_sent_at · email_otp_attempts INTEGER NN
sms_otp_code_hash · sms_otp_expires_at · sms_otp_sent_at · sms_otp_attempts INTEGER NN
password_hash VARCHAR NN
token_version INTEGER NN                 # JWT revocation (no exp claim; bump to invalidate)
last_activity_at DATETIME                # idle-timeout support
name VARCHAR NN · role VARCHAR(30) NN
address · government_id_number · occupation · home_latitude/home_longitude FLOAT · district VARCHAR(40)
availability VARCHAR(20) · assigned_area VARCHAR(80)     # verifier fields (migration e3a4b5c60005)
google_id · google_picture · google_email_verified BOOLEAN NN
preferred_language VARCHAR(10) NN
notify_sms / notify_email / notify_in_app BOOLEAN NN     # notification prefs (migration f4b5c6d70006)
onboarding_completed BOOLEAN NN · created_at DATETIME NN
```

### `pending_registrations` — pre-account OTP flow
```
id PK · name NN · method VARCHAR(10) NN · email · mobile_number · password_hash NN
otp_code_hash · otp_expires_at · otp_sent_at · otp_attempts INTEGER NN · created_at NN
```

### `profile_fields` — dynamic profile field config
```
id PK · field_name VARCHAR(50) NN · field_label VARCHAR(100) NN · field_type VARCHAR(20) NN
field_options JSONB · is_required/is_editable BOOLEAN NN · display_order INTEGER NN · roles JSONB
validation_regex VARCHAR(200) · help_text VARCHAR(300) · is_active BOOLEAN NN · created_at/updated_at NN
```

---

## Case / workflow engine

### `cases`
```
id UUID PK NN · case_no VARCHAR(30) NN · citizen_id VARCHAR NN · parcel_id VARCHAR NN
intent VARCHAR(50) · status VARCHAR(20) NN · priority VARCHAR(20) · routing_decision JSON
sla_config_id UUID → sla_configs.id · created_at NN · resolved_at · closed_at
```

### `department_tasks`
```
id PK · case_id UUID NN → cases.id · department_id UUID NN → departments.id · workflow_id UUID → workflows.id
status VARCHAR(20) NN · assigned_officer_id · assigned_verifier_id · assigned_at
stage INTEGER NN · stage_name VARCHAR(100) · resolution_mode VARCHAR(30)
resolution_decision VARCHAR(20) · resolution_remarks TEXT
sla_threshold_hours / sla_warning_threshold / sla_breach_threshold NUMERIC(5,2)
created_at/updated_at NN · completed_at
```

### `case_timeline_events` — the case audit spine
```
id PK · case_id UUID NN → cases.id · task_id UUID · event_type VARCHAR(50) NN
actor_id · actor_role VARCHAR(30) · previous_state/new_state VARCHAR(100) · metadata JSON · created_at NN
```

### `proposed_field_changes` — pending officer edits (honest, non-destructive)
```
id PK · case_id UUID NN → cases.id · parcel_id NN · department VARCHAR(50) NN · field_name VARCHAR(100) NN
current_value TEXT · proposed_value TEXT NN · reason TEXT · proposed_by
status VARCHAR(20) NN · decided_by · decided_at · decision_remarks · created_at/updated_at NN
```

### `case_parcel_geometry_versions` — versioned geometry proposals
```
id PK · case_id UUID NN → cases.id · parcel_id NN · version_number INTEGER NN
geometry geometry(POLYGON,4326) NN · is_current/is_proposed BOOLEAN NN
change_reason VARCHAR(500) · changed_by · decision_id UUID · verification_id UUID · created_at NN
```

### `verification_evidence` — field verifier captures
```
id PK · workflow_id UUID → workflows.id · case_id UUID → cases.id · task_id UUID
evidence_id VARCHAR(30) NN · verifier_id VARCHAR NN
photo_file_name · photo_file_path · mime_type · latitude/longitude FLOAT NN · accuracy_m FLOAT
captured_at DATETIME NN · photo_hash VARCHAR(128) · sequence INTEGER · notes TEXT · created_at NN
```

### `case_applications` / `ai_analyses` / `routing_decisions` — AI intake
```
case_applications: id PK · case_id NN → cases.id · original_input TEXT · conversation JSON
  ai_interpretation JSON · ai_draft · citizen_edited_version · final_submitted_version
  generated_document_path VARCHAR(500) · generated_at · citizen_confirmed BOOLEAN NN
  citizen_confirmation_timestamp · created_at/updated_at NN
ai_analyses: id PK · case_id NN → cases.id · structured_understanding/facts_stated/facts_verified JSON
  departments_identified JSON · application_draft TEXT · follow_up_questions/conversation JSON · created_at/updated_at NN
routing_decisions: id PK · case_id NN → cases.id · departments_routed JSON
  workflow_per_department JSON · priority VARCHAR(20) · created_at NN
```

### `workflows` / `workflow_steps` / `workflow_pipeline_configs`
```
workflows: id PK · parcel_id NN · workflow_type VARCHAR(40) NN · current_status VARCHAR(20) NN
  created_by · request_details/last_remarks/routing_notes TEXT · citizen_id · assigned_verifier_id
  applicant_contact · applicant_address · verification_precheck TEXT
  evidence_file_name/path/mime_type · evidence_extracted_text TEXT
  evidence_authenticity_suspicious BOOLEAN · evidence_authenticity_reasons TEXT · created_at/updated_at NN
workflow_steps: id PK · workflow_id UUID NN → workflows.id · step_order INTEGER NN
  department VARCHAR(30) NN · assigned_role VARCHAR(40) NN · status VARCHAR(20) NN
  action VARCHAR(40) · remarks TEXT · completed_at
workflow_pipeline_configs: id PK · workflow_type VARCHAR(40) NN · stages_json TEXT NN · is_active BOOLEAN NN
  template VARCHAR(40) · definition_json TEXT · resolution_modes/decision_types JSON · conditions_json TEXT · created_at/updated_at NN
```

### `departments` / `sla_configs`
```
departments: id PK · code VARCHAR(40) NN · name VARCHAR(100) NN · description VARCHAR(300)
  contact_email · contact_phone · capabilities JSON · created_at/updated_at NN
sla_configs: id PK · workflow_id UUID → workflows.id · task_id UUID · department_id UUID → departments.id
  threshold_hours/warning_threshold/breach_threshold NUMERIC(5,2) NN · is_active BOOLEAN NN · created_at/updated_at NN
```

### `appointments` / `feedback`
```
appointments: id PK · case_id NN → cases.id · citizen_id NN · department_id NN → departments.id · officer_id
  office_location VARCHAR(200) · date DATETIME NN · time_slot · purpose VARCHAR(500) · required_documents JSON
  status VARCHAR(20) NN · remarks TEXT · created_at/updated_at NN · completed_at
feedback: id PK · case_id NN → cases.id · citizen_id NN · officer_id · department_id → departments.id · task_id
  category VARCHAR(40) · officer_rating/overall_case_rating NUMERIC(1,0) · type VARCHAR(30)
  comments TEXT · reasons JSON · is_anonymous BOOLEAN NN · created_at NN
```

---

## Citizen ↔ parcel & documents

### `citizen_parcels`
```
id PK · citizen_id UUID NN → users.id · parcel_id UUID NN → parcels.id
status VARCHAR(30) NN · local_id VARCHAR(100) · verification_report TEXT · created_at NN
```

### `parcel_documents`
```
id PK · parcel_id NN · document_type VARCHAR(40) NN · file_name NN · file_path NN · mime_type VARCHAR(40) NN
extracted_text TEXT · registration_status VARCHAR(20) NN · created_at NN
```

---

## Notifications & audit

### `notifications`
```
id PK · user_id VARCHAR NN · type VARCHAR(40) NN · title VARCHAR(120) NN · message TEXT NN
parcel_id · workflow_id · case_id · alert_id · read BOOLEAN NN · created_at NN
```

### `audit_logs`
```
id PK · user_id VARCHAR NN · user_role VARCHAR(30) NN · action VARCHAR(60) NN
entity_type VARCHAR(40) NN · entity_id · parcel_id · case_id · task_id · decision_id
previous_value/new_value/reason/metadata_json TEXT · created_at NN
```

---

## Interoperability demo (deliberately mismatched state schemas)

### `state_a_land_records`
```
record_id UUID PK NN · survey_number VARCHAR(50) NN · subdivision_number VARCHAR(20) NN
owner_name VARCHAR(100) NN · village_code VARCHAR(30) NN · area_hectares NUMERIC(10,4) NN · record_status VARCHAR(20) NN
```

### `state_b_land_records`
```
record_id UUID PK NN · plot_id VARCHAR(50) NN · holder_name VARCHAR(100) NN
locality_id VARCHAR(30) NN · land_extent_sqft NUMERIC(12,2) NN · record_category VARCHAR(30) NN
```

State A uses `survey_number`/`area_hectares`; State B uses `plot_id`/`land_extent_sqft`. Adapters map both into the canonical parcel — proving interoperability across genuinely different schemas and units.

---

## Async / offline plumbing

### `processing_jobs`
```
id PK · job_type VARCHAR(50) NN · payload JSONB NN · status VARCHAR(20) NN · result JSONB · error TEXT
created_at NN · started_at · completed_at · idempotency_key VARCHAR(100)
dataset_status JSONB · total_estimated_eecu/actual_eecu NUMERIC(10,3)      # Earth Engine cost tracking
```

### `processed_sync_operations` — offline sync idempotency ledger
```
id PK · operation_id VARCHAR(64) NN · owner_user_id VARCHAR(64) NN · entity_type VARCHAR(20) NN
status VARCHAR(20) NN · entity_id VARCHAR(64) · result JSONB · error TEXT
client_created_at · server_received_at DATETIME NN
```

---

## Migrations

Alembic, **51 migration files**, baseline `ff7c6e8d9c1f`. Recent notable ones:
- `b6c7d8e90008_evidence_client_token` — `verification_evidence.client_token` for offline-replay idempotency (API-02)
- `a5b6c7d80007_case_invariant_and_task_indexes` — indexes on `department_tasks`/proposed-field-change FKs + a case-invariant guard (DB-01/SEC-03)
- `e3a4b5c60005_add_verifier_fields` (2026-09-27) — `users.availability`, `users.assigned_area`
- `f4b5c6d70006_add_notification_prefs` — `users.notify_sms/notify_email/notify_in_app`
- `7c30732a9782_add_verifier_role_evidence` — verifier role + evidence

Apply with `alembic upgrade head` (required before running tests). Regenerate this doc's column detail any time by introspecting `Base.metadata` — see [07-DEV-SETUP.md](07-DEV-SETUP.md).

