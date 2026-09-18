#!/usr/bin/env python3
"""
Extract highway features from OSM PBF files using pyosmium and load into PostGIS road_networks table.
Optimized: processes all districts in a zone in a single PBF pass.
"""

import sys
import os
from typing import Dict, List, Tuple, Optional, Iterator
from dataclasses import dataclass, field
from uuid import uuid4
import json
from collections import defaultdict

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import osmium as osm
from osmium.osm import Way, Node, Relation, TagList
from app.database import SessionLocal
from app.models.terrain import RoadNetwork
from app.models.parcel import Parcel
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from geoalchemy2 import WKTElement
from shapely.geometry import LineString, Point

# Highway types we care about
HIGHWAY_TYPES = {
    'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
    'residential', 'service', 'unclassified', 'track', 'path',
    'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'
}

# Map OSM highway to our road_type
HIGHWAY_TO_ROAD_TYPE = {
    'motorway': 'HIGHWAY',
    'trunk': 'HIGHWAY',
    'primary': 'PRIMARY',
    'secondary': 'SECONDARY',
    'tertiary': 'TERTIARY',
    'residential': 'RESIDENTIAL',
    'service': 'SERVICE',
    'unclassified': 'UNCLASSIFIED',
    'track': 'TRACK',
    'path': 'TRACK',
    'motorway_link': 'HIGHWAY',
    'trunk_link': 'HIGHWAY',
    'primary_link': 'PRIMARY',
    'secondary_link': 'SECONDARY',
    'tertiary_link': 'TERTIARY',
}

@dataclass
class DistrictBounds:
    state_code: str
    district: str
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float

    def contains(self, lon: float, lat: float) -> bool:
        return self.min_lon <= lon <= self.max_lon and self.min_lat <= lat <= self.max_lat


class MultiDistrictHighwayHandler(osm.SimpleHandler):
    """Osmium handler to extract highways for multiple districts in a single PBF pass."""
    
    def __init__(self, districts: List[DistrictBounds]):
        super().__init__()
        self.districts = districts
        # Store highways per (state_code, district) key
        self.highways: Dict[Tuple[str, str], List[Dict]] = defaultdict(list)
        # Track node locations for way geometry building
        self._node_cache: Dict[int, Tuple[float, float]] = {}
    
    def _way_intersects_any(self, way: Way) -> List[DistrictBounds]:
        """Check which district bboxes this way intersects."""
        matching = []
        for dist in self.districts:
            for node in way.nodes:
                if dist.contains(node.lon, node.lat):
                    matching.append(dist)
                    break
        return matching
    
    def way(self, way: Way):
        # Check if it's a highway
        highway = way.tags.get('highway')
        if highway not in HIGHWAY_TYPES:
            return
        
        # Check which districts this way intersects
        matching_districts = self._way_intersects_any(way)
        if not matching_districts:
            return
        
        # Build geometry from node locations
        coords = []
        for node in way.nodes:
            # Node locations are available via locations=True in apply_file
            coords.append((node.lon, node.lat))
        
        if len(coords) < 2:
            return
        
        line = LineString(coords)
        name = way.tags.get('name')
        tags = dict(way.tags)
        road_type = HIGHWAY_TO_ROAD_TYPE.get(highway, 'UNKNOWN')
        
        hw_data = {
            'osm_id': way.id,
            'highway_type': highway,
            'road_type': road_type,
            'name': name,
            'geometry_wkt': line.wkt,
            'tags': tags,
        }
        
        # Add to all matching districts
        for dist in matching_districts:
            self.highways[(dist.state_code, dist.district)].append(hw_data)


def get_district_bounds() -> List[DistrictBounds]:
    """Get all district bounds from parcels table."""
    db = SessionLocal()
    try:
        result = db.execute(
            select(
                Parcel.state_code,
                Parcel.district_code,
                func.min(func.ST_XMin(Parcel.geometry)),
                func.min(func.ST_YMin(Parcel.geometry)),
                func.max(func.ST_XMax(Parcel.geometry)),
                func.max(func.ST_YMax(Parcel.geometry)),
            )
            .where(Parcel.state_code.isnot(None), Parcel.district_code.isnot(None))
            .group_by(Parcel.state_code, Parcel.district_code)
        ).all()
        return [
            DistrictBounds(
                state_code=r[0],
                district=r[1],
                min_lon=float(r[2]),
                min_lat=float(r[3]),
                max_lon=float(r[4]),
                max_lat=float(r[5]),
            )
            for r in result
        ]
    finally:
        db.close()


