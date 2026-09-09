import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateWorkflowDto {
  @IsUUID()
  parcelId: string;

  @IsString()
  @MaxLength(40)
  workflowType: string; // e.g. ROR_COPY_REQUEST | CORRECTION_REQUEST - free-form, not a fixed enum

  @IsOptional()
  @IsString()
  @MaxLength(100)
  createdBy?: string;

  @IsOptional()
  @IsString()
  requestDetails?: string;
}

export class UpdateWorkflowStatusDto {
  @IsString()
  @MaxLength(20)
  status: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

// The officer review action on a single workflow_steps row (Phase 7). Kept
// separate from UpdateWorkflowStatusDto above, which sets the workflow's
// overall current_status directly and is unchanged since Phase 6.
export class ReviewWorkflowStepDto {
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  // Mandatory as of 2026-09-10, same reasoning/precedent as
  // UpdateGovernanceAlertStatusDto.reason: an officer approving or rejecting
  // a request must always record why - enforced here (400 without one), not
  // just hidden/disabled in the UI (WorkflowReviewPanel.tsx disables both
  // buttons until remarks is typed).
  @IsString()
  @IsNotEmpty()
  remarks: string;
}

// Admin oversight "alert the officers" action (docs/ADMIN_PANEL_ISSUES.md
// Coming Soon #2 follow-up) - notifies whichever officer role owns a still-
// pending step, without deciding it. Deliberately separate from
// ReviewWorkflowStepDto: an Admin is not expected to approve/reject by
// default (WorkflowsController.escalateStep never touches step.status),
// only to flag a case for the responsible officer to prioritize.
export class EscalateWorkflowStepDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}
