"""
License Manager — Hardware-locked license system.

How it works:
1. App reads client's machine ID (CPU + disk serial + hostname)
2. Client gives you this machine ID
3. You generate a license key for THAT specific machine
4. License key only works on that machine — can't be copied to another PC

You (developer) keep the SECRET_KEY private. Only you can generate licenses.
"""

import hashlib
import uuid
import platform
import subprocess
import os
import json
from datetime import datetime, date


# === YOUR SECRET KEY — NEVER SHARE THIS ===
SECRET_KEY = "LIS-REPORTER-2026-ADEEL-AHMAD-SECRET-KEY-NEVER-SHARE"


def get_machine_id():
    """Get a unique ID for this specific computer. Cannot be faked."""
    try:
        # Get CPU ID
        cpu = platform.processor()

        # Get disk serial number (Windows)
        try:
            result = subprocess.run(
                ["wmic", "diskdrive", "get", "serialnumber"],
                capture_output=True, text=True, timeout=5,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            disk_serial = result.stdout.strip().split("\n")[-1].strip()
        except:
            disk_serial = "unknown"

        # Get MAC address
        mac = uuid.getnode()

        # Get hostname
        hostname = platform.node()

        # Combine all into a unique fingerprint
        raw = f"{cpu}|{disk_serial}|{mac}|{hostname}"
        machine_id = hashlib.sha256(raw.encode()).hexdigest()[:16].upper()

        # Format as XXXX-XXXX-XXXX-XXXX for readability
        return f"{machine_id[:4]}-{machine_id[4:8]}-{machine_id[8:12]}-{machine_id[12:16]}"

    except Exception as e:
        # Fallback
        raw = f"{platform.node()}|{uuid.getnode()}"
        mid = hashlib.sha256(raw.encode()).hexdigest()[:16].upper()
        return f"{mid[:4]}-{mid[4:8]}-{mid[8:12]}-{mid[12:16]}"


def generate_license_key(machine_id, lab_name, expiry_date=None, max_machines=1):
    """
    ONLY YOU (developer) run this to generate a license for a client.

    Args:
        machine_id: Client's machine ID (they give you this)
        lab_name: Client's lab name
        expiry_date: Optional expiry (YYYY-MM-DD). None = lifetime
        max_machines: Number of machines allowed
    """
    data = {
        "machine_id": machine_id,
        "lab_name": lab_name,
        "expiry": expiry_date or "lifetime",
        "max_machines": max_machines,
        "issued": date.today().isoformat(),
    }

    # Create signature using secret key
    raw = f"{machine_id}|{lab_name}|{data['expiry']}|{max_machines}|{SECRET_KEY}"
    signature = hashlib.sha256(raw.encode()).hexdigest()[:20].upper()

    data["signature"] = signature

    # Format as license key
    license_key = f"LIS-{signature[:4]}-{signature[4:8]}-{signature[8:12]}-{signature[12:16]}-{signature[16:20]}"
    data["license_key"] = license_key

    return data


def verify_license(license_file="license.json"):
    """Verify the license is valid for THIS machine."""
    if not os.path.exists(license_file):
        return {"valid": False, "error": "No license file found. Contact your vendor for activation."}

    try:
        with open(license_file, "r") as f:
            data = json.load(f)
    except:
        return {"valid": False, "error": "License file is corrupted."}

    # Check machine ID matches
    current_machine = get_machine_id()
    if data.get("machine_id") != current_machine:
        return {
            "valid": False,
            "error": f"License is for a different computer.\nYour Machine ID: {current_machine}\nLicense Machine ID: {data.get('machine_id')}",
        }

    # Check expiry
    expiry = data.get("expiry", "lifetime")
    if expiry != "lifetime":
        try:
            exp_date = datetime.strptime(expiry, "%Y-%m-%d").date()
            if date.today() > exp_date:
                return {"valid": False, "error": f"License expired on {expiry}. Contact vendor to renew."}
        except:
            pass

    # Verify signature
    raw = f"{data['machine_id']}|{data['lab_name']}|{data['expiry']}|{data.get('max_machines', 1)}|{SECRET_KEY}"
    expected_sig = hashlib.sha256(raw.encode()).hexdigest()[:20].upper()

    if data.get("signature") != expected_sig:
        return {"valid": False, "error": "Invalid license. The license file has been tampered with."}

    return {
        "valid": True,
        "lab_name": data.get("lab_name"),
        "expiry": expiry,
        "max_machines": data.get("max_machines", 1),
    }


def save_license(data, filepath="license.json"):
    """Save license data to file."""
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)


# === CLI Tool — Run this on YOUR computer to generate licenses ===
if __name__ == "__main__":
    print("=" * 50)
    print("  LIS Reporter — License Generator")
    print("  (Run this on YOUR computer only)")
    print("=" * 50)

    print(f"\nYour Machine ID: {get_machine_id()}")

    print("\n--- Generate License for Client ---")
    machine_id = input("Client's Machine ID: ").strip()
    lab_name = input("Lab Name: ").strip()
    expiry = input("Expiry date (YYYY-MM-DD or press Enter for lifetime): ").strip()
    max_machines = input("Max machines (default 1): ").strip()

    if not machine_id or not lab_name:
        print("Error: Machine ID and Lab Name required")
        exit(1)

    data = generate_license_key(
        machine_id=machine_id,
        lab_name=lab_name,
        expiry_date=expiry or None,
        max_machines=int(max_machines) if max_machines else 1,
    )

    # Save license file
    filename = f"license_{lab_name.replace(' ', '_')}.json"
    save_license(data, filename)

    print(f"\n{'=' * 50}")
    print(f"  License Generated!")
    print(f"{'=' * 50}")
    print(f"  Lab Name:      {data['lab_name']}")
    print(f"  Machine ID:    {data['machine_id']}")
    print(f"  License Key:   {data['license_key']}")
    print(f"  Expiry:        {data['expiry']}")
    print(f"  Max Machines:  {data['max_machines']}")
    print(f"  Saved to:      {filename}")
    print(f"{'=' * 50}")
    print(f"\nSend '{filename}' to the client.")
    print(f"They put it next to LIS-Reporter.exe as 'license.json'")
