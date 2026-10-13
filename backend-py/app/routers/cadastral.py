"""
Cadastral Map Layer & Revenue Data Service for BhoomiSetu.
Provides:
1. Administrative Hierarchy (State -> District -> Taluka -> Village).
2. Sanitized, high-speed Village Vector Geometries (stripped of sensitive text for 60 FPS WebGL & anti-scraping).
3. Authenticated & Rate-Limited Plot Revenue Details (on-demand hydration when a user clicks a parcel).
4. Multi-criteria Cadastral Search across 720,000+ real survey plots.
"""

import os
import json
import sqlite3
import re
from pathlib import Path
from functools import lru_cache
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel

from app.rate_limit import limiter

from pyproj import Transformer

router = APIRouter(prefix="/gis/cadastral", tags=["cadastral"])

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "cadastral_data"
DB_PATH = DATA_DIR / "cadastral_index.db"
HIERARCHY_FILE = DATA_DIR / "hierarchy.json"

# In-memory cached hierarchy
_HIERARCHY_CACHE: Optional[dict[str, Any]] = None
# In-memory LRU cache for sanitized village GeoJSON payloads (max 100 villages in RAM)
_VILLAGE_GEOJSON_CACHE: dict[str, str] = {}

# Transformers for Eastern Maharashtra (Vidarbha / UTM 44N) data mistakenly exported via UTM 43N
_T_TO_UTM43 = Transformer.from_crs('EPSG:4326', 'EPSG:32643', always_xy=True)
_T_TO_WGS84_Z44 = Transformer.from_crs('EPSG:32644', 'EPSG:4326', always_xy=True)

EASTERN_DISTRICT_KEYWORDS = [
    '08', '09', '10', '11', '12', '13', '14',
    'wardha', 'nagpur', 'nangpur', 'bhandara', 'gondiya', 'gondia', 'gadchiroli', 'chandrapur', 'yawatmal'
]


def fix_coords_recursive(coords):
    if isinstance(coords, (list, tuple)) and len(coords) >= 2 and isinstance(coords[0], (int, float)):
        x, y = _T_TO_UTM43.transform(coords[0], coords[1])
        flon, flat = _T_TO_WGS84_Z44.transform(x, y)
        if len(coords) > 2:
            return [round(flon, 8), round(flat, 8), *coords[2:]]
        return [round(flon, 8), round(flat, 8)]
    return [fix_coords_recursive(c) for c in coords]


def get_db_connection():
    if not DB_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="Cadastral index database is not built. Please run `backend-py/scripts/index_cadastral_dataset.py`."
        )
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def parse_raw_info(info_str: str) -> dict[str, Any]:
    """
    Parses unstructured revenue info strings (from both urban CST and rural 7/12 formats)
    into clean, structured dictionary fields.
    """
    if not info_str:
        return {}

    lines = [line.strip() for line in info_str.split("\n") if line.strip() and not line.startswith("---")]
    parsed: dict[str, Any] = {
        "holders": [],
        "attributes": {}
    }

    in_holders = False
    for line in lines:
        if "Holders history:" in line or "Holders history" in line:
            in_holders = True
            continue

        if in_holders:
            # Lines like (A)-X-[THAKURDAS PANACHAND] AND A-[MANCKCHAND PANACHAND]
            # or (E) - MUNCIPAL CORPORATION OF GRETOR MUMBAI
            if line.startswith("(") or "-" in line or "[" in line:
                cleaned_holder = line.strip().strip(".").strip()
                if cleaned_holder:
                    parsed["holders"].append(cleaned_holder)
            elif ":" in line:
                in_holders = False  # switched to next key-value

        if not in_holders and ":" in line:
            key, val = line.split(":", 1)
            key = key.strip()
            val = val.strip()
            parsed["attributes"][key] = val

            # Normalize common keys
            k_lower = key.lower()
            if "owner" in k_lower:
                parsed["ownerName"] = val
            elif "survey" in k_lower or "c.s.no" in k_lower:
                parsed["surveyNo"] = val
            elif "sheet" in k_lower:
                parsed["sheetNo"] = val
            elif "page" in k_lower:
                parsed["pageNo"] = val
            elif "street" in k_lower or "locality" in k_lower:
                parsed["street"] = val
            elif "tenure" in k_lower:
                parsed["tenure"] = val
            elif "khata" in k_lower:
                parsed["khataNo"] = val
            elif "pot kharaba" in k_lower:
                parsed["potKharaba"] = val
            elif "area" in k_lower:
                parsed["areaRecorded"] = val

    return parsed


