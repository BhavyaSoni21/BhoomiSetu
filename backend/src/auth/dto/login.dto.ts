import { IsEmail, IsString, Matches, MinLength, ValidateIf } from 'class-validator';

// Accepts either identifier (docs/FRONTEND_UPGRADE_SPEC.md §3: "POST
// /auth/login needs to accept either mobileNumber or email as the
// identifier") - kept as two named optional fields rather than one generic
// `identifier` field so every existing email-based login call site
// (LoginPage.tsx's officer/admin flow, every e2e spec's test-user login)
// keeps working unchanged. Exactly one is expected; AuthController prefers
// email when both are somehow given, but doesn't reject that combination -
// not worth a stricter validator for an edge case with no real bad outcome.
export class LoginDto {
  @ValidateIf((o) => !o.mobileNumber)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email)
  @Matches(/^[0-9]{10}$/, { message: 'mobileNumber must be a 10-digit Indian mobile number' })
  mobileNumber?: string;

  @IsString()
  @MinLength(1)
  password: string;
}
