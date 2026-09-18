"""Renders the official Form 7/12-style Record of Rights PDF (BACKLOG.md
item 14) - layout, section order, and styling deliberately mirror the
project's reference implementation exactly (emblem box, applicant/approval
strip, profile block, Form 7 ownership table, pending-mutation line, notice,
Form 12 crop register, footer notes, watermark). This module is
presentation-only: it receives an already-built
app.services.land_record_pdf_service.LandRecordPDFData tree and never
queries the database itself.
"""

import io
from pathlib import Path

import qrcode
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle

from app.services.land_record_pdf_service import LandRecordPDFData, ProfileInfo

# Full display name per state_code (CLUSTER_CONFIGS's own set of 30 codes -
# see cluster_generator.py) - the subtitle/emblem below are state-specific
# rather than hardcoded to Maharashtra, but the exact rule number/year per
# state's own land revenue rules isn't modelled anywhere in this codebase,
# so the citation names the real state without asserting a specific rule
# number for states this project hasn't verified one for.
_STATE_NAMES: dict[str, str] = {
    "AP": "Andhra Pradesh", "AR": "Arunachal Pradesh", "AS": "Assam", "BR": "Bihar",
    "CG": "Chhattisgarh", "CH": "Chandigarh", "DL": "Delhi", "GA": "Goa", "GJ": "Gujarat",
    "HP": "Himachal Pradesh", "HR": "Haryana", "JH": "Jharkhand", "KA": "Karnataka",
    "KL": "Kerala", "MH": "Maharashtra", "ML": "Meghalaya", "MN": "Manipur",
    "MP": "Madhya Pradesh", "MZ": "Mizoram", "NL": "Nagaland", "OD": "Odisha",
    "PB": "Punjab", "RJ": "Rajasthan", "SK": "Sikkim", "TG": "Telangana", "TN": "Tamil Nadu",
    "TR": "Tripura", "UK": "Uttarakhand", "UP": "Uttar Pradesh", "WB": "West Bengal",
}


def _state_name(state_code: str) -> str:
    return _STATE_NAMES.get(state_code, state_code)


_FONT_PATH = Path(__file__).resolve().parent.parent.parent.parent / "static" / "fonts" / "NotoSansDevanagari-Regular.ttf"
_DEV_FONT = "NotoSansDevanagari"
_font_registered = False


def _ensure_devanagari_font_registered() -> None:
    global _font_registered
    if _font_registered:
        return
    if _FONT_PATH.exists():
        pdfmetrics.registerFont(TTFont(_DEV_FONT, str(_FONT_PATH)))
    _font_registered = True


def _fonts_for(lang: str) -> tuple[str, str]:
    """(regular, bold) font names. Devanagari has no bundled bold face -
    same "no bold for Devanagari" call the reference implementation makes."""
    _ensure_devanagari_font_registered()
    if lang == "hi" and _FONT_PATH.exists():
        return _DEV_FONT, _DEV_FONT
    return "Helvetica", "Helvetica-Bold"


_TRANSACTION_TYPE_LABELS = {
    "en": {"ORIGINAL": "Original Grant", "SALE": "Sale", "GIFT": "Gift", "INHERITANCE": "Inheritance", "PARTITION": "Partition", "CURRENT": "Current Owner"},
    "hi": {"ORIGINAL": "मूळ नोंद", "SALE": "विक्री", "GIFT": "देणगी", "INHERITANCE": "वारसा हक्क", "PARTITION": "वाटणी", "CURRENT": "वर्तमान मालक"},
}
_SEASON_LABELS = {
    "en": {"KHARIF": "Kharif", "RABI": "Rabi", "SUMMER": "Summer"},
    "hi": {"KHARIF": "खरीप", "RABI": "रब्बी", "SUMMER": "उन्हाळी"},
}
_CROP_TYPE_LABELS = {
    "en": {"FOOD_CROP": "Food crop", "CASH_CROP": "Cash crop", "HORTICULTURE": "Horticulture"},
    "hi": {"FOOD_CROP": "अन्नधान्य", "CASH_CROP": "नगदी पीक", "HORTICULTURE": "फळबाग"},
}
_IRRIGATION_SOURCE_LABELS = {
    "en": {"WELL": "Well", "BOREWELL": "Borewell", "CANAL": "Canal", "RAINFED": "Rain-fed"},
    "hi": {"WELL": "विहीर", "BOREWELL": "बोअरवेल", "CANAL": "कालवा", "RAINFED": "पावसावर अवलंबून"},
}

