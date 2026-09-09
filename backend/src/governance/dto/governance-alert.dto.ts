import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateGovernanceAlertStatusDto {
  @IsIn(['OPEN', 'REVIEWED', 'DISMISSED'])
  status: string;

  // Mandatory as of 2026-09-09, per the user's explicit follow-up: an
  // officer marking an alert reviewed or dismissing it must always record
  // why - enforced here (400 without one), not just hidden/disabled in the
  // UI (GovernanceAlertsPanel.tsx/GovernanceAlertDetailModal.tsx disable
  // both action buttons until a reason is typed).
  @IsString()
  @IsNotEmpty()
  reason: string;
}
