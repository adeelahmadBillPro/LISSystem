"""
Full API Test Suite — LIS / HIS System
Run with:  python -m pytest backend/tests/test_all_endpoints.py -v
Or direct: python backend/tests/test_all_endpoints.py

Requires:
  - Backend running at http://localhost:8000
  - Admin user exists (username: admin, password: admin123)
  - PostgreSQL connected
"""

import sys
import requests
import json
from datetime import date, datetime
from typing import Optional

BASE = "http://localhost:8000/api"
RESULTS = []
ADMIN_TOKEN = None
CREATED_IDS = {}   # store created IDs for cleanup / chained tests


def clr(code): return f"\033[{code}m"
GREEN  = clr("92"); RED = clr("91"); YELLOW = clr("93")
CYAN   = clr("96"); BOLD = clr("1"); RESET = clr("0")


def test(name: str, method: str, path: str, expected: int = 200,
         json_body=None, headers=None, skip=False, note=""):
    """Run one API test and record result."""
    if skip:
        RESULTS.append({"name": name, "status": "SKIP", "note": note})
        print(f"  {YELLOW}SKIP{RESET}  {name}")
        return None

    h = {"Authorization": f"Bearer {ADMIN_TOKEN}"} if ADMIN_TOKEN else {}
    if headers:
        h.update(headers)

    try:
        resp = getattr(requests, method)(f"{BASE}{path}", json=json_body, headers=h, timeout=10)
        ok = resp.status_code == expected
        status = "PASS" if ok else "FAIL"
        color  = GREEN if ok else RED
        detail = "" if ok else f"  → got {resp.status_code}: {resp.text[:120]}"
        RESULTS.append({"name": name, "status": status, "code": resp.status_code, "note": detail})
        print(f"  {color}{status}{RESET}  {name}{detail}")
        return resp
    except requests.exceptions.ConnectionError:
        RESULTS.append({"name": name, "status": "FAIL", "note": "Cannot connect to backend"})
        print(f"  {RED}FAIL{RESET}  {name}  → Cannot connect — is the server running?")
        return None
    except Exception as e:
        RESULTS.append({"name": name, "status": "FAIL", "note": str(e)})
        print(f"  {RED}FAIL{RESET}  {name}  → {e}")
        return None


def section(title: str):
    print(f"\n{BOLD}{CYAN}{'─'*60}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'─'*60}{RESET}")


