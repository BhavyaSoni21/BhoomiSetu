"""Ported from backend/seed.ts.

Generates the same 5-cluster demo dataset (~200 parcels, department
records, demo accounts) against backend-py's own database
(bhoomisetu_py), using the shared parcel-generation/common package ported
earlier. Run inside the backend-py container: `python -m scripts.seed`.

Parcel documents below run the same real OCR pass as backend/seed.ts did
(`document_verification.ocr.extract_text`, ParcelsModule's own OCR port -
BACKLOG.md item 25).
"""

import bcrypt
import math
import random
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from geoalchemy2.shape import from_shape
from shapely.geometry import LineString, Point as ShapelyPoint, Polygon

from app.common.geo_utils import point_in_ring, polygon_distance_meters
from app.common.parcel_generation.cluster_generator import CLUSTER_CONFIGS, GeneratedParcel, Point, Ring, generate_cluster_parcels
from app.common.parcel_generation.parcel_category import CURRENT_YEAR
from app.common.parcel_generation.parcel_document_generator import ParcelDocumentFields, render_parcel_document_image
from app.document_verification.ocr import extract_text
from app.common.supabase_storage import ensure_storage_bucket_exists, upload_to_storage
from app.database import SessionLocal
from app.models.admin import Department
from app.models.department_record import (
    DisputeRecord,
    EncumbranceRecord,
    PlanningRecord,
    RegistrationRecord,
    RestrictionRecord,
    SurveyRecord,
    TaxRecord,
)
from app.models.governance import GovernanceAlert, GovernanceRule
from app.models.land_records import StateALandRecord, StateBLandRecord
from app.models.parcel import (
    CitizenParcel,
    CropRecord,
    OwnershipHistoryRecord,
    Parcel,
    ParcelDocument,
    ParcelHistoricalState,
    ParcelIdentifier,
    ParcelNeighbour,
)
from app.models.spatial import ChangeDetectionEvent, InfrastructureFeature, RestrictionZone, ZoningOverlay
from app.models.user import User
from app.models.verification_evidence import VerificationEvidence
from app.models.workflow import Workflow, WorkflowStep

SQM_PER_HECTARE = 10000
SQFT_PER_SQM = 10.7639
_NOW = date(2026, 9, 1)  # the app's fixed "current" date, not the real one - matches parcel_category.CURRENT_YEAR


def district_code(district: str) -> str:
    return district[:3].upper()


def rand_int(lo: int, hi: int) -> int:
    return random.randint(lo, hi)


def random_date(years_ago_max: int) -> date:
    days_ago = rand_int(0, years_ago_max * 365)
    return _NOW - timedelta(days=days_ago)


def weighted_pick(options):
    total = sum(weight for _, weight in options)
    roll = random.random() * total
    for value, weight in options:
        roll -= weight
        if roll <= 0:
            return value
    return options[-1][0]


FIRST_NAMES = ["Amit", "Priya", "Rahul", "Sneha", "Vikram", "Anjali", "Suresh", "Kavita", "Ravi", "Meera", "Arjun", "Pooja"]
LAST_NAMES = ["Sharma", "Patil", "Reddy", "Gupta", "Kumar", "Iyer", "Singh", "Deshmukh", "Nair", "Joshi"]


def random_person_name() -> str:
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


# Identifier types each state prioritizes, layered on top of the Local
# Parcel ID every parcel always gets. Nothing downstream depends on any one
# of these being present - identifier_type is a free-form string throughout.
IDENTIFIER_PROFILES = {
    "MH": [
        {"type": "SURVEY_NUMBER", "probability": 0.9, "format": lambda: f"{rand_int(1, 200)}/{rand_int(1, 12)}"},
        {"type": "ULPIN", "probability": 0.82, "format": lambda: f"ULPIN{rand_int(0, 999999):010d}"},
    ],
    "TN": [
        {"type": "SURVEY_NUMBER", "probability": 0.9, "format": lambda: f"{rand_int(1, 200)}/{rand_int(1, 12)}"},
        {"type": "SUBDIVISION_NUMBER", "probability": 0.7, "format": lambda: f"SUB-{rand_int(1, 999)}"},
        {"type": "ULPIN", "probability": 0.73, "format": lambda: f"ULPIN{rand_int(0, 999999):010d}"},
    ],
    "KA": [
        {"type": "SURVEY_NUMBER", "probability": 0.9, "format": lambda: f"{rand_int(1, 200)}/{rand_int(1, 12)}"},
        {"type": "HISSA_NUMBER", "probability": 0.6, "format": lambda: f"{rand_int(1, 50)}/{rand_int(1, 9)}"},
        {"type": "ULPIN", "probability": 0.73, "format": lambda: f"ULPIN{rand_int(0, 999999):010d}"},
    ],
    "DL": [
        {"type": "PLOT_NUMBER", "probability": 0.9, "format": lambda: f"P-{rand_int(1, 9999)}"},
        {"type": "PROPERTY_NUMBER", "probability": 0.6, "format": lambda: f"PROP-{rand_int(1, 99999)}"},
        {"type": "ULPIN", "probability": 0.73, "format": lambda: f"ULPIN{rand_int(0, 999999):010d}"},
    ],
    "CH": [
        {"type": "PLOT_NUMBER", "probability": 0.9, "format": lambda: f"SCO-{rand_int(1, 999)}"},
        {"type": "SECTOR_NUMBER", "probability": 0.7, "format": lambda: f"SECTOR-{rand_int(1, 47)}"},
        {"type": "ULPIN", "probability": 0.73, "format": lambda: f"ULPIN{rand_int(0, 999999):010d}"},
    ],
}

# Every other state (the one-city + one-village-per-state expansion) gets
# this generic profile rather than a hand-tuned one per state - nothing
# downstream treats identifier_type as anything but a free-form string, so
# there's no real cadastral-accuracy loss in not modeling each state's
# actual scheme.
_DEFAULT_IDENTIFIER_PROFILE = [
    {"type": "SURVEY_NUMBER", "probability": 0.9, "format": lambda: f"{rand_int(1, 200)}/{rand_int(1, 12)}"},
    {"type": "ULPIN", "probability": 0.78, "format": lambda: f"ULPIN{rand_int(0, 999999):010d}"},
]

LAND_USES = [("RESIDENTIAL", 5), ("COMMERCIAL", 2), ("AGRICULTURAL", 2), ("MIXED_USE", 1)]

TOUCH_EPSILON_M = 3  # matches the live ParcelsService's own TOUCHING threshold
NEARBY_RADIUS_M = 60  # wide enough to catch the generator's intentional small gaps (5-7m) plus genuinely close unrelated neighbours


@dataclass
class Bounds:
    min_lng: float
    min_lat: float
    max_lng: float
    max_lat: float


def bounds_of_rings(rings: list[Ring]) -> Bounds:
    min_lng, min_lat, max_lng, max_lat = float("inf"), float("inf"), float("-inf"), float("-inf")
    for ring in rings:
        for lng, lat in ring:
            min_lng, max_lng = min(min_lng, lng), max(max_lng, lng)
            min_lat, max_lat = min(min_lat, lat), max(max_lat, lat)
    return Bounds(min_lng, min_lat, max_lng, max_lat)


