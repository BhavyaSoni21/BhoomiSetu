export interface UnderstandRequestIn {
  parcel_id: string;
  description: string;
  conversation?: Array<Record<string, unknown>>;
  language?: string;
}

export interface FactStatement {
  statement: string;
  fact_type: 'DATABASE_FACT' | 'CITIZEN_STATEMENT';
  source?: string | null;
  confidence?: number | null;
}

export interface UnderstandRequestOut {
  parcel_id: string;
  intent?: string | null;
  issues: string[];
  facts_stated_by_citizen: string[];
  facts_database: string[];
  departments: string[];
  follow_up_questions: string[];
  application_draft?: string | null;
}

export interface ApplicationDraftIn {
  parcel_id: string;
  intent?: string | null;
  issues: string[];
  facts_stated_by_citizen: string[];
  facts_database: string[];
  departments: string[];
  conversation?: Array<Record<string, unknown>>;
  language?: string;
}

export interface ApplicationDraftOut {
  application_draft: string;
  facts_database: string[];
  citizen_statements: string[];
}

export interface DepartmentRouting {
  department: string;
  confidence?: number | null;
  reason?: string | null;
}

export interface RoutingDecisionOut {
  departments: DepartmentRouting[];
  workflows_per_department?: Record<string, unknown> | null;
  required_capabilities: string[];
  priority?: string | null;
  reason?: string | null;
}

export interface RoutingDecisionIn {
  parcel_id: string;
  intent?: string | null;
  issues: string[];
  departments: string[];
  language?: string;
}

export interface ApplicationCreate {
  parcel_id: string;
  intent?: string | null;
  priority?: string | null;
  application_draft?: string | null;
  citizen_edited_version?: string | null;
  ai_structured_understanding?: Record<string, unknown>;
  facts_database?: string[] | null;
  citizen_statements?: string[] | null;
  conversation?: Array<Record<string, unknown>> | null;
  routing_result?: Record<string, unknown> | null;
}

export interface CaseOut {
  id: string;
  caseNo: string;
  citizenId: string;
  parcelId: string;
  intent?: string | null;
  status: string;
  priority?: string | null;
  routingDecision?: Record<string, unknown> | null;
  slaConfigId?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
}

export interface ApplicationOut {
  id: string;
  case_id: string;
  original_input?: string | null;
  conversation?: Array<Record<string, unknown>> | null;
  ai_interpretation?: Record<string, unknown> | null;
  ai_draft?: string | null;
  citizen_edited_version?: string | null;
  final_submitted_version?: string | null;
  generated_document_path?: string | null;
  generated_at?: string | null;
  citizen_confirmed: boolean;
  citizen_confirmation_timestamp?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposedFieldChangeOut {
  id: string;
  caseId: string;
  parcelId: string;
  department: string;
  fieldName: string;
  currentValue: string | null;
  proposedValue: string;
  reason: string | null;
  proposedBy: string | null;
  status: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionRemarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposedFieldChangeIn {
  parcel_id: string;
  department: string;
  field_name: string;
  current_value: string | null;
  proposed_value: string;
  reason: string | null;
}

export interface FieldChangeApprovalIn {
  decision: string;
  remarks: string | null;
}

export interface AppointmentOut {
  id: string;
  caseId: string;
  citizenId: string;
  departmentId: string;
  officerId?: string | null;
  officeLocation?: string | null;
  date: string;
  timeSlot?: string | null;
  purpose?: string | null;
  requiredDocuments?: string[] | null;
  status: string;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface AppointmentCreate {
  citizen_id: string;
  department_id: string;
  officer_id?: string | null;
  office_location?: string | null;
  date: string;
  time_slot?: string | null;
  purpose?: string | null;
  required_documents?: string[] | null;
}

export interface DepartmentTaskOut {
  id: string;
  case_id: string;
  department_id: string;
  workflow_id?: string | null;
  status: string;
  assigned_officer_id?: string | null;
  assigned_verifier_id?: string | null;
  stage: number;
  stage_name?: string | null;
  resolution_mode?: string | null;
  resolution_decision?: string | null;
  resolution_remarks?: string | null;
  sla_threshold_hours?: number | null;
  sla_warning_threshold?: number | null;
  sla_breach_threshold?: number | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

// camelCase mirror of DepartmentTaskOut - the actual wire shape from the
// /cases/* endpoints (CamelModel serializes by_alias). Use this for tasks
// fetched from those routes; the snake_case form above lags the wire.
export interface DepartmentTask {
  id: string;
  caseId: string;
  caseNo?: string | null;
  departmentId: string;
  departmentName?: string | null;
  departmentCode?: string | null;
  workflowId?: string | null;
  status: string;
  assignedOfficerId?: string | null;
  assignedVerifierId?: string | null;
  stage: number;
  stageName?: string | null;
  resolutionMode?: string | null;
  resolutionDecision?: string | null;
  resolutionRemarks?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface CaseDetailOut {
  case: CaseOut;
  tasks: DepartmentTask[];
  timeline: CaseTimelineEventOut[];
  feedback: FeedbackOut[];
  ai_analysis?: AIAnalysisOut | null;
  routing_decision?: RoutingDecisionOut | null;
}

export interface CaseTimelineEventOut {
  id: string;
  case_id: string;
  task_id?: string | null;
  event_type: string;
  actor_id?: string | null;
  actor_role?: string | null;
  previous_state?: string | null;
  new_state?: string | null;
  event_metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface FeedbackOut {
  id: string;
  case_id: string;
  citizen_id: string;
  rating: number;
  comment?: string | null;
  created_at: string;
}

export interface AIAnalysisOut {
  id: string;
  case_id: string;
  structured_understanding?: Record<string, unknown> | null;
  application_draft?: string | null;
  created_at: string;
}

export interface RoutingDecisionOut {
  id: string;
  case_id: string;
  departments_routed: Array<Record<string, unknown>>;
  priority?: string | null;
}
