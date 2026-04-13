"""
License Service — checks plan validity, shows warnings.
Reads license.json from client folder or falls back to .env LICENSE_* vars.
"""

import os
import json
from datetime import datetime, date
from pathlib import Path

ROOT = Path(__file__).parent.parent


def get_license_info() -> dict:
    """Load license info from license.json or environment variables."""
    # Try client dir first (deployed via new_client.py)
    slug = os.getenv("LICENSE_CLIENT", "")
    license_file = ROOT / "clients" / slug / "license.json" if slug else None

    if license_file and license_file.exists():
        data = json.loads(license_file.read_text())
    else:
        # Fallback: read from environment (local dev / standalone)
        plan    = os.getenv("LICENSE_PLAN", "lifetime")
        expires = os.getenv("LICENSE_EXPIRES", "2099-12-31")
        data = {
            "client_name": os.getenv("LAB_NAME", "Lab"),
            "slug": slug or "local",
            "plan": plan,
            "plan_label": plan.capitalize(),
            "expires_at": f"{expires}T23:59:59",
            "features": {
                "whatsapp": True,
                "machine_integration": True,
                "multi_branch": plan in ("annual", "lifetime"),
            }
        }

    # Compute derived fields
    expires_dt = datetime.fromisoformat(data["expires_at"])
    days_left  = (expires_dt - datetime.now()).days
    is_expired = days_left < 0
    is_trial   = data.get("plan") == "trial"

    data["expires_dt"]  = expires_dt
    data["days_left"]   = days_left
    data["is_expired"]  = is_expired
    data["is_trial"]    = is_trial
    data["status"] = (
        "expired"  if is_expired else
        "warning"  if days_left <= 7 else
        "active"
    )
    return data


def check_license() -> dict:
    """
    Returns license status dict.
    Raises nothing — calling code decides what to block.
    """
    return get_license_info()


def get_license_banner() -> dict | None:
    """
    Returns a banner dict if action is needed, else None.
    Frontend shows this as a top-of-page warning.
    """
    lic = get_license_info()

    if lic["is_expired"]:
        return {
            "type": "error",
            "title": "License Expired",
            "message": f"Your {lic['plan_label']} license expired on {lic['expires_dt'].strftime('%d %b %Y')}. Contact support to renew.",
            "contact": "+92-300-0000000",
            "days_left": lic["days_left"],
        }

    if lic["days_left"] <= 3:
        return {
            "type": "critical",
            "title": f"License expires in {lic['days_left']} day(s)!",
            "message": f"Renew your {lic['plan_label']} plan immediately to avoid interruption.",
            "contact": "+92-300-0000000",
            "days_left": lic["days_left"],
        }

    if lic["days_left"] <= 7:
        return {
            "type": "warning",
            "title": f"License expires in {lic['days_left']} days",
            "message": f"Your {lic['plan_label']} plan expires on {lic['expires_dt'].strftime('%d %b %Y')}.",
            "contact": "+92-300-0000000",
            "days_left": lic["days_left"],
        }

    if lic["is_trial"] and lic["days_left"] <= 7:
        return {
            "type": "warning",
            "title": f"Trial ends in {lic['days_left']} days",
            "message": "Purchase a subscription to continue using LIS.",
            "contact": "+92-300-0000000",
            "days_left": lic["days_left"],
        }

    return None