def build_zone_rectangle_from_bounds(bounds: Bounds, lat_frac_range: tuple[float, float]) -> Ring:
    """A rectangle spanning a fraction-of-bounds window (e.g. lat_frac_range
    (0, 0.5) = the southern half of the cluster's actual generated
    footprint) - works regardless of the cluster's actual irregular
    shape/orientation.
    """
    lat_span = bounds.max_lat - bounds.min_lat

    def jitter() -> float:
        return (random.random() - 0.5) * lat_span * 0.02

    margin = lat_span * 0.03
    min_lat = bounds.min_lat + lat_frac_range[0] * lat_span - margin
    max_lat = bounds.min_lat + lat_frac_range[1] * lat_span + margin
    lng_span = bounds.max_lng - bounds.min_lng
    min_lng = bounds.min_lng - lng_span * 0.03
    max_lng = bounds.max_lng + lng_span * 0.03

    ring: Ring = [
        (min_lng + jitter(), min_lat + jitter()),
        (max_lng + jitter(), min_lat + jitter()),
        (max_lng + jitter(), max_lat + jitter()),
        (min_lng + jitter(), max_lat + jitter()),
    ]
    ring.append(ring[0])
    return ring


def build_zone_around_point(center: Point, radius_meters: float, ref_lat: float) -> Ring:
    """A small irregular polygon (hand-jittered, 6-sided) centered on a
    real point and sized in meters - anchors a demo zone to wherever a
    cluster's parcels actually generated.
    """
    meters_per_deg_lat = 110540
    meters_per_deg_lng = 111320 * math.cos((ref_lat * math.pi) / 180)
    sides = 6
    ring: Ring = []
    for k in range(sides):
        theta = (k / sides) * 2 * math.pi + (random.random() - 0.5) * ((2 * math.pi) / sides) * 0.5
        r = radius_meters * (0.75 + random.random() * 0.4)
        dx = math.cos(theta) * r
        dy = math.sin(theta) * r
        ring.append((center[0] + dx / meters_per_deg_lng, center[1] + dy / meters_per_deg_lat))
    ring.append(ring[0])
    return ring


def build_zone_hitting_target(
    points: list, anchor: Point, ref_lat: float, target_range: tuple[int, int], start_radius_meters: float
) -> tuple[Ring, int]:
    """Grows/shrinks build_zone_around_point's radius until the number of
    centroids it captures lands in target_range, so a demo zone reliably
    affects "a plausible handful of parcels" regardless of how the
    randomized subdivision happened to lay out parcels near the chosen
    anchor this run.
    """
    radius = start_radius_meters
    ring = build_zone_around_point(anchor, radius, ref_lat)
    count = sum(1 for p in points if point_in_ring(p.centroid, ring))
    attempt = 0
    while attempt < 6 and (count < target_range[0] or count > target_range[1]):
        radius *= 1.35 if count < target_range[0] else 0.75
        ring = build_zone_around_point(anchor, radius, ref_lat)
        count = sum(1 for p in points if point_in_ring(p.centroid, ring))
        attempt += 1
    return ring, count


def pick_anchor(points: list, bounds: Bounds, target_lat_frac: float, target_lng_frac: float, avoid: Ring | None = None) -> Point:
    """The generated centroid closest to (target_lat_frac, target_lng_frac)
    within a cluster's bounding box, optionally excluding points already
    inside another zone.
    """
    lat_span = bounds.max_lat - bounds.min_lat
    lng_span = bounds.max_lng - bounds.min_lng
    best = points[0].centroid
    best_dist = float("inf")
    for p in points:
        if avoid and point_in_ring(p.centroid, avoid):
            continue
        lat_frac = (p.centroid[1] - bounds.min_lat) / lat_span
        lng_frac = (p.centroid[0] - bounds.min_lng) / lng_span
        dist = ((lat_frac - target_lat_frac) ** 2 + (lng_frac - target_lng_frac) ** 2) ** 0.5
        if dist < best_dist:
            best_dist = dist
            best = p.centroid
    return best


@dataclass
class ClusterParcelEntry:
    parcel: Parcel
    ring: Ring
    centroid: Point


def compute_neighbour_rows(entries: list[ClusterParcelEntry], ref_lat: float) -> list[ParcelNeighbour]:
    """Real geometric TOUCHING/NEARBY classification, computed once at seed
    time over every pair of parcels within a cluster - an exact shared edge
    -> distance 0 -> TOUCHING; an intentional small gap -> distance a few
    metres -> NEARBY.
    """
    rows: list[ParcelNeighbour] = []
    for i in range(len(entries)):
        for j in range(i + 1, len(entries)):
            distance = polygon_distance_meters(entries[i].ring, entries[j].ring, ref_lat)
            if distance > NEARBY_RADIUS_M:
                continue
            relationship_type = "TOUCHING" if distance <= TOUCH_EPSILON_M else "NEARBY"
            rows.append(ParcelNeighbour(parcel_id=str(entries[i].parcel.id), neighbour_parcel_id=str(entries[j].parcel.id), relationship_type=relationship_type))
            rows.append(ParcelNeighbour(parcel_id=str(entries[j].parcel.id), neighbour_parcel_id=str(entries[i].parcel.id), relationship_type=relationship_type))
    return rows


def _polygon(ring: Ring) -> Polygon:
    return from_shape(Polygon(ring), srid=4326)


def _seed_governance_rules(db) -> None:
    """Seed default governance rules that replicate the previous hardcoded behavior.

    These rules can be modified by admins via the admin API.
    """
    from app.models.governance import GovernanceRule
    import json

    # Check if rules already exist
    existing = db.query(GovernanceRule).count()
    if existing > 0:
        print(f"Governance rules already seeded ({existing} rules), skipping")
        return

    default_rules = [
        # RESTRICTION_ZONE_OVERLAP - triggers when parcel intersects a restriction zone
        GovernanceRule(
            alert_type="RESTRICTION_ZONE_OVERLAP",
            name="Restriction Zone Overlap Detection",
            description="Creates an alert when a parcel intersects any admin-defined restriction zone (flood, environmental, protected area)",
            condition_config=json.dumps({"intersects": True}),
            default_severity="MEDIUM",
            explanation_template="This parcel intersects an admin-defined restriction zone ({zone_name}). Any land-use change or construction request here should be reviewed against the zone's regulations before approval.",
            is_active=True,
            department="RESTRICTION",
        ),
        # UNAUTHORIZED_CHANGE_DETECTED - triggers on significant imagery changes
        GovernanceRule(
            alert_type="UNAUTHORIZED_CHANGE_DETECTED",
            name="Unauthorized Change Detection (Imagery Comparison)",
            description="Creates an alert when before/after imagery comparison detects physical changes above threshold",
            condition_config=json.dumps({"min_pixel_ratio": 0.01}),
            default_severity="HIGH",
            explanation_template="Comparison of before/after imagery flagged a physical change ({changed_pixel_ratio:.1%} of analyzed area) affecting this parcel that is not yet reflected in official land records. Recommend officer review.",
            is_active=True,
            department="LAND_RECORDS",
        ),
        # RESTRICTION_DETECTED - triggers when parcel becomes restricted in historical comparison
        GovernanceRule(
            alert_type="RESTRICTION_DETECTED",
            name="Restriction Detected (Historical Imagery)",
            description="Creates an alert when a parcel's restriction status changes to RESTRICTED in year-over-year comparison",
            condition_config=json.dumps({"categories": ["RESTRICTED"]}),
            default_severity="MEDIUM",
            explanation_template="This parcel's recorded restriction status became RESTRICTED in {to_year}.",
            is_active=True,
            department="RESTRICTION",
        ),
        # DISPUTE_DETECTED - triggers when parcel has dispute category in historical comparison
        GovernanceRule(
            alert_type="DISPUTE_DETECTED",
            name="Dispute Detected (Historical Imagery)",
            description="Creates an alert when a parcel shows a dispute category in year-over-year comparison",
            condition_config=json.dumps({"categories": ["DISPUTE_OWNERSHIP", "DISPUTE_BOUNDARY", "DISPUTE_INHERITANCE", "DISPUTE_ENCROACHMENT"]}),
            default_severity="HIGH",
            explanation_template="Dispute record on file: {to_category_display}, status {dispute_status}.",
            is_active=True,
            department="DISPUTE",
        ),
        # TAX_OVERDUE - triggers when tax is overdue
        GovernanceRule(
            alert_type="TAX_OVERDUE",
            name="Tax Overdue Detection",
            description="Creates an alert when a parcel has overdue property tax above threshold",
            condition_config=json.dumps({"min_overdue_amount": 100}),
            default_severity="LOW",
            explanation_template="Outstanding property tax of {overdue_amount} is overdue.",
            is_active=True,
            department="TAX",
        ),
    ]

    for rule in default_rules:
        db.add(rule)
    db.flush()
    print(f"Seeded {len(default_rules)} default governance rules")


