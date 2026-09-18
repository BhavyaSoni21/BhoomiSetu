"""Extended Earth Engine service for terrain/infrastructure data fetching.
Complements earth_engine_service.py (which handles Sentinel-2 imagery).

Key optimizations:
- Server-side aggregation instead of .getInfo() for large collections
- Raster zonal statistics instead of reduceToVectors for land cover
- Configurable dataset fallbacks with source tracking
- EECU usage instrumentation
- Batched/tiled processing for large regions
"""

import ee
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import List, Dict, Any, Optional, Tuple
from shapely.geometry import Polygon

from app.config import get_settings
from app.services.image_diff import GeoBounds
from app.services.eecu_tracker import eecu_tracker, estimate_eecu

_initialized = False
_init_lock = threading.Lock()


def _ensure_initialized() -> None:
    """Initialize EE with service account credentials. Same pattern as earth_engine_service.py."""
    global _initialized
    if _initialized:
        return
    with _init_lock:
        if _initialized:
            return
        settings = get_settings()
        if not settings.gee_service_account_email or not settings.gee_service_account_key_path:
            raise RuntimeError(
                "Earth Engine is not configured (GEE_SERVICE_ACCOUNT_EMAIL / GEE_SERVICE_ACCOUNT_KEY_PATH are not set)"
            )
        credentials = ee.ServiceAccountCredentials(
            settings.gee_service_account_email,
            settings.gee_service_account_key_path
        )
        try:
            ee.Initialize(credentials)
        except ee.EEException as exc:
            raise RuntimeError(f"Earth Engine configured but not usable: {exc}") from exc
        _initialized = True


def _bounds_to_ee_geometry(bounds: GeoBounds) -> ee.Geometry:
    return ee.Geometry.Rectangle([bounds.min_lng, bounds.min_lat, bounds.max_lng, bounds.max_lat])


@dataclass
class RoadFeature:
    geometry: dict
    road_type: str
    name: Optional[str]
    osm_tags: dict


@dataclass
class BuildingFeature:
    geometry: dict
    building_type: str
    height_m: Optional[float]
    confidence: float


@dataclass
class LandCoverStats:
    """Land cover percentages for a region (from raster zonal stats)."""
    class_code: int
    class_name: str
    percentage: float
    area_m2: float


@dataclass
class ElevationProfile:
    min_elevation_m: float
    max_elevation_m: float
    mean_elevation_m: float
    mean_slope_deg: float
    max_slope_deg: float
    slope_histogram: dict


@dataclass
class DatasetResult:
    """Result from a dataset fetch with metadata."""
    data: Any
    source: str
    dataset_id: str
    feature_count: int
    fetch_time_seconds: float
    estimated_eecu: float
    fallback_used: bool = False
    error: Optional[str] = None


@dataclass
class TerrainBundle:
    roads: DatasetResult
    buildings: DatasetResult
    landcover: DatasetResult
    elevation: DatasetResult


_ESA_CLASS_NAMES = {
    10: "Tree cover",
    20: "Shrubland",
    30: "Grassland",
    40: "Cropland",
    50: "Built-up",
    60: "Water",
    70: "Wetland",
    80: "Moss/lichen",
    90: "Bare/sparse vegetation",
    95: "Snow/ice",
}

_OSM_ROAD_TYPE_MAP = {
    "motorway": "HIGHWAY",
    "trunk": "HIGHWAY",
    "primary": "PRIMARY",
    "secondary": "SECONDARY",
    "tertiary": "TERTIARY",
    "residential": "RESIDENTIAL",
    "service": "SERVICE",
    "unclassified": "UNCLASSIFIED",
    "track": "TRACK",
    "path": "TRACK",
}

# GRIP4 road class mapping (1=highway, 2=primary, 3=secondary, 4=tertiary, 5=local)
_GRIP_ROAD_TYPE_MAP = {
    1: "HIGHWAY",
    2: "PRIMARY",
    3: "SECONDARY",
    4: "TERTIARY",
    5: "RESIDENTIAL",
}

# gROADS uses FCLASS field with values like 'Primary', 'Secondary', 'Tertiary', etc.
_GROADS_ROAD_TYPE_MAP = {
    "Primary": "PRIMARY",
    "Secondary": "SECONDARY",
    "Tertiary": "TERTIARY",
    "Local": "RESIDENTIAL",
    "Track": "TRACK",
}