# ═══════════════════════════════════════════════════════════════
def run():
    global ADMIN_TOKEN

    today = date.today().isoformat()

    # ── 1. AUTH ────────────────────────────────────────────────
    section("1. Authentication")

    r = test("Login with valid credentials", "post", "/auth/login", 200,
             json_body={"username": "admin", "password": "admin123"})
    if r and r.status_code == 200:
        ADMIN_TOKEN = r.json().get("access_token")
        print(f"        {GREEN}✓ Token acquired{RESET}")
    else:
        print(f"  {RED}✗ Cannot get token — remaining tests will fail with 401{RESET}")

    test("Login with wrong password", "post", "/auth/login", 401,
         json_body={"username": "admin", "password": "wrongpass"})
    test("Access protected route without token", "get", "/patients", 401,
         headers={"Authorization": ""})

    # ── 2. PATIENTS ────────────────────────────────────────────
    section("2. Patients")

    r = test("List patients", "get", "/patients", 200)
    test("Search patients", "get", "/patients?search=test", 200)

    r = test("Create patient", "post", "/patients", 201, json_body={
        "mrn": f"TEST-{datetime.now().strftime('%H%M%S')}",
        "first_name": "QA", "last_name": "TestPatient",
        "gender": "M", "phone": "03001234567",
        "dob": "1990-01-01", "address": "Test Address"
    })
    if r and r.status_code == 201:
        CREATED_IDS["patient_id"] = r.json().get("id")

    if "patient_id" in CREATED_IDS:
        pid = CREATED_IDS["patient_id"]
        test("Get patient by ID", "get", f"/patients/{pid}", 200)
        test("Update patient", "put", f"/patients/{pid}", 200,
             json_body={"first_name": "QA-Updated", "last_name": "TestPatient",
                        "gender": "M", "phone": "03001234567"})
        test("Patient test history", "get", f"/patients/{pid}/test-history", 200)

    # ── 3. DOCTORS ────────────────────────────────────────────
    section("3. Doctors")

    test("List doctors", "get", "/doctors", 200)
    r = test("Create doctor", "post", "/doctors", 201, json_body={
        "name": "Dr. QA Test", "specialization": "General",
        "phone": "03001234567", "email": "qatest@test.com"
    })
    if r and r.status_code == 201:
        CREATED_IDS["doctor_id"] = r.json().get("id")

    # ── 4. SAMPLES ────────────────────────────────────────────
    section("4. Samples")

    test("List samples", "get", "/samples", 200)
    if "patient_id" in CREATED_IDS:
        r = test("Create sample", "post", "/samples", 201, json_body={
            "sample_id": f"SAM-QA-{datetime.now().strftime('%H%M%S')}",
            "patient_id": CREATED_IDS["patient_id"],
            "test_panel": "CBC",
            "notes": "QA test sample"
        })
        if r and r.status_code == 201:
            CREATED_IDS["sample_id"] = r.json().get("id")
            CREATED_IDS["sample_barcode"] = r.json().get("sample_id")

    if "sample_id" in CREATED_IDS:
        sid = CREATED_IDS["sample_id"]
        sbc = CREATED_IDS["sample_barcode"]
        test("Get sample by ID", "get", f"/samples/{sid}", 200)
        test("Update sample status", "put", f"/samples/{sid}", 200,
             json_body={"status": "received"})
        test("Get results for sample", "get", f"/samples/{sid}/results", 200)
        test("Get barcode PDF", "get", f"/samples/{sbc}/barcode", 200)

    # ── 5. RESULTS ────────────────────────────────────────────
    section("5. Results")

    test("List results", "get", "/results", 200)
    if "sample_id" in CREATED_IDS:
        sid = CREATED_IDS["sample_id"]
        r = test("Add result", "post", f"/samples/{sid}/results", 200, json_body=[{
            "test_code": "WBC", "test_name": "White Blood Cells",
            "value": "7.5", "unit": "x10³/µL",
            "ref_low": 4.0, "ref_high": 11.0, "flag": "N"
        }])
        test("Get report data", "get", f"/samples/{sid}/report", 200)
        test("Get report PDF", "get", f"/samples/{sid}/report/pdf", 200)

    # ── 6. BILLING ────────────────────────────────────────────
    section("6. Billing & Invoices")

    test("List invoices", "get", "/billing/invoices", 200)
    if "patient_id" in CREATED_IDS:
        r = test("Create invoice", "post", "/billing/invoices", 201, json_body={
            "patient_id": CREATED_IDS["patient_id"],
            "tests": [{"test_code": "CBC", "test_name": "Complete Blood Count", "price": 800}],
            "discount_percent": 0,
            "total_amount": 800,
            "payment_method": "cash",
            "notes": "QA test invoice"
        })
        if r and r.status_code == 201:
            CREATED_IDS["invoice_id"] = r.json().get("invoice_id") or r.json().get("id")

    if "invoice_id" in CREATED_IDS:
        inv = CREATED_IDS["invoice_id"]
        test("Get invoice receipt", "get", f"/billing/invoices/{inv}", 200)

    # ── 7. APPOINTMENTS ───────────────────────────────────────
    section("7. Appointments")

    test("List appointments (today)", "get", f"/appointments?date={today}", 200)
    if "patient_id" in CREATED_IDS and "doctor_id" in CREATED_IDS:
        r = test("Create appointment", "post", "/appointments", 201, json_body={
            "patient_id": CREATED_IDS["patient_id"],
            "doctor_id": CREATED_IDS["doctor_id"],
            "appt_date": today,
            "appt_time": "10:00",
            "appt_type": "consultation",
            "reason": "QA test appointment"
        })
        if r and r.status_code == 201:
            CREATED_IDS["appt_id"] = r.json().get("id")

    if "appt_id" in CREATED_IDS:
        aid = CREATED_IDS["appt_id"]
        test("Update appointment status to arrived", "put", f"/appointments/{aid}",
             200, json_body={"status": "arrived"})
        test("Update appointment status to completed", "put", f"/appointments/{aid}",
             200, json_body={"status": "completed"})

    test("Public appointment booking (no auth)", "post", "/appointments/public", 200,
         json_body={"patient_name": "QA Walk-In", "phone": "03009999999",
                    "doctor_id": CREATED_IDS.get("doctor_id"), "appt_date": today,
                    "appt_time": "11:00", "visit_type": "consultation", "reason": "Test"},
         headers={"Authorization": ""})

    # ── 8. OPD ───────────────────────────────────────────────
    section("8. OPD")

    test("List OPD visits", "get", f"/opd/visits?date_filter={today}", 200)
    test("OPD stats", "get", "/opd/stats", 200)
    if "patient_id" in CREATED_IDS:
        r = test("Create OPD visit", "post", "/opd/visits", 201, json_body={
            "patient_id": CREATED_IDS["patient_id"],
            "chief_complaint": "QA test complaint",
            "status": "waiting", "fee": 500,
            "referred_to_lab": True, "referred_to_radiology": False, "referred_to_pharmacy": False
        })
        if r and r.status_code == 201:
            CREATED_IDS["opd_id"] = r.json().get("id")

    # ── 9. IPD ───────────────────────────────────────────────
    section("9. IPD")

    test("IPD stats", "get", "/ipd/stats", 200)
    test("List admissions", "get", "/ipd/admissions", 200)

    test("List wards", "get", "/wards", 200)
    r = test("Create ward", "post", "/wards", 201,
             json_body={"name": "QA Ward", "ward_type": "general", "total_beds": 2})
    if r and r.status_code == 201:
        CREATED_IDS["ward_id"] = r.json().get("id")

    if "ward_id" in CREATED_IDS and "patient_id" in CREATED_IDS:
        r = test("Create IPD admission", "post", "/ipd/admissions", 201, json_body={
            "patient_id": CREATED_IDS["patient_id"],
            "ward_id": CREATED_IDS["ward_id"],
            "admission_type": "planned",
            "diagnosis": "QA test diagnosis"
        })
        if r and r.status_code == 201:
            CREATED_IDS["admission_id"] = r.json().get("id")

    if "admission_id" in CREATED_IDS:
        adm = CREATED_IDS["admission_id"]
        test("Update admission notes", "put", f"/ipd/admissions/{adm}", 200,
             json_body={"notes": "QA treatment note added"})
        test("Discharge patient", "put", f"/ipd/admissions/{adm}/discharge", 200,
             json_body={"discharge_notes": "QA discharge", "discharge_date": today})

    # ── 10. RADIOLOGY ─────────────────────────────────────────
    section("10. Radiology")

    test("List radiology orders", "get", "/radiology/orders", 200)
    test("Radiology stats", "get", "/radiology/stats", 200)
    if "patient_id" in CREATED_IDS:
        r = test("Create radiology order", "post", "/radiology/orders", 201, json_body={
            "patient_id": CREATED_IDS["patient_id"],
            "modality": "X-Ray", "body_part": "Chest",
            "clinical_notes": "QA test", "priority": "routine"
        })
        if r and r.status_code == 201:
            CREATED_IDS["rad_order_id"] = r.json().get("id")

    if "rad_order_id" in CREATED_IDS:
        rid = CREATED_IDS["rad_order_id"]
        r = test("Add radiology report", "post", f"/radiology/orders/{rid}/report", 200,
                 json_body={"radiologist_name": "Dr. QA", "findings": "Normal",
                            "impression": "No abnormality", "report_date": today})
        test("Update radiology report", "post", f"/radiology/orders/{rid}/report", 200,
             json_body={"radiologist_name": "Dr. QA Updated", "findings": "Updated findings",
                        "impression": "Reviewed", "report_date": today})

    # ── 11. PHARMACY ──────────────────────────────────────────
    section("11. Pharmacy")

    test("List medications", "get", "/pharmacy/medications", 200)
    r = test("Create medication", "post", "/pharmacy/medications", 201, json_body={
        "name": "QA Paracetamol", "generic_name": "Paracetamol",
        "category": "Analgesic", "unit": "tablet",
        "stock_quantity": 100, "reorder_level": 20, "unit_price": 5.0
    })
    if r and r.status_code == 201:
        CREATED_IDS["med_id"] = r.json().get("id")

    test("List dispenses", "get", "/pharmacy/dispenses", 200)

    # ── 12. OT ───────────────────────────────────────────────
    section("12. Operation Theater (OT)")

    test("List surgeries", "get", "/ot/surgeries", 200)
    test("List theaters", "get", "/ot/theaters", 200)
    if "patient_id" in CREATED_IDS:
        r = test("Schedule surgery", "post", "/ot/surgeries", 201, json_body={
            "patient_id": CREATED_IDS["patient_id"],
            "surgery_name": "QA Test Surgery",
            "scheduled_at": f"{today}T09:00:00",
            "status": "scheduled"
        })
        if r and r.status_code == 201:
            CREATED_IDS["surgery_id"] = r.json().get("id")

    # ── 13. HR ───────────────────────────────────────────────
    section("13. HR & Payroll")

    test("List staff salary profiles", "get", "/hr/staff", 200)
    test("List advances", "get", "/hr/advances", 200)
    test("List payroll", "get", "/hr/payroll", 200)

    # ── 14. ATTENDANCE ────────────────────────────────────────
    section("14. Attendance")

    test("Get today's attendance", "get", "/attendance/today", 200)
    r = test("Clock in", "post", "/attendance/clock-in", 200,
             json_body={"lat": 33.7215, "lng": 73.0433})
    if r and r.status_code == 200:
        test("Clock in again (should fail)", "post", "/attendance/clock-in", 400,
             json_body={"lat": 33.7215, "lng": 73.0433})
        test("Clock out", "post", "/attendance/clock-out", 200, json_body={})
        test("Clock out again (should fail)", "post", "/attendance/clock-out", 400,
             json_body={})

    test("Get attendance history", "get", "/attendance/my-history", 200)
    test("Get attendance report (admin)", "get", "/attendance/report", 200)

    # ── 15. SETTINGS ──────────────────────────────────────────
    section("15. Settings & System")

    test("Get lab settings", "get", "/settings", 200)
    test("Get modules config", "get", "/settings/modules", 200)
    test("Update lab settings", "put", "/settings", 200,
         json_body={"lab_name": "QA Test Lab", "lab_phone": "0300-0000000"})
    test("Restore lab name", "put", "/settings", 200,
         json_body={"lab_name": "City Diagnostic Laboratory", "lab_phone": "+92-300-1234567"})

    # ── 16. TESTS & PACKAGES ──────────────────────────────────
    section("16. Test Catalog & Packages")

    test("List test catalog", "get", "/tests", 200)
    test("List test packages", "get", "/packages", 200)
    test("List categories", "get", "/categories", 200)

    # ── 17. USERS ─────────────────────────────────────────────
    section("17. Users & Auth")

    test("List users", "get", "/users", 200)
    r = test("Create user", "post", "/users", 201, json_body={
        "username": f"qauser_{datetime.now().strftime('%H%M%S')}",
        "password": "QaPass123!",
        "full_name": "QA Test User",
        "role": "technician"
    })
    if r and r.status_code == 201:
        CREATED_IDS["test_user_id"] = r.json().get("id")

    # ── 18. CREDIT ACCOUNTS ───────────────────────────────────
    section("18. Credit Accounts")

    test("List credit accounts", "get", "/credit-accounts", 200)
    r = test("Create credit account", "post", "/credit-accounts", 201, json_body={
        "account_name": "QA Corp", "account_type": "company",
        "contact_person": "QA Manager", "phone": "0300000001",
        "credit_limit": 50000
    })
    if r and r.status_code == 201:
        CREATED_IDS["credit_id"] = r.json().get("id")

    # ── 19. INVENTORY ─────────────────────────────────────────
    section("19. Inventory")

    test("List inventory", "get", "/inventory", 200)
    r = test("Create inventory item", "post", "/inventory", 201, json_body={
        "name": "QA Test Tubes", "category": "consumable",
        "quantity": 100, "unit": "pcs",
        "reorder_level": 10, "unit_cost": 5.0
    })
    if r and r.status_code == 201:
        CREATED_IDS["inv_item_id"] = r.json().get("id")

    # ── 20. REPORTS & EXPORT ──────────────────────────────────
    section("20. MIS Reports & Export")

    test("Daily summary", "get", "/reports/daily-summary", 200)
    test("Revenue report", "get", f"/reports/revenue?from_date={today}&to_date={today}", 200)
    test("Export patients CSV", "get", "/export/patients", 200)
    test("Export results CSV", "get", "/export/results", 200)
    test("Export invoices CSV", "get", "/export/invoices", 200)

    # ── 21. AUDIT LOG ─────────────────────────────────────────
    section("21. Audit Log")

    test("List audit logs", "get", "/audit-log", 200)

    # ── 22. TOKEN QUEUE ───────────────────────────────────────
    section("22. Token Queue")

    test("List tokens today", "get", "/tokens", 200)
    r = test("Create token", "post", "/tokens", 201,
             json_body={"counter": "A", "notes": "QA token"})

    # ── 23. BRANCHES ──────────────────────────────────────────
    section("23. Branches")

    test("List branches", "get", "/branches", 200)

    # ── 24. PATIENT PORTAL (no auth) ──────────────────────────
    section("24. Patient Portal (no auth)")

    test("Portal login with invalid MRN", "post", "/portal/login", 401,
         json_body={"mrn": "INVALID-MRN", "phone": "0000000000"},
         headers={"Authorization": ""})

    # ── 25. CLEANUP ───────────────────────────────────────────
    section("25. Cleanup — deleting QA test data")

    if "surgery_id" in CREATED_IDS:
        test("Delete surgery", "delete", f"/ot/surgeries/{CREATED_IDS['surgery_id']}", 200)
    if "rad_order_id" in CREATED_IDS:
        test("Delete radiology order", "delete", f"/radiology/orders/{CREATED_IDS['rad_order_id']}", 200)
    if "opd_id" in CREATED_IDS:
        test("Delete OPD visit", "delete", f"/opd/visits/{CREATED_IDS['opd_id']}", 200)
    if "appt_id" in CREATED_IDS:
        test("Delete appointment", "delete", f"/appointments/{CREATED_IDS['appt_id']}", 200)
    if "invoice_id" in CREATED_IDS:
        test("Delete invoice", "delete", f"/billing/invoices/{CREATED_IDS['invoice_id']}", 200)
    if "sample_id" in CREATED_IDS:
        test("Delete sample", "delete", f"/samples/{CREATED_IDS['sample_id']}", 200)
    if "admission_id" in CREATED_IDS:
        test("Delete admission", "delete", f"/ipd/admissions/{CREATED_IDS['admission_id']}", 200)
    if "ward_id" in CREATED_IDS:
        test("Delete ward", "delete", f"/wards/{CREATED_IDS['ward_id']}", 200)
    if "med_id" in CREATED_IDS:
        test("Delete medication", "delete", f"/pharmacy/medications/{CREATED_IDS['med_id']}", 200)
    if "inv_item_id" in CREATED_IDS:
        test("Delete inventory item", "delete", f"/inventory/{CREATED_IDS['inv_item_id']}", 200)
    if "credit_id" in CREATED_IDS:
        test("Delete credit account", "delete", f"/credit-accounts/{CREATED_IDS['credit_id']}", 200)
    if "test_user_id" in CREATED_IDS:
        test("Delete test user", "delete", f"/users/{CREATED_IDS['test_user_id']}", 200)
    if "doctor_id" in CREATED_IDS:
        test("Delete doctor", "delete", f"/doctors/{CREATED_IDS['doctor_id']}", 200)
    if "patient_id" in CREATED_IDS:
        test("Delete patient", "delete", f"/patients/{CREATED_IDS['patient_id']}", 200)

    # ── SUMMARY ───────────────────────────────────────────────
    total  = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["status"] == "PASS")
    failed = sum(1 for r in RESULTS if r["status"] == "FAIL")
    skipped = sum(1 for r in RESULTS if r["status"] == "SKIP")

    print(f"\n{'═'*60}")
    print(f"{BOLD}  QA RESULTS{RESET}")
    print(f"{'═'*60}")
    print(f"  {GREEN}PASS  {passed:3d}{RESET}")
    print(f"  {RED}FAIL  {failed:3d}{RESET}")
    print(f"  {YELLOW}SKIP  {skipped:3d}{RESET}")
    print(f"  Total {total:3d}")
    print(f"{'═'*60}")

    if failed > 0:
        print(f"\n{RED}Failed tests:{RESET}")
        for r in RESULTS:
            if r["status"] == "FAIL":
                print(f"  ✗ {r['name']}{r.get('note','')}")

    score = round(passed / max(total - skipped, 1) * 100)
    color = GREEN if score >= 90 else YELLOW if score >= 70 else RED
    print(f"\n  {BOLD}Score: {color}{score}%{RESET}\n")

    return failed == 0


if __name__ == "__main__":
    success = run()
    sys.exit(0 if success else 1)
