"""
WhatsApp Report Delivery Service.

Sends lab report PDFs to patients via WhatsApp.
Supports two methods:
1. WhatsApp Business API (via Twilio) — for production
2. Direct WhatsApp Web link — for quick sharing (opens wa.me link)

Setup for Twilio:
1. Create Twilio account at twilio.com
2. Enable WhatsApp sandbox or get approved WhatsApp Business number
3. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER in .env
"""

import os
import urllib.parse
from typing import Optional
from loguru import logger


# Method 1: Generate WhatsApp Web share link (no API needed)
def generate_whatsapp_link(phone: str, message: str) -> str:
    """
    Generate a wa.me link to open WhatsApp with pre-filled message.
    Works without any API setup — opens WhatsApp on the user's device.
    """
    # Clean phone number — remove spaces, dashes, leading 0
    phone = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    # Convert Pakistani numbers: 0300... → 92300...
    if phone.startswith("0"):
        phone = "92" + phone[1:]
    elif not phone.startswith("+") and not phone.startswith("92"):
        phone = "92" + phone

    phone = phone.lstrip("+")

    encoded_msg = urllib.parse.quote(message)
    return f"https://wa.me/{phone}?text={encoded_msg}"


# Method 2: Send via Twilio WhatsApp API (production)
def send_whatsapp_report(
    phone: str,
    patient_name: str,
    sample_id: str,
    report_url: str,
    twilio_sid: Optional[str] = None,
    twilio_token: Optional[str] = None,
    twilio_from: Optional[str] = None,
) -> dict:
    """
    Send report PDF via WhatsApp using Twilio API.

    Args:
        phone: Patient phone number (e.g., 03001234567)
        patient_name: Patient name for the message
        sample_id: Sample ID for reference
        report_url: Public URL to the PDF report
        twilio_sid: Twilio Account SID
        twilio_token: Twilio Auth Token
        twilio_from: Twilio WhatsApp number (e.g., whatsapp:+14155238886)
    """
    try:
        from twilio.rest import Client
    except ImportError:
        return {
            "success": False,
            "error": "Twilio not installed. Run: pip install twilio",
            "whatsapp_link": generate_whatsapp_link(
                phone,
                f"Your lab report for Sample {sample_id} is ready. Please visit the lab to collect or download from: {report_url}"
            ),
        }

    sid = twilio_sid or os.getenv("TWILIO_ACCOUNT_SID")
    token = twilio_token or os.getenv("TWILIO_AUTH_TOKEN")
    from_number = twilio_from or os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")

    if not sid or not token:
        return {
            "success": False,
            "error": "Twilio credentials not configured",
            "whatsapp_link": generate_whatsapp_link(
                phone,
                f"Your lab report for Sample {sample_id} is ready."
            ),
        }

    # Clean phone
    phone = phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("0"):
        phone = "+92" + phone[1:]
    elif not phone.startswith("+"):
        phone = "+92" + phone

    try:
        client = Client(sid, token)
        message = client.messages.create(
            body=f"Assalam o Alaikum {patient_name},\n\n"
                 f"Your lab report (Sample: {sample_id}) is ready.\n"
                 f"You can download it here: {report_url}\n\n"
                 f"Thank you for choosing our laboratory.\n"
                 f"For queries, please contact us.",
            from_=from_number,
            to=f"whatsapp:{phone}",
            media_url=[report_url] if report_url.startswith("http") else None,
        )

        logger.info("WhatsApp sent to {} - SID: {}", phone, message.sid)
        return {"success": True, "message_sid": message.sid}

    except Exception as e:
        logger.error("WhatsApp send failed: {}", str(e))
        return {
            "success": False,
            "error": str(e),
            "whatsapp_link": generate_whatsapp_link(
                phone,
                f"Your lab report for Sample {sample_id} is ready."
            ),
        }