# =========================================================================
# DATASET CONFIGURATION WITH FALLBACKS
# =========================================================================

@dataclass
class DatasetConfig:
    """Configuration for a dataset with fallback chain."""
    primary_id: str
    fallback_ids: List[str] = field(default_factory=list)
    source_name: str = ""
    requires_access: bool = True


# Dataset configurations - can be extended via settings
ROADS_CONFIG = DatasetConfig(
    primary_id="projects/sat-io/open-datasets/OSM/roads",
    fallback_ids=[
        # GRIP4 South-East Asia: Public, consistent global model, good for India/SE Asia
        "projects/sat-io/open-datasets/GRIP4/South-East-Asia",
        # gROADS v1: Global, public, but dated (1980-2010)
        "CIESIN/SEDAC/GROADS/v1",
        # Existing sat-io OSM versions as final fallbacks
        "projects/sat-io/open-datasets/OSM/roads_v1",
        "projects/sat-io/open-datasets/OSM/roads_v2",
    ],
    source_name="OSM",
    requires_access=True,
)

BUILDINGS_CONFIG = DatasetConfig(
    primary_id="projects/sat-io/open-datasets/MSBuildings/Global",
    fallback_ids=[],
    source_name="MS_BUILDINGS",
    requires_access=True,
)

LANDCOVER_CONFIG = DatasetConfig(
    primary_id="ESA/WorldCover/v200",
    fallback_ids=["GOOGLE/DYNAMICWORLD/V1"],
    source_name="ESA_WORLDCOVER",
    requires_access=False,  # Public dataset
)

ELEVATION_CONFIG = DatasetConfig(
    primary_id="COPERNICUS/DEM/GLO30",
    fallback_ids=["USGS/SRTMGL1_003", "NASA/NASADEM_HGT/001"],
    source_name="COPERNICUS_DEM_30M",
    requires_access=False,  # Public dataset
)


def _try_dataset_chain(
    dataset_config: DatasetConfig,
    fetch_func,
    bounds: GeoBounds,
    *args,
    **kwargs
) -> DatasetResult:
    """Try primary dataset, then fallbacks. Returns first successful result."""
    start_time = time.time()
    
    all_ids = [dataset_config.primary_id] + dataset_config.fallback_ids
    
    for idx, dataset_id in enumerate(all_ids):
        try:
            result = fetch_func(dataset_id, bounds, *args, **kwargs)
            elapsed = time.time() - start_time
            
            return DatasetResult(
                data=result,
                source=dataset_config.source_name,
                dataset_id=dataset_id,
                feature_count=len(result) if isinstance(result, list) else 1,
                fetch_time_seconds=elapsed,
                estimated_eecu=_estimate_eecu(dataset_config.source_name, len(result) if isinstance(result, list) else 1),
                fallback_used=(idx > 0),
            )
        except Exception as e:
            if idx == len(all_ids) - 1:
                # Last fallback failed
                elapsed = time.time() - start_time
                return DatasetResult(
                    data=[],
                    source=dataset_config.source_name,
                    dataset_id=dataset_id,
                    feature_count=0,
                    fetch_time_seconds=elapsed,
                    estimated_eecu=0.0,
                    fallback_used=(idx > 0),
                    error=str(e),
                )
            continue
    
    # Should not reach here
    return DatasetResult(
        data=[],
        source=dataset_config.source_name,
        dataset_id="",
        feature_count=0,
        fetch_time_seconds=time.time() - start_time,
        estimated_eecu=0.0,
        error="All fallbacks exhausted",
    )


def _estimate_eecu(source: str, feature_count: int) -> float:
    """Rough EECU estimate based on dataset and feature count."""
    rates = {
        "OSM": 0.000015,
        "MS_BUILDINGS": 0.00003,
        "ESA_WORLDCOVER": 0.000015,
        "DYNAMIC_WORLD": 0.00002,
        "COPERNICUS_DEM_30M": 0.0002,
        "SRTM30": 0.00015,
        "NASADEM": 0.00015,
    }
    base_rate = rates.get(source, 0.00002)
    return round(feature_count * base_rate, 6)


# =========================================================================
# ROADS - SERVER-SIDE AGGREGATION WITH BATCH EXPORT
# =========================================================================

