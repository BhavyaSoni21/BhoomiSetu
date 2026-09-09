import { IsEmail, IsIn, IsString, Matches, MinLength, ValidateIf } from 'class-validator';
import { ContactMethod, CONTACT_METHODS } from '../contact-method';

// Citizen self-registration (docs/FRONTEND_UPGRADE_SPEC.md §3) - a
// method-selector, not both fields at once: `method` picks which of
// email/mobileNumber is actually required and validated. Officer/Admin
// accounts are unaffected - they stay admin-created via POST /users
// (users.controller.ts), which this doesn't touch.
export class RegisterDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsIn(CONTACT_METHODS)
  method: ContactMethod;

  @ValidateIf((o) => o.method === 'EMAIL')
  @IsEmail()
  email?: string;

  @ValidateIf((o) => o.method === 'MOBILE')
  @Matches(/^[0-9]{10}$/, { message: 'mobileNumber must be a 10-digit Indian mobile number' })
  mobileNumber?: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password: string;

  @IsString()
  @MinLength(1)
  confirmPassword: string;
}
