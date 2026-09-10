import { IsString, IsUUID, Length } from 'class-validator';

// The pre-account registration flow's own verify/resend pair - keyed by
// registrationId (a PendingRegistration row) rather than the signed-in
// user + method that VerifyOtpDto/ResendOtpDto use, since there's no
// account and no JWT yet at this point (see AuthService.verifyRegistrationOtp).
export class VerifyRegistrationOtpDto {
  @IsUUID()
  registrationId: string;

  @IsString()
  @Length(4, 10)
  code: string;
}

export class ResendRegistrationOtpDto {
  @IsUUID()
  registrationId: string;
}
