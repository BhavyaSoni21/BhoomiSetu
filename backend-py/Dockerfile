# GDAL (needed by GeoPandas/Shapely's compiled deps) is a system-level C
# library, not a clean `pip install` - PYTHON_MIGRATION_PLAN.md §4's Known
# Phase-0 gotcha. gdal-bin/libgdal-dev must land before `pip install`, not
# after, or geopandas's build step fails looking for gdal-config.
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin libgdal-dev g++ \
    libcairo2 \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
