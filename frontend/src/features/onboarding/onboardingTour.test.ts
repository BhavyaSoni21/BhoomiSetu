import { describe, it, expect } from 'vitest';
import { pickVisibleSteps } from './onboardingTour';

const defs = [
  { tourId: 'a', titleKey: 'a', titleFallback: 'A', descKey: 'ad', descFallback: 'Ad' },
  { tourId: 'b', titleKey: 'b', titleFallback: 'B', descKey: 'bd', descFallback: 'Bd' },
  { tourId: 'c', titleKey: 'c', titleFallback: 'C', descKey: 'cd', descFallback: 'Cd' },
];

describe('pickVisibleSteps', () => {
  it('keeps only steps whose target resolves, preserving order', () => {
    const el = {} as Element;
    // 'b' is not visible (e.g. role/permission-hidden or off-viewport) -> dropped.
    const resolve = (id: string) => (id === 'b' ? null : el);
    const picked = pickVisibleSteps(defs, resolve);
    expect(picked.map((p) => p.def.tourId)).toEqual(['a', 'c']);
    expect(picked.every((p) => p.element === el)).toBe(true);
  });

  it('returns empty when nothing resolves', () => {
    expect(pickVisibleSteps(defs, () => null)).toEqual([]);
  });
});
