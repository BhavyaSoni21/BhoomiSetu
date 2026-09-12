"""Converts a GeoAlchemy2 geometry value (a WKBElement, as read back from a
real PostGIS column) to a GeoJSON dict - every module with a Geometry
column needs this at the API boundary, not just GisModule.
"""

from typing import Any

from geoalchemy2.elements import WKBElement
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping


def geometry_to_geojson(value: WKBElement | None) -> dict[str, Any] | None:
    if value is None:
        return None
    return mapping(to_shape(value))
