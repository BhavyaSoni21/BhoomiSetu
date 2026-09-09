import { IsOptional, IsString, MaxLength } from 'class-validator';

// Profile "more info, editable" (docs/FRONTEND_UPGRADE_SPEC.md follow-up,
// 2026-09-09) - partial update, no OTP step (unlike ContactDto's email/
// mobile - these aren't identity-verification critical). Every field
// optional so the client can send only what changed.
export class ProfileDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  governmentIdNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  occupation?: string;
}
