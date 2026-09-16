// Shape of the Governance Alerts API (backend/src/governance) - Tech.md #34.

export interface GovernanceAlert {
  id: string;
  parcelId: string;
  alertType: string;
  severity: string;
  source: string;
  status: string;
  explanation: string;
  reason: string | null;
  createdAt: string;
  department: string | null;
}
