"""Renders Officer Decision Order and Verification Report PDFs (§49).

Presentation-only: receives a DecisionDocumentData tree and never queries
the database itself. Uses reportlab for PDF rendering, consistent with the
official_document_generator.py pattern.
"""

import io
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.services.decision_document_data_service import DecisionDocumentData

_FONT_PATH = Path(__file__).resolve().parent.parent.parent.parent / "static" / "fonts" / "NotoSansDevanagari-Regular.ttf"
_DEV_FONT = "NotoSansDevanagari"
_font_registered = False


def _ensure_font() -> None:
    global _font_registered
    if _font_registered:
        return
    if _FONT_PATH.exists():
        pdfmetrics.registerFont(TTFont(_DEV_FONT, str(_FONT_PATH)))
    _font_registered = True


_L = {
    "en": {
        "title_decision": "OFFICER DECISION ORDER",
        "title_verification": "VERIFICATION REPORT",
        "case_id": "Case ID",
        "case_no": "Case No.",
        "parcel_id": "Parcel ID",
        "survey_no": "Survey No.",
        "area": "Area",
        "ulpin": "ULPIN",
        "citizen": "Citizen",
        "contact": "Contact",
        "address": "Address",
        "intent": "Issue Type",
        "priority": "Priority",
        "status": "Status",
        "created": "Created",
        "resolved": "Resolved",
        "departments": "Departments Involved",
        "department": "Department",
        "task_status": "Task Status",
        "resolution_mode": "Resolution Mode",
        "decision": "Decision",
        "remarks": "Remarks",
        "officer": "Authorized Officer",
        "officer_role": "Role",
        "date": "Date",
        "signature": "Authorized Officer (Signature)",
        "declaration": "I declare that the above information is true and correct to the best of my knowledge.",
        "no_evidence": "No field verification evidence on record.",
        "photo_count": "Photos Captured",
        "gps": "GPS Coordinates Captured",
        "yes": "Yes",
        "no": "No",
        "application_summary": "Application Summary",
        "departments_routed": "Departments Routed",
        "timeline": "Case Timeline",
        "event_type": "Event",
        "event_date": "Date",
        "actor": "Actor",
        "previous": "Previous State",
        "new": "New State",
        "footer": "This is a system-generated document. Case ID: {case_id}",
        "document_for": "Document generated for Case",
    },
}

_TASK_STATUS_LABELS = {
    "en": {
        "PENDING": "Pending",
        "ASSIGNED": "Assigned",
        "IN_PROGRESS": "In Progress",
        "BLOCKED": "Blocked",
        "COMPLETED": "Completed",
        "CANCELLED": "Cancelled",
    },
}

_DECISION_LABELS = {
    "en": {
        "APPROVE": "Approved",
        "REJECT": "Rejected",
        "RETURN_FOR_REVIEW": "Returned for Review",
    },
}


def _fonts_for(lang: str) -> tuple[str, str]:
    _ensure_font()
    if lang == "hi" and _FONT_PATH.exists():
        return _DEV_FONT, _DEV_FONT
    return "Helvetica", "Helvetica-Bold"


def _status_label(status: str, lang: str = "en") -> str:
    return _TASK_STATUS_LABELS.get(lang, {}).get(status, status)


def _decision_label(decision: str | None, lang: str = "en") -> str:
    if decision is None:
        return "-"
    return _DECISION_LABELS.get(lang, {}).get(decision, decision)


