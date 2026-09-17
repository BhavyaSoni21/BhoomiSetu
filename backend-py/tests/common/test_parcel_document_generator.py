from app.common.parcel_generation.parcel_document_generator import (
    ParcelDocumentFields,
    render_parcel_document_image,
)


def test_render_parcel_document_image_produces_a_valid_png():
    fields = ParcelDocumentFields(
        owner_name="Asha Rao",
        survey_number="142",
        area_sq_m=2310.5,
        state_code="MH",
        district_code="PUN",
        registration_status="REGISTERED",
    )
    png_bytes = render_parcel_document_image(fields)
    assert png_bytes[:8] == b"\x89PNG\r\n\x1a\n"


def test_render_parcel_document_image_escapes_xml_special_characters():
    # A crafted owner name shouldn't be able to break out of the <text> tag.
    fields = ParcelDocumentFields(
        owner_name='<script>alert("x")</script>',
        survey_number="1",
        area_sq_m=1,
        state_code="MH",
        district_code="PUN",
        registration_status="REGISTERED",
    )
    # Doesn't raise, and still produces a valid PNG - cairosvg would fail to
    # parse malformed/unescaped SVG.
    png_bytes = render_parcel_document_image(fields)
    assert png_bytes[:8] == b"\x89PNG\r\n\x1a\n"
