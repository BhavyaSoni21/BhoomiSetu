import { IsEmail, IsIn, Matches, ValidateIf } from 'class-validator';
import { ContactMethod, CONTACT_METHODS } from '../contact-method';

// Profile "add or change contact method" (docs/FRONTEND_UPGRADE_SPEC.md §3):
// the same shape covers both add (the slot is currently empty) and change
// (the slot already holds a verified value) - AuthService decides which
// based on the signed-in user's current state, not a flag the client sends.
export class ContactDto {
  @IsIn(CONTACT_METHODS)
  method: ContactMethod;

  @ValidateIf((o) => o.method === 'EMAIL')
  @IsEmail()
  email?: string;

  @ValidateIf((o) => o.method === 'MOBILE')
  @Matches(/^[0-9]{10}$/, { message: 'mobileNumber must be a 10-digit Indian mobile number' })
  mobileNumber?: string;
}