def generate_decision_order_pdf(data: DecisionDocumentData, lang: str = "en") -> bytes:
    """Generate the Officer Decision Order PDF (§49).

    Contains: Case ID, Parcel info, Citizen info, Application summary,
    Verification findings, Evidence references, Officer decision, Decision
    reason, Department, Date, Authorized officer info.
    """
    buf = io.BytesIO()
    _r = _L[lang]
    reg, bold = _fonts_for(lang)

    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    story: list = []

    styles = {
        "title": ParagraphStyle("title", fontName=bold, fontSize=18, textColor=colors.HexColor("#1a6b3c"), spaceAfter=12, alignment=TA_CENTER),
        "subtitle": ParagraphStyle("subtitle", fontName=reg, fontSize=11, textColor=colors.grey, spaceAfter=6, alignment=TA_CENTER),
        "h2": ParagraphStyle("h2", fontName=bold, fontSize=13, textColor=colors.HexColor("#333"), spaceBefore=12, spaceAfter=6),
        "body": ParagraphStyle("body", fontName=reg, fontSize=10, textColor=colors.black, spaceAfter=4, leading=14, alignment=TA_LEFT),
        "label": ParagraphStyle("label", fontName=bold, fontSize=10, textColor=colors.black, spaceAfter=2, leading=14, alignment=TA_LEFT),
    }

    story.append(Paragraph(_r["title_decision"], styles["title"]))
    story.append(Paragraph(f"{_r['document_for']} {data.case_no}", styles["subtitle"]))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph("1. Case Information", styles["h2"]))
    case_info_data = [
        [_r["case_no"], data.case_no],
        [_r["case_id"], data.case_id],
        [_r["parcel_id"], data.parcel_id],
        [_r["survey_no"], data.parcel_survey_no or "-"],
        [_r["ulpin"], data.parcel_ulpin or "-"],
        [_r["area"], data.parcel_area or "-"],
        [_r["citizen"], data.citizen_name or "-"],
        [_r["contact"], data.citizen_contact or "-"],
        [_r["address"], data.citizen_address or "-"],
        [_r["intent"], data.intent or "-"],
        [_r["priority"], data.priority or "-"],
        [_r["status"], data.status],
        [_r["created"], data.created_at.strftime("%Y-%m-%d %H:%M") if data.created_at else "-"],
        [_r["resolved"], data.resolved_at.strftime("%Y-%m-%d %H:%M") if data.resolved_at else "-"],
    ]
    case_table = Table(case_info_data, colWidths=[50*mm, 90*mm])
    case_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), reg),
        ("FONTNAME", (1, 0), (1, -1), bold),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#ddd")),
    ]))
    story.append(case_table)
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph("2. Departments Routed", styles["h2"]))
    if data.departments_routed:
        routed_data = [[d.get("department", "-"), d.get("reason", "-")] for d in data.departments_routed]
        routed_table = Table(routed_data, colWidths=[50*mm, 90*mm])
        routed_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), reg),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#ddd")),
        ]))
        story.append(routed_table)
    else:
        story.append(Paragraph("-", styles["body"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph("3. Department Task Decisions", styles["h2"]))
    if data.tasks:
        task_headers = [_r["department"], _r["resolution_mode"], _r["task_status"], _r["decision"], _r["remarks"]]
        task_data = [task_headers]
        for t in data.tasks:
            task_data.append([
                f"{t.department_code}\n({t.department_name})" if t.department_name else t.department_code,
                t.resolution_mode or "-",
                _status_label(t.status, lang),
                _decision_label(t.resolution_decision, lang),
                t.resolution_remarks or "-",
            ])
        task_table = Table(task_data, colWidths=[40*mm, 30*mm, 28*mm, 30*mm, 42*mm])
        task_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), bold),
            ("FONTNAME", (0, 1), (-1, -1), reg),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#ddd")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
        ]))
        story.append(task_table)
    else:
        story.append(Paragraph("-", styles["body"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph("4. Application Summary", styles["h2"]))
    story.append(Paragraph(data.application_draft or "-", styles["body"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph("5. Officer Decision", styles["h2"]))
    decision_label = _decision_label(data.decision, lang) if data.decision else "-"
    story.append(Paragraph(f"<b>{_r['decision']}:</b> {decision_label}", styles["body"]))
    story.append(Paragraph(f"<b>{_r['remarks']}:</b> {data.decision_reason or '-'}", styles["body"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph("6. Officer Information", styles["h2"]))
    officer_data = [
        [_r["officer"], data.officer_name or "-"],
        [_r["officer_role"], data.officer_role or "-"],
        [_r["date"], data.document_date.strftime("%Y-%m-%d") if data.document_date else "-"],
    ]
    officer_table = Table(officer_data, colWidths=[50*mm, 90*mm])
    officer_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), reg),
        ("FONTNAME", (1, 0), (1, -1), bold),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#ddd")),
    ]))
    story.append(officer_table)
    story.append(Spacer(1, 12*mm))

    story.append(Paragraph(_r["signature"], styles["h2"]))
    story.append(Paragraph(_r["declaration"], styles["body"]))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph(
        f"{_r['footer']} — {_r['created']}: {data.document_date.strftime('%Y-%m-%d %H:%M') if data.document_date else '-'}",
        ParagraphStyle("footer", fontName=reg, fontSize=7, textColor=colors.grey, alignment=TA_CENTER, spaceBefore=16)
    ))

    doc.build(story)
    return buf.getvalue()