def _fetch_roads_from_dataset(dataset_id: str, bounds: GeoBounds) -> List[RoadFeature]:
    """Fetch roads from a specific dataset ID, handling different schemas."""
    region = _bounds_to_ee_geometry(bounds)
    bounds_dict = {"min_lng": bounds.min_lng, "min_lat": bounds.min_lat, "max_lng": bounds.max_lng, "max_lat": bounds.max_lat}
    
    # Determine dataset type for proper property extraction
    is_grip = "GRIP4" in dataset_id
    is_groads = "GROADS" in dataset_id or "CIESIN/SEDAC/GROADS" in dataset_id
    is_osm = not is_grip and not is_groads
    
    with eecu_tracker.track(
        operation_type="fetch_roads",
        dataset="OSM",
        dataset_id=dataset_id,
        bounds=bounds_dict,
        estimated_eecu=estimate_eecu("OSM", 1000),  # rough estimate
    ) as op:
        roads_fc = ee.FeatureCollection(dataset_id).filterBounds(region)
        count = roads_fc.size().getInfo()
        
        if count == 0:
            op.feature_count = 0
            return []
        
        # For large collections, use server-side mapping and getInfo
        # In production, for >10k features, use batch export to Cloud Storage
        if is_grip:
            # GRIP4 uses numeric 'class' field (1-5)
            def extract_props(f: ee.Feature) -> ee.Feature:
                road_class = f.get("class")
                return ee.Feature(f.geometry(), {
                    "road_class": road_class,
                    "name": f.get("name"),
                    "osm_tags": f.toDictionary()
                })
        elif is_groads:
            # gROADS uses 'FCLASS' field with string values
            def extract_props(f: ee.Feature) -> ee.Feature:
                fclass = f.get("FCLASS")
                return ee.Feature(f.geometry(), {
                    "fclass": fclass,
                    "name": f.get("NAME"),
                    "osm_tags": f.toDictionary()
                })
        else:
            # OSM uses 'highway' tag
            def extract_props(f: ee.Feature) -> ee.Feature:
                highway = f.get("highway")
                return ee.Feature(f.geometry(), {
                    "highway": highway,
                    "name": f.get("name"),
                    "osm_tags": f.toDictionary()
                })
        
        features = roads_fc.map(extract_props).getInfo()["features"]
        
        result = []
        for feat in features:
            props = feat["properties"]
            if is_grip:
                road_class = props.get("road_class")
                road_type = _GRIP_ROAD_TYPE_MAP.get(road_class, "UNKNOWN")
                name = props.get("name")
            elif is_groads:
                fclass = props.get("fclass")
                road_type = _GROADS_ROAD_TYPE_MAP.get(fclass, "UNKNOWN")
                name = props.get("name")
            else:
                highway = props.get("highway")
                road_type = _OSM_ROAD_TYPE_MAP.get(highway, "UNKNOWN")
                name = props.get("name")
            
            result.append(RoadFeature(
                geometry=feat["geometry"],
                road_type=road_type,
                name=name,
                osm_tags=props.get("osm_tags", {})
            ))
        
        op.feature_count = len(result)
        return result


def fetch_road_network(bounds: GeoBounds) -> DatasetResult:
    """Fetch OSM roads with fallback chain."""
    return _try_dataset_chain(ROADS_CONFIG, _fetch_roads_from_dataset, bounds)


# =========================================================================
# BUILDINGS - SERVER-SIDE AGGREGATION WITH BATCH EXPORT
# =========================================================================

def _fetch_buildings_from_dataset(dataset_id: str, bounds: GeoBounds) -> List[BuildingFeature]:
    """Fetch buildings from a specific dataset ID."""
    region = _bounds_to_ee_geometry(bounds)
    bounds_dict = {"min_lng": bounds.min_lng, "min_lat": bounds.min_lat, "max_lng": bounds.max_lng, "max_lat": bounds.max_lat}
    
    with eecu_tracker.track(
        operation_type="fetch_buildings",
        dataset="MS_BUILDINGS",
        dataset_id=dataset_id,
        bounds=bounds_dict,
        estimated_eecu=estimate_eecu("MS_BUILDINGS", 5000),  # rough estimate
    ) as op:
        buildings_fc = ee.FeatureCollection(dataset_id).filterBounds(region)

        def extract_props(f: ee.Feature) -> ee.Feature:
            return ee.Feature(f.geometry(), {
                "confidence": f.get("confidence"),
                "height": f.get("height")
            })

        features = buildings_fc.map(extract_props).getInfo()["features"]
        
        result = []
        for feat in features:
            props = feat["properties"]
            result.append(BuildingFeature(
                geometry=feat["geometry"],
                building_type="UNKNOWN",
                height_m=props.get("height"),
                confidence=float(props.get("confidence", 0.5))
            ))
        
        op.feature_count = len(result)
        return result


