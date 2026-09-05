import { IsIn } from 'class-validator';

export class UpdateGovernanceAlertStatusDto {
  @IsIn(['OPEN', 'REVIEWED', 'DISMISSED'])
  status: string;
}
