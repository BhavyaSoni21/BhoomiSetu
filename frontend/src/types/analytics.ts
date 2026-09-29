// Shape of GET /api/v1/analytics/summary.
export interface Distribution {
  key: string;
  count: number;
}

export interface AnalyticsSummary {
  totals: {
    parcels: number;
    workflows: number;
    cases: number;
    openCases: number;
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
  caseStatusDistribution: Distribution[];
  caseIntentDistribution: Distribution[];
  casePriorityDistribution: Distribution[];
  departmentTaskStatusDistribution: Distribution[];
  alertSeverityDistribution: Distribution[];
  alertStatusDistribution: Distribution[];
}

// Shape of GET /api/v1/analytics/officer-monitoring - one entry per officer.
export interface OfficerMonitoringEntry {
  userId: string;
  name: string;
  role: string;
  department: string;
  // Role-level, not personal - WorkflowStep has no per-user assignee column,
  // only assignedRole, which every officer holding that role shares.
  pendingInRoleQueue: number;
  approvedCount: number;
  rejectedCount: number;
  avgDecisionHours: number | null;
  lastActivityAt: string | null;
}
