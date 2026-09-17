"""Tests for Parcel Verification Engine & Verify Endpoint."""

import pytest
from app.document_verification.verifier import (
    canon,
    extract,
    match_field,
    norm,
    real_fake,
    run_verification,
    dist_code,
    vill_code,
    build_local_id,
)
from app.models.parcel import CitizenParcel, Parcel
from app.models.workflow import Workflow
from tests.helpers.auth import create_authenticated_user


def test_district_and_village_codes():
    assert dist_code("ahmadnagar") == "AH"
    assert dist_code("pune") == "PUN"
    assert dist_code("sangamner") == "SA"
    assert vill_code("Shedgaon") == "SH"


def test_norm_and_canon():
    assert "123" in norm("१२३/४")
    assert canon("sangamer") == "sangamner"
    assert canon("shedgan") == "shedgaon"
    assert canon("ahamadnagar") == "ahmadnagar"


def test_extract_and_matching():
    sample_text = """
    महाराष्ट्र शासन - ७/१२ उतारा
    गाव: Shedgaon    तालुका: Sangamner    जिल्हा: Ahmadnagar
    खाते क्र. 1425
    भोगवटादार नाव: Ashutosh Ramesh Amale
    सर्व्हे क्र / गट क्र: 588/2
    क्षेत्र: 1.25 Hectare
    मोबाईल: 9876543210
    ULPIN: 11223344556
    """
    doc = extract(sample_text)
    assert "1425" in doc["khate_kramank"]
    assert "588/2" in doc["survey_number"]
    assert "9876543210" in doc["mobile"]
    assert "11223344556" in doc["ulpin"]

    raw_norm = norm(sample_text)

    # Test exact match
    m_khate = match_field("khate_kramank", "1425", doc["khate_kramank"], raw_norm)
    assert m_khate["match"] is True

    m_survey = match_field("survey_number", "588/2", doc["survey_number"], raw_norm)
    assert m_survey["match"] is True

    # Test fuzzy match
    m_vill = match_field("village", "Shedgaon", doc.get("village"), raw_norm)
    assert m_vill["match"] is True

    m_dist = match_field("district", "Ahmednagar", doc.get("district"), raw_norm)
    assert m_dist["match"] is True


def test_extract_handles_scan_spacing_and_ocr_spelling_variants():
    scanned_text = """
    Village: shedgaon
    Block: sangamner
    District: ahmadnagr
    Name of the occupant: ashutosh amale
    Mobile: 9867 180 509
    Bhumapan Kramank: 60/8
    """

    doc = extract(scanned_text)
    assert "9867180509" in doc["mobile"]
    assert "60/8" in doc["survey_number"]
    assert doc["owner_name"] == "ashutosh amale"
    assert doc["district"] == "ahmadnagr"

    raw_norm = norm(scanned_text)
    assert match_field("owner_name", "Ashutosh Amale", doc["owner_name"], raw_norm)["match"] is True
    assert match_field("district", "Ahmadnagar", doc["district"], raw_norm)["match"] is True
    assert match_field("mobile", "9867180509", doc["mobile"], raw_norm)["match"] is True


def test_run_verification_verified():
    sample_text = """
    GOVERNMENT OF MAHARASHTRA
    Village: Shedgaon   Taluka: Sangamner   District: Ahmadnagar
    Khate Kra: 4521
    Survey Number: 102/3
    Owner: Ashutosh Amale
    Mobile: 9876543210
    """
    user_inputs = {
        "khate_kramank": "4521",
        "survey_number": "102/3",
        "owner_name": "Ashutosh Amale",
        "village": "Shedgaon",
        "taluka": "Sangamner",
        "district": "Ahmadnagar",
        "mobile": "9876543210",
    }
    result = run_verification(sample_text.encode("utf-8"), "test.txt", user_inputs)
    assert result["verdict"] in ("VERIFIED", "PARTIAL MATCH")
    assert result["local_id"].startswith("MH-AH-SH-")
    assert result["matched_count"] >= 5


