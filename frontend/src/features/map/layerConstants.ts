export type LayerKey =
  | 'selected'
  | 'adjacent'
  | 'nearby'
  | 'cluster'
  | 'sameDistrict'
  | 'cadastral'
  | 'zoning'
  | 'restriction'
  | 'taxStatus'
  | 'infrastructure'
  | 'changeDetection'
  | 'adminNotes'
  | 'roads'
  | 'buildings'
  | 'landcover'
  | 'elevation'
  | 'legalStatus'
  | 'circleRate'
  | 'riskScore'
  | 'mismatch'
  | 'unauthorized';

export const LAYER_KEYS: LayerKey[] = [
  'selected',
  'adjacent',
  'nearby',
  'cluster',
  'sameDistrict',
  'cadastral',
  'zoning',
  'restriction',
  'taxStatus',
  'infrastructure',
  'changeDetection',
  'adminNotes',
  'roads',
  'buildings',
  'landcover',
  'elevation',
  'legalStatus',
  'circleRate',
  'riskScore',
  'mismatch',
  'unauthorized',
];

export const DEFAULT_LAYER_VISIBILITY: Record<LayerKey, boolean> = {
  selected: true,
  adjacent: true,
  nearby: true,
  cluster: true,
  sameDistrict: false,
  cadastral: true,
  zoning: false,
  restriction: false,
  taxStatus: false,
  infrastructure: false,
  changeDetection: false,
  adminNotes: false,
  roads: false,
  buildings: false,
  landcover: false,
  elevation: false,
  legalStatus: false,
  circleRate: false,
  riskScore: false,
  mismatch: false,
  unauthorized: false,
};
