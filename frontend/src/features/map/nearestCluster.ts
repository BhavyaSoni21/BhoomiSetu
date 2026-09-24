// Nearest cluster to a point, by centroid distance. Pure so the map wrapper
// can default a citizen's Find Parcels view to the cluster closest to their
// captured home coords (onboarding geolocation). Equirectangular approximation
// is plenty: clusters are city-scale and distances are only compared, never
// reported, so exact great-circle math would be wasted.
export interface ClusterBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface HierCluster {
  stateCode: string;
  districts: Array<{
    districtCode: string;
    clusters: Array<{ clusterId: string; bounds: ClusterBounds }>;
  }>;
}

export interface NearestMatch {
  stateCode: string;
  districtCode: string;
  clusterId: string;
  bounds: ClusterBounds;
}

export function nearestCluster(
  clusters: HierCluster[],
  lat: number,
  lng: number,
): NearestMatch | null {
  let best: NearestMatch | null = null;
  let bestD = Infinity;
  const latScale = Math.cos((lat * Math.PI) / 180); // longitude degrees shrink toward the poles
  for (const state of clusters) {
    for (const district of state.districts) {
      for (const c of district.clusters) {
        const cLng = (c.bounds.minLng + c.bounds.maxLng) / 2;
        const cLat = (c.bounds.minLat + c.bounds.maxLat) / 2;
        const dLat = cLat - lat;
        const dLng = (cLng - lng) * latScale;
        const d = dLat * dLat + dLng * dLng;
        if (d < bestD) {
          bestD = d;
          best = { stateCode: state.stateCode, districtCode: district.districtCode, clusterId: c.clusterId, bounds: c.bounds };
        }
      }
    }
  }
  return best;
}
