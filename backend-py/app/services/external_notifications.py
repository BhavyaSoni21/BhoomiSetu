import asyncio
import logging
import threading

from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.user import User
from app.services.bhashini import translate_text
from app.services.sms_service import is_configured as sms_configured, _TEXTBEE_API_URL
from app.services.email_service import is_configured as email_configured, send_otp_email
from app.config import get_settings
import httpx
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib

logger = logging.getLogger(__name__)

def _send_sms_raw(mobile_number: str, message: str) -> None:
    settings = get_settings()
    if not sms_configured() or not mobile_number:
        return
    try:
        response = httpx.post(
            _TEXTBEE_API_URL,
            headers={"x-api-key": settings.textbee_api_key, "Content-Type": "application/json"},
            json={"deviceId": settings.textbee_device_id, "simSubscriptionId": int(settings.textbee_sim_subscription_id), "recipients": [mobile_number], "message": message},
            timeout=10.0,
        )
        if response.status_code >= 400:
            logger.error(f"Failed to send SMS to {mobile_number}. HTTP {response.status_code}")
    except Exception as e:
        logger.error(f"Error sending SMS to {mobile_number}: {e}")

def _send_email_raw(to: str, subject: str, message: str) -> None:
    settings = get_settings()
    if not email_configured() or not to:
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.mail_from
    msg["To"] = to
    msg.attach(MIMEText(message, "plain"))
    
    html_content = f"""<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px">
      <h2 style="color:#1a6b3c;margin-top:0">{subject}</h2>
      <p style="font-size:1rem;color:#333;line-height:1.5">{message.replace(chr(10), '<br>')}</p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin-top:24px">
      <p style="color:#999;font-size:0.8rem;margin-bottom:0">BhoomiSetu — Land Governance Platform</p>
    </div>"""
    msg.attach(MIMEText(html_content, "html"))
    
    try:
        with smtplib.SMTP_SSL(settings.mail_host, settings.mail_port, timeout=10) if settings.mail_secure else smtplib.SMTP(settings.mail_host, settings.mail_port, timeout=10) as server:
            if not settings.mail_secure:
                server.starttls()
            if settings.mail_user:
                server.login(settings.mail_user, settings.mail_password)
            server.sendmail(settings.mail_from, [to], msg.as_string())
    except Exception as e:
        logger.error(f"Error sending email to {to}: {e}")

def _process_external_alert(mobile_number: str, email: str, message_en: str, target_lang: str):
    final_message = message_en
    if target_lang and target_lang.lower() != "en":
        try:
            # We need a new event loop since this is a new thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(translate_text(message_en, source_lang="en", target_lang=target_lang))
            loop.close()
            
            translated = result.translated_text
            # Format: English + Local Language (One Message)
            final_message = f"{message_en}\n\n{translated}"
        except Exception as e:
            logger.error(f"Translation failed for external alert, falling back to English: {e}")
            
    if mobile_number:
        _send_sms_raw(mobile_number, final_message)
    if email:
        _send_email_raw(email, "BhoomiSetu Update", final_message)

def send_citizen_alert(user: User, message_en: str) -> None:
    """
    Sends an external notification via SMS and Email to the user.
    The message is translated to the user's preferred language and sent as a single bilingual message.
    Operates in a background thread to prevent blocking the HTTP request/transaction.
    """
    if not user.mobile_number and not user.email:
        return
        
    # Copy string properties to avoid accessing SQLAlchemy object across threads
    mobile = user.mobile_number
    email = user.email
    lang = getattr(user, 'preferred_language', 'hi')
    
    thread = threading.Thread(
        target=_process_external_alert, 
        args=(mobile, email, message_en, lang),
        daemon=True
    )
    thread.start()

