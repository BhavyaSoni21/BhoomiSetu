"""EECU (Earth Engine Compute Unit) usage tracking and instrumentation."""

import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional, Any
from contextlib import contextmanager
from threading import local

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.processing_job import ProcessingJob
from app.database import SessionLocal


@dataclass
class EECUOperation:
    """Records a single Earth Engine operation."""
    operation_id: str
    operation_type: str  # "fetch_roads", "fetch_buildings", "fetch_landcover", "fetch_elevation", "reduce_region", etc.
    dataset: str
    dataset_id: str
    bounds: Dict[str, float]  # min_lng, min_lat, max_lng, max_lat
    start_time: float
    end_time: Optional[float] = None
    status: str = "running"  # "running", "succeeded", "failed"
    estimated_eecu: float = 0.0
    actual_eecu: Optional[float] = None
    error: Optional[str] = None
    feature_count: int = 0
    fallback_used: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


# Thread-local storage for current operation stack
_thread_local = local()


class EECUTracker:
    """Tracks EECU usage for Earth Engine operations."""
    
    def __init__(self):
        self._operations: list[EECUOperation] = []
        self._current_job_id: Optional[str] = None
    
    def set_job(self, job_id: str):
        """Set the current processing job ID."""
        self._current_job_id = job_id
        self._operations = []
    
    @contextmanager
    def track(self, operation_type: str, dataset: str, dataset_id: str, bounds: Dict[str, float], 
              estimated_eecu: float = 0.0, fallback_used: bool = False, **metadata):
        """Context manager to track an EE operation."""
        op_id = str(uuid.uuid4())[:8]
        operation = EECUOperation(
            operation_id=op_id,
            operation_type=operation_type,
            dataset=dataset,
            dataset_id=dataset_id,
            bounds=bounds,
            start_time=time.time(),
            estimated_eecu=estimated_eecu,
            fallback_used=fallback_used,
            metadata=metadata,
        )
        
        # Store in thread-local for nested calls
        if not hasattr(_thread_local, 'operation_stack'):
            _thread_local.operation_stack = []
        _thread_local.operation_stack.append(operation)
        
        try:
            yield operation
            operation.status = "succeeded"
        except Exception as e:
            operation.status = "failed"
            operation.error = str(e)
            raise
        finally:
            operation.end_time = time.time()
            _thread_local.operation_stack.pop()
            self._operations.append(operation)
            
            # Update job if tracking
            if self._current_job_id:
                self._update_job_tracking(operation)
    
    def _update_job_tracking(self, operation: EECUOperation):
        """Update the processing job with operation metrics."""
        db = SessionLocal()
        try:
            job = db.query(ProcessingJob).filter(ProcessingJob.id == self._current_job_id).first()
            if job:
                # Update dataset_status
                if not job.dataset_status:
                    job.dataset_status = {}
                
                dataset_key = operation.dataset.lower()
                if dataset_key not in job.dataset_status:
                    job.dataset_status[dataset_key] = {
                        "operations": 0,
                        "total_estimated_eecu": 0.0,
                        "total_actual_eecu": 0.0,
                        "feature_count": 0,
                        "fallback_used": False,
                    }
                
                ds = job.dataset_status[dataset_key]
                ds["operations"] = ds.get("operations", 0) + 1
                ds["total_estimated_eecu"] = round(ds.get("total_estimated_eecu", 0) + operation.estimated_eecu, 6)
                if operation.actual_eecu:
                    ds["total_actual_eecu"] = round(ds.get("total_actual_eecu", 0) + operation.actual_eecu, 6)
                ds["feature_count"] = ds.get("feature_count", 0) + operation.feature_count
                ds["fallback_used"] = ds.get("fallback_used", False) or operation.fallback_used
                if operation.status == "failed":
                    ds["last_error"] = operation.error
                
                # Update total
                job.total_estimated_eecu = round(sum(
                    d.get("total_estimated_eecu", 0) for d in job.dataset_status.values()
                ), 6)
                
                db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of all tracked operations."""
        total_estimated = sum(op.estimated_eecu for op in self._operations)
        total_actual = sum(op.actual_eecu or 0 for op in self._operations)
        by_dataset = {}
        
        for op in self._operations:
            if op.dataset not in by_dataset:
                by_dataset[op.dataset] = {
                    "operations": 0,
                    "estimated_eecu": 0.0,
                    "actual_eecu": 0.0,
                    "feature_count": 0,
                    "fallback_count": 0,
                    "errors": 0,
                }
            ds = by_dataset[op.dataset]
            ds["operations"] += 1
            ds["estimated_eecu"] += op.estimated_eecu
            ds["actual_eecu"] += op.actual_eecu or 0
            ds["feature_count"] += op.feature_count
            if op.fallback_used:
                ds["fallback_count"] += 1
            if op.status == "failed":
                ds["errors"] += 1
        
        return {
            "total_operations": len(self._operations),
            "total_estimated_eecu": round(total_estimated, 6),
            "total_actual_eecu": round(total_actual, 6),
            "by_dataset": by_dataset,
            "operations": [
                {
                    "id": op.operation_id,
                    "type": op.operation_type,
                    "dataset": op.dataset,
                    "dataset_id": op.dataset_id,
                    "duration_seconds": round((op.end_time or time.time()) - op.start_time, 2),
                    "status": op.status,
                    "estimated_eecu": op.estimated_eecu,
                    "actual_eecu": op.actual_eecu,
                    "feature_count": op.feature_count,
                    "fallback_used": op.fallback_used,
                    "error": op.error,
                }
                for op in self._operations
            ],
        }
    
    def estimate_monthly_usage(self, districts_per_month: int = 60) -> Dict[str, float]:
        """Estimate monthly EECU usage based on current operations."""
        if not self._operations:
            return {"estimated_monthly": 0.0, "per_district": 0.0, "safety_margin": 150.0}
        
        per_district = sum(op.estimated_eecu for op in self._operations)
        monthly = per_district * districts_per_month
        
        return {
            "per_district": round(per_district, 3),
            "estimated_monthly": round(monthly, 3),
            "free_tier_limit": 150.0,
            "remaining": round(150.0 - monthly, 3),
            "safety_margin_pct": round((150.0 - monthly) / 150.0 * 100, 1) if monthly < 150 else 0,
            "districts_per_month": districts_per_month,
        }


# Global tracker instance
eecu_tracker = EECUTracker()


# EECU cost estimates per dataset (per feature/operation)
EECU_RATES = {
    "OSM": 0.000015,           # per road feature
    "MS_BUILDINGS": 0.00003,   # per building feature
    "ESA_WORLDCOVER": 0.000015, # per land cover class (raster stats)
    "DYNAMIC_WORLD": 0.00002,   # per land cover class (raster stats)
    "COPERNICUS_DEM_30M": 0.0002, # per elevation tile (reduceRegion)
    "SRTM30": 0.00015,
    "NASADEM": 0.00015,
    "reduceRegion": 0.0001,     # generic reduceRegion
    "reduceToVectors": 0.01,    # EXPENSIVE - avoid!
    "export_table": 0.005,      # batch export to Cloud Storage
}


def estimate_eecu(dataset: str, feature_count: int = 1, operation: str = "reduceRegion") -> float:
    """Estimate EECU for an operation."""
    # Try dataset-specific rate first
    rate = EECU_RATES.get(dataset, EECU_RATES.get(operation, 0.00002))
    return round(feature_count * rate, 6)


def format_eecu_report(summary: Dict[str, Any]) -> str:
    """Format EECU summary as human-readable report."""
    lines = [
        "=" * 60,
        "EECU USAGE REPORT",
        "=" * 60,
        f"Total Operations: {summary['total_operations']}",
        f"Total Estimated EECU: {summary['total_estimated_eecu']:.6f}",
        f"Total Actual EECU: {summary['total_actual_eecu']:.6f}",
        "",
        "By Dataset:",
        "-" * 40,
    ]
    
    for dataset, stats in summary['by_dataset'].items():
        lines.extend([
            f"  {dataset}:",
            f"    Operations: {stats['operations']}",
            f"    Estimated EECU: {stats['estimated_eecu']:.6f}",
            f"    Actual EECU: {stats['actual_eecu']:.6f}",
            f"    Features: {stats['feature_count']}",
            f"    Fallbacks: {stats['fallback_count']}",
            f"    Errors: {stats['errors']}",
        ])
    
    lines.extend(["", "Monthly Projection (60 districts):", "-" * 40])
    monthly = summary['total_estimated_eecu'] * 60
    lines.extend([
        f"  Estimated Monthly: {monthly:.3f} EECU",
        f"  Free Tier Limit: 150.0 EECU",
        f"  Remaining: {150 - monthly:.3f} EECU",
        f"  Safety Margin: {((150 - monthly) / 150 * 100):.1f}%",
    ])
    
    return "\n".join(lines)