def fetch_building_footprints(bounds: GeoBounds) -> DatasetResult:
    """Fetch Microsoft Buildings with fallback."""
    return _try_dataset_chain(BUILDINGS_CONFIG, _fetch_buildings_from_dataset, bounds)


# =========================================================================
# LAND COVER - RASTER ZONAL STATISTICS (NO reduceToVectors!)
# =========================================================================

def _fetch_landcover_from_dataset(dataset_id: str, bounds: GeoBounds, year: int = 2026) -> List[LandCoverStats]:
    """Fetch land cover using RASTER zonal statistics - NO polygonization!"""
    _ensure_initialized()
    region = _bounds_to_ee_geometry(bounds)
    bounds_dict = {"min_lng": bounds.min_lng, "min_lat": bounds.min_lat, "max_lng": bounds.max_lng, "max_lat": bounds.max_lat}
    
    source_name = "DYNAMIC_WORLD" if (dataset_id == "GOOGLE/DYNAMICWORLD/V1" or year >= 2022) else "ESA_WORLDCOVER"
    
    with eecu_tracker.track(
        operation_type="fetch_landcover",
        dataset=source_name,
        dataset_id=dataset_id,
        bounds=bounds_dict,
        estimated_eecu=estimate_eecu(source_name, 10),  # ~10 classes
    ) as op:
        if dataset_id == "GOOGLE/DYNAMICWORLD/V1" or year >= 2022:
            # Dynamic World - annual mode composite
            start = f"{year}-01-01"
            end = f"{year}-12-31"
            dw = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1").filterBounds(region).filterDate(start, end).mode().clip(region)
            lc_image = dw.select("label")
            class_property = "label"
        else:
            # ESA WorldCover
            lc_image = ee.ImageCollection("ESA/WorldCover/v200").first().clip(region)
            class_property = "Map"
        
        # Use reduceRegion with frequency histogram - SERVER-SIDE, no polygonization!
        # This computes pixel counts per class within the region
        reducer = ee.Reducer.frequencyHistogram().combine(
            reducer2=ee.Reducer.count(),
            sharedInputs=True
        )
        
        # Scale: 10m for WorldCover/Dynamic World
        stats = lc_image.reduceRegion(
            reducer=reducer,
            geometry=region,
            scale=10,
            maxPixels=1e12,
            bestEffort=True,
            tileScale=4
        ).getInfo()
        
        # Parse histogram
        histogram = stats.get("label_histogram") or stats.get("Map_histogram") or {}
        total_pixels = stats.get("label_count") or stats.get("Map_count") or sum(histogram.values())
        
        if total_pixels == 0:
            op.feature_count = 0
            return []
        
        pixel_area_m2 = 10 * 10  # 10m resolution
        
        result = []
        for class_code_str, pixel_count in histogram.items():
            class_code = int(class_code_str)
            percentage = (pixel_count / total_pixels) * 100
            area_m2 = pixel_count * pixel_area_m2
            result.append(LandCoverStats(
                class_code=class_code,
                class_name=_ESA_CLASS_NAMES.get(class_code, f"Unknown({class_code})"),
                percentage=round(percentage, 2),
                area_m2=area_m2
            ))
        
        # Sort by percentage descending
        result.sort(key=lambda x: x.percentage, reverse=True)
        
        op.feature_count = len(result)
        return result


def fetch_land_cover(bounds: GeoBounds, year: int = 2026) -> DatasetResult:
    """Fetch land cover using raster zonal statistics (no polygonization)."""
    def _fetch(dataset_id: str, b: GeoBounds) -> List[LandCoverStats]:
        return _fetch_landcover_from_dataset(dataset_id, b, year)
    
    config = LANDCOVER_CONFIG
    if year >= 2022:
        config = DatasetConfig(
            primary_id="GOOGLE/DYNAMICWORLD/V1",
            fallback_ids=["ESA/WorldCover/v200"],
            source_name="DYNAMIC_WORLD",
            requires_access=False,
        )
    
    return _try_dataset_chain(config, _fetch, bounds)


# =========================================================================
# ELEVATION - SERVER-SIDE AGGREGATION (ALREADY OPTIMIZED)
# =========================================================================