def test_verify_endpoint_verified(db, client):
    citizen, _, headers = create_authenticated_user(db, "CITIZEN")

    doc_content = b"""
    GOVERNMENT OF MAHARASHTRA - 7/12 EXTRACT
    Village: Shedgaon   Taluka: Sangamner   District: Ahmadnagar
    Khate Kramank: 7890
    Survey Number: 588/2
    Owner: Ashutosh Amale
    Mobile: 9876543210
    """
    response = client.post(
        "/api/v1/parcels/verify",
        headers=headers,
        data={
            "khate_kramank": "7890",
            "owner_name": "Ashutosh Amale",
            "survey_number": "588/2",
            "village": "Shedgaon",
            "taluka": "Sangamner",
            "district": "Ahmadnagar",
            "mobile": "9876543210",
        },
        files={"document": ("sample_712.txt", doc_content, "text/plain")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["verdict"] == "VERIFIED"
    assert "parcel" in body
    assert body["localId"].startswith("MH-AH-SH-588/2")

    # Check database CitizenParcel
    link = db.query(CitizenParcel).filter_by(citizen_id=citizen.id).first()
    assert link is not None
    assert link.status == "Registered"


def test_extract_document_endpoint_prefills_land_record_fields(db, client):
    _, _, headers = create_authenticated_user(db, "CITIZEN")
    doc_content = b"""
    GOVERNMENT OF MAHARASHTRA - 7/12 EXTRACT
    Village: Shedgaon   Taluka: Sangamner   District: Ahmadnagar
    Khate Kramank: 7890
    Survey Number: 588/2
    Owner: Ashutosh Amale
    Mobile: 9876543210
    """
    response = client.post(
        "/api/v1/parcels/extract-document",
        headers=headers,
        files={"document": ("sample_712.pdf", doc_content, "application/pdf")},
    )

    assert response.status_code == 200
    fields = response.json()["fields"]
    assert "7890" in fields["khate_kramank"]
    assert "588/2" in fields["survey_number"]
    assert fields["village"] == "Shedgaon"
    assert fields["district"] == "Ahmadnagar"


def test_verify_endpoint_partial_match(db, client):
    citizen, _, headers = create_authenticated_user(db, "CITIZEN")

    doc_content = b"""
    GOVERNMENT OF MAHARASHTRA
    Village: Shedgaon   Taluka: Sangamner   District: Ahmadnagar
    Survey Number: 588/2
    Owner: Different Name
    """
    response = client.post(
        "/api/v1/parcels/verify",
        headers=headers,
        data={
            "khate_kramank": "9999",  # Mismatched
            "owner_name": "Ashutosh Amale",  # Mismatched
            "survey_number": "588/2",  # Match
            "village": "Shedgaon",  # Match
            "taluka": "Sangamner",  # Match
            "district": "Ahmadnagar",  # Match
        },
        files={"document": ("sample_712.txt", doc_content, "text/plain")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["verdict"] == "PARTIAL MATCH"

    # Check that parcel status is Pending Verification and review workflow is filed
    link = db.query(CitizenParcel).filter_by(citizen_id=citizen.id).first()
    assert link is not None
    assert link.status == "Pending Verification"

    wf = db.query(Workflow).filter_by(citizen_id=str(citizen.id)).first()
    assert wf is not None
    assert wf.workflow_type == "DOCUMENT_VERIFICATION_REQUEST"


def test_verify_endpoint_mismatch(db, client):
    citizen, _, headers = create_authenticated_user(db, "CITIZEN")

    doc_content = b"""
    State of Karnataka - Pahani Record
    Village: Bangalore   District: Bangalore
    Survey Number: 11/1
    Owner: Ram Kumar
    """
    response = client.post(
        "/api/v1/parcels/verify",
        headers=headers,
        data={
            "khate_kramank": "1234",
            "owner_name": "Ashutosh Amale",
            "survey_number": "588/2",
            "village": "Shedgaon",
            "taluka": "Sangamner",
            "district": "Ahmadnagar",
        },
        files={"document": ("sample.txt", doc_content, "text/plain")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["verdict"] == "MISMATCH"

    # No parcel should be linked
    link = db.query(CitizenParcel).filter_by(citizen_id=citizen.id).first()
    assert link is None


def test_sumanbai_vitthal_amale_marathi_and_english_matching():
    sample_text_marathi = """
    महाराष्ट्र शासन - ७/१२ उतारा
    गाव: शेडगाव    तालुका: संगमनेर    जिल्हा: अहमदनगर
    खाते क्रमांक: 65535
    भोगवटादाराचे नाव: सुमनबाई विठ्ठल आमले
    सर्व्हे नंबर: 588
    मोबाईल: ९६७१८०५०९
    ULPIN: 20260915082735
    """
    doc = extract(sample_text_marathi)
    assert "65535" in doc["khate_kramank"]
    assert "588" in doc["survey_number"]
    assert "967180509" in doc["mobile"]
    assert "20260915082735" in doc["ulpin"]

    raw_norm = norm(sample_text_marathi)
    # Match English typed user input with Marathi extracted document
    res_owner = match_field("owner_name", "sumanbai vitthal amale", doc["owner_name"], raw_norm)
    assert res_owner["match"] is True
    assert res_owner["score"] >= 0.70

    res_mobile = match_field("mobile", "967180509", doc["mobile"], raw_norm)
    assert res_mobile["match"] is True

    # Also test verification pipeline
    user_inputs = {
        "khate_kramank": "65535",
        "owner_name": "sumanbai vitthal amale",
        "survey_number": "588",
        "village": "shedgaon",
        "taluka": "sangamner",
        "district": "ahmdnagar",
        "mobile": "967180509",
        "ulpin": "20260915082735",
    }
    result = run_verification(sample_text_marathi.encode("utf-8"), "712.txt", user_inputs)
    assert result["verdict"] in ("VERIFIED", "PARTIAL MATCH")
    assert result["matched_count"] >= 6


def test_delete_pending_parcel_submission(db, client):
    citizen, _, headers = create_authenticated_user(db, "CITIZEN")

    # First verify/link a partial parcel
    doc_content = b"""
    GOVERNMENT OF MAHARASHTRA
    Village: Shedgaon   Taluka: Sangamner   District: Ahmadnagar
    Khate Kramank: 9999
    Survey Number: 777/1
    Owner: Sumanbai Vitthal Amale
    Mobile: 967180509
    """
    res = client.post(
        "/api/v1/parcels/verify",
        headers=headers,
        data={
            "khate_kramank": "9999",
            "owner_name": "Sumanbai Vitthal Amale",
            "survey_number": "777/1",
            "village": "Shedgaon",
            "taluka": "Sangamner",
            "district": "Ahmadnagar",
            "mobile": "967180509",
        },
        files={"document": ("doc.txt", doc_content, "text/plain")},
    )
    assert res.status_code == 200
    parcel_id = res.json()["parcel"]["id"]

    # Verify link exists
    link = db.query(CitizenParcel).filter_by(citizen_id=citizen.id, parcel_id=parcel_id).first()
    assert link is not None

    # Delete submission
    del_res = client.delete(f"/api/v1/parcels/mine/{parcel_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Link should now be gone
    link_after = db.query(CitizenParcel).filter_by(citizen_id=citizen.id, parcel_id=parcel_id).first()
    assert link_after is None