_L = {
    "en": {
        "report_date": "Report Date",
        "village": "Village", "pu_id": "PU-ID", "taluka": "Taluka", "district": "District",
        "survey_no": "Survey No. & Sub-Division",
        "main_title": "VILLAGE FORM SEVEN (Record of Rights)",
        "subtitle": "[Prepared under the {state} Land Revenue Records & Registers (Preparation & Maintenance) Rules]",
        "tenure": "Land Tenure Type", "occupant_class": "Occupant Class - {cls}",
        "col_khata": "Khata\nNo.", "col_name": "Occupant's Name", "col_area": "Area",
        "col_assess": "Assessment", "col_vfund": "Village\nFund", "col_other_no": "Other\nNo.",
        "col_other_rights": "Tenancy, Lease & Other Rights",
        "pending_mut": "Pending Mutation", "yes": "Yes", "no": "No",
        "mutation_line": "Latest Mutation No.: {mno}   Dated: {mdt}",
        "notice": "NOTICE: The information displayed here cannot be used for any government or legal purpose.",
        "form12_title": "VILLAGE FORM TWELVE (Register of Crops)",
        "form12_subtitle": "[Prepared under the {state} Land Revenue Records & Registers (Preparation & Maintenance) Rules]",
        "col_year": "Year", "col_season": "Season", "col_khata2": "Khata\nNo.",
        "col_ctype": "Crop\nType", "col_cname": "Crop\nName",
        "col_irr": "Irrigated", "col_unirr": "Un-\nirrigated", "col_source": "Irrigation\nSource",
        "col_uarea": "Uncultivable\nArea", "col_remark": "Remark",
        "no_crop_data": "No crop data on record for this parcel.",
        "no_ownership_rows": "No ownership history on record.",
        "footer_note": "* Generated on demand from the BhoomiSetu digital land record.",
        "applicant_block": "Document generated for Applicant: {name}   |   Application No.: {ano}   |   Applied On: {adt}",
        "approval_block": "Approved By: {by}   |   Approved On: {adt}",
        "auto_note": "This is a system-generated document. Digital signature not required.",
        "generated_on": "PDF Generated On",
        "watermark": "SAMPLE  -  NOT FOR LEGAL USE",
        "not_available": "-",
        "profile_section": "Account Profile",
        "profile_name": "Name",
        "profile_contact": "Contact",
        "profile_occupation": "Occupation",
        "profile_address": "Address",
        "profile_gov_id": "Government ID",
    },
    "hi": {
        "report_date": "अहवाल दिनांक",
        "village": "गाव", "pu_id": "पी.यू.-आयडी", "taluka": "तालुका", "district": "जिल्हा",
        "survey_no": "भूमापन क्रमांक व उपविभाग",
        "main_title": "गाव नमुना सात (अधिकार अभिलेख पत्रक)",
        "subtitle": "[{state} राज्याच्या जमीन महसूल अधिकार अभिलेख आणि नोंदवही नियमांन्वये तयार]",
        "tenure": "भू-धारणा पध्दती", "occupant_class": "भोगवटादार वर्ग - {cls}",
        "col_khata": "खाते\nक्र.", "col_name": "भोगवटादाराचे नाव", "col_area": "क्षेत्र",
        "col_assess": "आकारणी", "col_vfund": "गा.\nख.", "col_other_no": "इतर\nक्र.",
        "col_other_rights": "कुळ, खंड व इतर अधिकार",
        "pending_mut": "प्रलंबित फेरफार", "yes": "होय", "no": "नाही",
        "mutation_line": "अंतिम फेरफार क्र.: {mno}   दिनांक: {mdt}",
        "notice": "सूचना: या ठिकाणी दर्शविलेली माहिती ही कोणत्याही शासकीय अथवा कायदेशीर बाबीसाठी वापरता येणार नाही.",
        "form12_title": "गाव नमुना बारा (पिकांची नोंदवही)",
        "form12_subtitle": "[{state} राज्याच्या जमीन महसूल अधिकार अभिलेख आणि नोंदवही नियमांन्वये तयार]",
        "col_year": "वर्ष", "col_season": "हंगाम", "col_khata2": "खाते\nक्र.",
        "col_ctype": "पिकाचा\nप्रकार", "col_cname": "पिकाचे\nनाव",
        "col_irr": "जल सिंचित", "col_unirr": "अजल\nसिंचित", "col_source": "जल सिंचनाचे\nसाधन",
        "col_uarea": "लागवडीस अयोग्य\nक्षेत्र", "col_remark": "शेरा",
        "no_crop_data": "या भूखंडासाठी पीक नोंद उपलब्ध नाही.",
        "no_ownership_rows": "मालकी इतिहासाची नोंद नाही.",
        "footer_note": "* भूमिसेतु डिजिटल भूमि अभिलेखावरून मागणीनुसार तयार करण्यात आले.",
        "applicant_block": "अर्जदार: {name}   |   अर्ज क्र.: {ano}   |   अर्ज दिनांक: {adt}",
        "approval_block": "मंजूर अधिकारी: {by}   |   मंजुरी दिनांक: {adt}",
        "auto_note": "हा दस्तऐवज संगणकीकृत प्रणालीद्वारे तयार करण्यात आला आहे. स्वाक्षरीची आवश्यकता नाही.",
        "generated_on": "पीडीएफ तयार केल्याचा दिनांक",
        "watermark": "नमुना  -  कायदेशीर वापरासाठी नाही",
        "not_available": "-",
        "profile_section": "खातेदार प्रोफाइल",
        "profile_name": "नाव",
        "profile_contact": "संपर्क",
        "profile_occupation": "व्यवसाय",
        "profile_address": "पत्ता",
        "profile_gov_id": "शासकीय आयडी",
    },
}