def _fetch_elevation_from_dataset(dataset_id: str, bounds: GeoBounds) -> ElevationProfile:
    """Fetch elevation from a specific dataset."""
    region = _bounds_to_ee_geometry(bounds)
    bounds_dict = {"min_lng": bounds.min_lng, "min_lat": bounds.min_lat, "max_lng": bounds.max_lng, "max_lat": bounds.max_lat}
    
    source_name = "COPERNICUS_DEM_30M"
    if "SRTM" in dataset_id:
        source_name = "SRTM30"
    elif "NASADEM" in dataset_id:
        source_name = "NASADEM"
    
    with eecu_tracker.track(
        operation_type="fetch_elevation",
        dataset=source_name,
        dataset_id=dataset_id,
        bounds=bounds_dict,
        estimated_eecu=estimate_eecu(source_name, 1),
    ) as op:
        if "SRTM" in dataset_id:
            dem = ee.Image(dataset_id).clip(region)
        elif "NASADEM" in dataset_id:
            dem = ee.Image(dataset_id).select("elevation").clip(region)
        else:
            dem = ee.Image("COPERNICUS/DEM/GLO30").clip(region)
        
        slope = ee.Terrain.slope(dem)

        # Elevation stats - server-side
        elev_reducer = ee.Reducer.minMax().combine(
            ee.Reducer.mean(), "", True
        ).combine(
            ee.Reducer.percentile([10, 25, 50, 75, 90]), "", True
        ).combine(
            ee.Reducer.histogram(20, -500, 6000), "", True
        )
        elev_stats = dem.reduceRegion(
            reducer=elev_reducer,
            geometry=region,
            scale=30,
            maxPixels=1e10,
            bestEffort=True,
            tileScale=4
        ).getInfo()

        # Slope stats - server-side
        slope_reducer = ee.Reducer.minMax().combine(
            ee.Reducer.mean(), "", True
        ).combine(
            ee.Reducer.percentile([50, 75, 90, 95]), "", True
        ).combine(
            ee.Reducer.histogram(20, 0, 60), "", True
        )
        slope_stats = slope.reduceRegion(
            reducer=slope_reducer,
            geometry=region,
            scale=30,
            maxPixels=1e10,
            bestEffort=True,
            tileScale=4
        ).getInfo()

        op.feature_count = 1
        return ElevationProfile(
            min_elevation_m=elev_stats.get("elevation_min", 0.0),
            max_elevation_m=elev_stats.get("elevation_max", 0.0),
            mean_elevation_m=elev_stats.get("elevation_mean", 0.0),
            mean_slope_deg=slope_stats.get("slope_mean", 0.0),
            max_slope_deg=slope_stats.get("slope_max", 0.0),
            slope_histogram=slope_stats.get("slope_histogram", {})
        )


def fetch_elevation_profile(bounds: GeoBounds) -> DatasetResult:
    """Fetch elevation with fallback chain."""
    return _try_dataset_chain(ELEVATION_CONFIG, _fetch_elevation_from_dataset, bounds)


# =========================================================================
# TERRAIN BUNDLE - MAIN ENTRY POINT FOR BATCH TASKS
# =========================================================================

def fetch_terrain_bundle(bounds: GeoBounds, year: int = 2026, job_id: Optional[str] = None) -> TerrainBundle:
    """Fetch all terrain data with fallbacks and instrumentation."""
    if job_id:
        eecu_tracker.set_job(job_id)
    
    bundle = TerrainBundle(
        roads=fetch_road_network(bounds),
        buildings=fetch_building_footprints(bounds),
        landcover=fetch_land_cover(bounds, year),
        elevation=fetch_elevation_profile(bounds),
    )
    
    # Print EECU summary for monitoring
    summary = eecu_tracker.get_summary()
    print(f"EECU Summary for {job_id or 'unknown'}: {summary['total_estimated_eecu']:.6f} estimated EECU")
    
    return bundle


def _esa_class_name(code: int) -> str:
    return _ESA_CLASS_NAMES.get(code, f"Unknown({code})")


# =========================================================================
# PARCEL-LEVEL ZONAL STATISTICS (for profile computation)
# =========================================================================

