"""Ported from backend/src/notifications/email.service.ts.

Email OTP delivery via SMTP (Zoho Mail by default) using Python's
stdlib smtplib/email - no new dependency needed for a plain
send-and-forget SMTP relay, unlike the original's nodemailer.

Same "unset config -> 503 at call time, not at boot" pattern as
groq_service/sms_service: if MAIL_HOST is blank, every send_otp_email()
call raises. Unlike sms_service, this only *sends* - the OTP code
itself is generated, hashed, and checked by auth_service against the
User row's own email_otp_code_hash/email_otp_expires_at, since SMTP has
no server-side challenge/response verification.

Also provides generic send_email for notification delivery (workflows,
governance alerts, etc.).
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import HTTPException, status

from app.config import get_settings


def is_configured() -> bool:
    return bool(get_settings().mail_host)


def send_otp_email(to: str, code: str) -> None:
    settings = get_settings()
    if not settings.mail_host:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Email delivery is not configured (MAIL_HOST is not set)")

    message = MIMEMultipart("alternative")
    message["Subject"] = "Your BhoomiSetu verification code"
    message["From"] = settings.mail_from
    message["To"] = to
    message.attach(MIMEText(f"Your BhoomiSetu verification code is {code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.", "plain"))
    message.attach(MIMEText(
        f"""<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px">
  <h2 style="color:#1a6b3c;margin-top:0">BhoomiSetu Verification</h2>
  <p>Your one-time verification code is:</p>
  <div style="font-size:2rem;font-weight:700;letter-spacing:0.3em;color:#1a6b3c;text-align:center;padding:16px 0">{code}</div>
  <p style="color:#555;font-size:0.9rem">This code expires in <strong>10 minutes</strong>.<br>If you didn't request this, you can safely ignore this email.</p>
  <hr style="border:none;border-top:1px solid #e0e0e0">
  <p style="color:#999;font-size:0.8rem;margin-bottom:0">BhoomiSetu — Land Governance Platform</p>
</div>""",
        "html",
    ))

    try:
        with smtplib.SMTP_SSL(settings.mail_host, settings.mail_port, timeout=10) if settings.mail_secure else smtplib.SMTP(settings.mail_host, settings.mail_port, timeout=10) as server:
            if not settings.mail_secure:
                server.starttls()
            if settings.mail_user:
                server.login(settings.mail_user, settings.mail_password)
            server.sendmail(settings.mail_from, [to], message.as_string())
    except (smtplib.SMTPException, OSError) as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Email delivery failed ({error})") from error


# Generic email send for notification delivery (workflows, governance alerts, etc.)
# Returns True on success, False on failure (logs error but doesn't raise).
def send_email(to: str, subject: str, body_text: str, body_html: str | None = None) -> bool:
    settings = get_settings()
    if not settings.mail_host:
        return False

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = settings.mail_from
    message["To"] = to
    message.attach(MIMEText(body_text, "plain"))
    if body_html:
        message.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP_SSL(settings.mail_host, settings.mail_port, timeout=10) if settings.mail_secure else smtplib.SMTP(settings.mail_host, settings.mail_port, timeout=10) as server:
            if not settings.mail_secure:
                server.starttls()
            if settings.mail_user:
                server.login(settings.mail_user, settings.mail_password)
            server.sendmail(settings.mail_from, [to], message.as_string())
    except (smtplib.SMTPException, OSError):
        return False

    return True
