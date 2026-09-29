import { describe, it, expect, vi } from 'vitest';

// baseFillFor is pure, but it lives in MapComponent which imports maplibre-gl
// (and its worker URL) at module load. Stub both so the import is side-effect free.
vi.mock('./maplibreWorkerUrl', () => ({}));
vi.mock('maplibre-gl', () => ({ default: {}, Map: class {}, NavigationControl: class {} }));

import { baseFillFor } from './MapComponent';
import type { ParcelSummary } from '../../types/parcel';

const p = (o: Partial<ParcelSummary>): ParcelSummary =>
  ({ stateCode: 'DL', ...o } as ParcelSummary);

describe('baseFillFor', () => {
  it('tax officer: status → palette, unknown falls back to state color', () => {
    expect(baseFillFor('TAX_OFFICER', p({ taxStatus: 'PAID' }))).toBe('#22c55e');
    expect(baseFillFor('TAX_OFFICER', p({ taxStatus: 'OVERDUE' }))).toBe('#ef4444');
    expect(baseFillFor('TAX_OFFICER', p({ taxStatus: 'unknown' }))).toBe('#ef4444'); // DL state color
  });

  it('legal-title roles: severity → escalating color, 0 is green (real, not missing)', () => {
    expect(baseFillFor('REGISTRATION_OFFICER', p({ legalStatusSeverity: 3 }))).toBe('#dc2626');
    expect(baseFillFor('DISPUTE_OFFICER', p({ legalStatusSeverity: 0 }))).toBe('#10b981');
  });

  it('planning officer: value band indexes the palette, out-of-range → state color', () => {
    expect(baseFillFor('PLANNING_OFFICER', p({ valueBand: 3 }))).toBe('#41b6c4');
    expect(baseFillFor('PLANNING_OFFICER', p({ valueBand: 0 }))).toBe('#ef4444'); // DL
  });

  it('survey/admin: risk score bucket', () => {
    expect(baseFillFor('ADMIN', p({ riskScore: 80 }))).toBe('#ef4444');
    expect(baseFillFor('SURVEY_OFFICER', p({ riskScore: 10 }))).toBe('#10b981');
  });

  it('citizen / unknown role: location (state) color', () => {
    expect(baseFillFor('CITIZEN', p({ stateCode: 'MH' }))).toBe('#f97316');
    expect(baseFillFor(undefined, p({ stateCode: 'KA' }))).toBe('#10b981');
  });
});
