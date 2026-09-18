"""CLI script to ingest Earth Engine terrain/infrastructure data.

Usage:
    python -m scripts.ingest_terrain district --state MH --district Pune
    python -m scripts.ingest_terrain state --state MH
    python -m scripts.ingest_terrain all --year 2026
    python -m scripts.ingest_terrain profiles --state MH --district Pune
    python -m scripts.ingest_terrain refresh-all
"""

import argparse
import sys
from datetime import datetime
from uuid import uuid4

from app.database import SessionLocal
from app.models.processing_job import ProcessingJob
from app.models.parcel import Parcel
from sqlalchemy import select, distinct
from app.tasks.terrain_tasks import (
    ingest_district_terrain,
    ingest_state_terrain,
    compute_parcel_profiles,
    refresh_all_terrain_profiles,
)


def _get_all_state_districts(db):
    """Get all unique state/district combinations from parcels."""
    result = db.execute(
        select(Parcel.state_code, Parcel.district_code)
        .distinct()
        .where(Parcel.state_code.isnot(None), Parcel.district_code.isnot(None))
    ).all()
    return [(row[0], row[1]) for row in result]


def run_district(state_code: str, district: str, year: int = 2026, wait: bool = False):
    """Run terrain ingestion for a single district."""
    db = SessionLocal()
    try:
        job = ProcessingJob(
            id=uuid4(),
            job_type="ingest_district_terrain",
            status="pending",
            payload={"state_code": state_code, "district": district, "year": year},
        )
        db.add(job)
        db.commit()
        job_id = str(job.id)
        print(f"Created job {job_id} for {state_code}/{district}")

        if wait:
            # Run synchronously
            result = ingest_district_terrain(job_id, state_code, district, year)
            print(f"Result: {result}")
        else:
            # Queue as async Celery task
            ingest_district_terrain.delay(job_id, state_code, district, year)
            print(f"Queued async task for {state_code}/{district}")

        return job_id
    finally:
        db.close()


def run_state(state_code: str, year: int = 2026, wait: bool = False):
    """Run terrain ingestion for all districts in a state."""
    db = SessionLocal()
    try:
        job = ProcessingJob(
            id=uuid4(),
            job_type="ingest_state_terrain",
            status="pending",
            payload={"state_code": state_code, "year": year},
        )
        db.add(job)
        db.commit()
        job_id = str(job.id)
        print(f"Created state job {job_id} for {state_code}")

        if wait:
            result = ingest_state_terrain(job_id, state_code, year)
            print(f"Result: {result}")
        else:
            ingest_state_terrain.delay(job_id, state_code, year)
            print(f"Queued async state task for {state_code}")

        return job_id
    finally:
        db.close()


def run_all_clusters(year: int = 2026, wait: bool = False):
    """Run terrain ingestion for ALL clusters (all state/district combos)."""
    db = SessionLocal()
    try:
        state_districts = _get_all_state_districts(db)
        if not state_districts:
            print("No state/district combinations found in parcels table")
            return

        print(f"Found {len(state_districts)} state/district combinations")

        # Create parent job
        parent_job = ProcessingJob(
            id=uuid4(),
            job_type="ingest_all_clusters_terrain",
            status="pending",
            payload={"year": year, "total_districts": len(state_districts)},
        )
        db.add(parent_job)
        db.commit()
        parent_job_id = str(parent_job.id)
        print(f"Created parent job {parent_job_id} for all clusters")

        # Queue district tasks
        for idx, (state_code, district) in enumerate(state_districts):
            child_job = ProcessingJob(
                id=uuid4(),
                job_type="ingest_district_terrain",
                status="pending",
                payload={"state_code": state_code, "district": district, "year": year},
            )
            db.add(child_job)
            db.commit()

            if wait:
                result = ingest_district_terrain(str(child_job.id), state_code, district, year)
                print(f"  [{idx+1}/{len(state_districts)}] {state_code}/{district}: {result}")
            else:
                ingest_district_terrain.delay(str(child_job.id), state_code, district, year)
                print(f"  [{idx+1}/{len(state_districts)}] Queued {state_code}/{district}")

        print(f"All {len(state_districts)} district jobs {'completed' if wait else 'queued'}")
        return parent_job_id
    finally:
        db.close()


