"""
Cadastral Dataset Indexer and Sanitizer for BhoomiSetu.
Processes hierarchical Maharashtra cadastral GeoJSON files (State -> District -> Taluka -> Village),
computes exact bounding boxes, parses revenue metadata, and builds:
1. hierarchy.json - High-performance administrative tree for frontend navigation.
2. cadastral_index.db - Fast local SQLite database for instant plot detail lookups and anti-scraping hydration.
"""

import os
import sys
import glob
import json
import sqlite3
import re
from pathlib import Path

# Fix stdout encoding on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

DATASET_ROOT = r"C:\Users\Avadhut Vikas Gore\Downloads\bhumi dataset\maharashtra"
EXTRA_GEOJSON = r"d:\Bhoomisetu V2\000000000000000004.geojson"
OUTPUT_DIR = Path(r"d:\Bhoomisetu V2\backend-py\cadastral_data")
FRONTEND_DATA_DIR = Path(r"d:\Bhoomisetu V2\frontend\src\data")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = OUTPUT_DIR / "cadastral_index.db"
HIERARCHY_JSON_PATH = OUTPUT_DIR / "hierarchy.json"
FRONTEND_HIERARCHY_PATH = FRONTEND_DATA_DIR / "cadastralHierarchy.json"


def init_db(db_path: Path):
    if db_path.exists():
        try:
            db_path.unlink()
        except Exception:
            pass
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS villages (
            code TEXT PRIMARY KEY,
            name TEXT,
            taluka TEXT,
            district TEXT,
            category TEXT,
            parcel_count INTEGER,
            min_lng REAL,
            min_lat REAL,
            max_lng REAL,
            max_lat REAL,
            center_lng REAL,
            center_lat REAL,
            file_path TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS plots (
            plotid TEXT PRIMARY KEY,
            village_code TEXT,
            plotno TEXT,
            giscode TEXT,
            area REAL,
            info TEXT,
            category TEXT,
            district TEXT,
            taluka TEXT,
            FOREIGN KEY (village_code) REFERENCES villages(code)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_plots_village ON plots(village_code)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_plots_plotno ON plots(plotno)")
    conn.commit()
    return conn


def parse_village_prop(village_str: str):
    """
    Parses 'Category : U Urban, District : 23 Mumbai City, Taluka : 01 Mumbai City, Village : 000000000000000004 DADAR-NAIGAUM, '
    """
    parts = {}
    for seg in village_str.split(','):
        if ':' in seg:
            k, v = seg.split(':', 1)
            parts[k.strip().lower()] = v.strip()

    v_val = parts.get('village', '').strip()
    match = re.match(r'^([0-9]+)\s*(.*)$', v_val)
    if match:
        v_code = match.group(1).strip()
        v_name = match.group(2).strip() or v_code
    else:
        v_code = v_val
        v_name = v_val

    return {
        'category': parts.get('category', 'Urban').replace('Category : ', '').strip(),
        'district': parts.get('district', '').strip(),
        'taluka': parts.get('taluka', '').strip(),
        'village_code': v_code,
        'village_name': v_name
    }


from pyproj import Transformer

# Transformer to fix Eastern Maharashtra (UTM Zone 44N) data incorrectly exported via UTM Zone 43N
_T_TO_UTM43 = Transformer.from_crs('EPSG:4326', 'EPSG:32643', always_xy=True)
_T_TO_WGS84_Z44 = Transformer.from_crs('EPSG:32644', 'EPSG:4326', always_xy=True)

EASTERN_DISTRICT_KEYWORDS = [
    '08', '09', '10', '11', '12', '13', '14',
    'wardha', 'nagpur', 'nangpur', 'bhandara', 'gondiya', 'gondia', 'gadchiroli', 'chandrapur', 'yawatmal'
]


def needs_utm44_correction(fpath: str, district_name: str, sample_lng: float) -> bool:
    check_str = (fpath + " " + district_name).lower()
    return any(k in check_str for k in EASTERN_DISTRICT_KEYWORDS) and sample_lng < 76.0


def fix_coords_recursive(coords):
    if isinstance(coords, (list, tuple)) and len(coords) >= 2 and isinstance(coords[0], (int, float)):
        x, y = _T_TO_UTM43.transform(coords[0], coords[1])
        flon, flat = _T_TO_WGS84_Z44.transform(x, y)
        if len(coords) > 2:
            return [round(flon, 8), round(flat, 8), *coords[2:]]
        return [round(flon, 8), round(flat, 8)]
    return [fix_coords_recursive(c) for c in coords]


def normalize_feature_coordinates(features):
    """Normalizes features in place if they need UTM Zone 44N restoration."""
    for f in features:
        geom = f.get('geometry')
        if geom and 'coordinates' in geom:
            geom['coordinates'] = fix_coords_recursive(geom['coordinates'])


def compute_bbox(features):
    min_lng, min_lat = float('inf'), float('inf')
    max_lng, max_lat = float('-inf'), float('-inf')

    def check_coords(c):
        nonlocal min_lng, min_lat, max_lng, max_lat
        if isinstance(c, (list, tuple)) and len(c) >= 2 and isinstance(c[0], (int, float)):
            lng, lat = float(c[0]), float(c[1])
            if lng < min_lng: min_lng = lng
            if lng > max_lng: max_lng = lng
            if lat < min_lat: min_lat = lat
            if lat > max_lat: max_lat = lat
        elif isinstance(c, (list, tuple)):
            for sub in c:
                check_coords(sub)

    for f in features:
        geom = f.get('geometry')
        if geom and 'coordinates' in geom:
            check_coords(geom['coordinates'])

    if min_lng == float('inf'):
        return [72.8, 18.9, 73.0, 19.1], [72.9, 19.0]

    bbox = [round(min_lng, 6), round(min_lat, 6), round(max_lng, 6), round(max_lat, 6)]
    center = [round((min_lng + max_lng) / 2, 6), round((min_lat + max_lat) / 2, 6)]
    return bbox, center


def main():
    print(f"Starting Cadastral Dataset Indexing...")
    conn = init_db(DB_PATH)
    cur = conn.cursor()

    # Find all files
    all_files = glob.glob(os.path.join(DATASET_ROOT, '**', '*.geojson'), recursive=True)
    if os.path.exists(EXTRA_GEOJSON) and EXTRA_GEOJSON not in all_files:
        all_files.append(EXTRA_GEOJSON)

    print(f"Discovered {len(all_files)} GeoJSON files.")

    hierarchy = {
        "stateCode": "MH",
        "stateName": "Maharashtra",
        "districts": {}
    }

    processed_villages = set()
    total_plots = 0
    total_files = len(all_files)

    for idx, fpath in enumerate(all_files):
        if idx % 100 == 0 or idx == total_files - 1:
            print(f"Processing file {idx + 1}/{total_files}...")
            conn.commit()

        try:
            with open(fpath, 'r', encoding='utf-8') as fp:
                data = json.load(fp)
        except Exception as e:
            print(f"Warning: could not read {fpath}: {e}")
            continue

        features = data.get('features', [])
        if not features:
            continue

        # Extract village metadata from first feature or folder structure
        props = features[0].get('properties', {})
        v_info = parse_village_prop(props.get('village', ''))

        # Fallback to path tokens if empty
        rel_path = os.path.relpath(fpath, DATASET_ROOT) if fpath.startswith(DATASET_ROOT) else "Extra"
        path_parts = Path(rel_path).parts

        district_name = v_info.get('district') or props.get('district') or (path_parts[0] if len(path_parts) > 1 else "Unknown District")
        taluka_name = v_info.get('taluka') or props.get('taluka') or (path_parts[1] if len(path_parts) > 2 else "Unknown Taluka")
        village_code = v_info.get('village_code') or Path(fpath).stem
        village_name = v_info.get('village_name') or village_code
        category = props.get('category') or v_info.get('category') or ("Rural" if "Rural" in fpath else "Urban")

        # Unique key for village
        if village_code in processed_villages:
            # disambiguate if multiple
            village_code = f"{village_code}_{idx}"
        processed_villages.add(village_code)

        # Check if coordinates need UTM Zone 44N restoration (e.g. Nagpur/Vidarbha shifted west into Arabian Sea)
        sample_lng = 75.0
        geom0 = features[0].get('geometry', {})
        coords0 = geom0.get('coordinates', [])
        while isinstance(coords0, (list, tuple)) and len(coords0) > 0 and isinstance(coords0[0], (list, tuple)):
            coords0 = coords0[0]
        if isinstance(coords0, (list, tuple)) and len(coords0) >= 2 and isinstance(coords0[0], (int, float)):
            sample_lng = float(coords0[0])

        if needs_utm44_correction(fpath, district_name, sample_lng):
            normalize_feature_coordinates(features)

        bbox, center = compute_bbox(features)
        parcel_count = len(features)
        total_plots += parcel_count

        # Store village in DB
        cur.execute("""
            INSERT OR REPLACE INTO villages (
                code, name, taluka, district, category, parcel_count,
                min_lng, min_lat, max_lng, max_lat, center_lng, center_lat, file_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            village_code, village_name, taluka_name, district_name, category, parcel_count,
            bbox[0], bbox[1], bbox[2], bbox[3], center[0], center[1], fpath
        ))

        # Store plot details for hydration
        plot_records = []
        for f in features:
            f_props = f.get('properties', {})
            plot_id = f_props.get('plotid') or str(f.get('id') or f_props.get('plotno'))
            plot_records.append((
                plot_id,
                village_code,
                str(f_props.get('plotno', '')),
                str(f_props.get('giscode', '')),
                float(f_props.get('area', 0.0) or 0.0),
                f_props.get('info', ''),
                category,
                district_name,
                taluka_name
            ))

        cur.executemany("""
            INSERT OR REPLACE INTO plots (
                plotid, village_code, plotno, giscode, area, info, category, district, taluka
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, plot_records)

        # Build in-memory hierarchy tree
        dist_key = district_name.strip()
        if dist_key not in hierarchy["districts"]:
            hierarchy["districts"][dist_key] = {
                "districtName": dist_key,
                "category": category,
                "talukas": {}
            }

        tal_key = taluka_name.strip()
        if tal_key not in hierarchy["districts"][dist_key]["talukas"]:
            hierarchy["districts"][dist_key]["talukas"][tal_key] = {
                "talukaName": tal_key,
                "villages": []
            }

        hierarchy["districts"][dist_key]["talukas"][tal_key]["villages"].append({
            "code": village_code,
            "name": village_name,
            "category": category,
            "parcelCount": parcel_count,
            "bbox": bbox,
            "center": center
        })

    conn.commit()

    # Format hierarchy tree to JSON list
    formatted_hierarchy = {
        "stateCode": "MH",
        "stateName": "Maharashtra",
        "districts": []
    }

    for d_name, d_val in sorted(hierarchy["districts"].items()):
        taluka_list = []
        for t_name, t_val in sorted(d_val["talukas"].items()):
            taluka_list.append({
                "talukaName": t_name,
                "villages": sorted(t_val["villages"], key=lambda v: v["name"])
            })
        formatted_hierarchy["districts"].append({
            "districtName": d_name,
            "category": d_val["category"],
            "talukas": taluka_list
        })

    print(f"Writing hierarchy JSON to {HIERARCHY_JSON_PATH}...")
    with open(HIERARCHY_JSON_PATH, 'w', encoding='utf-8') as out_fp:
        json.dump(formatted_hierarchy, out_fp, ensure_ascii=False, indent=2)

    try:
        FRONTEND_DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(FRONTEND_HIERARCHY_PATH, 'w', encoding='utf-8') as f_out:
            json.dump(formatted_hierarchy, f_out, ensure_ascii=False)
        print(f"Successfully copied to frontend: {FRONTEND_HIERARCHY_PATH}")
    except Exception as e:
        print(f"Could not copy to frontend: {e}")

    cur.execute("SELECT count(*) FROM villages")
    v_count = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM plots")
    p_count = cur.fetchone()[0]

    conn.close()
    print("==================================================")
    print(f"Indexing Complete!")
    print(f"Total Villages indexed: {v_count}")
    print(f"Total Plots indexed:    {p_count}")
    print(f"SQLite DB size:         {os.path.getsize(DB_PATH) / (1024*1024):.2f} MB")
    print(f"Hierarchy JSON size:    {os.path.getsize(HIERARCHY_JSON_PATH) / 1024:.2f} KB")
    print("==================================================")


if __name__ == "__main__":
    main()
