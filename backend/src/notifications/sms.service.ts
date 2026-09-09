import { Injectable, ServiceUnavailableException } from '@nestjs/common';

// Mobile OTP delivery (docs/FRONTEND_UPGRADE_SPEC.md §3, provider chosen
// 2026-09-08: Fast2SMS - the user is already using it). Same "unset API key
// -> 503 at call time, not at boot" pattern as GroqService
// (backend/src/ai/groq.service.ts), read from FAST2SMS_API_KEY/
// FAST2SMS_OTP_ID.
//
// Deliberately thin: Fast2SMS's Smart OTP API generates, stores, and checks
// the code entirely on its own servers (confirmed against docs.fast2sms.com)
// - this service is just two REST calls, nothing here ever sees or stores
// the actual OTP code. That's the opposite of the email side (EmailService
// only sends; AuthService generates/hashes/checks the code itself), which is
// why the two channels don't share a common "OtpService" abstraction.
const FAST2SMS_BASE_URL = 'https://www.fast2sms.com/dev';

@Injectable()
export class SmsService {
  private readonly apiKey: string | undefined;
  private readonly otpId: string | undefined;

  constructor() {
    this.apiKey = process.env.FAST2SMS_API_KEY || undefined;
    this.otpId = process.env.FAST2SMS_OTP_ID || undefined;
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.otpId);
  }

  async sendOtp(mobileNumber: string): Promise<void> {
    if (!this.apiKey || !this.otpId) {
      throw new ServiceUnavailableException('SMS delivery is not configured (FAST2SMS_API_KEY/FAST2SMS_OTP_ID are not set)');
    }

    const response = await fetch(`${FAST2SMS_BASE_URL}/otp/send`, {
      method: 'POST',
      headers: { Authorization: this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: mobileNumber, otp_id: this.otpId }),
    });
    const body = (await response.json()) as { return?: boolean; message?: string };
    if (!response.ok || body.return !== true) {
      throw new ServiceUnavailableException(`Failed to send SMS OTP: ${body.message ?? response.statusText}`);
    }
  }

  // Fast2SMS is the source of truth for whether the code matches - this
  // returns exactly what it says, no local comparison of any kind.
  async verifyOtp(mobileNumber: string, code: string): Promise<boolean> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('SMS delivery is not configured (FAST2SMS_API_KEY is not set)');
    }

    const response = await fetch(`${FAST2SMS_BASE_URL}/otp/verify`, {
      method: 'POST',
      headers: { Authorization: this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: mobileNumber, otp: code }),
    });
    const body = (await response.json()) as { return?: boolean };
    return response.ok && body.return === true;
  }
}
