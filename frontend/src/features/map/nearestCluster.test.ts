import { describe, it, expect } from 'vitest';
import { nearestCluster, type HierCluster } from './nearestCluster';

const clusters: HierCluster[] = [
  {
    stateCode: 'MH',
    districts: [
      { districtCode: 'PUNE', clusters: [{ clusterId: 'pune-1', bounds: { minLng: 73.8, minLat: 18.5, maxLng: 73.9, maxLat: 18.6 } }] },
      { districtCode: 'NAGPUR', clusters: [{ clusterId: 'nag-1', bounds: { minLng: 79.0, minLat: 21.1, maxLng: 79.1, maxLat: 21.2 } }] },
    ],
  },
  {
    stateCode: 'TN',
    districts: [
      { districtCode: 'CHENNAI', clusters: [{ clusterId: 'chn-1', bounds: { minLng: 80.2, minLat: 13.0, maxLng: 80.3, maxLat: 13.1 } }] },
    ],
  },
];

describe('nearestCluster', () => {
  it('picks the cluster whose centroid is closest to the point', () => {
    // A point in central Pune -> pune-1, not the far Nagpur/Chennai clusters.
    const m = nearestCluster(clusters, 18.52, 73.85);
    expect(m?.clusterId).toBe('pune-1');
    expect(m?.districtCode).toBe('PUNE');
  });

  it('resolves across states (Chennai point -> chn-1)', () => {
    expect(nearestCluster(clusters, 13.05, 80.25)?.clusterId).toBe('chn-1');
  });

  it('returns null when there are no clusters', () => {
    expect(nearestCluster([], 18.5, 73.8)).toBeNull();
  });
});
