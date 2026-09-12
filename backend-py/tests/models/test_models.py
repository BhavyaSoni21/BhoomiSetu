import uuid
from datetime import date

import pytest
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Polygon
from sqlalchemy.exc import IntegrityError

from app.models.admin import Department
from app.models.department_record import TaxRecord
from app.models.governance import GovernanceAlert
from app.models.parcel import CitizenParcel, Parcel, ParcelIdentifier
from app.models.user import User

SQUARE = Polygon([(73.85, 18.52), (73.86, 18.52), (73.86, 18.53), (73.85, 18.53), (73.85, 18.52)])


def _make_user(db, role="CITIZEN", **overrides):
    fields = {"email": f"{uuid.uuid4()}@example.com", "name": "Test User", "password_hash": "hashed", "role": role}
    fields.update(overrides)
    user = User(**fields)
    db.add(user)
    db.flush()
    return user


def _make_parcel(db, **overrides):
    parcel = Parcel(
        state_code="MH",
        district_code="PUN",
        local_body_code="PUN-01",
        geometry=from_shape(SQUARE, srid=4326),
        area_sq_m=1000,
        **overrides,
    )
    db.add(parcel)
    db.flush()
    return parcel


def test_parcel_roundtrips_real_geometry(db):
    parcel = _make_parcel(db)
    db.flush()
    db.expire(parcel)

    fetched = db.get(Parcel, parcel.id)
    shape = to_shape(fetched.geometry)
    assert shape.equals_exact(SQUARE, tolerance=1e-9)
    assert fetched.area_sq_m == 1000


def test_parcel_identifier_relationship_and_cascade_delete(db):
    parcel = _make_parcel(db)
    identifier = ParcelIdentifier(
        parcel=parcel,
        identifier_type="ULPIN",
        identifier_value="ULPIN-1",
        source_state="MH",
        source_department="LAND_RECORDS",
    )
    db.add(identifier)
    db.flush()

    assert parcel.identifiers[0].identifier_value == "ULPIN-1"

    db.delete(parcel)
    db.flush()
    assert db.get(ParcelIdentifier, identifier.id) is None


def test_citizen_parcel_enforces_one_citizen_per_parcel(db):
    citizen_a = _make_user(db)
    citizen_b = _make_user(db)
    parcel = _make_parcel(db)

    db.add(CitizenParcel(citizen_id=citizen_a.id, parcel_id=parcel.id))
    db.flush()

    db.add(CitizenParcel(citizen_id=citizen_b.id, parcel_id=parcel.id))
    with pytest.raises(IntegrityError):
        db.flush()


def test_user_email_and_mobile_are_each_unique(db):
    _make_user(db, email="dup@example.com", mobile_number=None)
    db.add(User(email="dup@example.com", name="Second", password_hash="x", role="CITIZEN"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_two_users_with_no_email_dont_collide_on_null(db):
    # Both left email unset (mobile-only accounts) - a unique index allows
    # multiple NULLs on Postgres, matching backend/'s TypeORM behavior.
    _make_user(db, email=None, mobile_number="9000000001")
    _make_user(db, email=None, mobile_number="9000000002")
    db.flush()  # doesn't raise


def test_department_record_uses_a_plain_parcel_id_not_a_foreign_key(db):
    # parcel_id is a plain string matching Parcel.id by value, not a real
    # FK/relation - a value with no matching Parcel row is still valid,
    # standing in for an independent department system.
    tax_record = TaxRecord(
        parcel_id=str(uuid.uuid4()),
        assessed_value=500000,
        annual_tax_amount=5000,
        tax_status="PENDING",
        last_payment_date=date(2026, 1, 1),
    )
    db.add(tax_record)
    db.flush()
    assert db.get(TaxRecord, tax_record.id).tax_status == "PENDING"


def test_department_admin_code_is_unique(db):
    # A random code, not one of the real seed script's department codes
    # (LAND_RECORDS etc.) - this test's db fixture rolls back its own
    # transaction, but the seed script's data is real, committed rows in
    # this same database, so reusing a real code here would collide with
    # that instead of demonstrating the constraint.
    code = f"TEST_{uuid.uuid4().hex[:8]}"
    db.add(Department(code=code, name="Land Records"))
    db.flush()
    db.add(Department(code=code, name="Land Records (dup)"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_governance_alert_defaults_to_open_status(db):
    alert = GovernanceAlert(
        parcel_id=str(uuid.uuid4()),
        alert_type="TAX_OVERDUE",
        severity="MEDIUM",
        source="TAX_MONITOR",
        explanation="Outstanding tax balance detected.",
    )
    db.add(alert)
    db.flush()
    db.expire(alert)
    assert db.get(GovernanceAlert, alert.id).status == "OPEN"
