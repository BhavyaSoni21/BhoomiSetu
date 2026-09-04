import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