def map_state_to_pbf(state_code: str) -> str:
    """Map state code to PBF zone file."""
    zones = {
        # Northern zone
        'HP': 'northern', 'JK': 'northern', 'PB': 'northern', 'CH': 'northern',
        'HR': 'northern', 'DL': 'northern', 'RJ': 'northern', 'UP': 'northern',
        'UK': 'northern',
        # Central zone
        'MP': 'central', 'CG': 'central',
        # Western zone
        'MH': 'western', 'GJ': 'western', 'GA': 'western', 'DN': 'western', 'DD': 'western',
        # Southern zone
        'KA': 'southern', 'KL': 'southern', 'TN': 'southern', 'AP': 'southern',
        'TG': 'southern', 'PY': 'southern', 'LD': 'southern',
        # Eastern zone
        'BR': 'eastern', 'JH': 'eastern', 'WB': 'eastern', 'OD': 'eastern',
        # North-eastern zone
        'AS': 'north-eastern', 'AR': 'north-eastern', 'MN': 'north-eastern',
        'ML': 'north-eastern', 'MZ': 'north-eastern', 'NL': 'north-eastern',
        'TR': 'north-eastern', 'SK': 'north-eastern',
    }
    return zones.get(state_code, 'western')


def process_zone(zone: str, districts: List[DistrictBounds], pbf_dir: str):
    """Process a single PBF zone file for all its districts in ONE pass."""
    pbf_file = os.path.join(pbf_dir, f'{zone}-zone-260916.osm.pbf')
    if not os.path.exists(pbf_file):
        print(f"  PBF file not found: {pbf_file}")
        return
    
    print(f"  Processing {zone} zone ({len(districts)} districts) from {pbf_file}...")
    
    # Single handler for all districts in this zone
    handler = MultiDistrictHighwayHandler(districts)
    
    # Apply handler to PBF file ONCE with locations=True for node coordinates
    handler.apply_file(pbf_file, locations=True)
    
    # Store results per district
    for dbounds in districts:
        key = (dbounds.state_code, dbounds.district)
        highways = handler.highways.get(key, [])
        print(f"    {dbounds.state_code}/{dbounds.district}: found {len(highways)} highways", end=' ')
        
        if highways:
            store_highways(highways, dbounds.state_code, dbounds.district)
        else:
            print()


def store_highways(highways: List[Dict], state_code: str, district: str):
    """Store extracted highways in road_networks table."""
    db = SessionLocal()
    try:
        inserted = 0
        for hw in highways:
            stmt = pg_insert(RoadNetwork).values(
                osm_id=hw['osm_id'],
                name=hw['name'] or f"osm_{hw['osm_id']}",
                road_type=hw['road_type'],
                state_code=state_code,
                district=district,
                geometry=WKTElement(hw['geometry_wkt'], srid=4326),
                source='OSM_PBF',
                osm_tags=hw['tags'],
            ).on_conflict_do_nothing(
                index_elements=["osm_id", "state_code", "district"]
            )
            db.execute(stmt)
            inserted += 1
        
        db.commit()
        print(f"-> Inserted {inserted} roads")
    except Exception as e:
        db.rollback()
        print(f"-> Error: {e}")
    finally:
        db.close()


def main():
    """Main extraction function."""
    print("Extracting OSM roads from PBF files using pyosmium (single-pass per zone)...")
    
    # Get district bounds
    districts = get_district_bounds()
    print(f"Found {len(districts)} districts")
    
    # Group by PBF zone
    zones = defaultdict(list)
    for d in districts:
        zone = map_state_to_pbf(d.state_code)
        zones[zone].append(d)
    
    # PBF directory
    pbf_dir = r'D:\Projects\SIH_2026_BhoomiSetu\map'
    
    # Process each zone (single pass per zone)
    for zone, districts_in_zone in zones.items():
        process_zone(zone, districts_in_zone, pbf_dir)
    
    print("\nDone!")


if __name__ == '__main__':
    main()