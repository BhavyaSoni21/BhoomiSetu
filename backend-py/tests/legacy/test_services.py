#!/usr/bin/env python
"""
Test script for Email and SMS services.
Run from backend-py directory with: python test_services.py
"""

import sys
import os

# Add the current directory to the path so we can import app modules
sys.path.insert(0, os.path.dirname(__file__))

from app.services.email_service import send_otp_email
from app.services.sms_service import send_otp
from app.config import get_settings


def test_email():
    """Test sending an email"""
    print("\n" + "="*60)
    print("Testing Email Service")
    print("="*60)
    
    settings = get_settings()
    print(f"\nEmail Configuration:")
    print(f"  Host: {settings.mail_host}")
    print(f"  Port: {settings.mail_port}")
    print(f"  User: {settings.mail_user}")
    print(f"  From: {settings.mail_from}")
    
    email = "avgore2005@gmail.com"
    test_code = "123456"
    
    try:
        print(f"\nSending test email to: {email}")
        send_otp_email(email, test_code)
        print("✅ Email sent successfully!")
        return True
    except Exception as e:
        print(f"❌ Email failed: {e}")
        return False


def test_sms():
    """Test sending an SMS"""
    print("\n" + "="*60)
    print("Testing SMS Service")
    print("="*60)
    
    settings = get_settings()
    print(f"\nSMS Configuration:")
    print(f"  API Key: {'***' + settings.textbee_api_key[-8:] if settings.textbee_api_key else 'NOT SET'}")
    print(f"  Device ID: {settings.textbee_device_id}")
    print(f"  SIM Subscription: {settings.textbee_sim_subscription_id}")
    
    phone = "8655126504"
    
    try:
        print(f"\nSending test SMS to: +91{phone}")
        result = send_otp(phone)
        print("✅ SMS sent successfully!")
        print(f"  Expires at: {result.expires_at}")
        print(f"  Sent at: {result.sent_at}")
        return True
    except Exception as e:
        print(f"❌ SMS failed: {e}")
        return False


def main():
    """Run all tests"""
    print("\n🧪 BhoomiSetu Service Test Suite")
    
    email_ok = test_email()
    sms_ok = test_sms()
    
    print("\n" + "="*60)
    print("Test Summary")
    print("="*60)
    print(f"Email Service: {'✅ PASSED' if email_ok else '❌ FAILED'}")
    print(f"SMS Service:   {'✅ PASSED' if sms_ok else '❌ FAILED'}")
    
    if email_ok and sms_ok:
        print("\n✅ All services are working!")
        return 0
    else:
        print("\n❌ Some services failed. Check configurations above.")
        return 1


if __name__ == "__main__":
    exit(main())
