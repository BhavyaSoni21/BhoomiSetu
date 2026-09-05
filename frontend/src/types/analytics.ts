// Shape of GET /api/v1/analytics/summary.
export interface Distribution {
  key: string;
  count: number;
}

export interface AnalyticsSummary {
  totals: {
    parcels: number;
    workflows: number;
    openAlerts: number;
    activeDisputes: number;
    totalUsers: number;
    recentLogins24h: number;
  };
  taxStatusDistribution: Distribution[];
  registrationStatusDistribution: Distribution[];
  landUseDistribution: Distribution[];
  disputeCaseStatusDistribution: Distribution[];
  workflowStatusDistribution: Distribution[];
  workflowTypeDistribution: Distribution[];
  alertSeverityDistribution: Distribution[];
  alertStatusDistribution: Distribution[];
}