def _fmt_date(value) -> str:
    return value.strftime("%d/%m/%Y") if value else "-"


def _profile_contact(profile: ProfileInfo, t: dict) -> str:
    parts = []
    if profile.mobile_number:
        parts.append(profile.mobile_number)
    if profile.email:
        parts.append(profile.email)
    return ", ".join(parts) if parts else t["not_available"]


_SQM_PER_HECTARE = 10000
_SQM_PER_ARE = 100


def _fmt_area(area_sq_m: float) -> str:
    """Hectare.Are.SqM notation (e.g. "0.27.00") - how a real Form 7/12
    extract shows area, not raw square metres."""
    total = round(area_sq_m)
    hectares, remainder = divmod(total, _SQM_PER_HECTARE)
    ares, sq_m = divmod(remainder, _SQM_PER_ARE)
    return f"{hectares}.{ares:02d}.{sq_m:02d}"


def _para(text, font: str, size: float = 7, bold: bool = False, bold_font: str | None = None, align=TA_CENTER) -> Paragraph:
    style = ParagraphStyle(name="cell", fontName=(bold_font if bold and bold_font else font), fontSize=size, leading=size + 2, alignment=align)
    return Paragraph(str(text).replace("\n", "<br/>"), style)


def _ensure_space(c: canvas.Canvas, y: float, required: float, margin: float, height: float) -> float:
    """Ensure there's enough vertical space; if not, start a new page and return the new y position."""
    if y - required < margin:
        c.showPage()
        return height - margin
    return y


def _draw_watermark(c: canvas.Canvas, width: float, height: float, text: str, font: str) -> None:
    c.saveState()
    c.setFont(font, 16)
    c.setFillColor(colors.grey)
    c.setFillAlpha(0.15)
    c.translate(width / 2, height / 2)
    c.rotate(35)
    for x in range(-600, 600, 220):
        for y in range(-800, 800, 90):
            c.drawCentredString(x, y, text)
    c.restoreState()


def _qr_image(data: str) -> ImageReader:
    img = qrcode.make(data)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return ImageReader(buffer)