def generate_verification_report_pdf(data: DecisionDocumentData, lang: str = "en") -> bytes:
    """Generate the Verification Report PDF (§49).

    Contains: Case info, officer info, departments and decisions,
    evidence summary, field verification findings.
    """
    buf = io.BytesIO()
    _r = _L[lang]
    reg, bold = _fonts_for(lang)

    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    story: list = []

    styles = {
        "title": ParagraphStyle("title", fontName=bold, fontSize=18, textColor=colors.HexColor("#1a6b3c"), spaceAfter=12, alignment=TA_CENTER),
        "subtitle": ParagraphStyle("subtitle", fontName=reg, fontSize=11, textColor=colors.grey, spaceAfter=6, alignment=TA_CENTER),
        "h2": ParagraphStyle("h2", fontName=bold, fontSize=13, textColor=colors.HexColor("#333"), spaceBefore=12, spaceAfter=6),
        "body": ParagraphStyle("body", fontName=reg, fontSize=10, textColor=colors.black, spaceAfter=4, leading=14, alignment=TA_LEFT),
        "label": ParagraphStyle("label", fontName=bold, fontSize=10, textColor=colors.black, spaceAfter=2, leading=14, alignment=TA_LEFT),
    }

    story.append(Paragraph(_r["title_verification"], styles["title"]))
    story.append(Paragraph(f"{_r['document_for']} {data.case_no}", styles["subtitle"]))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph("1. Case Information", styles["h2"]))
    case_info_data = [
        [_r["case_no"], data.case_no],
        [_r["parcel_id"], data.parcel_id],
        [_r["survey_no"], data.parcel_survey_no or "-"],
        [_r["citizen"], data.citizen_name or "-"],
        [_r["intent"], data.intent or "-"],
        [_r["status"], data.status],
    ]
    case_table = Table(case_info_data, colWidths=[50*mm, 90*mm])
    case_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), reg),
        ("FONTNAME", (1, 0), (1, -1), bold),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#ddd")),
    ]))
    story.append(case_table)
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph("2. Evidence Summary", styles["h2"]))
    if data.evidence:
        evidence_data = [
            [_r["photo_count"], str(data.evidence.photo_count)],
            [_r["gps"], _r["yes"] if data.evidence.gps_captured else _r["no"]],
            [_r["remarks"], data.evidence.notes or "-"],
            [_r["date"], data.evidence.captured_at.strftime("%Y-%m-%d %H:%M") if data.evidence.captured_at else "-"],
        ]
    else:
        evidence_data = [[_r["remarks"], _r["no_evidence"]]]
    evidence_table = Table(evidence_data, colWidths=[50*mm, 90*mm])
    evidence_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), reg),
        ("FONTNAME", (1, 0), (1, -1), bold),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#ddd")),
    ]))
    story.append(evidence_table)
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph("3. Department Decisions", styles["h2"]))
    if data.tasks:
        headers = [_r["department"], _r["task_status"], _r["decision"], _r["remarks"]]
        task_rows = [headers]
        for t in data.tasks:
            task_rows.append([
                t.department_code,
                _status_label(t.status, lang),
                _decision_label(t.resolution_decision, lang),
                t.resolution_remarks or "-",
            ])
        task_table = Table(task_rows, colWidths=[45*mm, 30*mm, 30*mm, 65*mm])
        task_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), bold),
            ("FONTNAME", (0, 1), (-1, -1), reg),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#ddd")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
        ]))
        story.append(task_table)
    else:
        story.append(Paragraph("-", styles["body"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph("4. Case Timeline", styles["h2"]))
    if data.timeline_events:
        headers = [_r["event_type"], _r["event_date"], _r["previous"], _r["new"]]
        timeline_rows = [headers]
        for e in data.timeline_events:
            timeline_rows.append([
                e.get("event_type") or "-",
                e.get("created_at") or "-",
                e.get("previous_state") or "-",
                e.get("new_state") or "-",
            ])
        timeline_table = Table(timeline_rows, colWidths=[45*mm, 30*mm, 30*mm, 65*mm])
        timeline_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), bold),
            ("FONTNAME", (0, 1), (-1, -1), reg),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#ddd")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
        ]))
        story.append(timeline_table)
    else:
        story.append(Paragraph("-", styles["body"]))
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph(_r["footer"], ParagraphStyle("footer", fontName=reg, fontSize=7, textColor=colors.grey, alignment=TA_CENTER, spaceAfter=16)))

    doc.build(story)
    return buf.getvalue()
