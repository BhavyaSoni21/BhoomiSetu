"""Ported from backend/src/common/parcel-generation/parcel-document-generator.ts.

A synthetic "Record of Rights" copy image for a parcel's seeded land
property papers - same SVG-rasterized approach cluster_snapshot_generator
already uses, just SVG <text> instead of polygons. Not a real scan of
anything - consistent with every other piece of demo data in this project.
"""

from dataclasses import dataclass
from xml.sax.saxutils import escape

import cairosvg

DOCUMENT_WIDTH = 850
DOCUMENT_HEIGHT = 1100


@dataclass
class ParcelDocumentFields:
    owner_name: str
    survey_number: str
    area_sq_m: float
    state_code: str
    district_code: str
    registration_status: str


def render_parcel_document_image(fields: ParcelDocumentFields) -> bytes:
    rows: list[tuple[str, str]] = [
        ("Owner Name", fields.owner_name),
        ("Survey / Plot Number", fields.survey_number),
        ("Area", f"{fields.area_sq_m:,.0f} sqm"),
        ("State", fields.state_code),
        ("District", fields.district_code),
        ("Registration Status", fields.registration_status),
    ]

    rows_svg = []
    for i, (label, value) in enumerate(rows):
        y = 260 + i * 70
        rows_svg.append(
            f'<text x="60" y="{y}" font-family="monospace" font-size="20" fill="#5a5240">{escape(label)}</text>'
            f'<text x="60" y="{y + 28}" font-family="monospace" font-size="28" font-weight="bold" fill="#1f2417">{escape(value)}</text>'
        )

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{DOCUMENT_WIDTH}" height="{DOCUMENT_HEIGHT}">'
        f'<rect width="100%" height="100%" fill="#f4f1ea" />'
        f'<rect x="20" y="20" width="{DOCUMENT_WIDTH - 40}" height="{DOCUMENT_HEIGHT - 40}" fill="none" stroke="#1f2417" stroke-width="4" />'
        f'<text x="60" y="110" font-family="monospace" font-size="34" font-weight="bold" fill="#1f2417">RECORD OF RIGHTS</text>'
        f'<text x="60" y="150" font-family="monospace" font-size="18" fill="#5a5240">Government Land Records - BhoomiSetu</text>'
        f'<line x1="60" y1="180" x2="{DOCUMENT_WIDTH - 60}" y2="180" stroke="#1f2417" stroke-width="2" />'
        f'{"".join(rows_svg)}'
        f"</svg>"
    )

    return cairosvg.svg2png(bytestring=svg.encode("utf-8"))
