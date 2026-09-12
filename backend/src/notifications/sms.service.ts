import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

// SMS OTP delivery via TextBee (textbee.dev) - uses your Android phone as the
// SMS gateway. TextBee is a *send-only* gateway (no server-side OTP
// verification), so this service generates the code + bcrypt hash here and
// returns both to the caller (AuthService), which stores the hash on the User
// row and checks it later - exactly the same pattern as EmailService/email OTP.
//
// Same "unset config -> 503 at call time" pattern as the other services:
// if TEXTBEE_API_KEY is blank, every sendOtp() call throws
// ServiceUnavailableException and the caller (AuthService.register/resendOtp)
// swallows it - registration still succeeds, the citizen just can't verify
// mobile until the gateway is configured.
//
// TextBee API reference:
//   POST https://api.textbee.dev/api/v1/gateway/send-sms
//   Header: x-api-key: <TEXTBEE_API_KEY>
//   Body:   { deviceId, simSubscriptionId, recipients: ["+91..."], message }

const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 30;
const OTP_MAX_ATTEMPTS = 5;
const TEXTBEE_API_URL = 'https://api.textbee.dev/api/v1/gateway/send-sms';

export interface SmsOtpResult {
  codeHash: string;
  expiresAt: Date;
  sentAt: Date;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey: string | null;
  private readonly deviceId: string | null;
  private readonly simSubscriptionId: number;

  constructor() {
    this.apiKey = process.env.TEXTBEE_API_KEY || null;
    this.deviceId = process.env.TEXTBEE_DEVICE_ID || null;
    this.simSubscriptionId = Number(process.env.TEXTBEE_SIM_SUBSCRIPTION_ID ?? 2);
  }

  get isConfigured(): boolean {
    return this.apiKey !== null && this.deviceId !== null;
  }

  // Returns the hashed code + metadata for AuthService to persist on the User
  // row. The raw code is sent via TextBee but never persisted.
  async sendOtp(mobileNumber: string): Promise<SmsOtpResult> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'SMS delivery is not configured (TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID is not set)',
      );
    }

    const code = this.generateCode();
    const sentAt = new Date();
    const expiresAt = new Date(sentAt.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const codeHash = bcrypt.hashSync(code, 10);

    const message = `BhoomiSetu login code: ${code}. Expires in ${OTP_EXPIRY_MINUTES} minutes.`;

    const response = await fetch(TEXTBEE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId: this.deviceId,
        simSubscriptionId: this.simSubscriptionId,
        recipients: [mobileNumber],
        message,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`TextBee send-sms failed: HTTP ${response.status} - ${body}`);
      throw new ServiceUnavailableException(`SMS delivery failed (TextBee HTTP ${response.status})`);
    }

    this.logger.log(`SMS OTP sent to ${mobileNumber} via TextBee`);
    return { codeHash, expiresAt, sentAt };
  }

  // Pure local verification - no network call needed since we own the hash.
  // AuthService calls this with values from the User row after loading it.
  verifyOtp(
    storedHash: string | null,
    storedExpiresAt: Date | null,
    attempts: number,
    code: string,
  ): { valid: boolean; reason?: 'EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'WRONG_CODE' } {
    if (attempts >= OTP_MAX_ATTEMPTS) {
      return { valid: false, reason: 'TOO_MANY_ATTEMPTS' };
    }
    if (!storedHash || !storedExpiresAt || storedExpiresAt.getTime() < Date.now()) {
      return { valid: false, reason: 'EXPIRED' };
    }
    if (!bcrypt.compareSync(code, storedHash)) {
      return { valid: false, reason: 'WRONG_CODE' };
    }
    return { valid: true };
  }

  // Exposed so AuthService can enforce resend cooldown for SMS the same way
  // it already does for email OTP.
  get resendCooldownSeconds(): number {
    return OTP_RESEND_COOLDOWN_SECONDS;
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