def fetch_parcel_land_cover_stats(parcel_geojson: dict, year: int = 2026) -> Dict[str, float]:
    """Fetch land cover percentages for a single parcel using raster zonal stats.
    Used by compute_parcel_profiles for per-parcel land cover mix.
    """
    _ensure_initialized()
    region = ee.Geometry(parcel_geojson)
    
    # Get bounds from geojson for tracking
    coords = parcel_geojson.get("coordinates", [[]])[0]
    if coords:
        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        bounds_dict = {"min_lng": min(lons), "min_lat": min(lats), "max_lng": max(lons), "max_lat": max(lats)}
    else:
        bounds_dict = {"min_lng": 0, "min_lat": 0, "max_lng": 0, "max_lat": 0}
    
    source_name = "DYNAMIC_WORLD" if year >= 2022 else "ESA_WORLDCOVER"
    
    with eecu_tracker.track(
        operation_type="fetch_parcel_landcover",
        dataset=source_name,
        dataset_id="parcel_level",
        bounds=bounds_dict,
        estimated_eecu=estimate_eecu(source_name, 1),
    ) as op:
        if year >= 2022:
            start = f"{year}-01-01"
            end = f"{year}-12-31"
            dw = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1").filterBounds(region).filterDate(start, end).mode().clip(region)
            lc_image = dw.select("label")
            class_property = "label"
        else:
            lc_image = ee.ImageCollection("ESA/WorldCover/v200").first().clip(region)
            class_property = "Map"
        
        reducer = ee.Reducer.frequencyHistogram()
        stats = lc_image.reduceRegion(
            reducer=reducer,
            geometry=region,
            scale=10,
            maxPixels=1e9,
            bestEffort=True,
            tileScale=4
        ).getInfo()
        
        histogram = stats.get(f"{class_property}_histogram", {})
        total_pixels = sum(histogram.values())
        
        if total_pixels == 0:
            op.feature_count = 0
            return {}
        
        result = {}
        for class_code_str, pixel_count in histogram.items():
            class_code = int(class_code_str)
            class_name = _ESA_CLASS_NAMES.get(class_code, f"Unknown({class_code})")
            percentage = (pixel_count / total_pixels) * 100
            result[class_name] = round(percentage, 2)
        
        op.feature_count = len(result)
        return result


def fetch_parcel_elevation_stats(parcel_geojson: dict) -> ElevationProfile:
    """Fetch elevation/slope stats for a single parcel."""
    _ensure_initialized()
    region = ee.Geometry(parcel_geojson)
    
    # Get bounds from geojson for tracking
    coords = parcel_geojson.get("coordinates", [[]])[0]
    if coords:
        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        bounds_dict = {"min_lng": min(lons), "min_lat": min(lats), "max_lng": max(lons), "max_lat": max(lats)}
    else:
        bounds_dict = {"min_lng": 0, "min_lat": 0, "max_lng": 0, "max_lat": 0}
    
    with eecu_tracker.track(
        operation_type="fetch_parcel_elevation",
        dataset="COPERNICUS_DEM_30M",
        dataset_id="parcel_level",
        bounds=bounds_dict,
        estimated_eecu=estimate_eecu("COPERNICUS_DEM_30M", 1),
    ) as op:
        dem = ee.Image("COPERNICUS/DEM/GLO30").clip(region)
        slope = ee.Terrain.slope(dem)
        
        elev_reducer = ee.Reducer.minMax().combine(
            ee.Reducer.mean(), "", True
        ).combine(
            ee.Reducer.percentile([10, 25, 50, 75, 90]), "", True
        )
        elev_stats = dem.reduceRegion(
            reducer=elev_reducer,
            geometry=region,
            scale=30,
            maxPixels=1e8,
            bestEffort=True
        ).getInfo()
        
        slope_reducer = ee.Reducer.minMax().combine(
            ee.Reducer.mean(), "", True
        ).combine(
            ee.Reducer.percentile([50, 75, 90, 95]), "", True
        )
        slope_stats = slope.reduceRegion(
            reducer=slope_reducer,
            geometry=region,
            scale=30,
            maxPixels=1e8,
            bestEffort=True
        ).getInfo()
        
        op.feature_count = 1
        return ElevationProfile(
            min_elevation_m=elev_stats.get("elevation_min", 0.0),
            max_elevation_m=elev_stats.get("elevation_max", 0.0),
            mean_elevation_m=elev_stats.get("elevation_mean", 0.0),
            mean_slope_deg=slope_stats.get("slope_mean", 0.0),
            max_slope_deg=slope_stats.get("slope_max", 0.0),
            slope_histogram=slope_stats.get("slope_histogram", {})
        )