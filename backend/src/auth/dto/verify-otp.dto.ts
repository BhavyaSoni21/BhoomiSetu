import { IsIn, IsString, Length } from 'class-validator';
import { ContactMethod, CONTACT_METHODS } from '../contact-method';

export class VerifyOtpDto {
  @IsIn(CONTACT_METHODS)
  method: ContactMethod;

  @IsString()
  @Length(4, 10)
  code: string;
}

export class ResendOtpDto {
  @IsIn(CONTACT_METHODS)
  method: ContactMethod;
}
