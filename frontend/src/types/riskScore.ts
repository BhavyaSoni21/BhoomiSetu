export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskFactor {
  key: string;
  label: string;
  weight: number;
  available: boolean;
  score: number;
  rationale: string;
}

export interface RiskScore {
  parcelId: string;
  overallScore: number;
  riskBand: RiskBand;
  dataCompleteness: number;
  factors: RiskFactor[];
}
