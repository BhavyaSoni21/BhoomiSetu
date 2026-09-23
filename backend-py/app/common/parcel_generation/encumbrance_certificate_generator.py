"""Compact single-page Encumbrance Certificate PDF (BACKLOG #12a).

Presentation-only: takes already-assembled primitives (never queries the DB),
mirroring official_document_generator's split. An encumbrance certificate is a
short attestation of whether a parcel carries any registered charge/mortgage/
lien over a period, so this is intentionally one page, not the Form 7/12 tree.
"""

import io
from datetime import date, datetime

import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER


def _fmt(d) -> str:
    return d.strftime("%d/%m/%Y") if d else "-"


def _qr(data: str) -> ImageReader:
    buf = io.BytesIO()
    qrcode.make(data).save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def render_encumbrance_certificate_pdf(
    *,
    certificate_number: str,
    parcel_id: str,
    ulpin: str | None,
    period_from: date | None,
    period_to: date | None,
    has_encumbrance: bool,
    encumbrances: list[dict],
    issued_by: str | None,
    issued_at: datetime,
) -> bytes:
    width, height = A4
    margin = 40
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    font, font_b = "Helvetica", "Helvetica-Bold"

    c.setLineWidth(1)
    c.rect(margin - 8, margin - 8, width - 2 * (margin - 8), height - 2 * (margin - 8))

    y = height - margin
    c.setFont(font_b, 16)
    c.drawCentredString(width / 2, y, "ENCUMBRANCE CERTIFICATE")
    y -= 16
    c.setFont(font, 8)
    c.drawCentredString(width / 2, y, "Issued from the BhoomiSetu digital land record — informational, not for legal use.")
    y -= 22

    c.drawImage(_qr(f"{certificate_number}|{parcel_id}"), width - margin - 60, y - 48, 60, 60, mask="auto")

    c.setFont(font, 9)
    c.drawString(margin, y, f"Certificate No.: {certificate_number}")
    y -= 13
    c.drawString(margin, y, f"Parcel ID: {parcel_id}")
    y -= 13
    c.drawString(margin, y, f"ULPIN: {ulpin or '-'}")
    y -= 13
    c.drawString(margin, y, f"Search Period: {_fmt(period_from)}  to  {_fmt(period_to)}")
    y -= 13
    c.drawString(margin, y, f"Issued By: {issued_by or 'Encumbrance Department'}    Issued On: {_fmt(issued_at.date() if isinstance(issued_at, datetime) else issued_at)}")
    y -= 24

    c.setFont(font_b, 11)
    verdict = "ENCUMBRANCES FOUND" if has_encumbrance else "NIL ENCUMBRANCE"
    c.setFillColor(colors.red if has_encumbrance else colors.green)
    c.drawString(margin, y, f"Result: {verdict}")
    c.setFillColor(colors.black)
    y -= 22

    if has_encumbrance and encumbrances:
        cell = ParagraphStyle("cell", fontName=font, fontSize=8, leading=10, alignment=TA_LEFT)
        head = ParagraphStyle("head", fontName=font_b, fontSize=8, leading=10, alignment=TA_CENTER)
        headers = ["Type", "Lender / Holder", "Instrument Ref.", "Registered", "Discharged"]
        rows = [[Paragraph(h, head) for h in headers]]
        for e in encumbrances:
            rows.append([
                Paragraph(str(e.get("type") or "-"), cell),
                Paragraph(str(e.get("lender") or "-"), cell),
                Paragraph(str(e.get("instrument") or "-"), cell),
                Paragraph(str(e.get("registered") or "-"), cell),
                Paragraph(str(e.get("discharged") or "-"), cell),
            ])
        table = Table(rows, colWidths=[90, 130, 110, 70, 70], repeatRows=1)
        table.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        _, th = table.wrapOn(c, width - 2 * margin, height)
        table.drawOn(c, margin, y - th)
        y -= th + 16
    else:
        c.setFont(font, 9)
        c.drawString(margin, y, "No registered encumbrance was found against this parcel for the search period.")
        y -= 16

    c.setFont(font, 7)
    c.drawCentredString(width / 2, margin, "This is a system-generated document. Digital signature not required.")
    c.save()
    return buf.getvalue()
