import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

// Email OTP delivery (docs/FRONTEND_UPGRADE_SPEC.md §3/§11 item 5 -
// previously a separate, unresolved gap from the SMS side). Plain SMTP via
// nodemailer rather than a vendor-specific API (SendGrid/Resend/etc.) -
// works against literally any SMTP-capable provider (Gmail, Outlook,
// Brevo/SendGrid's own SMTP relay, ...) by changing only env vars, so this
// isn't a vendor lock-in decision the way choosing Fast2SMS for SMS was.
// Same "unset config -> 503 at call time, not at boot" pattern as
// GroqService/SmsService, read from SMTP_HOST/PORT/USER/PASS/FROM/SECURE.
//
// Unlike SmsService, this only *sends* - the OTP code itself is generated,
// hashed, and checked by AuthService against the User row's own
// emailOtpCodeHash/emailOtpExpiresAt, since no generic SMTP provider does
// challenge/response verification the way Fast2SMS's Smart OTP API does.
@Injectable()
export class EmailService {
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor() {
    const host = process.env.SMTP_HOST || undefined;
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        })
      : null;
    this.from = process.env.SMTP_FROM || 'BhoomiSetu <no-reply@bhoomisetu.gov.in>';
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async sendOtpEmail(to: string, code: string): Promise<void> {
    if (!this.transporter) {
      throw new ServiceUnavailableException('Email delivery is not configured (SMTP_HOST is not set)');
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Your BhoomiSetu verification code',
      text: `Your BhoomiSetu verification code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      html: `<p>Your BhoomiSetu verification code is <strong>${code}</strong>. It expires in 10 minutes.</p><p>If you didn't request this, you can ignore this email.</p>`,
    });
  }
}