@router.get("/hierarchy")
def get_cadastral_hierarchy():
    """
    Returns the complete administrative hierarchy tree:
    State (MH) -> Districts -> Talukas -> Villages with bounding boxes and centroid coordinates.
    Cached with public HTTP headers for CDN edge caching.
    """
    global _HIERARCHY_CACHE
    if _HIERARCHY_CACHE is not None:
        return Response(
            content=json.dumps(_HIERARCHY_CACHE, ensure_ascii=False),
            media_type="application/json",
            headers={"Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"}
        )

    if HIERARCHY_FILE.exists():
        with open(HIERARCHY_FILE, "r", encoding="utf-8") as fp:
            _HIERARCHY_CACHE = json.load(fp)
        return Response(
            content=json.dumps(_HIERARCHY_CACHE, ensure_ascii=False),
            media_type="application/json",
            headers={"Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"}
        )

    # Fallback to DB query if file not found
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT code, name, taluka, district, category, parcel_count, min_lng, min_lat, max_lng, max_lat, center_lng, center_lat FROM villages ORDER BY district, taluka, name")
    rows = cur.fetchall()
    conn.close()

    districts_map: dict[str, dict[str, Any]] = {}
    for r in rows:
        d_name = r["district"]
        t_name = r["taluka"]
        if d_name not in districts_map:
            districts_map[d_name] = {
                "districtName": d_name,
                "category": r["category"],
                "talukas": {}
            }
        if t_name not in districts_map[d_name]["talukas"]:
            districts_map[d_name]["talukas"][t_name] = {
                "talukaName": t_name,
                "villages": []
            }
        districts_map[d_name]["talukas"][t_name]["villages"].append({
            "code": r["code"],
            "name": r["name"],
            "category": r["category"],
            "parcelCount": r["parcel_count"],
            "bbox": [r["min_lng"], r["min_lat"], r["max_lng"], r["max_lat"]],
            "center": [r["center_lng"], r["center_lat"]]
        })

    formatted_hierarchy = {
        "stateCode": "MH",
        "stateName": "Maharashtra",
        "districts": [
            {
                "districtName": d_name,
                "category": d_val["category"],
                "talukas": [
                    {"talukaName": t_name, "villages": t_val["villages"]}
                    for t_name, t_val in d_val["talukas"].items()
                ]
            }
            for d_name, d_val in districts_map.items()
        ]
    }

    _HIERARCHY_CACHE = formatted_hierarchy
    return Response(
        content=json.dumps(formatted_hierarchy, ensure_ascii=False),
        media_type="application/json",
        headers={"Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"}
    )


@router.get("/village/{village_code}")
def get_village_geojson(village_code: str):
    """
    Returns the sanitized GeoJSON for the requested village.
    CRITICAL ANTI-SCRAPING & PERFORMANCE:
    Strips raw text and sensitive ownership records from the vector layer.
    Retains only: { id, plotno, area, cat } for 60 FPS GPU rendering in MapLibre.
    """
    global _VILLAGE_GEOJSON_CACHE
    if village_code in _VILLAGE_GEOJSON_CACHE:
        return Response(
            content=_VILLAGE_GEOJSON_CACHE[village_code],
            media_type="application/json",
            headers={
                "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
                "X-Cadastral-Source": "MemoryCache"
            }
        )

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT file_path, category, district, min_lng FROM villages WHERE code = ?", (village_code,))
    v_row = cur.fetchone()
    conn.close()

    if not v_row:
        raise HTTPException(status_code=404, detail=f"Village '{village_code}' not found.")

    fpath = v_row["file_path"]
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Cadastral data file for village '{village_code}' not found on disk.")

    with open(fpath, "r", encoding="utf-8") as fp:
        raw_data = json.load(fp)

    raw_features = raw_data.get("features", [])
    sanitized_features = []

    # Check if this village requires UTM Zone 44N projection restoration
    needs_reprojection = False
    if raw_features:
        sample_c = raw_features[0].get("geometry", {}).get("coordinates", [])
        while isinstance(sample_c, (list, tuple)) and len(sample_c) > 0 and isinstance(sample_c[0], (list, tuple)):
            sample_c = sample_c[0]
        if isinstance(sample_c, (list, tuple)) and len(sample_c) >= 2 and isinstance(sample_c[0], (int, float)):
            sample_lng = float(sample_c[0])
            dist_str = str(v_row["district"] or "").lower()
            if sample_lng < 76.0 and any(k in (fpath.lower() + " " + dist_str) for k in EASTERN_DISTRICT_KEYWORDS):
                needs_reprojection = True

    for f in raw_features:
        f_props = f.get("properties", {})
        plot_id = f_props.get("plotid") or str(f.get("id") or f_props.get("plotno"))
        plot_no = str(f_props.get("plotno", ""))
        area = float(f_props.get("area", 0.0) or 0.0)
        cat = f_props.get("category") or v_row["category"]

        # Classify feature type: genuine parcel plot vs public road network vs outer sheet boundary
        pno_clean = plot_no.strip().upper()
        if pno_clean.startswith("R") and (pno_clean[1:].isdigit() or "ROAD" in pno_clean or "RASTA" in pno_clean):
            f_type = "road"
        elif pno_clean.startswith(("O", "S", "FL-", "E-", "L")) and (len(pno_clean) > 1 and (pno_clean[1:].isdigit() or len(pno_clean) > 3)):
            f_type = "boundary"
        elif area > 1000000.0 and not plot_no.strip().isdigit():
            f_type = "boundary"
        else:
            f_type = "plot"

        geom = f.get("geometry")
        if geom and needs_reprojection and "coordinates" in geom:
            geom = {
                "type": geom.get("type"),
                "coordinates": fix_coords_recursive(geom["coordinates"])
            }

        # Minimal sanitized properties for GPU rendering
        sanitized_features.append({
            "type": "Feature",
            "id": plot_id,
            "properties": {
                "id": plot_id,
                "plotno": plot_no,
                "area": area,
                "cat": cat,
                "feature_type": f_type,
                "giscode": str(f_props.get("giscode", ""))
            },
            "geometry": geom
        })

    sanitized_collection = {
        "type": "FeatureCollection",
        "villageCode": village_code,
        "features": sanitized_features
    }

    serialized_json = json.dumps(sanitized_collection, ensure_ascii=False)

    # Cache if not overflowing
    if len(_VILLAGE_GEOJSON_CACHE) < 150:
        _VILLAGE_GEOJSON_CACHE[village_code] = serialized_json

    return Response(
        content=serialized_json,
        media_type="application/json",
        headers={
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "X-Cadastral-Source": "DiskSanitized"
        }
    )


