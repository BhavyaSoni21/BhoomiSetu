import { Injectable, ServiceUnavailableException } from '@nestjs/common';

// Mobile OTP delivery (docs/FRONTEND_UPGRADE_SPEC.md §3). Fast2SMS was
// evaluated as a provider but ruled out (2026-09-10) and isn't wired up
// here any more - this is a provider-agnostic stub, always unconfigured,
// so mobile OTP consistently 503s (same "unset config -> 503 at call
// time, not at boot" pattern as GroqService/EmailService) rather than
// silently pretending to send a real code. Email OTP is unaffected.
//
// Whichever provider is chosen next: implement sendOtp/verifyOtp against
// its actual API here, and flip isConfigured to reflect whatever env vars
// that provider needs - the rest of the app (AuthService, AuthController)
// needs no changes, since it only depends on this interface.
@Injectable()
export class SmsService {
  get isConfigured(): boolean {
    return false;
  }

  async sendOtp(_mobileNumber: string): Promise<void> {
    throw new ServiceUnavailableException('SMS delivery is not configured - no SMS OTP provider is currently set up');
  }

  async verifyOtp(_mobileNumber: string, _code: string): Promise<boolean> {
    throw new ServiceUnavailableException('SMS delivery is not configured - no SMS OTP provider is currently set up');
  }
}
