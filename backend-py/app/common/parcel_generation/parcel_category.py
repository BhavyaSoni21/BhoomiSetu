"""Ported from backend/src/common/parcel-generation/parcel-category.ts.

The category a parcel falls into for a given year of the historical
imagery archive. One function computes this for BOTH the cluster-snapshot
renderer (the color a parcel gets painted) and the change-detection
comparison logic - a real, data-driven category instead of a synthetic
randomly-"changed" pixel set, so the two can never disagree with each
other.
"""

from typing import Literal, TypedDict

# The single source of truth for "which year counts as current". A fixed
# year, not the real current year - this demo's snapshot archive is a fixed
# 2022-2026 arc, not a rolling window.
CURRENT_YEAR = 2026

ParcelCategory = Literal[
    "NONE",
    "RESTRICTED",
    "DISPUTE_OWNERSHIP",
    "DISPUTE_BOUNDARY",
    "DISPUTE_INHERITANCE",
    "DISPUTE_ENCROACHMENT",
]

CATEGORY_COLORS: dict[ParcelCategory, str] = {
    "NONE": "#8fae86",  # muted green - clean, nothing on file
    "RESTRICTED": "#3f6fb3",  # blue - a regulatory restriction, not an interpersonal dispute
    "DISPUTE_OWNERSHIP": "#6b4c9a",  # purple
    "DISPUTE_BOUNDARY": "#c9702e",  # burnt orange
    "DISPUTE_INHERITANCE": "#c9a227",  # gold
    "DISPUTE_ENCROACHMENT": "#b33f3f",  # crimson
}

CATEGORY_LABELS: dict[ParcelCategory, str] = {
    "NONE": "Clear",
    "RESTRICTED": "Restricted zone",
    "DISPUTE_OWNERSHIP": "Ownership dispute",
    "DISPUTE_BOUNDARY": "Boundary dispute",
    "DISPUTE_INHERITANCE": "Inheritance dispute",
    "DISPUTE_ENCROACHMENT": "Encroachment dispute",
}


class LegendEntry(TypedDict):
    category: ParcelCategory
    color: str
    label: str


SNAPSHOT_LEGEND: list[LegendEntry] = [
    {"category": category, "color": CATEGORY_COLORS[category], "label": CATEGORY_LABELS[category]}
    for category in CATEGORY_LABELS
]


class CurrentDispute(TypedDict):
    hasActiveDispute: bool
    disputeType: str | None


def _dispute_category(dispute_type: str | None) -> ParcelCategory | None:
    return {
        "OWNERSHIP": "DISPUTE_OWNERSHIP",
        "BOUNDARY": "DISPUTE_BOUNDARY",
        "INHERITANCE": "DISPUTE_INHERITANCE",
        "ENCROACHMENT": "DISPUTE_ENCROACHMENT",
    }.get(dispute_type)


def category_for(
    restriction_status: str | None,
    current_dispute: CurrentDispute | None,
) -> ParcelCategory:
    """`current_dispute` only ever applies for the current year - dispute
    status (unlike restriction_status) has no per-year history anywhere in
    this schema, so it would misrepresent an earlier year to apply today's
    dispute to it.
    """
    if current_dispute and current_dispute["hasActiveDispute"]:
        category = _dispute_category(current_dispute["disputeType"])
        if category:
            return category
    if restriction_status == "RESTRICTED":
        return "RESTRICTED"
    return "NONE"