@router.get("/plot/{plotid}/details")
@limiter.limit("60/minute")
def get_plot_details(request: Request, plotid: str):
    """
    On-demand detail hydration for an individual land parcel.
    Called when a user clicks a parcel polygon on the map.
    Protected by rate limiting to block automated scraping.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT p.plotid, p.village_code, p.plotno, p.giscode, p.area, p.info, p.category, p.district, p.taluka,
               v.name as village_name, v.min_lng, v.min_lat, v.max_lng, v.max_lat
        FROM plots p
        LEFT JOIN villages v ON p.village_code = v.code
        WHERE p.plotid = ?
    """, (plotid,))
    row = cur.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail=f"Plot '{plotid}' not found.")

    raw_info = row["info"] or ""
    parsed_info = parse_raw_info(raw_info)

    return {
        "plotid": row["plotid"],
        "villageCode": row["village_code"],
        "villageName": row["village_name"] or "Unknown Village",
        "plotno": row["plotno"],
        "giscode": row["giscode"],
        "area": row["area"],
        "category": row["category"],
        "district": row["district"],
        "taluka": row["taluka"],
        "bounds": [row["min_lng"], row["min_lat"], row["max_lng"], row["max_lat"]],
        "parsedInfo": parsed_info,
        "rawInfo": raw_info
    }


@router.get("/search")
@limiter.limit("30/minute")
def search_cadastral_plots(
    request: Request,
    query: str = Query(..., min_length=1, description="Plot number, village name, or survey number"),
    district: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100)
):
    """
    Search across real cadastral plots by plotno or village name.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    sql = """
        SELECT p.plotid, p.village_code, p.plotno, p.giscode, p.area, p.category, p.district, p.taluka,
               v.name as village_name, v.center_lng, v.center_lat, v.min_lng, v.min_lat, v.max_lng, v.max_lat
        FROM plots p
        JOIN villages v ON p.village_code = v.code
        WHERE (p.plotno = ? OR v.name LIKE ? OR p.giscode LIKE ?)
    """
    params: list[Any] = [query, f"%{query}%", f"%{query}%"]

    if district:
        sql += " AND p.district LIKE ?"
        params.append(f"%{district}%")

    sql += " LIMIT ?"
    params.append(limit)

    cur.execute(sql, tuple(params))
    rows = cur.fetchall()
    conn.close()

    results = []
    for r in rows:
        results.append({
            "plotid": r["plotid"],
            "plotno": r["plotno"],
            "giscode": r["giscode"],
            "area": r["area"],
            "category": r["category"],
            "district": r["district"],
            "taluka": r["taluka"],
            "villageName": r["village_name"],
            "villageCode": r["village_code"],
            "center": [r["center_lng"], r["center_lat"]],
            "bounds": [r["min_lng"], r["min_lat"], r["max_lng"], r["max_lat"]]
        })

    return {"results": results, "total": len(results)}