def seed_database() -> None:
    print("Starting database seeding...")
    db = SessionLocal()

    try:
        # Reset so re-running this script always leaves the same parcel
        # count. Order matters: children before the parents they reference
        # (Postgres refuses to delete a row another table's live FK still
        # points at).
        tables_to_clear = [
            VerificationEvidence, WorkflowStep, Workflow, Department, ParcelDocument, CitizenParcel, User, GovernanceAlert, DisputeRecord, RegistrationRecord,
            PlanningRecord, TaxRecord, RestrictionRecord, EncumbranceRecord, OwnershipHistoryRecord, CropRecord,
            ParcelHistoricalState,
            StateALandRecord, StateBLandRecord,
            ParcelNeighbour, ParcelIdentifier, ChangeDetectionEvent, RestrictionZone,
            ZoningOverlay, InfrastructureFeature, Parcel,
        ]
        for model in tables_to_clear:
            db.query(model).delete()
        db.flush()
        print("Cleared existing spatial demo data")

        # --- PHASE 1: generate every cluster's irregular parcel geometry up
        # front, before building any DB entities.
        generated_by_cluster: dict[str, list[GeneratedParcel]] = {}
        for config in CLUSTER_CONFIGS:
            generated = generate_cluster_parcels(config)
            generated_by_cluster[config.cluster_id] = generated
            print(f"Generated {len(generated)} irregular parcels for cluster {config.cluster_id}")

        pune = CLUSTER_CONFIGS[0]
        pune_generated = generated_by_cluster[pune.cluster_id]
        pune_bounds = bounds_of_rings([p.ring for p in pune_generated])

        # Built up front so the Restriction department mock can flag
        # parcels inside it while iterating.
        flood_anchor = pick_anchor(pune_generated, pune_bounds, 0.5, 0.45)
        flood_ring, flood_expected_count = build_zone_hitting_target(pune_generated, flood_anchor, pune.center_lat, (8, 18), 320)
        print(f"Flood zone anchored, expecting to affect ~{flood_expected_count} parcels")

        canonical_seq = 10000
        identifiers_to_save: list[ParcelIdentifier] = []

        def add_identifier(identifier: ParcelIdentifier) -> None:
            # Added to the session immediately (not just collected here)
            # since `identifier.parcel` points at an already-flushed,
            # persistent Parcel - leaving it un-added until the bulk
            # db.add_all() far below trips a SQLAlchemy SAWarning on every
            # later db.flush() in between ("not in session, add operation
            # ... will not proceed").
            db.add(identifier)
            identifiers_to_save.append(identifier)

        neighbour_rows_to_save: list[ParcelNeighbour] = []
        state_a_records_to_save: list[StateALandRecord] = []
        state_b_records_to_save: list[StateBLandRecord] = []

        registration_records_to_save: list[RegistrationRecord] = []
        planning_records_to_save: list[PlanningRecord] = []
        tax_records_to_save: list[TaxRecord] = []
        restriction_records_to_save: list[RestrictionRecord] = []
        dispute_records_to_save: list[DisputeRecord] = []
        encumbrance_records_to_save: list[EncumbranceRecord] = []
        survey_records_to_save: list[SurveyRecord] = []
        ownership_history_records_to_save: list[OwnershipHistoryRecord] = []
        crop_records_to_save: list[CropRecord] = []
        parcel_historical_states_to_save: list[ParcelHistoricalState] = []

        ensure_storage_bucket_exists()

        pune_entries: list[ClusterParcelEntry] = []
        all_saved_parcels: list[Parcel] = []
        parcel_document_info_by_id: dict[str, dict] = {}

        # --- PHASE 2: build DB entities + every per-parcel department
        # record from the pre-generated geometry ---
        for config in CLUSTER_CONFIGS:
            dist_code = district_code(config.district)
            generated = generated_by_cluster[config.cluster_id]
            cluster_entries: list[ClusterParcelEntry] = []

            for gp in generated:
                profile = IDENTIFIER_PROFILES.get(config.state_code, _DEFAULT_IDENTIFIER_PROFILE)
                ulpin_entry = next((p for p in profile if p["type"] == "ULPIN"), None)
                has_ulpin = bool(ulpin_entry and random.random() < ulpin_entry["probability"])

                parcel = Parcel(
                    canonical_parcel_id=f"CAN{canonical_seq:05d}",
                    cluster_id=config.cluster_id,
                    ulpin=ulpin_entry["format"]() if has_ulpin else None,
                    state_code=config.state_code,
                    district_code=dist_code,
                    local_body_code=f"{config.state_code}LB{rand_int(0, 999):03d}",
                    geometry=_polygon(gp.ring),
                    area_sq_m=gp.area_sq_m,
                )
                canonical_seq += 1
                db.add(parcel)
                db.flush()

                entry = ClusterParcelEntry(parcel=parcel, ring=gp.ring, centroid=gp.centroid)
                cluster_entries.append(entry)
                all_saved_parcels.append(parcel)
                if config.district == "Pune":
                    pune_entries.append(entry)

                # The identifier value a Land Records lookup-by-parcel would
                # use to resolve into the state schema below - computed once
                # and reused for both the parcel_identifiers row *and* the
                # state record.
                primary_identifier_value: str | None = None
                current_owner_name: str | None = None
                if config.state_code == "MH":
                    primary_identifier_value = f"{rand_int(1, 200)}/{rand_int(1, 12)}"
                    current_owner_name = random_person_name()
                    state_a_records_to_save.append(
                        StateALandRecord(
                            survey_number=primary_identifier_value,
                            subdivision_number=str(rand_int(1, 9)),
                            owner_name=current_owner_name,
                            village_code=f"VIL{rand_int(1, 40):03d}",
                            area_hectares=round(float(parcel.area_sq_m) / SQM_PER_HECTARE, 4),
                            record_status="ACTIVE",
                        )
                    )
                elif config.state_code == "DL":
                    primary_identifier_value = f"P-{rand_int(1000, 9999)}"
                    current_owner_name = random_person_name()
                    state_b_records_to_save.append(
                        StateBLandRecord(
                            plot_id=primary_identifier_value,
                            holder_name=current_owner_name,
                            locality_id=f"LOC{rand_int(1, 40):03d}",
                            land_extent_sqft=round(float(parcel.area_sq_m) * SQFT_PER_SQM, 2),
                            record_category="Urban",
                        )
                    )
                parcel_document_info_by_id[str(parcel.id)] = {
                    "owner_name": current_owner_name or random_person_name(),
                    "identifier_value": primary_identifier_value,
                }

                # --- mock department records, one per parcel every cluster ---
                is_registered = random.random() < 0.75
                registration_records_to_save.append(
                    RegistrationRecord(
                        parcel_id=str(parcel.id),
                        registration_status="REGISTERED" if is_registered else weighted_pick([("PENDING", 2), ("NOT_REGISTERED", 1)]),
                        registration_number=f"REG-{config.state_code}-{rand_int(100000, 999999)}" if is_registered else None,
                        registration_date=random_date(10) if is_registered else None,
                        last_transaction_type=weighted_pick([("SALE", 3), ("GIFT", 1), ("INHERITANCE", 1), ("PARTITION", 1)]) if is_registered else None,
                        last_transaction_date=random_date(5) if is_registered else None,
                    )
                )

                # Pune's land_use mirrors the latitude-banded zoning built
                # below so the Planning mock agrees with the GIS zoning
                # overlay instead of being independently random.
                if config.district == "Pune":
                    lat_frac = (gp.centroid[1] - pune_bounds.min_lat) / (pune_bounds.max_lat - pune_bounds.min_lat)
                    land_use = "RESIDENTIAL" if lat_frac < 0.5 else "COMMERCIAL" if lat_frac < 0.7 else "AGRICULTURAL"
                else:
                    land_use = weighted_pick(LAND_USES)
                planning_records_to_save.append(
                    PlanningRecord(
                        parcel_id=str(parcel.id),
                        land_use=land_use,
                        zoning_classification=f"{land_use[:1]}{land_use[1:].lower()}-{rand_int(1, 4)}",
                        master_plan_reference=f"{config.district} Master Plan {2020 + rand_int(0, 5)}",
                        building_permission_status="NOT_REQUIRED" if land_use == "AGRICULTURAL" else weighted_pick([("APPROVED", 3), ("PENDING", 1), ("NOT_REQUIRED", 1)]),
                    )
                )

                # Crop register (Form 12) - only ever seeded for
                # AGRICULTURAL parcels, since a residential/commercial
                # parcel genuinely has no crop history. One row for the
                # current agricultural year.
                if land_use == "AGRICULTURAL":
                    crop_name_en, crop_type = random.choice([
                        ("Paddy (Rice)", "FOOD_CROP"), ("Wheat", "FOOD_CROP"), ("Sugarcane", "CASH_CROP"),
                        ("Cotton", "CASH_CROP"), ("Vegetables", "HORTICULTURE"),
                    ])
                    irrigated_fraction = random.random()
                    irrigated_area = round(float(parcel.area_sq_m) * irrigated_fraction, 2)
                    unirrigated_area = round(float(parcel.area_sq_m) - irrigated_area, 2)
                    crop_records_to_save.append(
                        CropRecord(
                            parcel_id=str(parcel.id),
                            agricultural_year=f"{CURRENT_YEAR - 1}-{str(CURRENT_YEAR)[2:]}",
                            season=weighted_pick([("KHARIF", 3), ("RABI", 2), ("SUMMER", 1)]),
                            crop_type=crop_type,
                            crop_name=crop_name_en,
                            irrigated_area_sq_m=irrigated_area,
                            unirrigated_area_sq_m=unirrigated_area,
                            irrigation_source=weighted_pick([("WELL", 3), ("BOREWELL", 2), ("CANAL", 2), ("RAINFED", 1)]) if irrigated_area > 0 else None,
                            uncultivable_area_sq_m=0,
                            remark=None,
                        )
                    )

                rate_per_sqm = rand_int(300, 3000)
                assessed_value = round(float(parcel.area_sq_m) * rate_per_sqm, 2)
                annual_tax_amount = round(assessed_value * (0.003 + random.random() * 0.007), 2)
                tax_status = weighted_pick([("PAID", 6), ("PENDING", 3), ("OVERDUE", 1)])
                # An independent market/circle-rate figure within a
                # plausible spread of the tax authority's own assessed
                # value, not derived from it.
                market_value_reference = round(assessed_value * (0.85 + random.random() * 0.4), 2)
                tax_records_to_save.append(
                    TaxRecord(
                        parcel_id=str(parcel.id),
                        assessed_value=assessed_value,
                        annual_tax_amount=annual_tax_amount,
                        tax_status=tax_status,
                        outstanding_amount=0 if tax_status == "PAID" else round(annual_tax_amount * (1 if tax_status == "OVERDUE" else 0.5), 2),
                        last_payment_date=random_date(1) if tax_status == "PAID" else random_date(2) if tax_status == "PENDING" else None,
                        market_value_reference=market_value_reference,
                        valuation_date=random_date(2),
                        valuation_source=weighted_pick([("CIRCLE_RATE", 2), ("COMPARABLE_SALE", 1)]),
                    )
                )

                # Pune parcels inside the flood zone are flagged consistent
                # with the spatial RestrictionZone built below; everyone
                # else gets a small independent chance of a flag.
                in_flood_zone = config.district == "Pune" and point_in_ring(gp.centroid, flood_ring)
                has_restriction = in_flood_zone or random.random() < 0.08
                restriction_type = (
                    "FLOOD_PRONE" if in_flood_zone else weighted_pick([("ENVIRONMENTAL", 1), ("PROTECTED_AREA", 1)]) if has_restriction else None
                )
                restriction_records_to_save.append(
                    RestrictionRecord(
                        parcel_id=str(parcel.id),
                        has_restriction=has_restriction,
                        restriction_type=restriction_type,
                        restriction_details=(
                            "Parcel falls within the designated flood-prone restriction zone"
                            if restriction_type == "FLOOD_PRONE"
                            else f"Parcel flagged for {restriction_type.lower().replace('_', ' ')} review"
                            if has_restriction
                            else None
                        ),
                        imposing_authority=f"{config.state_code} State Environment Authority" if has_restriction else None,
                    )
                )

                # Dispute: same "every parcel gets a record" pattern as the
                # other mock departments, so a citizen/officer always gets a
                # real 200 rather than a 404. ~12% of parcels get a real
                # dispute on file.
                has_dispute = random.random() < 0.12
                dispute_type = weighted_pick([("OWNERSHIP", 3), ("BOUNDARY", 3), ("INHERITANCE", 2), ("ENCROACHMENT", 2)]) if has_dispute else None
                case_status = weighted_pick([("FILED", 2), ("UNDER_REVIEW", 2), ("RESOLVED", 3), ("DISMISSED", 1)]) if has_dispute else None
                is_closed_case = case_status in ("RESOLVED", "DISMISSED")
                has_active_dispute = case_status in ("FILED", "UNDER_REVIEW")
                dispute_records_to_save.append(
                    DisputeRecord(
                        parcel_id=str(parcel.id),
                        has_active_dispute=has_active_dispute,
                        dispute_type=dispute_type,
                        case_status=case_status,
                        filing_date=random_date(3) if has_dispute else None,
                        resolution_date=random_date(1) if is_closed_case else None,
                        resolution_summary=(
                            f"Dispute resolved in favor of the recorded owner following {dispute_type.lower()} review."
                            if is_closed_case and case_status == "RESOLVED"
                            else "Case dismissed for insufficient evidence."
                            if is_closed_case
                            else None
                        ),
                    )
                )

                # Encumbrance/mortgage: same "independent per-parcel record"
                # pattern as Dispute above, ~17% of parcels carry an active
                # mortgage/lien/charge.
                has_encumbrance = random.random() < 0.17
                encumbrance_type = weighted_pick([("MORTGAGE", 3), ("LIEN", 1), ("CHARGE", 1)]) if has_encumbrance else None
                encumbrance_records_to_save.append(
                    EncumbranceRecord(
                        parcel_id=str(parcel.id),
                        has_encumbrance=has_encumbrance,
                        encumbrance_type=encumbrance_type,
                        lender_name=f"{random.choice(LAST_NAMES)} Co-operative Bank" if has_encumbrance else None,
                        instrument_reference=f"{encumbrance_type}-{rand_int(100000, 999999)}" if has_encumbrance else None,
                        registered_date=random_date(8) if has_encumbrance else None,
                        discharge_date=None,
                    )
                )

                # Survey measurement: ~10% of parcels have a survey on file
                # (boundary verification, area correction, or demarcation).
                # Completed surveys may have measured area different from
                # the RoR area, triggering cross-dept updates.
                has_survey = random.random() < 0.10
                survey_type = weighted_pick([("BOUNDARY_VERIFICATION", 4), ("AREA_CORRECTION", 3), ("DEMARCATION", 2), ("GEOMETRY_CORRECTION", 1)]) if has_survey else None
                survey_status = weighted_pick([("PENDING", 2), ("IN_PROGRESS", 1), ("COMPLETED", 4), ("NO_CHANGE", 1)]) if has_survey else "PENDING"
                original_area = float(parcel.area_sq_m)
                measured_area = None
                area_delta = None
                geometry_updated = False
                if has_survey and survey_status in ("COMPLETED", "NO_CHANGE"):
                    # For AREA_CORRECTION and GEOMETRY_CORRECTION, simulate
                    # a measured area that may differ from the original
                    if survey_type in ("AREA_CORRECTION", "GEOMETRY_CORRECTION"):
                        # ±5% variation
                        variation = (random.random() - 0.5) * 0.10
                        measured_area = round(original_area * (1 + variation), 2)
                        area_delta = round(measured_area - original_area, 2)
                        geometry_updated = survey_type == "GEOMETRY_CORRECTION"
                    else:
                        # Boundary verification and demarcation typically
                        # confirm the existing area
                        measured_area = original_area
                        area_delta = 0.0
                        geometry_updated = False
                survey_records_to_save.append(
                    SurveyRecord(
                        parcel_id=str(parcel.id),
                        survey_status=survey_status,
                        survey_type=survey_type,
                        measured_area_sq_m=measured_area,
                        original_area_sq_m=original_area if has_survey else None,
                        area_delta_sq_m=area_delta,
                        geometry_updated=geometry_updated,
                        survey_date=random_date(2) if has_survey and survey_status != "PENDING" else None,
                        surveyor_notes=(
                            f"{survey_type.replace('_', ' ').title()} completed. Area delta: {area_delta:+.2f} sq m."
                            if has_survey and survey_status == "COMPLETED"
                            else f"Field visit scheduled for {survey_type.replace('_', ' ').lower()}."
                            if has_survey and survey_status in ("PENDING", "IN_PROGRESS")
                            else None
                        ),
                        reference_document=(
                            weighted_pick([("FIELD_BOOK_REF", 2), ("GPS_LOG", 2), ("DRONE_IMAGERY", 1)])
                            if has_survey and survey_status == "COMPLETED"
                            else None
                        ),
                    )
                )

                # Ownership history - a representative subset of parcels,
                # 1-3 prior owners each, ending at whichever name the state
                # schema recorded as current owner/holder when one exists.
                if random.random() < 0.5:
                    prior_owner_count = rand_int(1, 3)
                    entry_count = prior_owner_count + 1  # + the current owner
                    # Dates drawn independently, then sorted oldest-first,
                    # so the chain is always strictly chronological.
                    dates = sorted(random_date(20) for _ in range(entry_count))
                    for k, transaction_date in enumerate(dates):
                        ownership_history_records_to_save.append(
                            OwnershipHistoryRecord(
                                parcel_id=str(parcel.id),
                                owner_name=(current_owner_name or random_person_name()) if k == entry_count - 1 else random_person_name(),
                                transaction_type="ORIGINAL" if k == 0 else weighted_pick([("SALE", 3), ("GIFT", 1), ("INHERITANCE", 1), ("PARTITION", 1)]),
                                transaction_date=transaction_date,
                                document_reference=None if k == 0 else f"DEED-{rand_int(100000, 999999)}",
                                khata_number=str(rand_int(1000, 9999)),
                            )
                        )

                # Attribute-level history per year, 2022-2026. CURRENT_YEAR
                # is the anchor: its row always matches this parcel's own
                # current land_use/has_restriction/tax_status computed
                # above, not independently random. Walking backward, each
                # earlier year has a small independent chance of differing
                # from the year after it.
                history_land_use = land_use
                history_zoning = weighted_pick([("APPROVED", 3), ("PENDING", 1), ("NOT_REQUIRED", 1)])
                history_restriction = "RESTRICTED" if has_restriction else "UNRESTRICTED"
                history_tax = tax_status
                for year in (CURRENT_YEAR, 2025, 2024, 2023, 2022):
                    parcel_historical_states_to_save.append(
                        ParcelHistoricalState(
                            parcel_id=str(parcel.id),
                            year=year,
                            land_use=history_land_use,
                            zoning_status=history_zoning,
                            restriction_status=history_restriction,
                            tax_status=history_tax,
                        )
                    )
                    if random.random() < 0.12:
                        history_land_use = weighted_pick(LAND_USES)
                    if random.random() < 0.12:
                        history_zoning = weighted_pick([("APPROVED", 3), ("PENDING", 1), ("NOT_REQUIRED", 1)])
                    if random.random() < 0.1:
                        history_restriction = "UNRESTRICTED" if history_restriction == "RESTRICTED" else "RESTRICTED"
                    if random.random() < 0.15:
                        history_tax = weighted_pick([("PAID", 6), ("PENDING", 3), ("OVERDUE", 1)])

                # Local Parcel ID - every parcel, every state.
                add_identifier(
                    ParcelIdentifier(
                        parcel=parcel,
                        identifier_type="LOCAL_PARCEL_ID",
                        identifier_value=f"{config.state_code}-{dist_code}-{rand_int(0, 9999):04d}",
                        source_state=config.state_code,
                        source_department="Land Records",
                    )
                )

                # State-specific identifiers (ULPIN already folded into
                # parcel.ulpin above, but also recorded here so it's
                # discoverable through parcel_identifiers too).
                if has_ulpin:
                    add_identifier(
                        ParcelIdentifier(
                            parcel=parcel,
                            identifier_type="ULPIN",
                            identifier_value=parcel.ulpin,
                            source_state=config.state_code,
                            source_department="Land Records",
                        )
                    )
                for profile_entry in profile:
                    if profile_entry["type"] == "ULPIN":
                        continue
                    is_primary_type = (config.state_code == "MH" and profile_entry["type"] == "SURVEY_NUMBER") or (
                        config.state_code == "DL" and profile_entry["type"] == "PLOT_NUMBER"
                    )
                    if random.random() < profile_entry["probability"]:
                        add_identifier(
                            ParcelIdentifier(
                                parcel=parcel,
                                identifier_type=profile_entry["type"],
                                identifier_value=primary_identifier_value if (is_primary_type and primary_identifier_value) else profile_entry["format"](),
                                source_state=config.state_code,
                                source_department="Land Records",
                            )
                        )

            neighbour_rows_to_save.extend(compute_neighbour_rows(cluster_entries, config.center_lat))
            print(f"Built {len(cluster_entries)} parcel entities + department records for cluster {config.cluster_id}")

        db.flush()
        print(f"Saved {len(identifiers_to_save)} parcel identifiers")

        db.add_all(state_a_records_to_save)
        db.flush()
        print(f"Saved {len(state_a_records_to_save)} State A land records (Pune/MH)")
        db.add_all(state_b_records_to_save)
        db.flush()
        print(f"Saved {len(state_b_records_to_save)} State B land records (New Delhi/DL)")

        db.add_all(registration_records_to_save)
        db.flush()
        print(f"Saved {len(registration_records_to_save)} registration records")
        db.add_all(planning_records_to_save)
        db.flush()
        print(f"Saved {len(planning_records_to_save)} planning records")
        db.add_all(tax_records_to_save)
        db.flush()
        print(f"Saved {len(tax_records_to_save)} tax records")
        db.add_all(restriction_records_to_save)
        db.flush()
        print(f"Saved {len(restriction_records_to_save)} restriction records")
        db.add_all(dispute_records_to_save)
        db.flush()
        print(f"Saved {len(dispute_records_to_save)} dispute records")
        db.add_all(encumbrance_records_to_save)
        db.flush()
        print(f"Saved {len(encumbrance_records_to_save)} encumbrance records")
        db.add_all(survey_records_to_save)
        db.flush()
        print(f"Saved {len(survey_records_to_save)} survey records")
        db.add_all(ownership_history_records_to_save)
        db.flush()
        print(f"Saved {len(ownership_history_records_to_save)} ownership history records")
        db.add_all(crop_records_to_save)
        db.flush()
        print(f"Saved {len(crop_records_to_save)} crop records")
        db.add_all(parcel_historical_states_to_save)
        db.flush()
        print(f"Saved {len(parcel_historical_states_to_save)} parcel historical state records")
        db.add_all(neighbour_rows_to_save)
        db.flush()
        print(f"Saved {len(neighbour_rows_to_save)} explicit neighbour relationships (TOUCHING + NEARBY)")

        # --- Pune spatial demo layers ---
        def find_pune_parcel_ids(predicate) -> list[str]:
            return [
                str(p.parcel.id)
                for p in pune_entries
                if predicate((p.centroid[1] - pune_bounds.min_lat) / (pune_bounds.max_lat - pune_bounds.min_lat))
            ]

        db.add_all(
            [
                ZoningOverlay(
                    name="Pune Residential Zone", zone_type="RESIDENTIAL", state_code=pune.state_code, district=pune.district,
                    geometry=_polygon(build_zone_rectangle_from_bounds(pune_bounds, (0, 0.5))),
                    parcel_ids=find_pune_parcel_ids(lambda f: f < 0.5),
                ),
                ZoningOverlay(
                    name="Pune Commercial Zone", zone_type="COMMERCIAL", state_code=pune.state_code, district=pune.district,
                    geometry=_polygon(build_zone_rectangle_from_bounds(pune_bounds, (0.5, 0.7))),
                    parcel_ids=find_pune_parcel_ids(lambda f: 0.5 <= f < 0.7),
                ),
                ZoningOverlay(
                    name="Pune Agricultural / Open Zone", zone_type="AGRICULTURAL", state_code=pune.state_code, district=pune.district,
                    geometry=_polygon(build_zone_rectangle_from_bounds(pune_bounds, (0.7, 1))),
                    parcel_ids=find_pune_parcel_ids(lambda f: f >= 0.7),
                ),
            ]
        )
        db.flush()
        print("Saved 3 zoning overlays for Pune (residential/commercial/agricultural)")

        # Flood restriction zone (built earlier, before the parcel loop, so
        # the Restriction department mock could flag parcels inside it
        # while iterating).
        flood_affected_ids = [str(p.parcel.id) for p in pune_entries if point_in_ring(p.centroid, flood_ring)]
        db.add(
            RestrictionZone(
                name="Pune Flood-Prone Restriction Zone", restriction_type="FLOOD", state_code=pune.state_code, district=pune.district,
                geometry=_polygon(flood_ring), affected_parcel_ids=flood_affected_ids,
            )
        )
        db.flush()
        print(f"Saved flood restriction zone affecting {len(flood_affected_ids)} parcels")

        # Infrastructure: a road bisecting the cluster, a water line
        # crossing it, and two electricity points near opposite corners of
        # Pune's actual generated bounding box.
        pune_lng_span = pune_bounds.max_lng - pune_bounds.min_lng
        pune_lat_span = pune_bounds.max_lat - pune_bounds.min_lat
        pune_center_lng = (pune_bounds.min_lng + pune_bounds.max_lng) / 2
        pune_center_lat = (pune_bounds.min_lat + pune_bounds.max_lat) / 2
        overshoot = 0.08  # slight overhang past the bounding box, matching the old grid-half-span's "+0.5 cell" overshoot
        db.add_all(
            [
                InfrastructureFeature(
                    name="Pune Main Road", feature_type="ROAD", state_code=pune.state_code, district=pune.district,
                    geometry=from_shape(
                        LineString([
                            (pune_bounds.min_lng - pune_lng_span * overshoot, pune_center_lat),
                            (pune_bounds.max_lng + pune_lng_span * overshoot, pune_center_lat),
                        ]),
                        srid=4326,
                    ),
                ),
                InfrastructureFeature(
                    name="Pune Water Utility Line", feature_type="WATER_LINE", state_code=pune.state_code, district=pune.district,
                    geometry=from_shape(
                        LineString([
                            (pune_center_lng, pune_bounds.min_lat - pune_lat_span * overshoot),
                            (pune_center_lng, pune_bounds.max_lat + pune_lat_span * overshoot),
                        ]),
                        srid=4326,
                    ),
                ),
                InfrastructureFeature(
                    name="Pune Substation A", feature_type="ELECTRICITY", state_code=pune.state_code, district=pune.district,
                    geometry=from_shape(ShapelyPoint(pune_bounds.min_lng + pune_lng_span * 0.05, pune_bounds.min_lat + pune_lat_span * 0.05), srid=4326),
                ),
                InfrastructureFeature(
                    name="Pune Substation B", feature_type="ELECTRICITY", state_code=pune.state_code, district=pune.district,
                    geometry=from_shape(ShapelyPoint(pune_bounds.max_lng - pune_lng_span * 0.05, pune_bounds.max_lat - pune_lat_span * 0.05), srid=4326),
                ),
            ]
        )
        db.flush()
        print("Saved 4 infrastructure features (road, water line, 2 electricity points)")

        # Simulated satellite change-detection region, near a corner away
        # from the flood zone, resolved to affected parcels by
        # point-in-polygon. Anchored near an actual corner of Pune's
        # generated parcels (not the bounding box's own corner, which can
        # fall outside an irregular envelope's convex hull entirely).
        change_anchor = pick_anchor(pune_entries, pune_bounds, 0.08, 0.08, avoid=flood_ring)
        change_ring, _ = build_zone_hitting_target(pune_entries, change_anchor, pune.center_lat, (2, 5), 120)
        change_affected_ids = [str(p.parcel.id) for p in pune_entries if point_in_ring(p.centroid, change_ring)]
        db.add(
            ChangeDetectionEvent(
                description="Simulated change detected between sample imagery T1 and T2 (new construction footprint)",
                state_code=pune.state_code, district=pune.district,
                geometry=_polygon(change_ring), affected_parcel_ids=change_affected_ids,
            )
        )
        db.flush()
        print(f"Saved change-detection event affecting {len(change_affected_ids)} parcels")

        # Demo governance alerts and requests are linked to the generated
        # parcels and demo citizens so the officer queues are useful after a
        # fresh seed. They are intentionally marked as demo data by their
        # explanations/details and are cleared/recreated on every seed run.

        # Demo accounts for real login - one per officer role plus one
        # admin, all sharing one demo password. Never real credentials.
        DEMO_PASSWORD_HASH = bcrypt.hashpw(b"Demo@123", bcrypt.gensalt(10)).decode()
        db.add_all(
            [
                User(email="admin@bhoomisetu.gov.in", password_hash=DEMO_PASSWORD_HASH, name="Admin User", role="ADMIN", email_verified=True),
                User(email="landrecords.officer@bhoomisetu.gov.in", password_hash=DEMO_PASSWORD_HASH, name="Asha Kulkarni", role="LAND_RECORD_OFFICER", email_verified=True),
                User(email="registration.officer@bhoomisetu.gov.in", password_hash=DEMO_PASSWORD_HASH, name="Rohan Mehta", role="REGISTRATION_OFFICER", email_verified=True),
                User(email="planning.officer@bhoomisetu.gov.in", password_hash=DEMO_PASSWORD_HASH, name="Priya Nair", role="PLANNING_OFFICER", email_verified=True),
                User(email="dispute.officer@bhoomisetu.gov.in", password_hash=DEMO_PASSWORD_HASH, name="Vikram Singh", role="DISPUTE_OFFICER", email_verified=True),
                # So every department in the admin Department directory has
                # at least one real officer to receive AI-routed requests
                # and governance-alert notifications.
                User(email="tax.officer@bhoomisetu.gov.in", password_hash=DEMO_PASSWORD_HASH, name="Meera Iyer", role="TAX_OFFICER", email_verified=True),
                User(email="restriction.officer@bhoomisetu.gov.in", password_hash=DEMO_PASSWORD_HASH, name="Arjun Deshmukh", role="RESTRICTION_OFFICER", email_verified=True),
                User(email="encumbrance.officer@bhoomisetu.gov.in", password_hash=DEMO_PASSWORD_HASH, name="Kavita Rao", role="ENCUMBRANCE_OFFICER", email_verified=True),
                User(email="survey.officer@bhoomisetu.gov.in", password_hash=DEMO_PASSWORD_HASH, name="Sanjay Patil", role="SURVEY_OFFICER", email_verified=True),
            ]
        )
        verifiers = [
            User(email="verifier1@bhoomisetu.gov.in", password_hash=DEMO_PASSWORD_HASH, name="Sunil Patwardhan", role="VERIFIER", email_verified=True),
            User(email="verifier2@bhoomisetu.gov.in", password_hash=DEMO_PASSWORD_HASH, name="Neha Joshi", role="VERIFIER", email_verified=True),
        ]
        db.add_all(verifiers)
        db.flush()
        print("Saved 9 demo user accounts (1 admin + 8 officer roles, password: Demo@123)")
        print(f"Saved {len(verifiers)} demo verifier accounts (password: Demo@123)")

        # Seed default governance rules (BACKLOG.md #4 - admin-editable governance rules)
        _seed_governance_rules(db)

        # Optional citizen sign-in: each demo citizen account gets linked to
        # a random 0-5 parcels for the "My Parcels" dashboard, weighted so
        # 1-2 parcels is most likely and both 0 and 5 are least likely - a
        # shuffled, non-repeating walk through every saved parcel, so no
        # parcel is ever linked to more than one citizen.
        CITIZEN_COUNT = 20
        PARCEL_COUNT_WEIGHTS = [(0, 2), (1, 5), (2, 5), (3, 3), (4, 2), (5, 1)]
        shuffled_parcels = list(all_saved_parcels)
        random.shuffle(shuffled_parcels)
        parcel_cursor = 0

        citizens = [
            User(
                email=f"citizen{i + 1}@example.com",
                password_hash=DEMO_PASSWORD_HASH,
                name=random_person_name(),
                role="CITIZEN",
                # Demo citizens have never gone through the real
                # registration/OTP flow - marked verified so the Profile
                # page shows them as such rather than nudging every demo
                # account to "verify" an email that was never actually
                # theirs to prove.
                email_verified=True,
            )
            for i in range(CITIZEN_COUNT)
        ]
        db.add_all(citizens)
        db.flush()

        citizen_parcel_links: list[tuple[User, Parcel]] = []
        citizen_parcel_rows: list[CitizenParcel] = []
        for citizen in citizens:
            parcel_count = weighted_pick(PARCEL_COUNT_WEIGHTS)
            for _ in range(parcel_count):
                if parcel_cursor >= len(shuffled_parcels):
                    break
                parcel = shuffled_parcels[parcel_cursor]
                parcel_cursor += 1
                citizen_parcel_links.append((citizen, parcel))
                citizen_parcel_rows.append(CitizenParcel(citizen_id=citizen.id, parcel_id=parcel.id))
        db.add_all(citizen_parcel_rows)
        db.flush()
        print(f"Saved {len(citizens)} demo citizen accounts (password: Demo@123), linked to {len(citizen_parcel_rows)} parcels total")

        # Citizen request queue: two examples of every supported request type.
        # The steps mirror WorkflowsService's deterministic pipelines, without
        # calling the AI router or creating notifications during seeding.
        request_pipelines = {
            "ROR_COPY_REQUEST": [("LAND_RECORDS", "LAND_RECORD_OFFICER"), ("REGISTRATION", "REGISTRATION_OFFICER"), ("PLANNING", "PLANNING_OFFICER")],
            "CORRECTION_REQUEST": [("LAND_RECORDS", "LAND_RECORD_OFFICER"), ("REGISTRATION", "REGISTRATION_OFFICER"), ("PLANNING", "PLANNING_OFFICER")],
            "DISPUTE_FILING": [("DISPUTE", "DISPUTE_OFFICER")],
            "LAND_CLAIM_REQUEST": [("LAND_RECORDS", "LAND_RECORD_OFFICER")],
            "DOCUMENT_VERIFICATION_REQUEST": [("LAND_RECORDS", "LAND_RECORD_OFFICER")],
        }
        request_details = {
            "ROR_COPY_REQUEST": "Demo request: please provide a certified copy of the Record of Rights.",
            "CORRECTION_REQUEST": "Demo request: the owner name on this parcel needs correction.",
            "DISPUTE_FILING": "Demo request: review a reported boundary and ownership dispute.",
            "LAND_CLAIM_REQUEST": "Demo request: review the attached land claim against this parcel.",
            "DOCUMENT_VERIFICATION_REQUEST": "Demo request: verify the uploaded ownership document.",
        }
        seeded_workflows = []
        request_types = list(request_pipelines)
        for index, workflow_type in enumerate(request_types * 2):
            parcel = all_saved_parcels[index % len(all_saved_parcels)]
            citizen = citizens[index % len(citizens)]
            current_status = "UNDER_REVIEW" if index % 3 == 1 else ("COMPLETED" if index % 3 == 2 else "SUBMITTED")
            workflow = Workflow(
                parcel_id=str(parcel.id),
                workflow_type=workflow_type,
                current_status=current_status,
                created_by=str(citizen.id),
                citizen_id=str(citizen.id),
                request_details=request_details[workflow_type],
                last_remarks="Demo seed record for officer queue review.",
            )
            db.add(workflow)
            db.flush()
            steps = []
            for step_order, (department, assigned_role) in enumerate(request_pipelines[workflow_type], start=1):
                step_status = "APPROVED" if current_status == "COMPLETED" else ("IN_PROGRESS" if current_status == "UNDER_REVIEW" and step_order == 1 else "PENDING")
                steps.append(
                    WorkflowStep(
                        workflow_id=workflow.id,
                        step_order=step_order,
                        department=department,
                        assigned_role=assigned_role,
                        status=step_status,
                        action="DEMO_SEED" if step_status == "APPROVED" else None,
                        remarks="Demo seed workflow step." if step_status != "PENDING" else None,
                    )
                )
            db.add_all(steps)
            seeded_workflows.append(workflow)
        db.flush()
        print(f"Saved {len(seeded_workflows)} demo requests across {len(request_types)} request types")

        # A couple of demo requests get a Verifier assigned + real field-
        # visit evidence already on file, so the Verifier Portal and the
        # officer's "Field Evidence" review section are demoable
        # immediately without manually creating this state through the UI
        # first (docs/architecture/BACKLOG.md item 19).
        field_evidence_rows = []
        for index, workflow in enumerate(seeded_workflows[:2]):
            verifier = verifiers[index % len(verifiers)]
            workflow.assigned_verifier_id = str(verifier.id)
            photo = render_parcel_document_image(
                ParcelDocumentFields(owner_name="Field Visit Photo", survey_number="N/A", area_sq_m=500, state_code="MH", district_code="PUN", registration_status="UNREGISTERED")
            )
            photo_file_name = f"{workflow.id}-1.png"
            photo_file_path = f"verification-evidence/{photo_file_name}"
            upload_to_storage(photo_file_path, photo, "image/png")
            field_evidence_rows.append(
                VerificationEvidence(
                    workflow_id=workflow.id, verifier_id=str(verifier.id),
                    photo_file_name=photo_file_name, photo_file_path=photo_file_path, mime_type="image/png",
                    latitude=18.5204 + index * 0.01, longitude=73.8567 + index * 0.01,
                    captured_at=datetime.now(), notes="Boundary and structures match recorded details.",
                )
            )
        db.add_all(field_evidence_rows)
        db.flush()
        print(f"Saved {len(field_evidence_rows)} demo field-evidence records across {min(2, len(seeded_workflows))} verifier-assigned requests")

        alert_types = [
            ("RESTRICTION_ZONE_OVERLAP", "RESTRICTION_MONITOR", "HIGH", "Restriction zone overlap detected in demo monitoring."),
            ("UNAUTHORIZED_CHANGE_DETECTED", "CHANGE_DETECTION", "CRITICAL", "Unauthorized change detected in demo imagery comparison."),
            ("TAX_OVERDUE", "TAX_MONITOR", "MEDIUM", "Tax overdue condition detected in demo monitoring."),
            ("DISPUTE_DETECTED", "HISTORICAL_IMAGERY", "HIGH", "Dispute signal detected in demo parcel history."),
            ("RESTRICTION_DETECTED", "RESTRICTION_MONITOR", "LOW", "Land-use restriction detected in demo parcel review."),
        ]
        seeded_alerts = []
        for alert_index, (alert_type, source, severity, explanation) in enumerate(alert_types * 2):
            parcel = all_saved_parcels[(alert_index + 12) % len(all_saved_parcels)]
            seeded_alerts.append(
                GovernanceAlert(
                    parcel_id=str(parcel.id),
                    alert_type=alert_type,
                    severity=severity,
                    source=source,
                    status="OPEN" if alert_index % 2 == 0 else "ACKNOWLEDGED",
                    explanation=f"Demo seed alert: {explanation}",
                )
            )
        db.add_all(seeded_alerts)
        db.flush()
        print(f"Saved {len(seeded_alerts)} demo governance alerts across {len(alert_types)} alert types")

        # Land property papers - deliberately partial and messy, not a
        # uniform 1:1 seed: only citizen-linked parcels are even
        # candidates, and even among those only a random subset actually
        # gets a document. Of the parcels that do get one, most are
        # REGISTERED, a smaller share UNREGISTERED, so an officer's queue
        # has real pre-existing unregistered paperwork to act on from day
        # one rather than everything looking freshly pristine.
        #
        # Temporarily skipped: with the one-city+one-village-per-state
        # expansion there are ~10x as many citizen-linked parcels as
        # before, and this whole path (render + store a synthetic PNG per
        # document) is already slated for removal by
        # docs/architecture/BACKLOG.md item 14 (on-demand PDF generation
        # replacing seed-time rendered images). Re-enable by deleting this
        # early exit once that lands, or sooner if seeded documents are
        # needed again before then.
        SKIP_PARCEL_DOCUMENT_IMAGES = True
        parcel_documents_to_save: list[ParcelDocument] = []
        for _citizen, parcel in citizen_parcel_links:
            if SKIP_PARCEL_DOCUMENT_IMAGES or random.random() >= 0.55:
                continue
            info = parcel_document_info_by_id.get(str(parcel.id), {"owner_name": random_person_name(), "identifier_value": None})
            registration_status = "REGISTERED" if random.random() < 0.7 else "UNREGISTERED"

            file_name = f"{parcel.id}.png"
            file_path = f"parcel-documents/{file_name}"
            # Real document image still generated and stored, same as the
            # TS version - only the OCR pass itself is deferred (see the
            # module docstring).
            png = render_parcel_document_image(
                ParcelDocumentFields(
                    owner_name=info["owner_name"],
                    survey_number=info["identifier_value"] or "N/A",
                    area_sq_m=float(parcel.area_sq_m),
                    state_code=parcel.state_code,
                    district_code=parcel.district_code,
                    registration_status=registration_status,
                )
            )
            upload_to_storage(file_path, png, "image/png")

            parcel_documents_to_save.append(
                ParcelDocument(
                    parcel_id=str(parcel.id),
                    document_type="ROR_COPY",
                    file_name=file_name,
                    file_path=file_path,
                    mime_type="image/png",
                    extracted_text=extract_text(png).text,
                    registration_status=registration_status,
                )
            )
        db.add_all(parcel_documents_to_save)
        db.flush()
        print(f"Saved {len(parcel_documents_to_save)} parcel documents (land property papers) out of {len(citizen_parcel_links)} citizen-linked parcels")

        # Admin Portal "Department management" - display/admin metadata
        # only, one row per existing hardcoded department code.
        departments = [
            Department(code="LAND_RECORDS", name="Land Records", description="Survey numbers, ownership records, and title documentation.", contact_email="landrecords@bhoomisetu.gov.in"),
            Department(code="REGISTRATION", name="Registration", description="Property registration and transaction recording.", contact_email="registration@bhoomisetu.gov.in"),
            Department(code="PLANNING", name="Planning", description="Zoning classification, land use, and master plan oversight.", contact_email="planning@bhoomisetu.gov.in"),
            Department(code="TAX", name="Tax", description="Property tax assessment and collection.", contact_email="tax@bhoomisetu.gov.in"),
            Department(code="RESTRICTION", name="Restriction", description="Environmental, protected-area, and other land-use restrictions.", contact_email="restrictions@bhoomisetu.gov.in"),
            Department(code="DISPUTE", name="Dispute", description="Ownership, boundary, inheritance, and encroachment dispute resolution.", contact_email="disputes@bhoomisetu.gov.in"),
            Department(code="ENCUMBRANCE", name="Encumbrance", description="Mortgages, liens, and other charges registered against a parcel.", contact_email="encumbrance@bhoomisetu.gov.in"),
            Department(code="SURVEY", name="Survey", description="Physical field measurement, cadastral map geometry updates, and boundary demarcation.", contact_email="survey@bhoomisetu.gov.in"),
        ]
        db.add_all(departments)
        db.flush()
        print(f"Saved {len(departments)} departments")

        db.commit()
        total_parcels = db.query(Parcel).count()
        print(f"Database seeding completed successfully! Total parcels: {total_parcels}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
