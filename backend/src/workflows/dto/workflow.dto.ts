import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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

  @IsOptional()
  @IsString()
  remarks?: string;
}
