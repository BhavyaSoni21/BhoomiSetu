// Tech.md #33's CHANGE ANALYSIS step, hand-rolled in place of OpenCV (this
// project keeps a single Node/TypeScript stack rather than adding a second
// Python service - see docs/Plan.md's Phase 9 verification note). Pure,
// dependency-free pixel comparison: given two same-sized raw RGBA buffers,
// find the bounding box of pixels that actually changed.

export interface PixelBox {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export interface ImageDiffResult {
  changed: boolean;
  changedPixelRatio: number;
  bbox: PixelBox | null;
}

// Per-channel average absolute difference above which a pixel counts as
// "changed" - tolerant of lossy re-encoding noise between two real photos of
// the same scene, sensitive enough to catch an actual new structure.
const CHANGE_THRESHOLD = 30;

// Below this fraction of the image, treat it as noise (JPEG artifacts,
// lighting) rather than a real physical change - mirrors OpenCV pipelines
// discarding tiny contours.
const MIN_CHANGED_PIXEL_RATIO = 0.002;

export function diffImages(before: Buffer, after: Buffer, width: number, height: number): ImageDiffResult {
  const channels = 4; // raw RGBA buffers, produced via sharp's ensureAlpha()
  let minRow = height, maxRow = -1, minCol = width, maxCol = -1, changedCount = 0;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = (row * width + col) * channels;
      const diff =
        (Math.abs(before[idx] - after[idx]) + Math.abs(before[idx + 1] - after[idx + 1]) + Math.abs(before[idx + 2] - after[idx + 2])) / 3;

      if (diff > CHANGE_THRESHOLD) {
        changedCount++;
        if (row < minRow) minRow = row;
        if (row > maxRow) maxRow = row;
        if (col < minCol) minCol = col;
        if (col > maxCol) maxCol = col;
      }
    }
  }

  const changedPixelRatio = changedCount / (width * height);
  const changed = changedPixelRatio >= MIN_CHANGED_PIXEL_RATIO;

  return { changed, changedPixelRatio, bbox: changed ? { minRow, maxRow, minCol, maxCol } : null };
}

export interface GeoBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

// Tech.md #33's CHANGE REGION step: the caller states the real geographic
// footprint the two images cover, so the detected pixel box can be mapped
// back to a real GeoJSON rectangle for the spatial-intersection step below.
export function pixelBoxToGeoBox(bbox: PixelBox, imageWidth: number, imageHeight: number, bounds: GeoBounds): GeoBounds {
  const lngPerCol = (bounds.maxLng - bounds.minLng) / imageWidth;
  const latPerRow = (bounds.maxLat - bounds.minLat) / imageHeight;

  return {
    minLng: bounds.minLng + bbox.minCol * lngPerCol,
    maxLng: bounds.minLng + (bbox.maxCol + 1) * lngPerCol,
    // Row 0 is the top of the image (= maxLat); increasing row = decreasing lat.
    maxLat: bounds.maxLat - bbox.minRow * latPerRow,
    minLat: bounds.maxLat - (bbox.maxRow + 1) * latPerRow,
  };
}
