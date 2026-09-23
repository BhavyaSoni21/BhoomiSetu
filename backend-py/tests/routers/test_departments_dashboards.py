"""Officer department dashboards (BACKLOG item 12).

Guards two things: the literal routes must NOT be shadowed by the
/{parcel_id} catch-alls (a 422 here means shadowing), and the real-data
endpoints must return the exact camelCase shapes their pages consume.
"""

from tests.helpers.auth import create_authenticated_user
from tests.routers.test_departments import _seed


def test_fraud_prevention_flags_encumbrance_with_dispute_and_restriction(db, client):
    _seed(db)  # MH parcel: MORTGAGE encumbrance + active dispute + restriction
    _, _, headers = create_authenticated_user(db, "ENCUMBRANCE_OFFICER")
    res = client.get("/api/v1/encumbrance/fraud-prevention", headers=headers)
    assert res.status_code == 200, res.text  # 422 => shadowed by /{parcel_id}
    rows = res.json()
    assert len(rows) == 1
    row = rows[0]
    assert row["fraudRiskLevel"] == "CRITICAL"  # dispute AND restriction
    assert row["disputeStatus"]["hasActiveDispute"] is True
    assert row["restrictionStatus"]["hasActiveRestriction"] is True
    assert row["activeEncumbranceRequest"]["requestType"] == "MORTGAGE"


def test_tax_analytics_aggregates_real_records(db, client):
    _seed(db)  # one TaxRecord: annual 5000, outstanding 2500
    _, _, headers = create_authenticated_user(db, "TAX_OFFICER")
    res = client.get("/api/v1/tax/analytics", headers=headers)
    assert res.status_code == 200, res.text
    a = res.json()
    assert a["totalDemand"] == 5000
    assert a["totalOverdue"] == 2500
    assert a["totalCollected"] == 2500
    # page maps over these unconditionally - must always be present
    for key in ("overdueTrend", "collectionByCategory", "topOverdueParcels", "reassessmentStats"):
        assert key in a
    assert len(a["topOverdueParcels"]) == 1


def test_registration_chain_returns_registered_parcels(db, client):
    _seed(db)
    _, _, headers = create_authenticated_user(db, "REGISTRATION_OFFICER")
    res = client.get("/api/v1/registration/chain", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()[0]["registrationNumber"] == "REG-MH-1"


def test_literal_routes_not_shadowed_and_stubs_return_empty(db, client):
    _seed(db)
    _, _, survey = create_authenticated_user(db, "SURVEY_OFFICER")
    _, _, enc = create_authenticated_user(db, "ENCUMBRANCE_OFFICER")
    _, _, reg = create_authenticated_user(db, "REGISTRATION_OFFICER")

    # real-data list route (no survey seeded => empty list, but 200 not 422)
    assert client.get("/api/v1/survey/records", headers=survey).status_code == 200
    # no certificates issued yet
    assert client.get("/api/v1/encumbrance/certificates", headers=enc).json() == []
    # encumbered parcel surfaces as one PENDING certificate request
    reqs = client.get("/api/v1/encumbrance/certificate-requests", headers=enc).json()
    assert len(reqs) == 1 and reqs[0]["status"] == "PENDING"
    # no survey documents uploaded for this parcel
    assert client.get("/api/v1/survey/documents", headers=survey, params={"parcelId": "x"}).json() == []
    assert client.get("/api/v1/registration/duplicate-registry", headers=reg).json() == []
    # upload requires a file part => client-side validation error, not a 501 stub
    assert client.post("/api/v1/survey/documents/upload", headers=survey).status_code in (400, 422)


def test_certificate_generation_roundtrip(db, client):
    """#12a: generate → listed → request flips GENERATED → PDF bytes served."""
    p = _seed(db)
    _, _, enc = create_authenticated_user(db, "ENCUMBRANCE_OFFICER")
    parcel_id = str(p["mh_parcel"].id)

    gen = client.post("/api/v1/encumbrance/certificates/generate", headers=enc, json={"parcelId": parcel_id})
    assert gen.status_code == 201, gen.text
    cert = gen.json()
    assert cert["parcelId"] == parcel_id and cert["status"] == "ACTIVE"
    cert_id = cert["id"]

    assert any(c["id"] == cert_id for c in client.get("/api/v1/encumbrance/certificates", headers=enc).json())
    assert client.get("/api/v1/encumbrance/certificate-requests", headers=enc).json()[0]["status"] == "GENERATED"

    pdf = client.get(f"/api/v1/encumbrance/certificates/{cert_id}/pdf", headers=enc)
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"


def test_survey_document_upload_roundtrip(db, client):
    """#12b: multipart upload → listed by parcel → original bytes served back."""
    p = _seed(db)
    _, _, survey = create_authenticated_user(db, "SURVEY_OFFICER")
    parcel_id = str(p["mh_parcel"].id)

    up = client.post(
        "/api/v1/survey/documents/upload", headers=survey,
        data={"parcelId": parcel_id, "documentType": "FIELD_SKETCH", "gpsLat": "18.52", "gpsLng": "73.85"},
        files={"file": ("sketch.txt", b"field sketch bytes", "text/plain")},
    )
    assert up.status_code == 201, up.text
    doc = up.json()
    assert doc["parcelId"] == parcel_id and doc["documentType"] == "FIELD_SKETCH"
    doc_id = doc["id"]

    listed = client.get("/api/v1/survey/documents", headers=survey, params={"parcelId": parcel_id}).json()
    assert any(d["id"] == doc_id for d in listed)

    f = client.get(f"/api/v1/survey/documents/{doc_id}/file", headers=survey)
    assert f.status_code == 200 and f.content == b"field sketch bytes"


def test_dashboards_require_staff_auth(db, client):
    assert client.get("/api/v1/tax/analytics").status_code == 401
    _, _, citizen = create_authenticated_user(db, "CITIZEN")
    assert client.get("/api/v1/tax/analytics", headers=citizen).status_code == 403
