from datetime import date, datetime

from app.common.parcel_generation.official_document_generator import render_official_document_pdf
from app.services.land_record_pdf_service import ApplicantInfo, CropRow, LandRecordPDFData, MutationInfo, OwnershipRow, ParcelInfo


def _parcel_info(**overrides) -> ParcelInfo:
    defaults = dict(
        parcel_id="p1", parcel_url="http://localhost:5173/parcels/p1", village_name="Pune", village_code="MH-PUNE-01",
        taluka="Pune Taluka", district_code="PUN", state_code="MH", ulpin="ULPIN123", survey_number="142",
        plot_number=None, area_sq_m=2310.5, registration_status="REGISTERED",
    )
    defaults.update(overrides)
    return ParcelInfo(**defaults)


def _data(**overrides) -> LandRecordPDFData:
    defaults = dict(
        applicant=ApplicantInfo(
            name="Ramesh Kadam", application_no="ABCD1234", application_date=datetime(2026, 1, 10),
            approved_by="Land Record Officer", approval_date=datetime(2026, 1, 15),
        ),
        parcel=_parcel_info(),
        ownership=[
            OwnershipRow(
                khata_number="1099", owner_name="Asha Rao", occupant_class="I", area_sq_m=2310.5, assessment=45000.0,
                village_fund=None, other_number="DEED-287245", other_rights=None,
                transaction_type="ORIGINAL", transaction_date=date(2011, 4, 22),
            ),
        ],
        mutation=MutationInfo(pending=False, latest_mutation_no="DEED-287245", latest_mutation_date=date(2011, 4, 22)),
        crops=[
            CropRow(
                agricultural_year="2025-26", season="KHARIF", khata_number="1099", crop_type="FOOD_CROP", crop_name="Paddy (Rice)",
                irrigated_area_sq_m=1500.0, unirrigated_area_sq_m=810.5, irrigation_source="WELL", uncultivable_area_sq_m=0, remark=None,
            ),
        ],
    )
    defaults.update(overrides)
    return LandRecordPDFData(**defaults)


def test_render_official_document_pdf_produces_a_valid_pdf_in_english():
    pdf_bytes = render_official_document_pdf(_data(), lang="en")
    assert pdf_bytes[:5] == b"%PDF-"


def test_render_official_document_pdf_produces_a_valid_pdf_in_hindi():
    pdf_bytes = render_official_document_pdf(_data(), lang="hi")
    assert pdf_bytes[:5] == b"%PDF-"


def test_handles_no_ownership_history():
    pdf_bytes = render_official_document_pdf(_data(ownership=[]), lang="en")
    assert pdf_bytes[:5] == b"%PDF-"


def test_handles_no_crop_data():
    pdf_bytes = render_official_document_pdf(_data(crops=[]), lang="en")
    assert pdf_bytes[:5] == b"%PDF-"


def test_handles_multiple_owners_and_multiple_crop_rows():
    owners = [
        OwnershipRow(
            khata_number=str(1000 + i), owner_name=f"Owner {i}", occupant_class="I", area_sq_m=2310.5, assessment=45000.0,
            village_fund=None, other_number=None, other_rights=None, transaction_type="SALE", transaction_date=date(2015 + i, 1, 1),
        )
        for i in range(3)
    ]
    crops = [
        CropRow(
            agricultural_year=f"{2023 + i}-{str(2024 + i)[2:]}", season="RABI", khata_number="1000", crop_type="CASH_CROP",
            crop_name="Cotton", irrigated_area_sq_m=500.0, unirrigated_area_sq_m=0, irrigation_source="CANAL",
            uncultivable_area_sq_m=0, remark=None,
        )
        for i in range(2)
    ]
    pdf_bytes = render_official_document_pdf(_data(ownership=owners, crops=crops), lang="en")
    assert pdf_bytes[:5] == b"%PDF-"


def test_handles_no_applicant_strip_when_no_approved_workflow_exists():
    pdf_bytes = render_official_document_pdf(_data(applicant=None), lang="en")
    assert pdf_bytes[:5] == b"%PDF-"


def test_unknown_lang_falls_back_to_english():
    pdf_bytes = render_official_document_pdf(_data(), lang="fr")
    assert pdf_bytes[:5] == b"%PDF-"
