# GDAL (needed by GeoPandas/Shapely's compiled deps) is a system-level C
# library, not a clean `pip install` - PYTHON_MIGRATION_PLAN.md §4's Known
# Phase-0 gotcha. gdal-bin/libgdal-dev must land before `pip install`, not
# after, or geopandas's build step fails looking for gdal-config.
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin libgdal-dev g++ \
    libcairo2 \
    libexpat1 \
    zlib1g \
    libbz2-1.0 \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Drop root: run as an unprivileged user. Render injects $PORT (>1024) so a
# non-root process can still bind it; the app writes only to /tmp, not /app,
# so no chown is needed.
RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8000
# Shell form so ${PORT} expands - Render (and most PaaS) inject the port to
# bind via $PORT; falls back to 8000 for local `docker run`.
#
# `alembic upgrade head` first: the schema is alembic-managed (no create_all
# anywhere), env.py reads the same prod DB URL from settings, and the versions/
# dir ships in the image (COPY . .). Without this the deploy applied NO
# migrations, so a prod DB lagging the code by even one revision (e.g. missing
# the home_latitude/home_longitude columns) makes the onboarding location save
# 500 with "could not save your information". upgrade is idempotent - a
# fully-migrated DB is a no-op. Fails loud (container won't start) if the DB is
# unreachable, which is the correct signal.
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
