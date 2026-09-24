import { describe, it, expect } from 'vitest';
import { tilesForBounds } from './gis';

describe('tilesForBounds', () => {
  it('covers a bbox and inverts the y axis (north = smaller y)', () => {
    // Small bbox around Pune at a single zoom.
    const tiles = tilesForBounds([73.85, 18.52, 73.86, 18.53], 14, 14);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((t) => t.z === 14)).toBe(true);
    // Northern lat maps to a smaller tile-y than the southern lat.
    const ys = tiles.map((t) => t.y);
    expect(Math.min(...ys)).toBeLessThanOrEqual(Math.max(...ys));
  });

  it('honours the MAX_TILES hard cap on a wide bbox', () => {
    const tiles = tilesForBounds([68, 8, 97, 37], 11, 14); // ~all of India
    expect(tiles.length).toBeLessThanOrEqual(600);
  });
});
