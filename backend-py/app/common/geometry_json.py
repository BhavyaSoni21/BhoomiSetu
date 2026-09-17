"""Converts a GeoAlchemy2 geometry value (a WKBElement, as read back from a
real PostGIS column) to a GeoJSON dict - every module with a Geometry
column needs this at the API boundary, not just GisModule.
"""

from json import JSONDecodeError
import json
from typing import Any

from geoalchemy2.elements import WKBElement
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping


def geometry_to_geojson(value: WKBElement | str | dict[str, Any] | None) -> dict[str, Any] | None:
    if value is None:
        return None
    if isinstance(value, str):
        # TypeORM's legacy schema stores PostGIS values in TEXT. Depending
        # on the writer, that text is either GeoJSON or hex-encoded EWKB.
        # Both formats must become GeoJSON at the API boundary; returning
        # the hex string makes MapLibre silently discard the feature.
        try:
            parsed = json.loads(value)
        except JSONDecodeError:
            return mapping(to_shape(WKBElement(value, srid=4326)))
        if isinstance(parsed, dict):
            return parsed
        raise ValueError("Geometry JSON must be an object")
    if isinstance(value, dict):
        return value
    return mapping(to_shape(value))