def run_profiles(state_code: str, district: str, wait: bool = False):
    """Compute terrain profiles for parcels in a district."""
    db = SessionLocal()
    try:
        job = ProcessingJob(
            id=uuid4(),
            job_type="compute_parcel_profiles",
            status="pending",
            payload={"state_code": state_code, "district": district},
        )
        db.add(job)
        db.commit()
        job_id = str(job.id)
        print(f"Created profile job {job_id} for {state_code}/{district}")

        if wait:
            result = compute_parcel_profiles(job_id, state_code, district)
            print(f"Result: {result}")
        else:
            compute_parcel_profiles.delay(job_id, state_code, district)
            print(f"Queued async profile task for {state_code}/{district}")

        return job_id
    finally:
        db.close()


def run_refresh_all(wait: bool = False):
    """Refresh terrain profiles for all parcels."""
    db = SessionLocal()
    try:
        job = ProcessingJob(
            id=uuid4(),
            job_type="refresh_all_terrain_profiles",
            status="pending",
            payload={},
        )
        db.add(job)
        db.commit()
        job_id = str(job.id)
        print(f"Created refresh-all job {job_id}")

        if wait:
            result = refresh_all_terrain_profiles(job_id)
            print(f"Result: {result}")
        else:
            refresh_all_terrain_profiles.delay(job_id)
            print(f"Queued async refresh-all task")

        return job_id
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Ingest Earth Engine terrain data")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # District command
    district_parser = subparsers.add_parser("district", help="Ingest terrain for one district")
    district_parser.add_argument("--state", required=True, help="State code (e.g., MH)")
    district_parser.add_argument("--district", required=True, help="District name (e.g., Pune)")
    district_parser.add_argument("--year", type=int, default=2026, help="Year for land cover (default: 2026)")
    district_parser.add_argument("--wait", action="store_true", help="Run synchronously (blocking)")

    # State command
    state_parser = subparsers.add_parser("state", help="Ingest terrain for all districts in a state")
    state_parser.add_argument("--state", required=True, help="State code (e.g., MH)")
    state_parser.add_argument("--year", type=int, default=2026, help="Year for land cover (default: 2026)")
    state_parser.add_argument("--wait", action="store_true", help="Run synchronously (blocking)")

    # All clusters command
    all_parser = subparsers.add_parser("all", help="Ingest terrain for ALL clusters (all state/district combos)")
    all_parser.add_argument("--year", type=int, default=2026, help="Year for land cover (default: 2026)")
    all_parser.add_argument("--wait", action="store_true", help="Run synchronously (blocking)")

    # Profiles command
    profiles_parser = subparsers.add_parser("profiles", help="Compute parcel terrain profiles")
    profiles_parser.add_argument("--state", required=True, help="State code (e.g., MH)")
    profiles_parser.add_argument("--district", required=True, help="District name (e.g., Pune)")
    profiles_parser.add_argument("--wait", action="store_true", help="Run synchronously (blocking)")

    # Refresh all command
    refresh_parser = subparsers.add_parser("refresh-all", help="Refresh profiles for all parcels")
    refresh_parser.add_argument("--wait", action="store_true", help="Run synchronously (blocking)")

    args = parser.parse_args()

    if args.command == "district":
        run_district(args.state, args.district, args.year, args.wait)
    elif args.command == "state":
        run_state(args.state, args.year, args.wait)
    elif args.command == "all":
        run_all_clusters(args.year, args.wait)
    elif args.command == "profiles":
        run_profiles(args.state, args.district, args.wait)
    elif args.command == "refresh-all":
        run_refresh_all(args.wait)


if __name__ == "__main__":
    main()