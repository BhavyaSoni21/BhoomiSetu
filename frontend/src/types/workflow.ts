// Shape of the Workflow API (backend/src/workflows) - citizen service
// requests, e.g. a request for a copy of the RoR or a correction request.

export interface WorkflowStep {
  id: string;
  stepOrder: number;
  department: string;
  assignedRole: string;
  status: string;
  action: string | null;
  remarks: string | null;
  completedAt: string | null;
}

export interface Workflow {
  id: string;
  parcelId: string;
  workflowType: string;
  currentStatus: string;
  createdBy: string | null;
  requestDetails: string | null;
  lastRemarks: string | null;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStep[];
}
