"""
WhatsApp Report Delivery Service.

Sends lab report PDFs to patients via WA Connect Pro API.
Setup: Add WA_API_KEY to your .env file.
"""

import os
import base64
import urllib.parse
import requests
from typing import Optional
from loguru import logger


def clean_phone(phone: str) -> str:
    """Normalize Pakistani phone number to 92XXXXXXXXXX format."""
    phone = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "").lstrip("+")
    if phone.startswith("0"):
        phone = "92" + phone[1:]
    elif not phone.startswith("92"):
        phone = "92" + phone
    return phone


def generate_whatsapp_link(phone: str, message: str) -> str:
    """Generate wa.me link as fallback."""
    phone = clean_phone(phone)
    encoded_msg = urllib.parse.quote(message)
    return f"https://wa.me/{phone}?text={encoded_msg}"


def send_whatsapp_report(
    phone: str,
    patient_name: str,
    sample_id: str,
    report_path: Optional[str] = None,
    report_url: Optional[str] = None,
    api_key: Optional[str] = None,
    api_url: Optional[str] = None,
) -> dict:
    """
    Send lab report to patient via WA Connect Pro API.

    Args:
        phone: Patient phone number (e.g., 03001234567)
        patient_name: Patient name for personalized message
        sample_id: Sample/Lab ID for reference
        report_path: Local path to PDF file (preferred)
        report_url: Public URL to PDF (alternative)
        api_key: WA Connect Pro API key (or set WA_API_KEY in .env)
        api_url: WA Connect Pro API URL (or set WA_API_URL in .env)
    """
    key = api_key or os.getenv("WA_API_KEY")
    url = api_url or os.getenv("WA_API_URL", "http://187.127.138.168/api/v1/messages/send")

    if not key:
        logger.warning("WA_API_KEY not set — falling back to WhatsApp link")
        return {
            "success": False,
            "error": "WA_API_KEY not configured",
            "whatsapp_link": generate_whatsapp_link(
                phone,
                f"Assalam o Alaikum {patient_name}, aap ka lab report (Sample: {sample_id}) ready hai."
            ),
        }

    to = clean_phone(phone)

    message_text = (
        f"Assalam o Alaikum *{patient_name}*,\n\n"
        f"Aap ka lab report tayyar ho gaya hai.\n"
        f"*Sample ID:* {sample_id}\n\n"
        f"Report PDF attach hai. Shukriya!"
    )

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    # Try sending PDF as base64 first
    if report_path and os.path.exists(report_path):
        try:
            with open(report_path, "rb") as f:
                pdf_base64 = base64.b64encode(f.read()).decode("utf-8")

            payload = {
                "to": to,
                "message": message_text,
                "media_base64": pdf_base64,
                "media_type": "document",
                "filename": f"Report_{sample_id}.pdf",
                "caption": message_text,
            }

            response = requests.post(url, json=payload, headers=headers, timeout=30)
            data = response.json()

            if response.status_code == 200 and data.get("success"):
                logger.info("WhatsApp report sent to {} - msg_id: {}", to, data.get("message_id"))
                return {"success": True, "message_id": data.get("message_id")}
            else:
                logger.error("WA API error: {}", data)
                return {"success": False, "error": data.get("error", "Send failed")}

        except Exception as e:
            logger.error("WhatsApp send failed: {}", str(e))
            return {"success": False, "error": str(e)}

    # Fallback: send text message with report URL
    elif report_url:
        try:
            payload = {
                "to": to,
                "message": (
                    f"Assalam o Alaikum *{patient_name}*,\n\n"
                    f"Aap ka lab report tayyar ho gaya hai.\n"
                    f"*Sample ID:* {sample_id}\n\n"
                    f"Report download karein: {report_url}\n\n"
                    f"Shukriya!"
                ),
            }

            response = requests.post(url, json=payload, headers=headers, timeout=30)
            data = response.json()

            if response.status_code == 200 and data.get("success"):
                logger.info("WhatsApp text sent to {}", to)
                return {"success": True, "message_id": data.get("message_id")}
            else:
                return {"success": False, "error": data.get("error", "Send failed")}

        except Exception as e:
            logger.error("WhatsApp send failed: {}", str(e))
            return {"success": False, "error": str(e)}

    else:
        return {
            "success": False,
            "error": "No report_path or report_url provided",
        }


def send_whatsapp_text(
    phone: str,
    message: str,
    api_key: Optional[str] = None,
    api_url: Optional[str] = None,
) -> dict:
    """Send a plain text WhatsApp message via WA Connect Pro API."""
    key = api_key or os.getenv("WA_API_KEY")
    url = api_url or os.getenv("WA_API_URL", "http://187.127.138.168/api/v1/messages/send")

    if not key:
        return {"success": False, "error": "WA_API_KEY not configured"}

    to = clean_phone(phone)

    try:
        response = requests.post(
            url,
            json={"to": to, "message": message},
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            timeout=30,
        )
        data = response.json()
        if response.status_code == 200 and data.get("success"):
            return {"success": True, "message_id": data.get("message_id")}
        return {"success": False, "error": data.get("error", "Send failed")}
    except Exception as e:
        return {"success": False, "error": str(e)}
