import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

// Email OTP delivery via Zoho Mail SMTP (docs/FRONTEND_UPGRADE_SPEC.md §3/§11
// item 5). Uses nodemailer against Zoho's SMTP relay (smtp.zoho.in:465, SSL)
// configured via MAIL_HOST/PORT/SECURE/USER/PASSWORD/FROM env vars. The same
// pattern works for any SMTP-capable provider by changing only those vars.
//
// Same "unset config -> 503 at call time, not at boot" pattern as
// GroqService/SmsService: if MAIL_HOST is blank the transporter is null and
// every sendOtpEmail() call throws ServiceUnavailableException.
//
// Unlike SmsService, this only *sends* - the OTP code itself is generated,
// hashed, and checked by AuthService against the User row's own
// emailOtpCodeHash/emailOtpExpiresAt, since SMTP has no server-side
// challenge/response verification.
@Injectable()
export class EmailService {
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor() {
    const host = process.env.MAIL_HOST || undefined;
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: Number(process.env.MAIL_PORT ?? 465),
          secure: (process.env.MAIL_SECURE ?? 'true') === 'true',
          auth:
            process.env.MAIL_USER
              ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD }
              : undefined,
        })
      : null;
    this.from = process.env.MAIL_FROM || process.env.MAIL_USER || 'BhoomiSetu <no-reply@bhoomisetu.gov.in>';
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async sendOtpEmail(to: string, code: string): Promise<void> {
    if (!this.transporter) {
      throw new ServiceUnavailableException('Email delivery is not configured (MAIL_HOST is not set)');
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Your BhoomiSetu verification code',
      text: `Your BhoomiSetu verification code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px">
  <h2 style="color:#1a6b3c;margin-top:0">BhoomiSetu Verification</h2>
  <p>Your one-time verification code is:</p>
  <div style="font-size:2rem;font-weight:700;letter-spacing:0.3em;color:#1a6b3c;text-align:center;padding:16px 0">${code}</div>
  <p style="color:#555;font-size:0.9rem">This code expires in <strong>10 minutes</strong>.<br>If you didn't request this, you can safely ignore this email.</p>
  <hr style="border:none;border-top:1px solid #e0e0e0">
  <p style="color:#999;font-size:0.8rem;margin-bottom:0">BhoomiSetu — Land Governance Platform</p>
</div>`,
    });
  }
}
