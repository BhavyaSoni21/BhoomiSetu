#!/usr/bin/env python
"""
Test script for Email service only with detailed debugging.
Run from backend-py directory with: python test_email.py
"""

import sys
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Add the current directory to the path so we can import app modules
sys.path.insert(0, os.path.dirname(__file__))

from app.config import get_settings


def test_email_raw():
    """Test sending an email with detailed debugging"""
    print("\n" + "="*70)
    print("Email Service Test - Raw SMTP Debug")
    print("="*70)
    
    settings = get_settings()
    
    print(f"\n📧 Email Configuration:")
    print(f"  MAIL_HOST:     {settings.mail_host}")
    print(f"  MAIL_PORT:     {settings.mail_port}")
    print(f"  MAIL_SECURE:   {settings.mail_secure}")
    print(f"  MAIL_USER:     {settings.mail_user}")
    print(f"  MAIL_PASSWORD: {'*' * len(settings.mail_password) if settings.mail_password else 'NOT SET'}")
    print(f"  MAIL_FROM:     {settings.mail_from}")
    
    if not settings.mail_host:
        print("\n❌ Email is not configured (MAIL_HOST is empty)")
        return False
    
    email_to = "avgore2005@gmail.com"
    test_code = "123456"
    
    # Create message
    message = MIMEMultipart("alternative")
    message["Subject"] = "Your BhoomiSetu verification code"
    message["From"] = settings.mail_from
    message["To"] = email_to
    message.attach(MIMEText(f"Your BhoomiSetu verification code is {test_code}. It expires in 10 minutes.", "plain"))
    message.attach(MIMEText(
        f"""<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px">
  <h2 style="color:#1a6b3c;margin-top:0">BhoomiSetu Verification</h2>
  <p>Your one-time verification code is:</p>
  <div style="font-size:2rem;font-weight:700;letter-spacing:0.3em;color:#1a6b3c;text-align:center;padding:16px 0">{test_code}</div>
  <p style="color:#555;font-size:0.9rem">This code expires in <strong>10 minutes</strong>.</p>
</div>""",
        "html",
    ))
    
    print(f"\n📬 Sending test email to: {email_to}")
    print(f"   Subject: {message['Subject']}")
    print(f"   From: {message['From']}")
    
    try:
        print(f"\n🔌 Connecting to SMTP server...")
        
        if settings.mail_secure:
            print(f"   Using SMTP_SSL on port {settings.mail_port}")
            server = smtplib.SMTP_SSL(settings.mail_host, settings.mail_port, timeout=10)
        else:
            print(f"   Using SMTP on port {settings.mail_port}")
            server = smtplib.SMTP(settings.mail_host, settings.mail_port, timeout=10)
            server.starttls()
        
        print(f"   ✅ Connected to {settings.mail_host}")
        
        if settings.mail_user:
            print(f"\n🔐 Authenticating as: {settings.mail_user}")
            server.login(settings.mail_user, settings.mail_password)
            print(f"   ✅ Authentication successful")
        
        print(f"\n📤 Sending email...")
        server.sendmail(settings.mail_from, [email_to], message.as_string())
        print(f"   ✅ Email sent successfully!")
        
        server.quit()
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"\n❌ Authentication failed: {e}")
        print(f"   Check MAIL_USER and MAIL_PASSWORD")
        return False
    except smtplib.SMTPRecipientsRefused as e:
        print(f"\n❌ Recipient refused: {e}")
        print(f"   Check MAIL_FROM or recipient address")
        return False
    except smtplib.SMTPSenderRefused as e:
        print(f"\n❌ Sender refused: {e}")
        print(f"   This typically means: 'Sender is not allowed to relay emails'")
        print(f"   Solution: Verify that {settings.mail_from} is authorized in Zoho Mail settings")
        return False
    except smtplib.SMTPException as e:
        print(f"\n❌ SMTP error: {e}")
        return False
    except OSError as e:
        print(f"\n❌ Connection error: {e}")
        print(f"   Check if {settings.mail_host}:{settings.mail_port} is accessible")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {type(e).__name__}: {e}")
        return False


def main():
    """Run email test"""
    print("\n🧪 BhoomiSetu Email Service Test")
    
    success = test_email_raw()
    
    print("\n" + "="*70)
    if success:
        print("✅ Email service is working!")
    else:
        print("❌ Email service has issues. See details above.")
    print("="*70 + "\n")
    
    return 0 if success else 1


if __name__ == "__main__":
    exit(main())
