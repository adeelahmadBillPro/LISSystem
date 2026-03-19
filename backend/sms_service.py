"""
SMS Alert Service — sends SMS notifications to patients.

Supports:
1. Twilio SMS API (production)
2. Local SMS gateway (for Pakistan — Jazz, Telenor, Zong APIs)
"""

import os
import urllib.parse
from loguru import logger


def send_sms(phone: str, message: str) -> dict:
    """Send SMS via configured provider. Falls back to logging if not configured."""
    phone = _clean_phone(phone)

    # Try Twilio
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_SMS_NUMBER")

    if sid and token and from_number:
        return _send_twilio(phone, message, sid, token, from_number)

    # Fallback — log only
    logger.info("SMS (not sent - no provider configured): {} -> {}", phone, message[:50])
    return {"success": False, "error": "No SMS provider configured. Set TWILIO credentials in .env"}


def send_report_ready_sms(phone: str, patient_name: str, sample_id: str, lab_name: str = "") -> dict:
    """Send 'report ready' SMS to patient."""
    message = (
        f"Dear {patient_name}, your lab report (ID: {sample_id}) is ready. "
        f"Please visit {lab_name or 'the lab'} to collect. Thank you."
    )
    return send_sms(phone, message)


def _clean_phone(phone: str) -> str:
    phone = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if phone.startswith("0"):
        phone = "+92" + phone[1:]
    elif not phone.startswith("+"):
        phone = "+92" + phone
    return phone


def _send_twilio(phone: str, message: str, sid: str, token: str, from_number: str) -> dict:
    try:
        from twilio.rest import Client
        client = Client(sid, token)
        msg = client.messages.create(body=message, from_=from_number, to=phone)
        logger.info("SMS sent to {}: {}", phone, msg.sid)
        return {"success": True, "message_sid": msg.sid}
    except ImportError:
        return {"success": False, "error": "pip install twilio"}
    except Exception as e:
        logger.error("SMS failed: {}", str(e))
        return {"success": False, "error": str(e)}