def _build_form7_table(data: LandRecordPDFData, lang: str, font: str, font_b: str) -> Table:
    t = _L[lang]
    tx_labels = _TRANSACTION_TYPE_LABELS[lang]
    headers = [t["col_khata"], t["col_name"], t["col_area"], t["col_assess"], t["col_vfund"], t["col_other_no"], t["col_other_rights"]]
    rows = [[_para(h, font, 7, True, font_b) for h in headers]]

    if not data.ownership:
        rows.append([_para(t["no_ownership_rows"], font, 7, align=TA_LEFT)] + [_para("", font, 7)] * 6)
    else:
        for row in data.ownership:
            name_line = f"{row.owner_name} ({tx_labels.get(row.transaction_type, row.transaction_type)}, {_fmt_date(row.transaction_date)})"
            rows.append([
                _para(row.khata_number or t["not_available"], font, 7),
                _para(name_line, font, 7, align=TA_LEFT),
                _para(_fmt_area(row.area_sq_m), font, 7),
                _para(f"{row.assessment:,.2f}" if row.assessment is not None else t["not_available"], font, 7),
                _para(row.village_fund or t["not_available"], font, 7),
                _para(row.other_number or t["not_available"], font, 7),
                _para(row.other_rights or t["not_available"], font, 7, align=TA_LEFT),
            ])

    col_widths = [42, 145, 55, 55, 40, 45, 135]
    table = Table(rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    return table


def _build_form12_table(data: LandRecordPDFData, lang: str, font: str, font_b: str) -> Table:
    t = _L[lang]
    season_labels, crop_type_labels, irr_labels = _SEASON_LABELS[lang], _CROP_TYPE_LABELS[lang], _IRRIGATION_SOURCE_LABELS[lang]
    headers = [t["col_year"], t["col_season"], t["col_khata2"], t["col_ctype"], t["col_cname"],
               t["col_irr"], t["col_unirr"], t["col_source"], t["col_uarea"], t["col_remark"]]
    rows = [[_para(h, font, 6.5, True, font_b) for h in headers]]

    if not data.crops:
        rows.append([_para(t["no_crop_data"], font, 6.5, align=TA_LEFT)] + [_para("", font, 6.5)] * 9)
    else:
        for row in data.crops:
            rows.append([
                _para(row.agricultural_year, font, 6.5),
                _para(season_labels.get(row.season, row.season), font, 6.5),
                _para(row.khata_number or t["not_available"], font, 6.5),
                _para(crop_type_labels.get(row.crop_type, row.crop_type), font, 6.5),
                _para(row.crop_name, font, 6.5),
                _para(_fmt_area(row.irrigated_area_sq_m), font, 6.5),
                _para(_fmt_area(row.unirrigated_area_sq_m), font, 6.5),
                _para(irr_labels.get(row.irrigation_source, t["not_available"]) if row.irrigation_source else t["not_available"], font, 6.5),
                _para(_fmt_area(row.uncultivable_area_sq_m), font, 6.5),
                _para(row.remark or t["not_available"], font, 6.5),
            ])

    col_widths = [38, 42, 38, 48, 55, 45, 42, 48, 48, 48]
    table = Table(rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    return table


def render_official_document_pdf(data: LandRecordPDFData, lang: str = "en") -> bytes:
    lang = lang if lang in _L else "en"
    t = _L[lang]
    font, font_b = _fonts_for(lang)
    p = data.parcel

    width, height = A4
    margin = 28
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    _draw_watermark(c, width, height, t["watermark"], font_b)

    c.setLineWidth(1)
    c.rect(margin - 6, margin - 6, width - 2 * (margin - 6), height - 2 * (margin - 6))

    y = height - margin
    page_number = 1

    def draw_page_footer(page_num: int) -> None:
        c.setFont(font, 6)
        c.drawCentredString(width / 2, margin / 2, f"Page {page_num}")

    def new_page() -> None:
        nonlocal y, page_number
        draw_page_footer(page_number)
        c.showPage()
        page_number += 1
        y = height - margin
        _draw_watermark(c, width, height, t["watermark"], font_b)
        c.setLineWidth(1)
        c.rect(margin - 6, margin - 6, width - 2 * (margin - 6), height - 2 * (margin - 6))

    def ensure_space(required: float) -> None:
        nonlocal y
        if y - required < margin:
            new_page()

    # ---- Top row: emblem box (left) + report date + QR (right) ----
    c.setFont(font, 7)
    c.rect(margin, y - 42, 42, 42)
    c.drawCentredString(margin + 21, y - 24, f"Go{p.state_code}")

    c.drawRightString(width - margin, y - 8, f"{t['report_date']}: {_fmt_date(data.generated_at.date())}")
    qr_reader = _qr_image(p.parcel_url)
    c.drawImage(qr_reader, width - margin - 42, y - 55, 42, 42, mask="auto")

    y -= 55

    # ---- Applicant / approval strip (omitted if no approved request on file) ----
    if data.applicant:
        c.setFont(font, 7)
        c.drawCentredString(width / 2, y, t["applicant_block"].format(
            name=data.applicant.name, ano=data.applicant.application_no, adt=_fmt_date(data.applicant.application_date.date()),
        ))
        y -= 10
        c.drawCentredString(width / 2, y, t["approval_block"].format(
            by=data.applicant.approved_by or t["not_available"],
            adt=_fmt_date(data.applicant.approval_date.date()) if data.applicant.approval_date else t["not_available"],
        ))
        y -= 16
    else:
        y -= 6

    # ---- Profile block (if authenticated user provided) ----
    if data.profile:
        ensure_space(60)
        c.setFont(font_b, 8)
        c.drawString(margin, y, t["profile_section"])
        y -= 11
        c.setFont(font, 7)
        c.drawString(margin, y, f"{t['profile_name']}: {data.profile.name or t['not_available']}")
        c.drawRightString(width - margin, y, f"{t['profile_contact']}: {_profile_contact(data.profile, t)}")
        y -= 10
        c.drawString(margin, y, f"{t['profile_occupation']}: {data.profile.occupation or t['not_available']}")
        c.drawRightString(width - margin, y, f"{t['profile_address']}: {data.profile.address or t['not_available']}")
        if data.profile.government_id_number:
            # Mask government ID for privacy
            gov_id = data.profile.government_id_number
            masked = f"{'*' * max(0, len(gov_id) - 4)}{gov_id[-4:]}" if len(gov_id) > 4 else "****"
            y -= 10
            c.drawString(margin, y, f"{t['profile_gov_id']}: {masked}")
        y -= 14

    # ---- Main Title ----
    ensure_space(40)
    c.setFont(font_b, 12)
    c.drawCentredString(width / 2, y, t["main_title"])
    y -= 13
    c.setFont(font, 7)
    c.drawCentredString(width / 2, y, t["subtitle"].format(state=_state_name(p.state_code)))
    y -= 16

    # ---- Village info block ----
    ensure_space(60)
    c.setFont(font, 8)
    c.drawString(margin, y, f"{t['village']}: {p.village_name or t['not_available']} ({p.village_code or t['not_available']})")
    c.drawRightString(width - margin, y, f"{t['taluka']}: {p.taluka or t['not_available']}")
    y -= 12
    c.drawString(margin, y, f"{t['pu_id']}: {p.ulpin or t['not_available']}")
    c.drawRightString(width - margin, y, f"{t['district']}: {p.district_code} ({p.state_code})")
    y -= 12
    survey_display = " / ".join(v for v in (p.survey_number, p.plot_number) if v) or t["not_available"]
    c.drawCentredString(width / 2, y, f"{t['survey_no']}: {survey_display}")
    y -= 12
    # Display area in hectare.are.sqm notation
    c.drawCentredString(width / 2, y, f"Area: {_fmt_area(p.area_sq_m)}")
    y -= 16

    c.setFont(font_b, 8)
    c.drawString(margin, y, f"{t['tenure']}: {t['occupant_class'].format(cls='I')}")
    y -= 8

    # ---- Form 7 Table ----
    table7 = _build_form7_table(data, lang, font, font_b)
    tw, th = table7.wrapOn(c, width - 2 * margin, height)
    ensure_space(th + 20)
    table7.drawOn(c, margin, y - th)
    y -= (th + 12)

    # ---- Pending mutation + mutation line ----
    ensure_space(30)
    c.setFont(font, 8)
    c.drawString(margin, y, f"{t['pending_mut']}: {t['yes'] if data.mutation.pending else t['no']}")
    c.drawRightString(width - margin, y, t["mutation_line"].format(
        mno=data.mutation.latest_mutation_no or t["not_available"],
        mdt=_fmt_date(data.mutation.latest_mutation_date),
    ))
    y -= 14

    # ---- Legal notice ----
    ensure_space(30)
    c.setFont(font, 7)
    c.drawCentredString(width / 2, y, t["notice"])
    y -= 18

    # ---- Form 12 Title ----
    ensure_space(40)
    c.setFont(font_b, 11)
    c.drawCentredString(width / 2, y, t["form12_title"])
    y -= 12
    c.setFont(font, 7)
    c.drawCentredString(width / 2, y, t["form12_subtitle"].format(state=_state_name(p.state_code)))
    y -= 14

    c.setFont(font, 8)
    c.drawString(margin, y, f"{t['village']}: {p.village_name or t['not_available']}   {t['taluka']}: {p.taluka or t['not_available']}   {t['district']}: {p.district_code}")
    y -= 10
    c.drawString(margin, y, f"{t['survey_no']}: {survey_display}")
    y -= 10

    # ---- Form 12 Table ----
    table12 = _build_form12_table(data, lang, font, font_b)
    tw2, th2 = table12.wrapOn(c, width - 2 * margin, height)
    ensure_space(th2 + 40)
    table12.drawOn(c, margin, y - th2)
    y -= (th2 + 14)

    # ---- Footer notes ----
    ensure_space(50)
    c.setFont(font, 7)
    c.drawString(margin, y, t["footer_note"])
    y -= 10
    c.drawCentredString(width / 2, y, t["notice"])
    y -= 14

    c.setFont(font, 6.5)
    c.drawCentredString(width / 2, y, t["auto_note"])
    y -= 9
    # Use timezone-aware timestamp
    generated_str = data.generated_at.strftime('%d/%m/%Y %H:%M:%S %Z') if data.generated_at.tzinfo else data.generated_at.strftime('%d/%m/%Y %H:%M:%S UTC')
    c.drawCentredString(width / 2, y, f"{t['generated_on']}: {generated_str}")

    draw_page_footer(page_number)
    c.save()
    return buffer.getvalue()
