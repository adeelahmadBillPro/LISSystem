"""
FastAPI Application - Laboratory Information System API.
"""

import os
import re
import html
from datetime import datetime, date, timedelta
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session


def sanitize(value: str) -> str:
    """Sanitize input to prevent XSS attacks."""
    if not value:
        return value
    value = html.escape(value.strip())
    value = re.sub(r'<[^>]*>', '', value)  # Remove any HTML tags
    return value
from sqlalchemy import func, extract
from loguru import logger

from fastapi import Request
from backend.config import get_settings
from backend.database.connection import get_db
from backend.database.models import (
    Patient, Doctor, Sample, Result, User, ReferenceRange, Invoice, InvoiceItem,
    TestCatalog, Category, TestPackage, TestPackageItem, Branch, LabSettings,
    Token, InventoryItem, InventoryLog, ReportTemplate,
    DoctorSchedule, Prescription, PrescriptionItem,
    OPDVisit, Ward, Bed, Admission, RadiologyOrder, RadiologyReport,
    OperationTheater, Surgery, Medication, PharmacyDispense, PharmacyDispenseItem,
    StaffSalaryProfile, SalaryAdvance, SalaryPayment, Appointment,
    CreditAccount, Shift, Attendance,
)
from backend.sms_service import send_report_ready_sms
from backend.audit_service import AuditLog, log_action
from backend.whatsapp_service import generate_whatsapp_link, send_whatsapp_report, send_whatsapp_text
from backend.barcode_service import generate_barcode_label_pdf, generate_barcode_sheet_pdf
from backend.schemas import (
    PatientCreate, PatientResponse, DoctorCreate, DoctorResponse,
    SampleCreate, SampleResponse, ResultCreate, ResultResponse,
    MachineResultsBatch, ReportResponse, DashboardResponse,
    LoginRequest, TokenResponse, UserCreate,
)
from backend.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_role, oauth2_scheme,
)
from backend.report_generator import generate_report
from backend.license_service import get_license_info, get_license_banner

settings = get_settings()

app = FastAPI(
    title="Laboratory Information System API",
    description="API for managing lab samples, results, and reports",
    version="1.0.0",
)

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================
# AUTH ENDPOINTS
# =============================================

@app.post("/api/auth/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    user.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token(data={"sub": user.username, "role": user.role})
    return TokenResponse(access_token=token, role=user.role, full_name=user.full_name)


@app.post("/api/auth/register", response_model=dict)
async def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(
        username=user_data.username,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role,
    )
    db.add(user)
    db.commit()
    return {"message": "User created successfully", "username": user.username}


@app.post("/api/auth/signup")
async def signup(data: dict, db: Session = Depends(get_db)):
    """Public signup — creates inactive account that admin must activate."""
    username = sanitize(data.get("username", "")).strip().lower()
    password = data.get("password", "")
    full_name = sanitize(data.get("full_name", "")).strip()
    role = data.get("role", "receptionist")

    if not username or not password or not full_name:
        raise HTTPException(status_code=400, detail="All fields are required")
    if len(username) < 3 or len(username) > 50:
        raise HTTPException(status_code=400, detail="Username must be 3-50 characters")
    if len(full_name) > 200:
        raise HTTPException(status_code=400, detail="Name too long (max 200 characters)")
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        raise HTTPException(status_code=400, detail="Username can only contain letters, numbers, and underscores")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Block reserved usernames
    reserved = ["admin", "administrator", "root", "superadmin", "system", "sysadmin", "owner", "master"]
    if username in reserved:
        raise HTTPException(status_code=400, detail="This username is reserved and cannot be used")

    # Only allow safe roles — admin can never be self-assigned
    if role not in ("receptionist", "technician", "doctor"):
        raise HTTPException(status_code=400, detail="Invalid role")

    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        username=username,
        password_hash=hash_password(password),
        full_name=full_name,
        role=role,
        is_active=False,  # Admin must activate
    )
    db.add(user)
    db.commit()
    logger.info("New signup: {} ({})", username, role)
    return {"message": "Account created. Contact your lab admin to activate it."}


@app.post("/api/auth/forgot-password")
async def forgot_password(data: dict, db: Session = Depends(get_db)):
    """Generate a reset code for the user. In production, send via SMS/email."""
    username = data.get("username", "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Username not found")

    # Generate a simple 6-digit reset code
    import random
    reset_code = str(random.randint(100000, 999999))

    # Store it temporarily (in production, use Redis or DB with expiry)
    # For now, store in a simple dict on the app
    if not hasattr(app, '_reset_codes'):
        app._reset_codes = {}
    app._reset_codes[username] = reset_code

    logger.info("Password reset code for {}: {}", username, reset_code)

    return {
        "message": f"Reset code has been generated. Contact your admin for the code, or check server logs. Code: {reset_code}",
    }


@app.post("/api/auth/reset-password")
async def reset_password(data: dict, db: Session = Depends(get_db)):
    """Reset password using the reset code."""
    username = data.get("username", "").strip()
    reset_code = data.get("reset_code", "").strip()
    new_password = data.get("new_password", "")

    if not username or not reset_code or not new_password:
        raise HTTPException(status_code=400, detail="All fields required")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Verify reset code
    stored_codes = getattr(app, '_reset_codes', {})
    if stored_codes.get(username) != reset_code:
        raise HTTPException(status_code=400, detail="Invalid reset code")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(new_password)
    db.commit()

    # Remove used code
    del app._reset_codes[username]

    logger.info("Password reset successful for {}", username)
    return {"message": "Password reset successful"}


# =============================================
# PATIENT ENDPOINTS
# =============================================

@app.get("/api/patients", response_model=list[PatientResponse])
async def list_patients(
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Patient)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Patient.mrn.ilike(search_filter)) |
            (Patient.first_name.ilike(search_filter)) |
            (Patient.last_name.ilike(search_filter)) |
            (Patient.phone.ilike(search_filter))
        )
    return query.order_by(Patient.created_at.desc()).offset(skip).limit(limit).all()


@app.post("/api/patients", response_model=PatientResponse, status_code=201)
async def create_patient(
    patient_data: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["admin", "receptionist"]:
        raise HTTPException(status_code=403, detail="Only receptionists and admins can create patients")
    if db.query(Patient).filter(Patient.mrn == patient_data.mrn).first():
        raise HTTPException(status_code=400, detail="Patient with this MRN already exists")

    # Sanitize all string inputs
    data = patient_data.model_dump()
    for key in ["first_name", "last_name", "phone", "address", "mrn"]:
        if key in data and isinstance(data[key], str):
            data[key] = sanitize(data[key])

    patient = Patient(**data)
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@app.get("/api/patients/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


# =============================================
# DOCTOR ENDPOINTS
# =============================================

@app.get("/api/doctors", response_model=list[DoctorResponse])
async def list_doctors(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Doctor).order_by(Doctor.name).all()


@app.post("/api/doctors", response_model=DoctorResponse, status_code=201)
async def create_doctor(
    doctor_data: DoctorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check duplicate doctor name
    clean_name = sanitize(doctor_data.name)
    existing = db.query(Doctor).filter(Doctor.name == clean_name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Doctor '{clean_name}' already exists")

    data = doctor_data.model_dump()
    data["name"] = clean_name
    doctor = Doctor(**data)
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


# =============================================
# SAMPLE ENDPOINTS
# =============================================

@app.post("/api/samples", response_model=SampleResponse, status_code=201)
async def create_sample(
    sample_data: SampleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["admin", "receptionist", "technician"]:
        raise HTTPException(status_code=403, detail="Not authorized to create samples")
    # Verify patient exists
    patient = db.query(Patient).filter(Patient.id == sample_data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if db.query(Sample).filter(Sample.sample_id == sample_data.sample_id).first():
        raise HTTPException(status_code=400, detail="Sample ID already exists")

    sample = Sample(**sample_data.model_dump())
    db.add(sample)
    db.commit()
    db.refresh(sample)
    return sample


@app.get("/api/samples", response_model=list[SampleResponse])
async def list_samples(
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[date] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Sample)
    if status_filter:
        query = query.filter(Sample.status == status_filter)
    if date_from:
        query = query.filter(Sample.collected_at >= datetime.combine(date_from, datetime.min.time()))
    return query.order_by(Sample.created_at.desc()).offset(skip).limit(limit).all()


@app.delete("/api/samples/{sample_id}")
async def delete_sample(
    sample_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["admin", "technician"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete samples")
    sample = db.query(Sample).filter(Sample.sample_id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    log_action(db, current_user, "DELETE", "sample", sample_id, f"Deleted sample {sample_id}")
    db.delete(sample)
    db.commit()
    return {"message": "Sample deleted"}


# =============================================
# RESULTS ENDPOINTS
# =============================================

@app.post("/api/results", response_model=dict)
async def receive_results(
    batch: MachineResultsBatch,
    db: Session = Depends(get_db),
):
    """Receive parsed results from machine (called by serial listener)."""
    # Find the sample
    sample = db.query(Sample).filter(Sample.sample_id == batch.sample_id).first()
    if not sample:
        # Auto-create sample if patient exists (by MRN)
        if batch.patient_id:
            patient = db.query(Patient).filter(Patient.mrn == batch.patient_id).first()
            if patient:
                sample = Sample(
                    sample_id=batch.sample_id,
                    patient_id=patient.id,
                    machine_id=batch.machine_id,
                    status="processing",
                )
                db.add(sample)
                db.flush()

        if not sample:
            raise HTTPException(
                status_code=404,
                detail=f"Sample {batch.sample_id} not found. Register sample first.",
            )

    # Save results
    saved_count = 0
    for r in batch.results:
        # Look up reference range if not provided
        ref_low, ref_high = r.ref_low, r.ref_high
        if ref_low is None or ref_high is None:
            ref = db.query(ReferenceRange).filter(
                ReferenceRange.test_code == r.test_code
            ).first()
            if ref:
                ref_low = ref_low or float(ref.ref_low) if ref.ref_low else None
                ref_high = ref_high or float(ref.ref_high) if ref.ref_high else None

        result = Result(
            sample_id=sample.id,
            test_code=r.test_code,
            test_name=r.test_name,
            value=r.value,
            unit=r.unit,
            ref_low=ref_low,
            ref_high=ref_high,
            flag=r.flag,
            status="final",
        )
        db.add(result)
        saved_count += 1

    sample.status = "completed"
    sample.machine_id = batch.machine_id or sample.machine_id
    sample.received_at = datetime.utcnow()
    db.commit()

    logger.info("Saved {} results for sample {}", saved_count, batch.sample_id)
    return {"message": f"Saved {saved_count} results", "sample_id": batch.sample_id}


@app.get("/api/samples/{sample_id}/results", response_model=list[ResultResponse])
async def get_sample_results(
    sample_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sample = db.query(Sample).filter(Sample.sample_id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    return db.query(Result).filter(Result.sample_id == sample.id).all()


@app.put("/api/results/{result_id}/notes")
async def save_pathologist_notes(
    result_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save pathologist notes/comments for a result."""
    result = db.query(Result).filter(Result.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    result.pathologist_notes = sanitize(data.get("notes", "") or "")
    db.commit()
    return {"message": "Notes saved"}


@app.get("/api/patients/{patient_id}/test-history")
async def get_test_history(
    patient_id: int,
    test_code: Optional[str] = Query(None),
    limit: int = Query(10),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get historical test results for a patient (for trend/comparison)."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    query = (
        db.query(Result, Sample)
        .join(Sample, Result.sample_id == Sample.id)
        .filter(Sample.patient_id == patient_id)
        .filter(Sample.status.in_(["completed", "verified"]))
    )
    if test_code:
        query = query.filter(Result.test_code == test_code)

    rows = query.order_by(Sample.collected_at.desc()).limit(limit).all()

    history = []
    for r, s in rows:
        history.append({
            "result_id": r.id,
            "sample_id": s.sample_id,
            "test_code": r.test_code,
            "test_name": r.test_name,
            "value": r.value,
            "unit": r.unit,
            "flag": r.flag,
            "collected_at": s.collected_at.isoformat() if s.collected_at else None,
        })
    return history


# =============================================
# REPORT ENDPOINTS
# =============================================

@app.get("/api/samples/{sample_id}/report")
async def get_report_data(
    sample_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sample = db.query(Sample).filter(Sample.sample_id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    patient = db.query(Patient).filter(Patient.id == sample.patient_id).first()
    doctor = db.query(Doctor).filter(Doctor.id == sample.doctor_id).first() if sample.doctor_id else None
    results = db.query(Result).filter(Result.sample_id == sample.id).all()

    # Include lab settings for dynamic report header
    lab_settings = {}
    for s in db.query(LabSettings).all():
        lab_settings[s.key] = s.value
    defs = get_settings()
    import os
    logo_path = lab_settings.get("logo_path", "")
    return {
        "patient": PatientResponse.model_validate(patient),
        "sample": SampleResponse.model_validate(sample),
        "doctor": DoctorResponse.model_validate(doctor) if doctor else None,
        "results": [ResultResponse.model_validate(r) for r in results],
        "lab": {
            "name": lab_settings.get("lab_name", defs.LAB_NAME),
            "phone": lab_settings.get("lab_phone", defs.LAB_PHONE),
            "address": lab_settings.get("lab_address", defs.LAB_ADDRESS),
            "email": lab_settings.get("lab_email", defs.LAB_EMAIL),
            "has_logo": bool(logo_path and os.path.exists(logo_path)),
        },
    }


@app.get("/api/samples/{sample_id}/report/pdf")
async def download_report_pdf(
    sample_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sample = db.query(Sample).filter(Sample.sample_id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    patient = db.query(Patient).filter(Patient.id == sample.patient_id).first()
    doctor = db.query(Doctor).filter(Doctor.id == sample.doctor_id).first() if sample.doctor_id else None
    results = db.query(Result).filter(Result.sample_id == sample.id).all()

    # Prepare data for report generator
    patient_dict = {
        "name": patient.full_name,
        "age": patient.age,
        "gender": patient.gender,
        "mrn": patient.mrn,
        "dob": patient.dob.strftime("%d-%b-%Y") if patient.dob else "",
        "phone": patient.phone or "",
    }
    sample_dict = {
        "sample_id": sample.sample_id,
        "collected_at": sample.collected_at,
        "test_panel": sample.test_panel or "Laboratory Report",
        "doctor_name": doctor.name if doctor else "",
    }
    results_list = [
        {
            "test_name": r.test_name,
            "value": r.value,
            "unit": r.unit or "",
            "ref_low": float(r.ref_low) if r.ref_low else None,
            "ref_high": float(r.ref_high) if r.ref_high else None,
            "flag": r.flag,
        }
        for r in results
    ]

    # Load lab settings for dynamic header + logo
    lab_settings_rows = db.query(LabSettings).all()
    lab_cfg = {s.key: s.value for s in lab_settings_rows}
    defs_cfg = get_settings()
    import os as _os
    _logo_path = lab_cfg.get("logo_path", "")
    _resolved_logo = _logo_path if (_logo_path and _os.path.exists(_logo_path)) else None

    lab_info = {
        "name":    lab_cfg.get("lab_name",    defs_cfg.LAB_NAME),
        "address": lab_cfg.get("lab_address", defs_cfg.LAB_ADDRESS),
        "phone":   lab_cfg.get("lab_phone",   defs_cfg.LAB_PHONE),
        "email":   lab_cfg.get("lab_email",   defs_cfg.LAB_EMAIL),
    }

    # Load matching report template (by test_panel first, then default, then None)
    _panel = sample_dict.get("test_panel", "")
    _tmpl_row = (
        db.query(ReportTemplate).filter(ReportTemplate.test_panel == _panel).first()
        or db.query(ReportTemplate).filter(ReportTemplate.is_default == True).first()
    )
    _template_dict = None
    if _tmpl_row:
        _template_dict = {
            "header_text": _tmpl_row.header_text,
            "footer_text": _tmpl_row.footer_text,
            "notes_text":  _tmpl_row.notes_text,
            "show_qr":     _tmpl_row.show_qr,
            "show_signature": _tmpl_row.show_signature,
        }

    output_path = f"./reports/{sample_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
    generate_report(patient_dict, sample_dict, results_list, output_path,
                    logo_path=_resolved_logo, lab_info=lab_info, template=_template_dict)

    return FileResponse(
        output_path,
        media_type="application/pdf",
        filename=f"report_{sample_id}.pdf",
    )


# =============================================
# DASHBOARD ENDPOINT
# =============================================

@app.get("/api/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today_start = datetime.combine(date.today(), datetime.min.time())

    total_patients = db.query(func.count(Patient.id)).scalar()
    today_samples = db.query(func.count(Sample.id)).filter(
        Sample.created_at >= today_start
    ).scalar()
    pending_results = db.query(func.count(Sample.id)).filter(
        Sample.status.in_(["pending", "processing"])
    ).scalar()
    completed_today = db.query(func.count(Sample.id)).filter(
        Sample.status == "completed",
        Sample.created_at >= today_start,
    ).scalar()
    critical_alerts = db.query(func.count(Result.id)).filter(
        Result.flag.in_(["HH", "LL"]),
        Result.received_at >= today_start,
    ).scalar()

    recent_samples = (
        db.query(Sample)
        .order_by(Sample.created_at.desc())
        .limit(10)
        .all()
    )

    return DashboardResponse(
        total_patients=total_patients or 0,
        today_samples=today_samples or 0,
        pending_results=pending_results or 0,
        completed_today=completed_today or 0,
        critical_alerts=critical_alerts or 0,
        recent_samples=recent_samples,
    )


# =============================================
# PATIENT DETAIL & UPDATE
# =============================================

@app.delete("/api/patients/{patient_id}")
async def delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["admin"]:
        raise HTTPException(status_code=403, detail="Only admins can delete patients")
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    log_action(db, current_user, "DELETE", "patient", patient_id, f"Deleted patient {patient.mrn}")
    db.delete(patient)
    db.commit()
    return {"message": "Patient deleted"}


@app.put("/api/patients/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: int,
    patient_data: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    for key, value in patient_data.model_dump(exclude_unset=True).items():
        if key != "mrn":  # Don't allow MRN change
            setattr(patient, key, value)

    db.commit()
    db.refresh(patient)
    return patient


@app.get("/api/patients/{patient_id}/samples", response_model=list[SampleResponse])
async def get_patient_samples(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Sample).filter(Sample.patient_id == patient_id).order_by(Sample.created_at.desc()).all()


# =============================================
# SAMPLE VERIFICATION
# =============================================

@app.put("/api/samples/{sample_id}/verify")
async def verify_sample(
    sample_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sample = db.query(Sample).filter(Sample.sample_id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    sample.status = "verified"
    sample.reported_at = datetime.utcnow()

    # Mark all results as verified
    db.query(Result).filter(Result.sample_id == sample.id).update({
        "verified_by": current_user.id,
        "verified_at": datetime.utcnow(),
    })

    db.commit()

    # ── Auto-send WhatsApp report ──────────────────────────────────────────────
    wa_sent = False
    wa_error = None
    patient = None
    doctor = None
    results = []
    try:
        patient = db.query(Patient).filter(Patient.id == sample.patient_id).first()
        doctor = db.query(Doctor).filter(Doctor.id == sample.doctor_id).first() if sample.doctor_id else None
        results = db.query(Result).filter(Result.sample_id == sample.id).all()

        if patient and patient.phone:
            # Get WA API key from DB settings
            wa_key_setting = db.query(LabSettings).filter(LabSettings.key == "wa_api_key").first()
            wa_key = wa_key_setting.value if wa_key_setting else get_settings().WA_API_KEY

            if wa_key:
                # Generate PDF
                patient_dict = {
                    "name": patient.full_name, "age": patient.age,
                    "gender": patient.gender, "mrn": patient.mrn,
                    "dob": patient.dob.strftime("%d-%b-%Y") if patient.dob else "",
                    "phone": patient.phone or "",
                }
                sample_dict = {
                    "sample_id": sample.sample_id,
                    "collected_at": sample.collected_at,
                    "test_panel": sample.test_panel or "Laboratory Report",
                    "doctor_name": doctor.name if doctor else "",
                }
                results_list = [
                    {
                        "test_name": r.test_name, "value": r.value,
                        "unit": r.unit or "",
                        "ref_low": float(r.ref_low) if r.ref_low else None,
                        "ref_high": float(r.ref_high) if r.ref_high else None,
                        "flag": r.flag,
                    }
                    for r in results
                ]
                os.makedirs("./reports", exist_ok=True)
                pdf_path = f"./reports/wa_{sample_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
                generate_report(patient_dict, sample_dict, results_list, pdf_path)

                wa_result = send_whatsapp_report(
                    phone=patient.phone,
                    patient_name=patient.full_name,
                    sample_id=sample_id,
                    report_path=pdf_path,
                    api_key=wa_key,
                )
                wa_sent = wa_result.get("success", False)
                if not wa_sent:
                    wa_error = wa_result.get("error", "Unknown error")
                else:
                    log_action(db, current_user, "WHATSAPP", "sample", sample_id, f"Auto-sent to {patient.phone}")
    except Exception as e:
        wa_error = str(e)
        logger.error("Auto WhatsApp send failed for {}: {}", sample_id, e)

    # ── Critical value alert: notify doctor via WhatsApp ──────────────────────
    doctor_alert_sent = False
    try:
        if not results:
            results = db.query(Result).filter(Result.sample_id == sample.id).all()
        if not patient:
            patient = db.query(Patient).filter(Patient.id == sample.patient_id).first()
        if not doctor and sample.doctor_id:
            doctor = db.query(Doctor).filter(Doctor.id == sample.doctor_id).first()

        critical_results = [r for r in results if r.flag in ("HH", "LL")]
        if critical_results and doctor and doctor.phone:
            wa_key_setting = db.query(LabSettings).filter(LabSettings.key == "wa_api_key").first()
            wa_key = wa_key_setting.value if wa_key_setting else get_settings().WA_API_KEY
            if wa_key:
                critical_lines = "\n".join([
                    f"  • {r.test_name}: *{r.value} {r.unit or ''}* ({'CRITICAL HIGH' if r.flag == 'HH' else 'CRITICAL LOW'})"
                    for r in critical_results
                ])
                alert_msg = (
                    f"⚠️ *CRITICAL RESULT ALERT*\n\n"
                    f"Doctor: *{doctor.name}*\n"
                    f"Patient: *{patient.full_name if patient else 'Unknown'}*\n"
                    f"Sample ID: {sample_id}\n\n"
                    f"Critical Values:\n{critical_lines}\n\n"
                    f"Please review immediately."
                )
                alert_result = send_whatsapp_text(
                    phone=doctor.phone,
                    message=alert_msg,
                    api_key=wa_key,
                )
                doctor_alert_sent = alert_result.get("success", False)
                if doctor_alert_sent:
                    log_action(db, current_user, "WHATSAPP", "sample", sample_id,
                               f"Critical alert sent to doctor {doctor.name} ({doctor.phone})")
                else:
                    logger.warning("Critical alert to doctor failed: {}", alert_result.get("error"))
    except Exception as e:
        logger.error("Critical alert send failed for {}: {}", sample_id, e)

    return {
        "message": f"Sample {sample_id} verified by {current_user.full_name}",
        "whatsapp_sent": wa_sent,
        "whatsapp_error": wa_error,
        "doctor_alert_sent": doctor_alert_sent,
    }


# =============================================
# USER MANAGEMENT
# =============================================

@app.get("/api/users")
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "last_login": u.last_login,
            "created_at": u.created_at,
        }
        for u in users
    ]


# =============================================
# BILLING
# =============================================

@app.post("/api/billing/invoices")
async def create_invoice(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["admin", "receptionist"]:
        raise HTTPException(status_code=403, detail="Only receptionists and admins can create invoices")
    invoice = Invoice(
        patient_id=data["patient_id"],
        sample_id=data.get("sample_id"),
        credit_account_id=data.get("credit_account_id"),
        total_amount=data["total_amount"],
        discount_percent=data.get("discount_percent", 0),
        payment_method=data.get("payment_method", "cash"),
        notes=data.get("notes", ""),
        created_by=current_user.id,
        insurance_company=data.get("insurance_company"),
        policy_number=data.get("insurance_policy"),
        tpa_name=data.get("tpa_name"),
        claim_status="pending" if data.get("payment_method") == "insurance" else None,
    )
    db.add(invoice)
    db.flush()

    for test in data.get("tests", []):
        item = InvoiceItem(
            invoice_id=invoice.id,
            test_code=test["test_code"],
            test_name=test["test_name"],
            price=test["price"],
        )
        db.add(item)

    db.commit()
    patient = db.query(Patient).filter(Patient.id == invoice.patient_id).first()
    patient_mrn = patient.mrn if patient else str(invoice.patient_id)
    log_action(db, current_user, "CREATE", "invoice", invoice.id,
               f"Created invoice #{invoice.id} for patient {patient_mrn}, amount {invoice.total_amount}")
    return {"message": "Invoice created", "invoice_id": invoice.id}


@app.get("/api/billing/invoices")
async def list_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoices = (
        db.query(Invoice, Patient)
        .join(Patient, Invoice.patient_id == Patient.id)
        .order_by(Invoice.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": inv.id,
            "patient_id": pat.id,
            "patient_name": pat.full_name,
            "patient_mrn": pat.mrn,
            "total_amount": float(inv.total_amount),
            "discount_percent": inv.discount_percent,
            "net_amount": float(inv.total_amount) * (1 - inv.discount_percent / 100),
            "payment_method": inv.payment_method,
            "test_count": len(inv.items),
            "insurance_company": inv.insurance_company or "",
            "claim_status": inv.claim_status or "",
            "created_at": inv.created_at.isoformat() if inv.created_at else "",
        }
        for inv, pat in invoices
    ]


# =============================================
# MIS REPORTS
# =============================================

@app.get("/api/reports/mis")
async def get_mis_reports(
    range: str = "today",
    from_date: str = None,
    to_date: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today_start = datetime.combine(date.today(), datetime.min.time())
    end_date = datetime.combine(date.today(), datetime.max.time())

    if range == "custom" and from_date and to_date:
        try:
            start_date = datetime.strptime(from_date, "%Y-%m-%d")
            end_date = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        except ValueError:
            start_date = today_start
    elif range == "week":
        start_date = today_start - timedelta(days=7)
    elif range == "month":
        start_date = today_start - timedelta(days=30)
    elif range == "year":
        start_date = datetime(date.today().year, 1, 1)
    else:
        start_date = today_start

    total_samples = db.query(func.count(Sample.id)).filter(
        Sample.created_at >= start_date, Sample.created_at <= end_date
    ).scalar() or 0
    patients_served = db.query(func.count(func.distinct(Sample.patient_id))).filter(
        Sample.created_at >= start_date, Sample.created_at <= end_date
    ).scalar() or 0
    tests_performed = db.query(func.count(Result.id)).filter(
        Result.received_at >= start_date, Result.received_at <= end_date
    ).scalar() or 0
    total_invoices = db.query(func.count(Invoice.id)).filter(
        Invoice.created_at >= start_date, Invoice.created_at <= end_date
    ).scalar() or 0

    total_revenue = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.created_at >= start_date, Invoice.created_at <= end_date
    ).scalar() or 0

    test_breakdown = (
        db.query(Sample.test_panel, func.count(Sample.id).label("count"))
        .filter(Sample.created_at >= start_date, Sample.created_at <= end_date, Sample.test_panel.isnot(None))
        .group_by(Sample.test_panel)
        .order_by(func.count(Sample.id).desc())
        .all()
    )

    payment_breakdown = (
        db.query(Invoice.payment_method, func.sum(Invoice.total_amount).label("total"))
        .filter(Invoice.created_at >= start_date, Invoice.created_at <= end_date)
        .group_by(Invoice.payment_method)
        .all()
    )

    status_counts = (
        db.query(Sample.status, func.count(Sample.id))
        .filter(Sample.created_at >= start_date, Sample.created_at <= end_date)
        .group_by(Sample.status)
        .all()
    )
    status_breakdown = {s: c for s, c in status_counts}

    # Daily revenue trend (last 30 days or range)
    from sqlalchemy import cast, Date as SADate
    daily_revenue = (
        db.query(
            func.date(Invoice.created_at).label("day"),
            func.sum(Invoice.total_amount).label("revenue"),
            func.count(Invoice.id).label("invoices"),
        )
        .filter(Invoice.created_at >= start_date, Invoice.created_at <= end_date)
        .group_by(func.date(Invoice.created_at))
        .order_by(func.date(Invoice.created_at))
        .all()
    )
    daily_trend = [{"date": str(row.day), "revenue": float(row.revenue), "invoices": row.invoices} for row in daily_revenue]

    # Top referring doctors
    top_doctors_raw = (
        db.query(Doctor.name, func.count(Sample.id).label("sample_count"))
        .join(Sample, Sample.doctor_id == Doctor.id)
        .filter(Sample.created_at >= start_date, Sample.created_at <= end_date)
        .group_by(Doctor.id, Doctor.name)
        .order_by(func.count(Sample.id).desc())
        .limit(6)
        .all()
    )
    top_doctors = [{"doctor": name, "sample_count": cnt, "revenue": 0} for name, cnt in top_doctors_raw]

    # New vs returning patients (new = first sample ever in this period)
    all_period_patients = db.query(func.distinct(Sample.patient_id)).filter(
        Sample.created_at >= start_date, Sample.created_at <= end_date
    ).all()
    new_patients = 0
    for (pat_id,) in all_period_patients:
        first_sample = db.query(func.min(Sample.created_at)).filter(Sample.patient_id == pat_id).scalar()
        if first_sample and first_sample >= start_date:
            new_patients += 1
    returning_patients = patients_served - new_patients

    days_in_range = max((end_date - start_date).days, 1)
    avg_daily_revenue = float(total_revenue) / days_in_range if days_in_range > 0 else 0

    return {
        "total_samples": total_samples,
        "total_revenue": float(total_revenue),
        "patients_served": patients_served,
        "tests_performed": tests_performed,
        "total_invoices": total_invoices,
        "new_patients": new_patients,
        "returning_patients": max(0, returning_patients),
        "avg_daily_revenue": round(avg_daily_revenue, 2),
        "test_breakdown": [{"test_panel": t, "count": c} for t, c in test_breakdown],
        "payment_breakdown": [{"method": m, "total": float(t)} for m, t in payment_breakdown],
        "status_breakdown": status_breakdown,
        "daily_trend": daily_trend,
        "top_doctors": top_doctors,
    }


# =============================================
# TEST CATALOG MANAGEMENT
# =============================================

@app.get("/api/tests")
async def list_tests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tests = db.query(TestCatalog).filter(TestCatalog.is_active == True).order_by(TestCatalog.category, TestCatalog.test_name).all()
    return [
        {
            "id": t.id, "test_code": t.test_code, "test_name": t.test_name,
            "category": t.category, "price": float(t.price) if t.price else 0,
            "unit": t.unit, "sample_type": t.sample_type,
            "ref_low_male": float(t.ref_low_male) if t.ref_low_male else None,
            "ref_high_male": float(t.ref_high_male) if t.ref_high_male else None,
            "ref_low_female": float(t.ref_low_female) if t.ref_low_female else None,
            "ref_high_female": float(t.ref_high_female) if t.ref_high_female else None,
        }
        for t in tests
    ]


@app.post("/api/tests")
async def create_test(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(TestCatalog).filter(TestCatalog.test_code == data["test_code"]).first():
        raise HTTPException(status_code=400, detail="Test code already exists")
    if db.query(TestCatalog).filter(TestCatalog.test_name == data["test_name"]).first():
        raise HTTPException(status_code=400, detail="Test name already exists")

    test = TestCatalog(
        test_code=data["test_code"],
        test_name=data["test_name"],
        category=data.get("category"),
        price=data.get("price", 0),
        unit=data.get("unit"),
        sample_type=data.get("sample_type", "Blood"),
        ref_low_male=data.get("ref_low_male"),
        ref_high_male=data.get("ref_high_male"),
        ref_low_female=data.get("ref_low_female"),
        ref_high_female=data.get("ref_high_female"),
    )
    db.add(test)
    db.commit()
    return {"message": "Test added", "id": test.id}


@app.put("/api/tests/{test_id}")
async def update_test(
    test_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    test = db.query(TestCatalog).filter(TestCatalog.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    for key in ["test_code", "test_name", "category", "price", "unit", "sample_type",
                "ref_low_male", "ref_high_male", "ref_low_female", "ref_high_female"]:
        if key in data:
            setattr(test, key, data[key])

    db.commit()
    return {"message": "Test updated"}


@app.delete("/api/tests/{test_id}")
async def delete_test(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    test = db.query(TestCatalog).filter(TestCatalog.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    test.is_active = False  # Soft delete
    db.commit()
    return {"message": "Test deleted"}


# =============================================
# SETTINGS
# =============================================

@app.get("/api/settings")
async def get_settings_api(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    defaults = get_settings()
    result = {
        "lab_name": defaults.LAB_NAME,
        "lab_phone": defaults.LAB_PHONE,
        "lab_address": defaults.LAB_ADDRESS,
        "lab_email": defaults.LAB_EMAIL,
        "wa_api_key": defaults.WA_API_KEY,
        "nav_layout": "sidebar",  # default
    }
    # Override with DB values if they exist
    for setting in db.query(LabSettings).all():
        if setting.key in result or setting.key == "nav_layout":
            result[setting.key] = setting.value
    return result


@app.put("/api/settings")
async def update_settings_api(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    allowed_keys = ["lab_name", "lab_phone", "lab_address", "lab_email", "wa_api_key", "nav_layout"]
    for key, value in data.items():
        if key not in allowed_keys:
            continue
        existing = db.query(LabSettings).filter(LabSettings.key == key).first()
        if existing:
            existing.value = sanitize(str(value))
        else:
            db.add(LabSettings(key=key, value=sanitize(str(value))))
    db.commit()
    log_action(db, current_user, "UPDATE", "settings", None, "Lab settings updated")
    return {"message": "Settings saved successfully"}


# =============================================
# LICENSE ENDPOINTS
# =============================================

@app.get("/api/license")
async def get_license(current_user: User = Depends(get_current_user)):
    """Get current license info and banner (if expiry warning needed)."""
    info = get_license_info()
    banner = get_license_banner()
    return {
        "plan": info.get("plan"),
        "plan_label": info.get("plan_label"),
        "expires_at": info.get("expires_at"),
        "days_left": info.get("days_left"),
        "status": info.get("status"),
        "is_trial": info.get("is_trial"),
        "is_expired": info.get("is_expired"),
        "features": info.get("features", {}),
        "client_name": info.get("client_name"),
        "banner": banner,
    }


# =============================================
# DATABASE BACKUP ENDPOINT
# =============================================

@app.get("/api/admin/backup")
async def download_backup(current_user: User = Depends(require_role("admin"))):
    """Generate and download a PostgreSQL backup of the current database."""
    import subprocess
    import tempfile
    import urllib.parse
    from fastapi.responses import FileResponse

    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")

    # Parse connection from URL: postgresql+psycopg://user:pass@host:port/dbname
    try:
        # Strip dialect prefix
        clean_url = db_url.replace("postgresql+psycopg://", "postgresql://")
        from urllib.parse import urlparse
        parsed = urlparse(clean_url)
        db_host = parsed.hostname or "localhost"
        db_port = parsed.port or 5432
        db_user = parsed.username or "postgres"
        db_pass = urllib.parse.unquote(parsed.password or "")
        db_name = parsed.path.lstrip("/")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not parse DATABASE_URL: {e}")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"lis_backup_{db_name}_{ts}.sql"
    backup_path = Path(os.getenv("LOG_DIR", "./logs")).parent / "backups" / backup_filename
    backup_path.parent.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env["PGPASSWORD"] = db_pass

    result = subprocess.run(
        ["pg_dump", "-h", db_host, "-p", str(db_port), "-U", db_user, db_name,
         "-f", str(backup_path), "--no-password"],
        capture_output=True, text=True, env=env, timeout=120
    )

    if result.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"pg_dump failed: {result.stderr[:300]}"
        )

    log_action(None, current_user, "BACKUP", "database", None, f"DB backup downloaded: {backup_filename}")

    return FileResponse(
        path=str(backup_path),
        filename=backup_filename,
        media_type="application/sql",
        headers={"Content-Disposition": f'attachment; filename="{backup_filename}"'}
    )


@app.post("/api/whatsapp/test")
async def test_whatsapp_connection(
    data: dict,
    current_user: User = Depends(require_role("admin")),
):
    """Test WA Connect Pro API key connection."""
    import requests as req
    api_key = data.get("api_key", "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is required")
    try:
        res = req.get(
            "http://187.127.138.168/api/wa/session",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        if res.status_code == 200:
            return {"message": "Connected successfully! WhatsApp API is working."}
        elif res.status_code == 401:
            raise HTTPException(status_code=400, detail="Invalid API key")
        else:
            raise HTTPException(status_code=400, detail=f"API returned: {res.status_code}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")


@app.get("/api/whatsapp/sessions")
async def get_whatsapp_sessions(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Proxy WA sessions list through backend to avoid browser CORS issues."""
    import requests as req
    row = db.query(LabSettings).filter(LabSettings.key == "wa_api_key").first()
    api_key = row.value if row else None
    if not api_key:
        return {"sessions": []}
    try:
        res = req.get(
            "http://187.127.138.168/api/wa/session",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        data = res.json()
        return {"sessions": data.get("sessions", [])}
    except Exception:
        return {"sessions": []}


@app.post("/api/whatsapp/sessions/start")
async def start_whatsapp_session(
    data: dict,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Proxy: start a WA session and return the QR code."""
    import requests as req
    row = db.query(LabSettings).filter(LabSettings.key == "wa_api_key").first()
    api_key = row.value if row else None
    if not api_key:
        raise HTTPException(status_code=400, detail="WA API key not configured")
    session_id = data.get("session_id", "default")
    try:
        res = req.post(
            "http://187.127.138.168/api/wa/session",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"action": "start", "session_id": session_id},
            timeout=15,
        )
        return res.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/whatsapp/sessions/qr")
async def get_whatsapp_qr(
    session_id: str = "default",
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Proxy: get QR code for a WA session."""
    import requests as req
    row = db.query(LabSettings).filter(LabSettings.key == "wa_api_key").first()
    api_key = row.value if row else None
    if not api_key:
        raise HTTPException(status_code=400, detail="WA API key not configured")
    try:
        res = req.get(
            f"http://187.127.138.168/api/wa/session/qr?session_id={session_id}",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=15,
        )
        return res.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================
# USER ENABLE/DISABLE/DELETE
# =============================================

@app.put("/api/users/{user_id}/toggle")
async def toggle_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot disable admin account")
    user.is_active = not user.is_active
    db.commit()
    return {"message": f"User {'enabled' if user.is_active else 'disabled'}"}


@app.delete("/api/users/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin account")
    log_action(db, current_user, "DELETE", "user", user_id, f"Deleted user {user.username}")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}


# =============================================
# SIGNATURE UPLOAD
# =============================================

@app.post("/api/users/{user_id}/signature")
async def upload_signature(
    user_id: int,
    file: bytes = Depends(lambda request: request.body()),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload signature image for a user (used on reports)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Use the multipart endpoint below"}


from fastapi import UploadFile, File as FastAPIFile

@app.post("/api/signature/upload")
async def upload_my_signature(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload your own signature image."""
    import os
    os.makedirs("./signatures", exist_ok=True)

    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed (PNG, JPG)")

    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"sig_{current_user.id}_{current_user.username}.{ext}"
    filepath = f"./signatures/{filename}"

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    current_user.signature_path = filepath
    db.commit()

    return {"message": "Signature uploaded", "path": filepath}


@app.get("/api/signature/{user_id}")
async def get_signature(user_id: int, db: Session = Depends(get_db)):
    """Get signature image for a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.signature_path:
        raise HTTPException(status_code=404, detail="No signature found")

    import os
    if not os.path.exists(user.signature_path):
        raise HTTPException(status_code=404, detail="Signature file not found")

    return FileResponse(user.signature_path, media_type="image/png")


@app.post("/api/settings/logo")
async def upload_lab_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Upload lab logo — shown on PDF reports and report header."""
    import os
    os.makedirs("./logos", exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower() or ".png"
    if ext not in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
        raise HTTPException(status_code=400, detail="Only image files allowed (PNG, JPG, GIF, WEBP)")
    filepath = f"./logos/lab_logo{ext}"
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    existing = db.query(LabSettings).filter(LabSettings.key == "logo_path").first()
    if existing:
        existing.value = filepath
    else:
        db.add(LabSettings(key="logo_path", value=filepath))
    db.commit()
    log_action(db, current_user, "UPDATE", "settings", None, "Lab logo uploaded")
    return {"message": "Logo uploaded successfully", "path": filepath}


@app.get("/api/settings/logo")
async def get_lab_logo(db: Session = Depends(get_db)):
    """Get lab logo image (no auth — needed for report embedding)."""
    import os
    setting = db.query(LabSettings).filter(LabSettings.key == "logo_path").first()
    if not setting or not os.path.exists(setting.value):
        raise HTTPException(status_code=404, detail="No logo uploaded")
    ext = os.path.splitext(setting.value)[1].lower()
    media_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                 ".gif": "image/gif", ".webp": "image/webp"}
    return FileResponse(setting.value, media_type=media_map.get(ext, "image/png"))


@app.delete("/api/settings/logo")
async def delete_lab_logo(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Remove the lab logo."""
    import os
    setting = db.query(LabSettings).filter(LabSettings.key == "logo_path").first()
    if setting:
        if os.path.exists(setting.value):
            os.remove(setting.value)
        db.delete(setting)
        db.commit()
    return {"message": "Logo removed"}


# =============================================
# CREDIT ACCOUNTS
# =============================================

@app.get("/api/credit-accounts")
async def list_credit_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(CreditAccount).filter(CreditAccount.is_active == True).order_by(CreditAccount.account_name).all()
    result = []
    for ca in rows:
        total_billed = float(db.query(func.sum(Invoice.total_amount)).filter(Invoice.credit_account_id == ca.id).scalar() or 0)
        total_paid   = float(db.query(func.sum(Invoice.total_amount)).filter(
            Invoice.credit_account_id == ca.id,
            Invoice.payment_method.in_(["cash","card","online"])
        ).scalar() or 0)
        result.append({
            "id": ca.id, "account_name": ca.account_name, "account_type": ca.account_type,
            "contact_person": ca.contact_person or "", "phone": ca.phone or "",
            "email": ca.email or "", "address": ca.address or "",
            "credit_limit": float(ca.credit_limit), "notes": ca.notes or "",
            "total_billed": total_billed,
            "outstanding": total_billed - total_paid,
            "created_at": ca.created_at.isoformat() if ca.created_at else "",
        })
    return result


@app.post("/api/credit-accounts")
async def create_credit_account(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ca = CreditAccount(
        account_name=data["account_name"], account_type=data.get("account_type","company"),
        contact_person=data.get("contact_person"), phone=data.get("phone"),
        email=data.get("email"), address=data.get("address"),
        credit_limit=data.get("credit_limit", 0), notes=data.get("notes"),
    )
    db.add(ca); db.commit(); db.refresh(ca)
    return {"id": ca.id, "message": "Created"}


@app.put("/api/credit-accounts/{ca_id}")
async def update_credit_account(ca_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ca = db.query(CreditAccount).filter(CreditAccount.id == ca_id).first()
    if not ca: raise HTTPException(404, "Not found")
    for f in ["account_name","account_type","contact_person","phone","email","address","credit_limit","notes","is_active"]:
        if f in data: setattr(ca, f, data[f])
    db.commit(); return {"ok": True}


@app.delete("/api/credit-accounts/{ca_id}")
async def delete_credit_account(ca_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ca = db.query(CreditAccount).filter(CreditAccount.id == ca_id).first()
    if not ca: raise HTTPException(404, "Not found")
    ca.is_active = False; db.commit(); return {"ok": True}


@app.get("/api/credit-accounts/{ca_id}/invoices")
async def credit_account_invoices(ca_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(Invoice, Patient).join(Patient, Invoice.patient_id == Patient.id).filter(
        Invoice.credit_account_id == ca_id
    ).order_by(Invoice.created_at.desc()).all()
    return [{
        "id": inv.id, "patient_name": pat.full_name, "patient_mrn": pat.mrn,
        "total_amount": float(inv.total_amount), "discount_percent": inv.discount_percent,
        "payment_method": inv.payment_method, "created_at": inv.created_at.isoformat() if inv.created_at else "",
        "notes": inv.notes or "",
    } for inv, pat in rows]


@app.post("/api/credit-accounts/{ca_id}/record-payment")
async def record_credit_payment(ca_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Mark specific credit invoices as paid."""
    invoice_ids = data.get("invoice_ids", [])
    method = data.get("payment_method", "cash")
    for inv_id in invoice_ids:
        inv = db.query(Invoice).filter(Invoice.id == inv_id, Invoice.credit_account_id == ca_id).first()
        if inv:
            inv.payment_method = method
    db.commit()
    return {"ok": True, "updated": len(invoice_ids)}


# =============================================
# PATIENT BILLING STATEMENT
# =============================================

@app.get("/api/patients/{patient_id}/statement")
async def patient_statement(patient_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient: raise HTTPException(404, "Patient not found")
    invoices = db.query(Invoice).filter(Invoice.patient_id == patient_id).order_by(Invoice.created_at.desc()).all()
    result = []
    for inv in invoices:
        items = [{"test_name": i.test_name, "price": float(i.price)} for i in inv.items]
        result.append({
            "id": inv.id,
            "total_amount": float(inv.total_amount),
            "discount_percent": inv.discount_percent,
            "net_amount": float(inv.total_amount) * (1 - inv.discount_percent / 100),
            "payment_method": inv.payment_method,
            "notes": inv.notes or "",
            "insurance_company": inv.insurance_company or "",
            "claim_status": inv.claim_status or "",
            "created_at": inv.created_at.isoformat() if inv.created_at else "",
            "items": items,
        })
    total_billed = sum(float(i.total_amount) for i in invoices)
    total_paid   = sum(float(i.total_amount) * (1 - i.discount_percent/100) for i in invoices if i.payment_method != "credit")
    credit_outstanding = sum(float(i.total_amount) * (1 - i.discount_percent/100) for i in invoices if i.payment_method == "credit")
    return {
        "patient": {"id": patient.id, "full_name": patient.full_name, "mrn": patient.mrn, "phone": patient.phone or ""},
        "invoices": result,
        "summary": {
            "total_visits": len(invoices),
            "total_billed": total_billed,
            "total_paid": total_paid,
            "credit_outstanding": credit_outstanding,
        }
    }


# =============================================
# SHIFT MANAGEMENT
# =============================================

@app.get("/api/shifts")
async def list_shifts(
    shift_date: str = "", from_date: str = "", to_date: str = "", user_id: int = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    q = db.query(Shift, User).join(User, Shift.user_id == User.id)
    if shift_date:
        q = q.filter(Shift.shift_date == datetime.strptime(shift_date, "%Y-%m-%d").date())
    if from_date:
        q = q.filter(Shift.shift_date >= datetime.strptime(from_date, "%Y-%m-%d").date())
    if to_date:
        q = q.filter(Shift.shift_date <= datetime.strptime(to_date, "%Y-%m-%d").date())
    if user_id:
        q = q.filter(Shift.user_id == user_id)
    rows = q.order_by(Shift.shift_date.desc(), Shift.start_time).all()
    return [{
        "id": s.id, "user_id": s.user_id, "staff_name": u.full_name, "staff_role": u.role,
        "shift_date": s.shift_date.isoformat(), "shift_type": s.shift_type,
        "start_time": s.start_time or "", "end_time": s.end_time or "",
        "status": s.status, "notes": s.notes or "",
    } for s, u in rows]


@app.post("/api/shifts")
async def create_shift(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = Shift(
        user_id=int(data["user_id"]),
        shift_date=datetime.strptime(data["shift_date"], "%Y-%m-%d").date(),
        shift_type=data.get("shift_type", "morning"),
        start_time=data.get("start_time"), end_time=data.get("end_time"),
        status="scheduled", notes=data.get("notes"), created_by=current_user.id,
    )
    db.add(s); db.commit(); db.refresh(s)
    return {"id": s.id}


@app.put("/api/shifts/{shift_id}")
async def update_shift(shift_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = db.query(Shift).filter(Shift.id == shift_id).first()
    if not s: raise HTTPException(404, "Not found")
    for f in ["shift_type","start_time","end_time","status","notes"]:
        if f in data: setattr(s, f, data[f])
    db.commit(); return {"ok": True}


@app.delete("/api/shifts/{shift_id}")
async def delete_shift(shift_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = db.query(Shift).filter(Shift.id == shift_id).first()
    if not s: raise HTTPException(404, "Not found")
    db.delete(s); db.commit(); return {"ok": True}


@app.get("/api/shifts/summary")
async def shifts_summary(month: int = None, year: int = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today()
    m, y = month or today.month, year or today.year
    from sqlalchemy import extract
    q = db.query(Shift, User).join(User, Shift.user_id == User.id).filter(
        extract("month", Shift.shift_date) == m,
        extract("year",  Shift.shift_date) == y,
    ).all()
    by_user = {}
    for s, u in q:
        if u.id not in by_user:
            by_user[u.id] = {"staff_name": u.full_name, "role": u.role, "scheduled":0,"completed":0,"absent":0,"leave":0}
        by_user[u.id][s.status if s.status in ("completed","absent","leave") else "scheduled"] += 1
    return list(by_user.values())


# =============================================
# INSURANCE / TPA CLAIMS
# =============================================

@app.get("/api/insurance/claims")
async def list_insurance_claims(
    status: str = "",
    from_date: str = "",
    to_date: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Invoice, Patient).join(Patient, Invoice.patient_id == Patient.id).filter(
        Invoice.payment_method == "insurance"
    )
    if status:
        q = q.filter(Invoice.claim_status == status)
    if from_date:
        q = q.filter(Invoice.created_at >= datetime.strptime(from_date, "%Y-%m-%d"))
    if to_date:
        q = q.filter(Invoice.created_at < datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1))
    rows = q.order_by(Invoice.created_at.desc()).all()
    result = []
    for inv, pat in rows:
        result.append({
            "id":               inv.id,
            "patient_name":     pat.full_name,
            "patient_mrn":      pat.mrn,
            "total_amount":     float(inv.total_amount),
            "discount":         inv.discount_percent,
            "insurance_company": inv.insurance_company or "",
            "policy_number":    inv.policy_number or "",
            "tpa_name":         inv.tpa_name or "",
            "claim_status":     inv.claim_status or "pending",
            "claim_amount":     float(inv.claim_amount) if inv.claim_amount else None,
            "claim_note":       inv.claim_note or "",
            "claim_submitted_at": inv.claim_submitted_at.isoformat() if inv.claim_submitted_at else None,
            "claim_settled_at": inv.claim_settled_at.isoformat() if inv.claim_settled_at else None,
            "created_at":       inv.created_at.isoformat() if inv.created_at else None,
        })
    return result


@app.put("/api/insurance/claims/{invoice_id}")
async def update_insurance_claim(
    invoice_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    for field in ["claim_status", "claim_amount", "claim_note", "insurance_company",
                  "policy_number", "tpa_name"]:
        if field in data:
            setattr(inv, field, data[field])
    if data.get("claim_status") == "submitted" and not inv.claim_submitted_at:
        inv.claim_submitted_at = datetime.utcnow()
    if data.get("claim_status") in ("settled", "paid") and not inv.claim_settled_at:
        inv.claim_settled_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


# =============================================
# APPOINTMENTS
# =============================================

@app.get("/api/appointments")
async def list_appointments(
    date: str = "",
    from_date: str = "",
    to_date: str = "",
    doctor_id: int = None,
    status: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Appointment, Patient, Doctor).join(
        Patient, Appointment.patient_id == Patient.id
    ).outerjoin(Doctor, Appointment.doctor_id == Doctor.id)

    if date:
        q = q.filter(Appointment.appt_date == datetime.strptime(date, "%Y-%m-%d").date())
    if from_date:
        q = q.filter(Appointment.appt_date >= datetime.strptime(from_date, "%Y-%m-%d").date())
    if to_date:
        q = q.filter(Appointment.appt_date <= datetime.strptime(to_date, "%Y-%m-%d").date())
    if doctor_id:
        q = q.filter(Appointment.doctor_id == doctor_id)
    if status:
        q = q.filter(Appointment.status == status)

    rows = q.order_by(Appointment.appt_date, Appointment.appt_time).all()
    return [
        {
            "id":           a.id,
            "patient_id":   a.patient_id,
            "patient_name": p.full_name,
            "patient_phone": p.phone or "",
            "patient_mrn":  p.mrn,
            "doctor_id":    a.doctor_id,
            "doctor_name":  d.name if d else "",
            "appt_date":    a.appt_date.isoformat() if a.appt_date else "",
            "appt_time":    a.appt_time or "",
            "appt_type":    a.appt_type or "consultation",
            "reason":       a.reason or "",
            "notes":        a.notes or "",
            "status":       a.status or "scheduled",
            "created_at":   a.created_at.isoformat() if a.created_at else "",
        }
        for a, p, d in rows
    ]


@app.post("/api/appointments/public")
async def public_book_appointment(data: dict, db: Session = Depends(get_db)):
    """
    Public endpoint — no auth required.
    New or existing patients can book an appointment from the website.
    Finds patient by phone or creates a walk-in record, then creates appointment with status 'pending'.
    Returns a booking reference number.
    """
    name  = sanitize(data.get("name", "").strip())
    phone = sanitize(data.get("phone", "").strip())
    if not name or not phone:
        raise HTTPException(status_code=400, detail="Name and phone are required")

    # Find existing patient by phone, or create a minimal walk-in record
    patient = db.query(Patient).filter(Patient.phone == phone).first()
    if not patient:
        import random, string as _string
        mrn = "WI-" + "".join(random.choices(_string.digits, k=6))
        patient = Patient(
            full_name = name,
            phone     = phone,
            mrn       = mrn,
            gender    = "unknown",
        )
        db.add(patient)
        db.flush()   # get patient.id without full commit

    doctor_id  = int(data["doctor_id"]) if data.get("doctor_id") else None
    appt_date  = data.get("appt_date", "")
    appt_time  = data.get("appt_time", "")
    reason     = sanitize(data.get("reason", ""))
    appt_type  = sanitize(data.get("appt_type", "consultation"))

    if not appt_date:
        raise HTTPException(status_code=400, detail="Preferred date is required")

    try:
        parsed_date = datetime.strptime(appt_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    appt = Appointment(
        patient_id = patient.id,
        doctor_id  = doctor_id,
        appt_date  = parsed_date,
        appt_time  = appt_time,
        appt_type  = appt_type,
        reason     = reason,
        notes      = "Online booking from website",
        status     = "pending",
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)

    return {
        "message": "Appointment request received",
        "booking_ref": f"APT-{appt.id:05d}",
        "patient_mrn": patient.mrn,
        "status": "pending",
    }


@app.post("/api/appointments")
async def create_appointment(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = Appointment(
        patient_id  = int(data["patient_id"]),
        doctor_id   = int(data["doctor_id"]) if data.get("doctor_id") else None,
        appt_date   = datetime.strptime(data["appt_date"], "%Y-%m-%d").date(),
        appt_time   = data.get("appt_time", ""),
        appt_type   = data.get("appt_type", "consultation"),
        reason      = data.get("reason", ""),
        notes       = data.get("notes", ""),
        status      = "scheduled",
        created_by  = current_user.id,
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return {"id": appt.id, "message": "Appointment created"}


@app.put("/api/appointments/{appt_id}")
async def update_appointment(
    appt_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = db.query(Appointment).filter(Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Not found")
    for field in ["appt_date", "appt_time", "appt_type", "reason", "notes", "status", "doctor_id"]:
        if field in data:
            if field == "appt_date":
                appt.appt_date = datetime.strptime(data[field], "%Y-%m-%d").date()
            elif field == "doctor_id":
                appt.doctor_id = int(data[field]) if data[field] else None
            else:
                setattr(appt, field, data[field])
    db.commit()
    return {"ok": True}


@app.delete("/api/appointments/{appt_id}")
async def delete_appointment(
    appt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = db.query(Appointment).filter(Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(appt)
    db.commit()
    return {"ok": True}


# =============================================
# MODULE MANAGER
# =============================================

TOGGLEABLE_MODULES = [
    "opd", "ipd", "wards", "radiology", "ot", "pharmacy",
    "hr", "referral", "token_queue", "prescriptions", "doctor_dashboard",
    "export", "audit_log", "insurance", "appointments",
]


@app.get("/api/settings/modules")
async def get_modules(db: Session = Depends(get_db)):
    """Return enabled/disabled state for each toggleable module (no auth — needed by Layout)."""
    rows = db.query(LabSettings).filter(LabSettings.key.like("module_%")).all()
    cfg = {r.key[len("module_"):]: r.value for r in rows}
    # Default: all enabled if not explicitly set to "false"
    return {m: cfg.get(m, "true") != "false" for m in TOGGLEABLE_MODULES}


@app.put("/api/settings/modules")
async def update_modules(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    for module, enabled in data.items():
        if module not in TOGGLEABLE_MODULES:
            continue
        key = f"module_{module}"
        val = "true" if enabled else "false"
        row = db.query(LabSettings).filter(LabSettings.key == key).first()
        if row:
            row.value = val
        else:
            db.add(LabSettings(key=key, value=val))
    db.commit()
    return {"ok": True}


# =============================================
# CATEGORIES (dynamic dropdowns)
# =============================================

@app.post("/api/categories/seed-defaults")
async def seed_default_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Seed default categories if empty."""
    defaults = {
        "test_category": [
            "Hematology", "Biochemistry", "Liver Function", "Renal Function",
            "Lipid Profile", "Thyroid", "Diabetes", "Serology", "Immunology",
            "Urine Analysis", "Coagulation", "Hormones", "Vitamins",
            "Tumor Markers", "Cardiac Markers", "Electrolytes",
        ],
        "sample_type": ["Blood", "Serum", "Plasma", "Urine", "Stool", "Swab", "CSF", "Sputum", "Tissue"],
        "test_panel": [
            "CBC", "LFT", "RFT", "Lipid Profile", "Thyroid Profile",
            "Blood Sugar", "HbA1c", "Urine R/E", "Electrolytes",
            "Coagulation Profile", "Iron Studies", "Vitamin Panel",
        ],
        "specialization": [
            "General Physician", "Pathologist", "Cardiologist", "Gynecologist",
            "Pediatrician", "Surgeon", "Dermatologist", "Orthopedic",
            "ENT Specialist", "Neurologist", "Urologist", "Pulmonologist",
            "Gastroenterologist", "Oncologist", "Nephrologist",
        ],
    }

    count = 0
    for cat_type, names in defaults.items():
        for name in names:
            exists = db.query(Category).filter(Category.type == cat_type, Category.name == name).first()
            if not exists:
                db.add(Category(type=cat_type, name=name))
                count += 1
    db.commit()
    return {"message": f"Seeded {count} categories"}


@app.get("/api/categories/{category_type}")
async def list_categories(
    category_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cats = db.query(Category).filter(
        Category.type == category_type, Category.is_active == True
    ).order_by(Category.name).all()
    return [{"id": c.id, "name": c.name} for c in cats]


@app.post("/api/categories/{category_type}")
async def add_category(
    category_type: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    existing = db.query(Category).filter(
        Category.type == category_type, Category.name == name
    ).first()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            db.commit()
            return {"message": f"'{name}' re-activated", "id": existing.id}
        raise HTTPException(status_code=400, detail=f"'{name}' already exists")

    cat = Category(type=category_type, name=name)
    db.add(cat)
    db.commit()
    return {"message": f"'{name}' added", "id": cat.id}


@app.put("/api/categories/{cat_id}")
async def update_category(
    cat_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    new_name = data.get("name", "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Name is required")

    # Check duplicate
    dup = db.query(Category).filter(
        Category.type == cat.type, Category.name == new_name, Category.id != cat_id
    ).first()
    if dup:
        raise HTTPException(status_code=400, detail=f"'{new_name}' already exists")

    cat.name = new_name
    db.commit()
    return {"message": "Updated"}


@app.delete("/api/categories/{cat_id}")
async def delete_category(
    cat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Not found")
    cat.is_active = False
    db.commit()
    return {"message": "Deleted"}


# =============================================
# WHATSAPP
# =============================================

@app.post("/api/samples/{sample_id}/whatsapp")
async def send_whatsapp(
    sample_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sample = db.query(Sample).filter(Sample.sample_id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    patient = db.query(Patient).filter(Patient.id == sample.patient_id).first()
    phone = data.get("phone") or patient.phone
    if not phone:
        raise HTTPException(status_code=400, detail="No phone number available")

    # Get WA API key from DB settings
    wa_key_setting = db.query(LabSettings).filter(LabSettings.key == "wa_api_key").first()
    wa_key = wa_key_setting.value if wa_key_setting else get_settings().WA_API_KEY

    # Generate PDF for sending
    doctor = db.query(Doctor).filter(Doctor.id == sample.doctor_id).first() if sample.doctor_id else None
    results = db.query(Result).filter(Result.sample_id == sample.id).all()
    patient_dict = {
        "name": patient.full_name, "age": patient.age, "gender": patient.gender,
        "mrn": patient.mrn, "dob": patient.dob.strftime("%d-%b-%Y") if patient.dob else "",
        "phone": patient.phone or "",
    }
    sample_dict = {
        "sample_id": sample.sample_id, "collected_at": sample.collected_at,
        "test_panel": sample.test_panel or "Laboratory Report",
        "doctor_name": doctor.name if doctor else "",
    }
    results_list = [
        {
            "test_name": r.test_name, "value": r.value, "unit": r.unit or "",
            "ref_low": float(r.ref_low) if r.ref_low else None,
            "ref_high": float(r.ref_high) if r.ref_high else None, "flag": r.flag,
        }
        for r in results
    ]
    os.makedirs("./reports", exist_ok=True)
    pdf_path = f"./reports/wa_{sample_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
    generate_report(patient_dict, sample_dict, results_list, pdf_path)

    result = send_whatsapp_report(
        phone=phone,
        patient_name=patient.full_name,
        sample_id=sample_id,
        report_path=pdf_path,
        api_key=wa_key,
    )

    whatsapp_link = generate_whatsapp_link(phone,
        f"Assalam o Alaikum {patient.full_name}, aap ka lab report (Sample: {sample_id}) ready hai.")

    log_action(db, current_user, "WHATSAPP", "sample", sample_id, f"Sent to {phone}")

    return {
        "success": result.get("success", False),
        "whatsapp_link": whatsapp_link,
        "message": "Report sent via WhatsApp!" if result.get("success") else result.get("error", "Failed"),
    }


# =============================================
# BARCODE
# =============================================

@app.get("/api/samples/{sample_id}/barcode")
async def get_barcode(
    sample_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sample = db.query(Sample).filter(Sample.sample_id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    patient = db.query(Patient).filter(Patient.id == sample.patient_id).first()

    output = generate_barcode_label_pdf(
        sample_id=sample.sample_id,
        patient_name=patient.full_name if patient else "",
        test_panel=sample.test_panel or "",
        collected_at=sample.collected_at.strftime("%d-%b-%Y") if sample.collected_at else "",
    )

    return FileResponse(output, media_type="application/pdf", filename=f"barcode_{sample_id}.pdf")


@app.post("/api/barcodes/batch")
async def generate_batch_barcodes(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sample_ids = data.get("sample_ids", [])
    samples_data = []

    for sid in sample_ids:
        sample = db.query(Sample).filter(Sample.sample_id == sid).first()
        if sample:
            patient = db.query(Patient).filter(Patient.id == sample.patient_id).first()
            samples_data.append({
                "sample_id": sample.sample_id,
                "patient_name": patient.full_name if patient else "",
                "test_panel": sample.test_panel or "",
            })

    if not samples_data:
        raise HTTPException(status_code=400, detail="No valid samples found")

    output = generate_barcode_sheet_pdf(samples_data)
    return FileResponse(output, media_type="application/pdf", filename="barcodes_batch.pdf")


# =============================================
# AUDIT LOG
# =============================================

@app.get("/api/audit-logs")
async def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    action: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        query = query.filter(AuditLog.action == action)
    logs = query.offset(skip).limit(limit).all()
    return [
        {
            "id": l.id,
            "username": l.username,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "details": l.details,
            "created_at": l.created_at,
        }
        for l in logs
    ]


# =============================================
# BACKUP
# =============================================

@app.get("/api/backup")
async def download_backup(
    current_user: User = Depends(require_role("admin")),
):
    """Download a backup of the database."""
    import shutil
    import subprocess
    settings = get_settings()

    os.makedirs("./backups", exist_ok=True)
    backup_name = f"lis_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    if "sqlite" in settings.DATABASE_URL:
        db_path = settings.DATABASE_URL.replace("sqlite:///", "").replace("./", "")
        full_path = os.path.join(os.getcwd(), db_path) if not os.path.isabs(db_path) else db_path
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="Database file not found")
        backup_path = f"./backups/{backup_name}.db"
        shutil.copy2(full_path, backup_path)
        return FileResponse(backup_path, media_type="application/octet-stream", filename=f"{backup_name}.db")
    else:
        # PostgreSQL backup using pg_dump
        backup_path = f"./backups/{backup_name}.sql"
        pg_dump = r"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
        try:
            # Parse connection string
            db_url = settings.DATABASE_URL
            # Extract components
            import urllib.parse
            parsed = urllib.parse.urlparse(db_url)
            env = os.environ.copy()
            env["PGPASSWORD"] = urllib.parse.unquote(parsed.password) if parsed.password else ""

            result = subprocess.run(
                [pg_dump, "-h", parsed.hostname or "localhost",
                 "-p", str(parsed.port or 5432),
                 "-U", parsed.username or "postgres",
                 "-d", parsed.path.lstrip("/"),
                 "-f", backup_path],
                env=env, capture_output=True, text=True, timeout=60,
            )
            if result.returncode != 0:
                raise HTTPException(status_code=500, detail=f"Backup failed: {result.stderr[:200]}")

            return FileResponse(backup_path, media_type="application/sql", filename=f"{backup_name}.sql")
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="pg_dump not found. Install PostgreSQL tools.")


@app.post("/api/backup/restore")
async def restore_backup(
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Restore database from a SQL dump file."""
    if not file.filename.endswith('.sql'):
        raise HTTPException(status_code=400, detail="Only .sql backup files are accepted")
    content = await file.read()
    try:
        from sqlalchemy import text
        statements = content.decode('utf-8').split(';\n')
        with db.bind.connect() as conn:
            for stmt in statements:
                stmt = stmt.strip()
                if stmt and not stmt.startswith('--'):
                    try:
                        conn.execute(text(stmt))
                    except Exception:
                        pass  # Skip errors (duplicate tables, constraints, etc.)
            conn.commit()
        return {"ok": True, "message": f"Backup restored from {file.filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")


# =============================================
# EMAIL REPORT
# =============================================

@app.post("/api/samples/{sample_id}/email")
async def email_report(
    sample_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send report PDF via email (requires SMTP config in .env)."""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.base import MIMEBase
    from email.mime.text import MIMEText
    from email import encoders

    email_to = data.get("email")
    if not email_to:
        raise HTTPException(status_code=400, detail="Email address required")

    sample = db.query(Sample).filter(Sample.sample_id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    patient = db.query(Patient).filter(Patient.id == sample.patient_id).first()

    # Generate PDF
    from backend.report_generator import generate_report
    results = db.query(Result).filter(Result.sample_id == sample.id).all()
    doctor = db.query(Doctor).filter(Doctor.id == sample.doctor_id).first() if sample.doctor_id else None

    pdf_path = f"./reports/email_{sample_id}.pdf"
    generate_report(
        {"name": patient.full_name, "age": patient.age, "gender": patient.gender,
         "mrn": patient.mrn, "dob": patient.dob.strftime("%d-%b-%Y") if patient.dob else "", "phone": patient.phone or ""},
        {"sample_id": sample.sample_id, "collected_at": sample.collected_at,
         "test_panel": sample.test_panel or "Laboratory Report", "doctor_name": doctor.name if doctor else ""},
        [{"test_name": r.test_name, "value": r.value, "unit": r.unit or "",
          "ref_low": float(r.ref_low) if r.ref_low else None,
          "ref_high": float(r.ref_high) if r.ref_high else None, "flag": r.flag} for r in results],
        pdf_path,
    )

    settings = get_settings()
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", settings.LAB_EMAIL)
    smtp_pass = os.getenv("SMTP_PASSWORD", "")

    if not smtp_pass:
        log_action(db, current_user, "EMAIL_FAILED", "sample", sample_id, "SMTP not configured")
        raise HTTPException(status_code=400, detail="Email SMTP not configured. Set SMTP_PASSWORD in .env")

    try:
        msg = MIMEMultipart()
        msg["From"] = smtp_user
        msg["To"] = email_to
        msg["Subject"] = f"Lab Report - {patient.full_name} ({sample_id})"

        body = (
            f"Dear {patient.full_name},\n\n"
            f"Please find your lab report attached (Sample: {sample_id}).\n\n"
            f"Regards,\n{settings.LAB_NAME}\n{settings.LAB_PHONE}"
        )
        msg.attach(MIMEText(body, "plain"))

        with open(pdf_path, "rb") as f:
            attachment = MIMEBase("application", "pdf")
            attachment.set_payload(f.read())
            encoders.encode_base64(attachment)
            attachment.add_header("Content-Disposition", f"attachment; filename=report_{sample_id}.pdf")
            msg.attach(attachment)

        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()

        log_action(db, current_user, "EMAIL", "sample", sample_id, f"Sent to {email_to}")
        return {"message": f"Report sent to {email_to}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email failed: {str(e)}")


# =============================================
# SMS ALERTS
# =============================================

@app.post("/api/samples/{sample_id}/sms")
async def send_sms_alert(
    sample_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sample = db.query(Sample).filter(Sample.sample_id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    patient = db.query(Patient).filter(Patient.id == sample.patient_id).first()
    if not patient or not patient.phone:
        raise HTTPException(status_code=400, detail="Patient has no phone number")

    settings = get_settings()
    result = send_report_ready_sms(patient.phone, patient.full_name, sample_id, settings.LAB_NAME)
    log_action(db, current_user, "SMS", "sample", sample_id, f"SMS to {patient.phone}")
    return result


# =============================================
# TEST PACKAGES
# =============================================

@app.get("/api/packages")
async def list_packages(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pkgs = db.query(TestPackage).filter(TestPackage.is_active == True).all()
    return [
        {
            "id": p.id, "name": p.name, "description": p.description,
            "price": float(p.price), "individual_total": sum(float(i.individual_price or 0) for i in p.items),
            "tests": [{"test_code": i.test_code, "test_name": i.test_name,
                        "individual_price": float(i.individual_price or 0)} for i in p.items],
        }
        for p in pkgs
    ]


@app.post("/api/packages")
async def create_package(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pkg = TestPackage(name=data["name"], description=data.get("description", ""), price=data["price"])
    db.add(pkg)
    db.flush()
    for t in data.get("tests", []):
        item = TestPackageItem(
            package_id=pkg.id, test_code=t["test_code"],
            test_name=t["test_name"], individual_price=t.get("individual_price", 0),
        )
        db.add(item)
    db.commit()
    return {"message": "Package created", "id": pkg.id}


@app.delete("/api/packages/{pkg_id}")
async def delete_package(pkg_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pkg = db.query(TestPackage).filter(TestPackage.id == pkg_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    pkg.is_active = False
    db.commit()
    return {"message": "Deleted"}


# =============================================
# DAILY CASH CLOSING
# =============================================

@app.get("/api/reports/daily-closing")
async def daily_closing_report(
    report_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_date = report_date or date.today()
    day_start = datetime.combine(target_date, datetime.min.time())
    day_end = datetime.combine(target_date, datetime.max.time())

    invoices = db.query(Invoice).filter(Invoice.created_at.between(day_start, day_end)).all()

    total = sum(float(inv.total_amount) for inv in invoices)
    by_method = {}
    for inv in invoices:
        m = inv.payment_method or "cash"
        by_method[m] = by_method.get(m, 0) + float(inv.total_amount)

    samples_count = db.query(func.count(Sample.id)).filter(Sample.created_at.between(day_start, day_end)).scalar() or 0
    patients_count = db.query(func.count(func.distinct(Sample.patient_id))).filter(
        Sample.created_at.between(day_start, day_end)).scalar() or 0

    # Get staff who created invoices
    invoice_details = []
    for inv in invoices:
        patient = db.query(Patient).filter(Patient.id == inv.patient_id).first()
        created_by = db.query(User).filter(User.id == inv.created_by).first() if inv.created_by else None
        invoice_details.append({
            "id": inv.id, "amount": float(inv.total_amount),
            "method": inv.payment_method, "time": inv.created_at.strftime("%I:%M %p"),
            "discount": inv.discount_percent,
            "patient_name": patient.full_name if patient else "-",
            "created_by": created_by.full_name if created_by else "System",
        })

    # Staff collection breakdown
    by_staff = {}
    for inv in invoices:
        staff = db.query(User).filter(User.id == inv.created_by).first() if inv.created_by else None
        name = staff.full_name if staff else "System"
        by_staff[name] = by_staff.get(name, 0) + float(inv.total_amount)

    # Login/logout activity
    staff_activity = db.query(AuditLog).filter(
        AuditLog.created_at.between(day_start, day_end),
        AuditLog.action.in_(["LOGIN", "VERIFY", "WHATSAPP", "SMS"]),
    ).order_by(AuditLog.created_at).all()

    activity_log = [
        {"time": a.created_at.strftime("%I:%M %p"), "user": a.username,
         "action": a.action, "details": a.details or ""}
        for a in staff_activity
    ]

    return {
        "date": target_date.isoformat(),
        "total_invoices": len(invoices),
        "total_collection": total,
        "payment_breakdown": [{"method": k, "amount": v} for k, v in by_method.items()],
        "staff_breakdown": [{"staff": k, "amount": v} for k, v in by_staff.items()],
        "samples_count": samples_count,
        "patients_count": patients_count,
        "invoices": invoice_details,
        "staff_activity": activity_log,
    }


# =============================================
# PATIENT PORTAL
# =============================================

@app.post("/api/portal/login")
async def patient_portal_login(data: dict, db: Session = Depends(get_db)):
    """Patient login with phone number + MRN."""
    phone = data.get("phone", "").strip()
    mrn = data.get("mrn", "").strip()

    if not phone or not mrn:
        raise HTTPException(status_code=400, detail="Phone and MRN required")

    patient = db.query(Patient).filter(Patient.mrn == mrn).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Verify phone matches (basic auth)
    stored_phone = (patient.phone or "").replace("-", "").replace(" ", "")
    input_phone = phone.replace("-", "").replace(" ", "")
    if not stored_phone or not input_phone.endswith(stored_phone[-7:]):
        raise HTTPException(status_code=401, detail="Phone number does not match")

    # Generate token
    token = create_access_token(data={"sub": f"patient:{patient.mrn}", "role": "patient", "patient_id": patient.id})
    return {
        "access_token": token,
        "patient_name": patient.full_name,
        "mrn": patient.mrn,
    }


@app.get("/api/portal/reports")
async def patient_portal_reports(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Get all reports for the logged-in patient."""
    from jose import jwt as jose_jwt
    try:
        payload = jose_jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        patient_id = payload.get("patient_id")
        if not patient_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    samples = db.query(Sample).filter(
        Sample.patient_id == patient_id,
        Sample.status.in_(["verified", "completed", "printed"]),
    ).order_by(Sample.created_at.desc()).all()

    result = []
    for s in samples:
        results = db.query(Result).filter(Result.sample_id == s.id).all()
        result.append({
            "sample_id": s.sample_id, "test_panel": s.test_panel,
            "status": s.status, "date": s.created_at.isoformat(),
            "results": [{"test_name": r.test_name, "value": r.value, "unit": r.unit,
                         "flag": r.flag, "ref_low": float(r.ref_low) if r.ref_low else None,
                         "ref_high": float(r.ref_high) if r.ref_high else None} for r in results],
        })
    return result


# =============================================
# BRANCHES (Multi-branch)
# =============================================

@app.get("/api/branches")
async def list_branches(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return [
        {"id": b.id, "name": b.name, "code": b.code, "address": b.address, "phone": b.phone, "is_active": b.is_active}
        for b in db.query(Branch).order_by(Branch.name).all()
    ]


@app.post("/api/branches")
async def create_branch(data: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    if db.query(Branch).filter(Branch.code == data["code"]).first():
        raise HTTPException(status_code=400, detail="Branch code already exists")
    branch = Branch(name=data["name"], code=data["code"], address=data.get("address"), phone=data.get("phone"))
    db.add(branch)
    db.commit()
    return {"message": "Branch created", "id": branch.id}


@app.delete("/api/branches/{branch_id}")
async def delete_branch(branch_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    b = db.query(Branch).filter(Branch.id == branch_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    b.is_active = False
    db.commit()
    return {"message": "Deleted"}


# =============================================
# TOKEN / QUEUE SYSTEM
# =============================================

@app.get("/api/tokens")
async def list_tokens(
    token_date: Optional[date] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = token_date or date.today()
    query = db.query(Token).filter(Token.date == target)
    if status_filter:
        query = query.filter(Token.status == status_filter)
    tokens = query.order_by(Token.token_number).all()
    return [
        {
            "id": t.id, "token_number": t.token_number, "patient_name": t.patient_name,
            "phone": t.phone, "status": t.status, "counter": t.counter, "notes": t.notes,
            "created_at": t.created_at, "called_at": t.called_at, "completed_at": t.completed_at,
        }
        for t in tokens
    ]


@app.post("/api/tokens")
async def create_token(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    last = db.query(func.max(Token.token_number)).filter(Token.date == today).scalar() or 0
    token = Token(
        token_number=last + 1,
        patient_name=sanitize(data.get("patient_name", "")),
        phone=data.get("phone", ""),
        counter=data.get("counter", "Counter 1"),
        notes=data.get("notes", ""),
        patient_id=data.get("patient_id"),
        date=today,
    )
    db.add(token)
    db.commit()
    return {"token_number": token.token_number, "id": token.id}


@app.put("/api/tokens/{token_id}/call")
async def call_token(token_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    token = db.query(Token).filter(Token.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    token.status = "in_progress"
    token.called_at = datetime.utcnow()
    db.commit()
    return {"message": f"Token {token.token_number} called"}


@app.put("/api/tokens/{token_id}/complete")
async def complete_token(token_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    token = db.query(Token).filter(Token.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    token.status = "completed"
    token.completed_at = datetime.utcnow()
    db.commit()
    return {"message": f"Token {token.token_number} completed"}


@app.put("/api/tokens/{token_id}/cancel")
async def cancel_token(token_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    token = db.query(Token).filter(Token.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    token.status = "cancelled"
    db.commit()
    return {"message": f"Token {token.token_number} cancelled"}


@app.get("/api/tokens/current")
async def get_current_token(db: Session = Depends(get_db)):
    """Public endpoint — shows current serving token on display screen."""
    today = date.today()
    current = db.query(Token).filter(
        Token.date == today, Token.status == "in_progress"
    ).order_by(Token.called_at.desc()).first()

    waiting = db.query(func.count(Token.id)).filter(
        Token.date == today, Token.status == "waiting"
    ).scalar() or 0

    total = db.query(func.count(Token.id)).filter(Token.date == today).scalar() or 0

    return {
        "current_token": current.token_number if current else 0,
        "current_counter": current.counter if current else "",
        "current_patient": current.patient_name if current else "",
        "waiting_count": waiting,
        "total_today": total,
    }


# =============================================
# INVENTORY MANAGEMENT
# =============================================

@app.get("/api/inventory")
async def list_inventory(
    category: Optional[str] = None,
    low_stock: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(InventoryItem).filter(InventoryItem.is_active == True)
    if category:
        query = query.filter(InventoryItem.category == category)
    if low_stock:
        query = query.filter(InventoryItem.quantity <= InventoryItem.min_quantity)
    items = query.order_by(InventoryItem.category, InventoryItem.name).all()
    return [
        {
            "id": i.id, "name": i.name, "category": i.category, "sku": i.sku,
            "quantity": i.quantity, "min_quantity": i.min_quantity, "unit": i.unit,
            "price_per_unit": float(i.price_per_unit) if i.price_per_unit else 0,
            "supplier": i.supplier, "expiry_date": i.expiry_date.isoformat() if i.expiry_date else None,
            "location": i.location, "is_low": i.quantity <= i.min_quantity,
            "is_expired": i.expiry_date < date.today() if i.expiry_date else False,
        }
        for i in items
    ]


@app.post("/api/inventory")
async def add_inventory_item(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = InventoryItem(
        name=sanitize(data["name"]),
        category=data.get("category", "Consumable"),
        sku=data.get("sku"),
        quantity=data.get("quantity", 0),
        min_quantity=data.get("min_quantity", 10),
        unit=data.get("unit", "pcs"),
        price_per_unit=data.get("price_per_unit", 0),
        supplier=data.get("supplier"),
        expiry_date=data.get("expiry_date"),
        location=data.get("location"),
    )
    db.add(item)
    db.commit()
    return {"message": "Item added", "id": item.id}


@app.put("/api/inventory/{item_id}")
async def update_inventory(
    item_id: int, data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for key in ["name", "category", "sku", "quantity", "min_quantity", "unit",
                "price_per_unit", "supplier", "expiry_date", "location"]:
        if key in data:
            setattr(item, key, data[key])
    db.commit()
    return {"message": "Updated"}


@app.post("/api/inventory/{item_id}/stock")
async def adjust_stock(
    item_id: int, data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    action = data.get("action", "add")  # add, use, adjust
    qty = int(data.get("quantity", 0))

    if action == "add":
        item.quantity += qty
    elif action == "use":
        if item.quantity < qty:
            raise HTTPException(status_code=400, detail="Insufficient stock")
        item.quantity -= qty
    elif action == "adjust":
        item.quantity = qty

    log = InventoryLog(
        item_id=item.id, action=action, quantity=qty,
        notes=data.get("notes", ""), user_id=current_user.id,
    )
    db.add(log)
    db.commit()
    return {"message": f"Stock {action}: {qty} {item.unit}", "new_quantity": item.quantity}


@app.delete("/api/inventory/{item_id}")
async def delete_inventory(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    item.is_active = False
    db.commit()
    return {"message": "Deleted"}


# =============================================
# REPORT TEMPLATES
# =============================================

@app.get("/api/report-templates")
async def list_templates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    templates = db.query(ReportTemplate).order_by(ReportTemplate.name).all()
    return [
        {
            "id": t.id, "name": t.name, "test_panel": t.test_panel,
            "header_text": t.header_text, "footer_text": t.footer_text,
            "notes_text": t.notes_text, "show_qr": t.show_qr,
            "show_signature": t.show_signature, "is_default": t.is_default,
        }
        for t in templates
    ]


@app.post("/api/report-templates")
async def create_template(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tmpl = ReportTemplate(
        name=sanitize(data["name"]),
        test_panel=data.get("test_panel"),
        header_text=data.get("header_text"),
        footer_text=data.get("footer_text"),
        notes_text=data.get("notes_text"),
        show_qr=data.get("show_qr", True),
        show_signature=data.get("show_signature", True),
        is_default=data.get("is_default", False),
    )
    db.add(tmpl)
    db.commit()
    return {"message": "Template created", "id": tmpl.id}


@app.put("/api/report-templates/{tmpl_id}")
async def update_template(tmpl_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tmpl = db.query(ReportTemplate).filter(ReportTemplate.id == tmpl_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    for key in ["name", "test_panel", "header_text", "footer_text", "notes_text", "show_qr", "show_signature", "is_default"]:
        if key in data:
            setattr(tmpl, key, data[key])
    db.commit()
    return {"message": "Updated"}


@app.delete("/api/report-templates/{tmpl_id}")
async def delete_template(tmpl_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tmpl = db.query(ReportTemplate).filter(ReportTemplate.id == tmpl_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(tmpl)
    db.commit()
    return {"message": "Deleted"}


# =============================================
# MACHINE TEST PARSER
# =============================================

@app.post("/api/machine/test-parse")
async def test_parse_message(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Test parse an HL7/ASTM message without saving to database."""
    raw = data.get("raw_message", "")
    if not raw.strip():
        raise HTTPException(status_code=400, detail="No message provided")

    from backend.machine_adapter import detect_protocol
    try:
        adapter = detect_protocol(raw)
        result = adapter.parse(raw)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parse error: {str(e)}")


# =============================================
# DATA IMPORT (CSV)
# =============================================

@app.post("/api/import/patients")
async def import_patients_csv(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Import patients from CSV file. Columns: mrn, first_name, last_name, gender, dob, phone, address"""
    import csv, io

    content = await file.read()
    text = content.decode("utf-8-sig")  # Handle BOM from Excel
    reader = csv.DictReader(io.StringIO(text))

    imported = 0
    skipped = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        try:
            mrn = (row.get("mrn") or row.get("MRN") or "").strip()
            if not mrn:
                errors.append(f"Row {i}: MRN is empty")
                skipped += 1
                continue

            # Check duplicate
            if db.query(Patient).filter(Patient.mrn == mrn).first():
                skipped += 1
                continue

            patient = Patient(
                mrn=sanitize(mrn),
                first_name=sanitize(row.get("first_name") or row.get("First Name") or row.get("name", "").split()[0] if row.get("name") else ""),
                last_name=sanitize(row.get("last_name") or row.get("Last Name") or (row.get("name", "").split()[-1] if row.get("name") and len(row.get("name", "").split()) > 1 else "")),
                gender=(row.get("gender") or row.get("Gender") or "")[:1].upper() or None,
                phone=row.get("phone") or row.get("Phone") or row.get("mobile") or None,
                address=row.get("address") or row.get("Address") or None,
            )

            # Parse DOB
            dob_str = row.get("dob") or row.get("DOB") or row.get("date_of_birth") or ""
            if dob_str:
                for fmt in ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d-%b-%Y"]:
                    try:
                        patient.dob = datetime.strptime(dob_str.strip(), fmt).date()
                        break
                    except ValueError:
                        continue

            db.add(patient)
            imported += 1

        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
            skipped += 1

    db.commit()
    log_action(db, current_user, "IMPORT", "patients", None, f"Imported {imported}, skipped {skipped}")

    return {
        "message": f"Import complete: {imported} imported, {skipped} skipped",
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:10],  # Show first 10 errors
    }


@app.post("/api/import/doctors")
async def import_doctors_csv(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Import doctors from CSV. Columns: name, specialization, phone, email"""
    import csv, io

    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))

    imported = 0
    skipped = 0

    for row in reader:
        name = sanitize(row.get("name") or row.get("Name") or "").strip()
        if not name:
            skipped += 1
            continue
        if db.query(Doctor).filter(Doctor.name == name).first():
            skipped += 1
            continue

        db.add(Doctor(
            name=name,
            specialization=row.get("specialization") or row.get("Specialization") or None,
            phone=row.get("phone") or row.get("Phone") or None,
            email=row.get("email") or row.get("Email") or None,
        ))
        imported += 1

    db.commit()
    return {"message": f"Imported {imported} doctors, skipped {skipped}", "imported": imported, "skipped": skipped}


# =============================================
# MANUAL RESULT ENTRY
# =============================================

@app.post("/api/samples/{sample_id}/manual-results")
async def manual_result_entry(
    sample_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enter results manually when machine is offline."""
    sample = db.query(Sample).filter(Sample.sample_id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    results_data = data.get("results", [])
    if not results_data:
        raise HTTPException(status_code=400, detail="No results provided")

    saved = 0
    for r in results_data:
        value = r.get("value", "").strip()
        if not value:
            continue

        # Auto-flag based on reference ranges
        flag = "N"
        ref_low = r.get("ref_low")
        ref_high = r.get("ref_high")

        if ref_low is not None and ref_high is not None:
            try:
                num_val = float(value)
                if num_val > float(ref_high):
                    flag = "H"
                elif num_val < float(ref_low):
                    flag = "L"
            except (ValueError, TypeError):
                pass

        result = Result(
            sample_id=sample.id,
            test_code=sanitize(r.get("test_code", "")),
            test_name=sanitize(r.get("test_name", "")),
            value=value,
            unit=r.get("unit", ""),
            ref_low=ref_low,
            ref_high=ref_high,
            flag=r.get("flag") or flag,
            status="final",
        )
        db.add(result)
        saved += 1

    sample.status = "completed"
    sample.received_at = datetime.utcnow()
    db.commit()

    log_action(db, current_user, "MANUAL_ENTRY", "sample", sample_id, f"Entered {saved} results manually")
    return {"message": f"Saved {saved} results", "sample_id": sample_id}


# =============================================
# DATA EXPORT (CSV/Excel)
# =============================================

@app.get("/api/export/patients")
async def export_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    import csv, io
    patients = db.query(Patient).order_by(Patient.created_at.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["MRN", "First Name", "Last Name", "Gender", "DOB", "Age", "Phone", "Address", "Registered"])
    for p in patients:
        writer.writerow([p.mrn, p.first_name, p.last_name, p.gender, p.dob, p.age, p.phone, p.address, p.created_at])

    from fastapi.responses import StreamingResponse
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=\"patients_{datetime.now().strftime('%Y-%m-%d')}.csv\""},
    )


@app.get("/api/export/results")
async def export_results(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    import csv, io
    query = db.query(Result, Sample, Patient).join(Sample, Result.sample_id == Sample.id).join(Patient, Sample.patient_id == Patient.id)
    if date_from:
        query = query.filter(Result.received_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(Result.received_at <= datetime.combine(date_to, datetime.max.time()))

    rows = query.order_by(Result.received_at.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Sample ID", "Patient MRN", "Patient Name", "Test Code", "Test Name", "Value", "Unit", "Ref Low", "Ref High", "Flag", "Status", "Date"])
    for r, s, p in rows:
        writer.writerow([s.sample_id, p.mrn, p.full_name, r.test_code, r.test_name, r.value, r.unit, r.ref_low, r.ref_high, r.flag, r.status, r.received_at])

    from fastapi.responses import StreamingResponse
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=\"results_{datetime.now().strftime('%Y-%m-%d')}.csv\""},
    )


@app.get("/api/export/invoices")
async def export_invoices(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    import csv, io
    query = db.query(Invoice, Patient).join(Patient, Invoice.patient_id == Patient.id)
    if date_from:
        query = query.filter(Invoice.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(Invoice.created_at <= datetime.combine(date_to, datetime.max.time()))

    rows = query.order_by(Invoice.created_at.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Invoice #", "Patient MRN", "Patient Name", "Amount", "Discount %", "Payment Method", "Date"])
    for inv, p in rows:
        writer.writerow([f"INV-{str(inv.id).zfill(5)}", p.mrn, p.full_name, inv.total_amount, inv.discount_percent, inv.payment_method, inv.created_at])

    from fastapi.responses import StreamingResponse
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=\"invoices_{datetime.now().strftime('%Y-%m-%d')}.csv\""},
    )


# =============================================
# NOTIFICATIONS
# =============================================

@app.get("/api/notifications")
async def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today_start = datetime.combine(date.today(), datetime.min.time())
    notifs = []

    # Critical results
    critical = db.query(Result, Sample).join(Sample, Result.sample_id == Sample.id).filter(
        Result.flag.in_(["H", "L", "HH", "LL"]),
        Result.received_at >= today_start,
    ).order_by(Result.received_at.desc()).limit(10).all()

    for r, s in critical:
        notifs.append({
            "type": "critical" if r.flag in ("HH", "LL") else "abnormal",
            "title": f"{r.test_name}: {r.value} ({r.flag})",
            "detail": f"Sample {s.sample_id}",
            "time": r.received_at.isoformat() if r.received_at else "",
        })

    # Pending verification
    pending = db.query(func.count(Sample.id)).filter(
        Sample.status == "completed",
    ).scalar() or 0
    if pending > 0:
        notifs.insert(0, {
            "type": "pending",
            "title": f"{pending} sample(s) pending verification",
            "detail": "Go to Verification page",
            "time": "",
        })

    # Low stock
    low_stock = db.query(func.count(InventoryItem.id)).filter(
        InventoryItem.is_active == True,
        InventoryItem.quantity <= InventoryItem.min_quantity,
    ).scalar() or 0
    if low_stock > 0:
        notifs.append({
            "type": "low_stock",
            "title": f"{low_stock} inventory item(s) low on stock",
            "detail": "Go to Inventory page",
            "time": "",
        })

    return notifs


# =============================================
# SAMPLE TRACKING
# =============================================

@app.put("/api/samples/{sample_id}/status")
async def update_sample_status(
    sample_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sample = db.query(Sample).filter(Sample.sample_id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    new_status = data.get("status")
    valid = ["pending", "collected", "received", "processing", "completed", "verified", "printed"]
    if new_status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid)}")

    sample.status = new_status
    if new_status == "received":
        sample.received_at = datetime.utcnow()
    elif new_status == "completed":
        sample.reported_at = datetime.utcnow()

    db.commit()
    log_action(db, current_user, "STATUS_UPDATE", "sample", sample_id, f"Status → {new_status}")
    return {"message": f"Sample {sample_id} status updated to {new_status}"}


# =============================================
# INVOICE RECEIPT (thermal printer format)
# =============================================

@app.get("/api/billing/invoices/{invoice_id}/receipt")
async def get_invoice_receipt(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    patient = db.query(Patient).filter(Patient.id == invoice.patient_id).first()
    items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).all()
    created_by = db.query(User).filter(User.id == invoice.created_by).first() if invoice.created_by else None

    # Get lab settings
    lab_settings = {}
    for s in db.query(LabSettings).all():
        lab_settings[s.key] = s.value
    defaults = get_settings()

    return {
        "invoice_id": f"INV-{str(invoice.id).zfill(5)}",
        "lab_name": lab_settings.get("lab_name", defaults.LAB_NAME),
        "lab_phone": lab_settings.get("lab_phone", defaults.LAB_PHONE),
        "lab_address": lab_settings.get("lab_address", defaults.LAB_ADDRESS),
        "patient_name": patient.full_name if patient else "",
        "patient_mrn": patient.mrn if patient else "",
        "patient_phone": patient.phone if patient else "",
        "items": [{"test_name": i.test_name, "price": float(i.price)} for i in items],
        "subtotal": sum(float(i.price) for i in items),
        "discount_percent": invoice.discount_percent,
        "total": float(invoice.total_amount),
        "payment_method": invoice.payment_method,
        "created_by": created_by.full_name if created_by else "",
        "date": invoice.created_at.strftime("%d-%b-%Y %I:%M %p"),
    }


# =============================================
# DOCTOR SCHEDULE
# =============================================

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


@app.get("/api/doctors/{doctor_id}/schedule")
async def get_doctor_schedule(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    schedules = db.query(DoctorSchedule).filter(DoctorSchedule.doctor_id == doctor_id).all()
    return {
        "doctor": {"id": doctor.id, "name": doctor.name, "specialization": doctor.specialization},
        "schedule": [
            {
                "id": s.id,
                "day_of_week": s.day_of_week,
                "day_name": DAYS[s.day_of_week],
                "start_time": s.start_time,
                "end_time": s.end_time,
                "is_available": s.is_available,
                "notes": s.notes,
            }
            for s in sorted(schedules, key=lambda x: x.day_of_week)
        ],
    }


@app.post("/api/doctors/{doctor_id}/schedule")
async def set_doctor_schedule(
    doctor_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upsert schedule entry for one day."""
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    day = int(data.get("day_of_week", 0))
    existing = db.query(DoctorSchedule).filter(
        DoctorSchedule.doctor_id == doctor_id,
        DoctorSchedule.day_of_week == day,
    ).first()

    if existing:
        existing.start_time = data.get("start_time", existing.start_time)
        existing.end_time = data.get("end_time", existing.end_time)
        existing.is_available = data.get("is_available", existing.is_available)
        existing.notes = sanitize(data.get("notes") or "")
    else:
        db.add(DoctorSchedule(
            doctor_id=doctor_id,
            day_of_week=day,
            start_time=data.get("start_time", "09:00"),
            end_time=data.get("end_time", "17:00"),
            is_available=data.get("is_available", True),
            notes=sanitize(data.get("notes") or ""),
        ))
    db.commit()
    return {"message": "Schedule saved"}


@app.delete("/api/doctors/{doctor_id}/schedule/{day}")
async def delete_schedule_day(
    doctor_id: int,
    day: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    db.query(DoctorSchedule).filter(
        DoctorSchedule.doctor_id == doctor_id,
        DoctorSchedule.day_of_week == day,
    ).delete()
    db.commit()
    return {"message": "Schedule entry removed"}


@app.get("/api/schedule/today")
async def get_today_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All doctors available today."""
    today_dow = datetime.now().weekday()  # 0=Mon
    schedules = (
        db.query(DoctorSchedule, Doctor)
        .join(Doctor, DoctorSchedule.doctor_id == Doctor.id)
        .filter(DoctorSchedule.day_of_week == today_dow, DoctorSchedule.is_available == True)
        .all()
    )
    return [
        {
            "doctor_id": d.id,
            "doctor_name": d.name,
            "specialization": d.specialization,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "notes": s.notes,
        }
        for s, d in schedules
    ]


# =============================================
# PRESCRIPTIONS
# =============================================

@app.get("/api/prescriptions")
async def list_prescriptions(
    patient_id: Optional[int] = Query(None),
    doctor_id: Optional[int] = Query(None),
    limit: int = Query(50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Prescription, Patient, Doctor).join(
        Patient, Prescription.patient_id == Patient.id
    ).outerjoin(Doctor, Prescription.doctor_id == Doctor.id)

    if patient_id:
        q = q.filter(Prescription.patient_id == patient_id)
    if doctor_id:
        q = q.filter(Prescription.doctor_id == doctor_id)

    rows = q.order_by(Prescription.created_at.desc()).limit(limit).all()

    result = []
    for rx, pat, doc in rows:
        items = db.query(PrescriptionItem).filter(PrescriptionItem.prescription_id == rx.id).all()
        result.append({
            "id": rx.id,
            "patient_id": rx.patient_id,
            "patient_name": pat.full_name,
            "patient_mrn": pat.mrn,
            "doctor_id": rx.doctor_id,
            "doctor_name": doc.name if doc else None,
            "diagnosis": rx.diagnosis,
            "chief_complaint": rx.chief_complaint,
            "notes": rx.notes,
            "created_at": rx.created_at.isoformat() if rx.created_at else None,
            "items": [
                {
                    "id": i.id,
                    "medicine_name": i.medicine_name,
                    "dosage": i.dosage,
                    "frequency": i.frequency,
                    "duration": i.duration,
                    "route": i.route,
                    "instructions": i.instructions,
                }
                for i in items
            ],
        })
    return result


@app.post("/api/prescriptions", status_code=201)
async def create_prescription(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.query(Patient).filter(Patient.id == data.get("patient_id")).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    rx = Prescription(
        patient_id=data["patient_id"],
        doctor_id=data.get("doctor_id"),
        sample_id=data.get("sample_id"),
        diagnosis=sanitize(data.get("diagnosis") or ""),
        chief_complaint=sanitize(data.get("chief_complaint") or ""),
        notes=sanitize(data.get("notes") or ""),
        created_by=current_user.id,
    )
    db.add(rx)
    db.flush()

    for item in data.get("items", []):
        db.add(PrescriptionItem(
            prescription_id=rx.id,
            medicine_name=sanitize(item.get("medicine_name", "")),
            dosage=sanitize(item.get("dosage") or ""),
            frequency=sanitize(item.get("frequency") or ""),
            duration=sanitize(item.get("duration") or ""),
            route=sanitize(item.get("route") or ""),
            instructions=sanitize(item.get("instructions") or ""),
        ))

    db.commit()
    log_action(db, current_user, "CREATE", "prescription", str(rx.id),
               f"Prescription for {patient.full_name}")
    return {"id": rx.id, "message": "Prescription created"}


@app.get("/api/prescriptions/{rx_id}")
async def get_prescription(
    rx_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rx = db.query(Prescription).filter(Prescription.id == rx_id).first()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    patient = db.query(Patient).filter(Patient.id == rx.patient_id).first()
    doctor = db.query(Doctor).filter(Doctor.id == rx.doctor_id).first() if rx.doctor_id else None
    items = db.query(PrescriptionItem).filter(PrescriptionItem.prescription_id == rx_id).all()

    return {
        "id": rx.id,
        "patient_id": rx.patient_id,
        "patient_name": patient.full_name if patient else None,
        "patient_mrn": patient.mrn if patient else None,
        "doctor_id": rx.doctor_id,
        "doctor_name": doctor.name if doctor else None,
        "diagnosis": rx.diagnosis,
        "chief_complaint": rx.chief_complaint,
        "notes": rx.notes,
        "created_at": rx.created_at.isoformat() if rx.created_at else None,
        "items": [
            {
                "id": i.id,
                "medicine_name": i.medicine_name,
                "dosage": i.dosage,
                "frequency": i.frequency,
                "duration": i.duration,
                "route": i.route,
                "instructions": i.instructions,
            }
            for i in items
        ],
    }


@app.put("/api/prescriptions/{rx_id}")
async def update_prescription(
    rx_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rx = db.query(Prescription).filter(Prescription.id == rx_id).first()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    rx.diagnosis = sanitize(data.get("diagnosis") or rx.diagnosis or "")
    rx.chief_complaint = sanitize(data.get("chief_complaint") or rx.chief_complaint or "")
    rx.notes = sanitize(data.get("notes") or rx.notes or "")
    rx.doctor_id = data.get("doctor_id", rx.doctor_id)

    if "items" in data:
        # Replace all items
        db.query(PrescriptionItem).filter(PrescriptionItem.prescription_id == rx_id).delete()
        for item in data["items"]:
            db.add(PrescriptionItem(
                prescription_id=rx_id,
                medicine_name=sanitize(item.get("medicine_name", "")),
                dosage=sanitize(item.get("dosage") or ""),
                frequency=sanitize(item.get("frequency") or ""),
                duration=sanitize(item.get("duration") or ""),
                route=sanitize(item.get("route") or ""),
                instructions=sanitize(item.get("instructions") or ""),
            ))

    db.commit()
    return {"message": "Prescription updated"}


@app.delete("/api/prescriptions/{rx_id}")
async def delete_prescription(
    rx_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    rx = db.query(Prescription).filter(Prescription.id == rx_id).first()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    db.delete(rx)
    db.commit()
    return {"message": "Prescription deleted"}


# =============================================
# DOCTOR DASHBOARD
# =============================================

@app.get("/api/doctor/dashboard")
async def get_doctor_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Doctor dashboard: samples/patients referred by this doctor's linked doctor record."""
    # Find doctor record linked to this user (match by name)
    doctor = db.query(Doctor).filter(
        func.lower(Doctor.name) == func.lower(current_user.full_name)
    ).first()

    if not doctor:
        # Return empty dashboard if no doctor record found
        return {
            "doctor": None,
            "pending": [],
            "completed": [],
            "stats": {"total": 0, "pending": 0, "completed": 0, "critical": 0},
        }

    pending_samples = (
        db.query(Sample, Patient)
        .join(Patient, Sample.patient_id == Patient.id)
        .filter(Sample.doctor_id == doctor.id)
        .filter(Sample.status.in_(["pending", "processing", "completed"]))
        .order_by(Sample.collected_at.desc())
        .limit(50)
        .all()
    )

    verified_samples = (
        db.query(Sample, Patient)
        .join(Patient, Sample.patient_id == Patient.id)
        .filter(Sample.doctor_id == doctor.id)
        .filter(Sample.status == "verified")
        .order_by(Sample.reported_at.desc())
        .limit(50)
        .all()
    )

    def _fmt_sample(s, p):
        critical_count = db.query(func.count(Result.id)).filter(
            Result.sample_id == s.id,
            Result.flag.in_(["HH", "LL"])
        ).scalar() or 0
        return {
            "sample_id": s.sample_id,
            "patient_name": p.full_name,
            "patient_mrn": p.mrn,
            "test_panel": s.test_panel,
            "status": s.status,
            "collected_at": s.collected_at.isoformat() if s.collected_at else None,
            "reported_at": s.reported_at.isoformat() if s.reported_at else None,
            "tat_hours": round((s.reported_at - s.collected_at).total_seconds() / 3600, 1) if s.reported_at and s.collected_at else None,
            "critical_count": critical_count,
        }

    total_critical = db.query(func.count(Result.id)).join(
        Sample, Result.sample_id == Sample.id
    ).filter(
        Sample.doctor_id == doctor.id,
        Result.flag.in_(["HH", "LL"]),
    ).scalar() or 0

    return {
        "doctor": {"id": doctor.id, "name": doctor.name, "specialization": doctor.specialization},
        "pending": [_fmt_sample(s, p) for s, p in pending_samples],
        "completed": [_fmt_sample(s, p) for s, p in verified_samples],
        "stats": {
            "total": len(pending_samples) + len(verified_samples),
            "pending": len(pending_samples),
            "completed": len(verified_samples),
            "critical": total_critical,
        },
    }


# =============================================
# STARTUP
# =============================================

# =============================================
# OPD ENDPOINTS
# =============================================

def _next_visit_number(db: Session) -> str:
    today = date.today().strftime("%Y%m%d")
    count = db.query(OPDVisit).filter(func.date(OPDVisit.created_at) == date.today()).count()
    return f"OPD-{today}-{count + 1:04d}"


# =============================================
# REFERRAL COMMISSION
# =============================================

@app.get("/api/referral/commission")
async def get_referral_commission(
    from_date: str = None,
    to_date: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get referral summary per doctor: samples referred, total billed, per-patient breakdown."""
    import os as _os
    from datetime import date as _date

    sample_q = db.query(Sample).filter(Sample.doctor_id.isnot(None))
    if from_date:
        try:
            fd = datetime.strptime(from_date, "%Y-%m-%d")
            sample_q = sample_q.filter(Sample.collected_at >= fd)
        except ValueError:
            pass
    if to_date:
        try:
            td = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            sample_q = sample_q.filter(Sample.collected_at <= td)
        except ValueError:
            pass

    samples = sample_q.order_by(Sample.collected_at.desc()).all()

    # Group by doctor
    doctor_cache = {}
    patient_cache = {}
    doctor_map: dict = {}

    for sample in samples:
        doc_id = sample.doctor_id
        if doc_id not in doctor_cache:
            doc = db.query(Doctor).filter(Doctor.id == doc_id).first()
            doctor_cache[doc_id] = doc
        doc = doctor_cache[doc_id]
        if not doc:
            continue

        if doc_id not in doctor_map:
            doctor_map[doc_id] = {
                "doctor_id": doc_id,
                "doctor_name": doc.name,
                "doctor_phone": doc.phone or "",
                "specialization": doc.specialization or "",
                "sample_count": 0,
                "patient_ids": set(),
                "total_billed": 0.0,
                "records": [],
            }

        # Find invoice for this patient on same day as sample collection
        billed_amount = 0.0
        if sample.collected_at:
            sample_date = sample.collected_at.date()
            invoice = (
                db.query(Invoice)
                .filter(
                    Invoice.patient_id == sample.patient_id,
                    func.date(Invoice.created_at) == sample_date,
                )
                .first()
            )
            if invoice:
                billed_amount = float(invoice.total_amount)

        if sample.patient_id not in patient_cache:
            pat = db.query(Patient).filter(Patient.id == sample.patient_id).first()
            patient_cache[sample.patient_id] = pat
        pat = patient_cache[sample.patient_id]

        doctor_map[doc_id]["sample_count"] += 1
        doctor_map[doc_id]["patient_ids"].add(sample.patient_id)
        doctor_map[doc_id]["total_billed"] += billed_amount
        doctor_map[doc_id]["records"].append({
            "sample_id": sample.sample_id,
            "patient_name": pat.full_name if pat else "Unknown",
            "patient_mrn": pat.mrn if pat else "",
            "collected_at": sample.collected_at.strftime("%d-%b-%Y") if sample.collected_at else "",
            "test_panel": sample.test_panel or "",
            "billed_amount": round(billed_amount, 2),
        })

    result = []
    for doc_id, data in doctor_map.items():
        result.append({
            "doctor_id": doc_id,
            "doctor_name": data["doctor_name"],
            "doctor_phone": data["doctor_phone"],
            "specialization": data["specialization"],
            "sample_count": data["sample_count"],
            "patient_count": len(data["patient_ids"]),
            "total_billed": round(data["total_billed"], 2),
            "records": data["records"],
        })

    result.sort(key=lambda x: x["total_billed"], reverse=True)
    return result


@app.get("/api/opd/visits")
async def list_opd_visits(
    date_filter: str = None,
    status: str = None,
    search: str = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(OPDVisit).join(Patient, OPDVisit.patient_id == Patient.id)
    if date_filter:
        try:
            d = datetime.strptime(date_filter, "%Y-%m-%d").date()
            q = q.filter(OPDVisit.visit_date == d)
        except ValueError:
            pass
    else:
        q = q.filter(OPDVisit.visit_date == date.today())
    if status:
        q = q.filter(OPDVisit.status == status)
    if search:
        q = q.filter(Patient.first_name.ilike(f"%{search}%") | Patient.last_name.ilike(f"%{search}%"))
    visits = q.order_by(OPDVisit.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for v in visits:
        result.append({
            "id": v.id, "visit_number": v.visit_number,
            "patient_id": v.patient_id,
            "patient_name": v.patient.full_name if v.patient else "",
            "patient_phone": v.patient.phone if v.patient else "",
            "doctor_id": v.doctor_id,
            "doctor_name": v.doctor.name if v.doctor else "",
            "visit_date": str(v.visit_date), "chief_complaint": v.chief_complaint,
            "diagnosis": v.diagnosis, "notes": v.notes, "fee": float(v.fee or 0),
            "status": v.status,
            "referred_to_lab": v.referred_to_lab,
            "referred_to_radiology": v.referred_to_radiology,
            "referred_to_pharmacy": v.referred_to_pharmacy,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        })
    return result

@app.post("/api/opd/visits", status_code=201)
async def create_opd_visit(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient_id = data.get("patient_id")
    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id is required")
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    visit = OPDVisit(
        visit_number=_next_visit_number(db),
        patient_id=patient_id,
        doctor_id=data.get("doctor_id"),
        chief_complaint=sanitize(data.get("chief_complaint", "") or ""),
        diagnosis=sanitize(data.get("diagnosis", "") or ""),
        notes=sanitize(data.get("notes", "") or ""),
        fee=data.get("fee", 0),
        status=data.get("status", "waiting"),
        referred_to_lab=data.get("referred_to_lab", False),
        referred_to_radiology=data.get("referred_to_radiology", False),
        referred_to_pharmacy=data.get("referred_to_pharmacy", False),
        created_by=current_user.id,
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return {"id": visit.id, "visit_number": visit.visit_number, "message": "OPD visit created"}

@app.put("/api/opd/visits/{visit_id}")
async def update_opd_visit(
    visit_id: int, data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    visit = db.query(OPDVisit).filter(OPDVisit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    for field in ["doctor_id", "chief_complaint", "diagnosis", "notes", "fee", "status",
                  "referred_to_lab", "referred_to_radiology", "referred_to_pharmacy"]:
        if field in data:
            val = sanitize(str(data[field])) if isinstance(data[field], str) else data[field]
            setattr(visit, field, val)
    visit.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Visit updated"}

@app.delete("/api/opd/visits/{visit_id}")
async def delete_opd_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    visit = db.query(OPDVisit).filter(OPDVisit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    db.delete(visit)
    db.commit()
    return {"message": "Visit deleted"}

@app.get("/api/opd/stats")
async def opd_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today()
    total = db.query(OPDVisit).filter(OPDVisit.visit_date == today).count()
    waiting = db.query(OPDVisit).filter(OPDVisit.visit_date == today, OPDVisit.status == "waiting").count()
    in_progress = db.query(OPDVisit).filter(OPDVisit.visit_date == today, OPDVisit.status == "in_progress").count()
    completed = db.query(OPDVisit).filter(OPDVisit.visit_date == today, OPDVisit.status == "completed").count()
    return {"total": total, "waiting": waiting, "in_progress": in_progress, "completed": completed}


# =============================================
# WARD & BED ENDPOINTS
# =============================================

@app.get("/api/wards")
async def list_wards(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wards = db.query(Ward).filter(Ward.is_active == True).order_by(Ward.name).all()
    result = []
    for w in wards:
        beds = db.query(Bed).filter(Bed.ward_id == w.id, Bed.is_active == True).all()
        available = sum(1 for b in beds if b.status == "available")
        occupied  = sum(1 for b in beds if b.status == "occupied")
        result.append({
            "id": w.id, "name": w.name, "code": w.code, "ward_type": w.ward_type,
            "floor": w.floor, "total_beds": w.total_beds,
            "available_beds": available, "occupied_beds": occupied,
            "maintenance_beds": sum(1 for b in beds if b.status == "maintenance"),
            "created_at": w.created_at.isoformat(),
        })
    return result

@app.post("/api/wards", status_code=201)
async def create_ward(data: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    if not data.get("name") or not data.get("code"):
        raise HTTPException(status_code=400, detail="name and code are required")
    if db.query(Ward).filter(Ward.code == data["code"].upper()).first():
        raise HTTPException(status_code=400, detail="Ward code already exists")
    ward = Ward(
        name=sanitize(data["name"]), code=data["code"].upper().strip(),
        ward_type=data.get("ward_type", "general"), floor=data.get("floor", ""),
        total_beds=data.get("total_beds", 0),
    )
    db.add(ward)
    db.commit()
    db.refresh(ward)
    return {"id": ward.id, "message": "Ward created"}

@app.put("/api/wards/{ward_id}")
async def update_ward(ward_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    ward = db.query(Ward).filter(Ward.id == ward_id).first()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")
    for f in ["name", "ward_type", "floor", "total_beds", "is_active"]:
        if f in data:
            setattr(ward, f, sanitize(str(data[f])) if isinstance(data[f], str) else data[f])
    db.commit()
    return {"message": "Ward updated"}

@app.delete("/api/wards/{ward_id}")
async def delete_ward(ward_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    ward = db.query(Ward).filter(Ward.id == ward_id).first()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")
    occupied = db.query(Bed).filter(Bed.ward_id == ward_id, Bed.status == "occupied").count()
    if occupied > 0:
        raise HTTPException(status_code=400, detail=f"{occupied} beds are occupied. Discharge patients first.")
    ward.is_active = False
    db.commit()
    return {"message": "Ward deactivated"}

@app.get("/api/wards/{ward_id}/beds")
async def list_beds(ward_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    beds = db.query(Bed).filter(Bed.ward_id == ward_id, Bed.is_active == True).order_by(Bed.bed_number).all()
    result = []
    for b in beds:
        adm = db.query(Admission).filter(Admission.bed_id == b.id, Admission.status == "admitted").first()
        result.append({
            "id": b.id, "bed_number": b.bed_number, "bed_type": b.bed_type,
            "status": b.status, "ward_id": b.ward_id,
            "patient_name": adm.patient.full_name if adm and adm.patient else None,
            "admission_id": adm.id if adm else None,
            "admission_number": adm.admission_number if adm else None,
            "admitted_at": adm.admission_date.isoformat() if adm and adm.admission_date else None,
        })
    return result

@app.post("/api/wards/{ward_id}/beds", status_code=201)
async def create_bed(ward_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    ward = db.query(Ward).filter(Ward.id == ward_id).first()
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")
    if not data.get("bed_number"):
        raise HTTPException(status_code=400, detail="bed_number is required")
    if db.query(Bed).filter(Bed.ward_id == ward_id, Bed.bed_number == data["bed_number"]).first():
        raise HTTPException(status_code=400, detail="Bed number already exists in this ward")
    bed = Bed(ward_id=ward_id, bed_number=data["bed_number"], bed_type=data.get("bed_type", "standard"))
    db.add(bed)
    db.commit()
    db.refresh(bed)
    return {"id": bed.id, "message": "Bed created"}

@app.put("/api/beds/{bed_id}")
async def update_bed(bed_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    bed = db.query(Bed).filter(Bed.id == bed_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    for f in ["bed_number", "bed_type", "status", "is_active"]:
        if f in data:
            setattr(bed, f, data[f])
    db.commit()
    return {"message": "Bed updated"}

@app.delete("/api/beds/{bed_id}")
async def delete_bed(bed_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    bed = db.query(Bed).filter(Bed.id == bed_id).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    if bed.status == "occupied":
        raise HTTPException(status_code=400, detail="Bed is occupied. Discharge patient first.")
    bed.is_active = False
    db.commit()
    return {"message": "Bed removed"}


# =============================================
# IPD / ADMISSION ENDPOINTS
# =============================================

def _next_admission_number(db: Session) -> str:
    count = db.query(Admission).count()
    return f"ADM-{date.today().strftime('%Y%m%d')}-{count + 1:04d}"

@app.get("/api/admissions")
async def list_admissions(
    status: str = None, search: str = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    q = db.query(Admission).join(Patient, Admission.patient_id == Patient.id)
    if status:
        q = q.filter(Admission.status == status)
    if search:
        q = q.filter(Patient.first_name.ilike(f"%{search}%") | Patient.last_name.ilike(f"%{search}%"))
    admissions = q.order_by(Admission.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for a in admissions:
        ward_name = a.bed.ward.name if a.bed and a.bed.ward else None
        result.append({
            "id": a.id, "admission_number": a.admission_number,
            "patient_id": a.patient_id,
            "patient_name": a.patient.full_name if a.patient else "",
            "patient_phone": a.patient.phone if a.patient else "",
            "doctor_id": a.doctor_id,
            "doctor_name": a.doctor.name if a.doctor else "",
            "bed_id": a.bed_id,
            "bed_number": a.bed.bed_number if a.bed else None,
            "ward_name": ward_name,
            "admission_date": a.admission_date.isoformat() if a.admission_date else None,
            "discharge_date": a.discharge_date.isoformat() if a.discharge_date else None,
            "admission_type": a.admission_type, "diagnosis": a.diagnosis,
            "notes": a.notes, "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return result

@app.post("/api/admissions", status_code=201)
async def create_admission(
    data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    if not data.get("patient_id"):
        raise HTTPException(status_code=400, detail="patient_id is required")
    patient = db.query(Patient).filter(Patient.id == data["patient_id"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    bed_id = data.get("bed_id")
    if bed_id:
        bed = db.query(Bed).filter(Bed.id == bed_id).first()
        if not bed:
            raise HTTPException(status_code=404, detail="Bed not found")
        if bed.status == "occupied":
            raise HTTPException(status_code=400, detail="Bed is already occupied")
        bed.status = "occupied"
    admission = Admission(
        admission_number=_next_admission_number(db),
        patient_id=data["patient_id"],
        bed_id=bed_id,
        doctor_id=data.get("doctor_id"),
        admission_type=data.get("admission_type", "planned"),
        diagnosis=sanitize(data.get("diagnosis", "") or ""),
        notes=sanitize(data.get("notes", "") or ""),
        status="admitted",
        created_by=current_user.id,
    )
    db.add(admission)
    db.commit()
    db.refresh(admission)
    log_action(db, current_user, "CREATE", "admission", admission.id,
               f"Admitted patient {patient.full_name} to IPD")
    return {"id": admission.id, "admission_number": admission.admission_number, "message": "Patient admitted"}

@app.put("/api/admissions/{admission_id}")
async def update_admission(
    admission_id: int, data: dict,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    adm = db.query(Admission).filter(Admission.id == admission_id).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")
    # Handle bed change
    new_bed_id = data.get("bed_id")
    if new_bed_id and new_bed_id != adm.bed_id:
        if adm.bed_id:
            old_bed = db.query(Bed).filter(Bed.id == adm.bed_id).first()
            if old_bed:
                old_bed.status = "available"
        new_bed = db.query(Bed).filter(Bed.id == new_bed_id).first()
        if not new_bed:
            raise HTTPException(status_code=404, detail="New bed not found")
        if new_bed.status == "occupied":
            raise HTTPException(status_code=400, detail="New bed is already occupied")
        new_bed.status = "occupied"
        adm.bed_id = new_bed_id
    for f in ["doctor_id", "diagnosis", "notes", "admission_type"]:
        if f in data:
            setattr(adm, f, sanitize(str(data[f])) if isinstance(data[f], str) else data[f])
    db.commit()
    return {"message": "Admission updated"}

@app.put("/api/admissions/{admission_id}/discharge")
async def discharge_patient(
    admission_id: int, data: dict = {},
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    adm = db.query(Admission).filter(Admission.id == admission_id).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")
    if adm.status == "discharged":
        raise HTTPException(status_code=400, detail="Patient already discharged")
    adm.status = "discharged"
    adm.discharge_date = datetime.utcnow()
    if adm.bed_id:
        bed = db.query(Bed).filter(Bed.id == adm.bed_id).first()
        if bed:
            bed.status = "available"
    db.commit()
    patient = db.query(Patient).filter(Patient.id == adm.patient_id).first()
    patient_name = patient.full_name if patient else f"patient#{adm.patient_id}"
    log_action(db, current_user, "UPDATE", "admission", admission_id,
               f"Discharged patient {patient_name} from IPD admission {adm.admission_number}")
    return {"message": "Patient discharged successfully"}

@app.delete("/api/admissions/{admission_id}")
async def delete_admission(
    admission_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin")),
):
    adm = db.query(Admission).filter(Admission.id == admission_id).first()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission not found")
    if adm.status == "admitted" and adm.bed_id:
        bed = db.query(Bed).filter(Bed.id == adm.bed_id).first()
        if bed:
            bed.status = "available"
    db.delete(adm)
    db.commit()
    return {"message": "Admission deleted"}

@app.get("/api/admissions/stats")
async def admission_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    total_admitted = db.query(Admission).filter(Admission.status == "admitted").count()
    total_beds = db.query(Bed).filter(Bed.is_active == True).count()
    available_beds = db.query(Bed).filter(Bed.is_active == True, Bed.status == "available").count()
    today_admissions = db.query(Admission).filter(func.date(Admission.admission_date) == date.today()).count()
    today_discharges = db.query(Admission).filter(func.date(Admission.discharge_date) == date.today()).count()
    return {
        "total_admitted": total_admitted, "total_beds": total_beds,
        "available_beds": available_beds, "occupied_beds": total_beds - available_beds,
        "today_admissions": today_admissions, "today_discharges": today_discharges,
    }


# =============================================
# RADIOLOGY ENDPOINTS
# =============================================

def _next_radiology_number(db: Session) -> str:
    count = db.query(RadiologyOrder).count()
    return f"RAD-{date.today().strftime('%Y%m%d')}-{count + 1:04d}"

@app.get("/api/radiology/orders")
async def list_radiology_orders(
    status: str = None, search: str = None, modality: str = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    q = db.query(RadiologyOrder).join(Patient, RadiologyOrder.patient_id == Patient.id)
    if status:
        q = q.filter(RadiologyOrder.status == status)
    if modality:
        q = q.filter(RadiologyOrder.modality == modality)
    if search:
        q = q.filter(Patient.first_name.ilike(f"%{search}%") | Patient.last_name.ilike(f"%{search}%"))
    orders = q.order_by(RadiologyOrder.ordered_at.desc()).offset(skip).limit(limit).all()
    result = []
    for o in orders:
        result.append({
            "id": o.id, "order_number": o.order_number,
            "patient_id": o.patient_id,
            "patient_name": o.patient.full_name if o.patient else "",
            "patient_phone": o.patient.phone if o.patient else "",
            "doctor_id": o.doctor_id,
            "doctor_name": o.doctor.name if o.doctor else "",
            "modality": o.modality, "body_part": o.body_part,
            "clinical_info": o.clinical_info, "priority": o.priority,
            "status": o.status, "price": float(o.price or 0),
            "ordered_at": o.ordered_at.isoformat() if o.ordered_at else None,
            "has_report": o.report is not None,
            "report": {
                "id": o.report.id,
                "radiologist_name": o.report.radiologist_name,
                "findings": o.report.findings,
                "impression": o.report.impression,
                "recommendations": o.report.recommendations,
                "reported_at": o.report.reported_at.isoformat() if o.report and o.report.reported_at else None,
            } if o.report else None,
        })
    return result

@app.post("/api/radiology/orders", status_code=201)
async def create_radiology_order(
    data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    if not data.get("patient_id") or not data.get("modality"):
        raise HTTPException(status_code=400, detail="patient_id and modality are required")
    patient = db.query(Patient).filter(Patient.id == data["patient_id"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    order = RadiologyOrder(
        order_number=_next_radiology_number(db),
        patient_id=data["patient_id"],
        doctor_id=data.get("doctor_id"),
        modality=data["modality"],
        body_part=sanitize(data.get("body_part", "") or ""),
        clinical_info=sanitize(data.get("clinical_info", "") or ""),
        priority=data.get("priority", "routine"),
        price=data.get("price", 0),
        status="ordered",
        ordered_by=current_user.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return {"id": order.id, "order_number": order.order_number, "message": "Radiology order created"}

@app.put("/api/radiology/orders/{order_id}")
async def update_radiology_order(
    order_id: int, data: dict,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    order = db.query(RadiologyOrder).filter(RadiologyOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    for f in ["modality", "body_part", "clinical_info", "priority", "status", "price", "doctor_id"]:
        if f in data:
            setattr(order, f, sanitize(str(data[f])) if isinstance(data[f], str) else data[f])
    db.commit()
    return {"message": "Order updated"}

@app.delete("/api/radiology/orders/{order_id}")
async def delete_radiology_order(
    order_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin")),
):
    order = db.query(RadiologyOrder).filter(RadiologyOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(order)
    db.commit()
    return {"message": "Order deleted"}

@app.post("/api/radiology/orders/{order_id}/report")
async def save_radiology_report(
    order_id: int, data: dict,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    order = db.query(RadiologyOrder).filter(RadiologyOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.report:
        order.report.radiologist_name = sanitize(data.get("radiologist_name", "") or "")
        order.report.findings        = sanitize(data.get("findings", "") or "")
        order.report.impression      = sanitize(data.get("impression", "") or "")
        order.report.recommendations = sanitize(data.get("recommendations", "") or "")
        order.report.reported_at     = datetime.utcnow()
    else:
        rpt = RadiologyReport(
            order_id=order_id,
            radiologist_name=sanitize(data.get("radiologist_name", "") or ""),
            findings=sanitize(data.get("findings", "") or ""),
            impression=sanitize(data.get("impression", "") or ""),
            recommendations=sanitize(data.get("recommendations", "") or ""),
        )
        db.add(rpt)
    order.status = "completed"
    db.commit()
    return {"message": "Radiology report saved"}


@app.post("/api/radiology/orders/{order_id}/image")
async def upload_radiology_image(
    order_id: int,
    image: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload an image (X-ray, MRI, CT scan) for a radiology order."""
    order = db.query(RadiologyOrder).filter(RadiologyOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    import shutil, uuid as _uuid
    images_dir = Path("./radiology_images")
    images_dir.mkdir(exist_ok=True)

    ext = Path(image.filename).suffix.lower() if image.filename else ".jpg"
    allowed = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".dcm"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="File type not allowed")

    filename = f"rad_{order_id}_{_uuid.uuid4().hex[:8]}{ext}"
    dest = images_dir / filename
    with dest.open("wb") as f:
        shutil.copyfileobj(image.file, f)

    # Store image path on the report (create one if not exists)
    if not order.report:
        rpt = RadiologyReport(order_id=order_id, image_path=filename)
        db.add(rpt)
    else:
        existing = order.report.image_path or ""
        order.report.image_path = (existing + "," + filename).lstrip(",")
    db.commit()

    return {"message": "Image uploaded", "filename": filename, "url": f"/api/radiology/images/{filename}"}


@app.get("/api/radiology/images/{filename}")
async def get_radiology_image(
    filename: str,
    current_user: User = Depends(get_current_user),
):
    """Serve a radiology image file."""
    images_dir = Path("./radiology_images")
    file_path = images_dir / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path=str(file_path), media_type="image/*")


@app.get("/api/radiology/stats")
async def radiology_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today()
    return {
        "today_orders": db.query(RadiologyOrder).filter(func.date(RadiologyOrder.ordered_at) == today).count(),
        "pending": db.query(RadiologyOrder).filter(RadiologyOrder.status == "ordered").count(),
        "in_progress": db.query(RadiologyOrder).filter(RadiologyOrder.status == "in_progress").count(),
        "completed_today": db.query(RadiologyOrder).filter(func.date(RadiologyOrder.ordered_at) == today, RadiologyOrder.status == "completed").count(),
    }


# =============================================
# OPERATION THEATER ENDPOINTS
# =============================================

def _next_surgery_number(db: Session) -> str:
    count = db.query(Surgery).count()
    return f"SUR-{date.today().strftime('%Y%m%d')}-{count + 1:04d}"

@app.get("/api/ot/theaters")
async def list_theaters(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    theaters = db.query(OperationTheater).filter(OperationTheater.is_active == True).all()
    result = []
    for t in theaters:
        today_surg = db.query(Surgery).filter(
            Surgery.theater_id == t.id,
            func.date(Surgery.scheduled_at) == date.today()
        ).count()
        result.append({
            "id": t.id, "name": t.name, "ot_type": t.ot_type,
            "status": t.status, "today_surgeries": today_surg,
            "created_at": t.created_at.isoformat(),
        })
    return result

@app.post("/api/ot/theaters", status_code=201)
async def create_theater(data: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="name is required")
    theater = OperationTheater(
        name=sanitize(data["name"]), ot_type=data.get("ot_type", "general"),
        status=data.get("status", "available"),
    )
    db.add(theater)
    db.commit()
    db.refresh(theater)
    return {"id": theater.id, "message": "Theater created"}

@app.put("/api/ot/theaters/{theater_id}")
async def update_theater(theater_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    t = db.query(OperationTheater).filter(OperationTheater.id == theater_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Theater not found")
    for f in ["name", "ot_type", "status", "is_active"]:
        if f in data:
            setattr(t, f, data[f])
    db.commit()
    return {"message": "Theater updated"}

@app.delete("/api/ot/theaters/{theater_id}")
async def delete_theater(theater_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    t = db.query(OperationTheater).filter(OperationTheater.id == theater_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Theater not found")
    if db.query(Surgery).filter(Surgery.theater_id == theater_id, Surgery.status == "in_progress").count() > 0:
        raise HTTPException(status_code=400, detail="Surgery in progress in this theater")
    t.is_active = False
    db.commit()
    return {"message": "Theater deactivated"}

@app.get("/api/ot/surgeries")
async def list_surgeries(
    status: str = None, search: str = None, date_filter: str = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    q = db.query(Surgery).join(Patient, Surgery.patient_id == Patient.id)
    if status:
        q = q.filter(Surgery.status == status)
    if date_filter:
        try:
            d = datetime.strptime(date_filter, "%Y-%m-%d").date()
            q = q.filter(func.date(Surgery.scheduled_at) == d)
        except ValueError:
            pass
    if search:
        q = q.filter(Patient.first_name.ilike(f"%{search}%") | Patient.last_name.ilike(f"%{search}%") | Surgery.procedure_name.ilike(f"%{search}%"))
    surgeries = q.order_by(Surgery.scheduled_at.desc()).offset(skip).limit(limit).all()
    result = []
    for s in surgeries:
        result.append({
            "id": s.id, "surgery_number": s.surgery_number,
            "patient_id": s.patient_id,
            "patient_name": s.patient.full_name if s.patient else "",
            "surgeon_id": s.surgeon_id,
            "surgeon_name": s.surgeon.name if s.surgeon else "",
            "theater_id": s.theater_id,
            "theater_name": s.theater.name if s.theater else "",
            "procedure_name": s.procedure_name,
            "scheduled_at": s.scheduled_at.isoformat() if s.scheduled_at else None,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "status": s.status, "anesthesiologist": s.anesthesiologist,
            "anesthesia_type": s.anesthesia_type, "notes": s.notes,
            "post_op_notes": s.post_op_notes,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })
    return result

@app.post("/api/ot/surgeries", status_code=201)
async def create_surgery(
    data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    if not data.get("patient_id") or not data.get("procedure_name"):
        raise HTTPException(status_code=400, detail="patient_id and procedure_name are required")
    patient = db.query(Patient).filter(Patient.id == data["patient_id"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    scheduled_at = None
    if data.get("scheduled_at"):
        try:
            scheduled_at = datetime.fromisoformat(data["scheduled_at"])
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid scheduled_at format. Use ISO 8601.")
    surgery = Surgery(
        surgery_number=_next_surgery_number(db),
        patient_id=data["patient_id"],
        surgeon_id=data.get("surgeon_id"),
        theater_id=data.get("theater_id"),
        procedure_name=sanitize(data["procedure_name"]),
        scheduled_at=scheduled_at,
        anesthesiologist=sanitize(data.get("anesthesiologist", "") or ""),
        anesthesia_type=data.get("anesthesia_type", ""),
        notes=sanitize(data.get("notes", "") or ""),
        status=data.get("status", "scheduled"),
        created_by=current_user.id,
    )
    db.add(surgery)
    db.commit()
    db.refresh(surgery)
    return {"id": surgery.id, "surgery_number": surgery.surgery_number, "message": "Surgery scheduled"}

@app.put("/api/ot/surgeries/{surgery_id}")
async def update_surgery(
    surgery_id: int, data: dict,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    s = db.query(Surgery).filter(Surgery.id == surgery_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Surgery not found")
    for f in ["surgeon_id", "theater_id", "procedure_name", "anesthesiologist", "anesthesia_type", "notes", "post_op_notes", "status"]:
        if f in data:
            setattr(s, f, sanitize(str(data[f])) if isinstance(data[f], str) else data[f])
    for dt_field in ["scheduled_at", "started_at", "completed_at"]:
        if data.get(dt_field):
            try:
                setattr(s, dt_field, datetime.fromisoformat(data[dt_field]))
            except ValueError:
                pass
    if data.get("status") == "in_progress" and s.theater_id:
        theater = db.query(OperationTheater).filter(OperationTheater.id == s.theater_id).first()
        if theater:
            theater.status = "occupied"
    elif data.get("status") in ("completed", "cancelled") and s.theater_id:
        theater = db.query(OperationTheater).filter(OperationTheater.id == s.theater_id).first()
        if theater:
            theater.status = "available"
    db.commit()
    return {"message": "Surgery updated"}

@app.delete("/api/ot/surgeries/{surgery_id}")
async def delete_surgery(
    surgery_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin")),
):
    s = db.query(Surgery).filter(Surgery.id == surgery_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Surgery not found")
    if s.status == "in_progress":
        raise HTTPException(status_code=400, detail="Cannot delete surgery in progress")
    db.delete(s)
    db.commit()
    return {"message": "Surgery deleted"}

@app.get("/api/ot/stats")
async def ot_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today()
    return {
        "today_scheduled": db.query(Surgery).filter(func.date(Surgery.scheduled_at) == today).count(),
        "in_progress": db.query(Surgery).filter(Surgery.status == "in_progress").count(),
        "completed_today": db.query(Surgery).filter(func.date(Surgery.scheduled_at) == today, Surgery.status == "completed").count(),
        "available_theaters": db.query(OperationTheater).filter(OperationTheater.is_active == True, OperationTheater.status == "available").count(),
    }


# =============================================
# PHARMACY ENDPOINTS
# =============================================

def _next_dispense_number(db: Session) -> str:
    count = db.query(PharmacyDispense).count()
    return f"PH-{date.today().strftime('%Y%m%d')}-{count + 1:04d}"

@app.get("/api/pharmacy/medications")
async def list_medications(
    search: str = None, category: str = None, low_stock: bool = False,
    skip: int = 0, limit: int = 200,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    q = db.query(Medication).filter(Medication.is_active == True)
    if search:
        q = q.filter(Medication.name.ilike(f"%{search}%") | Medication.generic_name.ilike(f"%{search}%"))
    if category:
        q = q.filter(Medication.category == category)
    if low_stock:
        q = q.filter(Medication.stock_quantity <= Medication.reorder_level)
    meds = q.order_by(Medication.name).offset(skip).limit(limit).all()
    return [{
        "id": m.id, "name": m.name, "generic_name": m.generic_name,
        "category": m.category, "manufacturer": m.manufacturer,
        "unit": m.unit, "price": float(m.price or 0),
        "stock_quantity": m.stock_quantity, "reorder_level": m.reorder_level,
        "expiry_date": str(m.expiry_date) if m.expiry_date else None,
        "low_stock": m.stock_quantity <= m.reorder_level,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    } for m in meds]

@app.post("/api/pharmacy/medications", status_code=201)
async def create_medication(
    data: dict, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin")),
):
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="name is required")
    med = Medication(
        name=sanitize(data["name"]),
        generic_name=sanitize(data.get("generic_name", "") or ""),
        category=data.get("category", "Tablet"),
        manufacturer=sanitize(data.get("manufacturer", "") or ""),
        unit=data.get("unit", "tablet"),
        price=data.get("price", 0),
        stock_quantity=data.get("stock_quantity", 0),
        reorder_level=data.get("reorder_level", 10),
        expiry_date=datetime.strptime(data["expiry_date"], "%Y-%m-%d").date() if data.get("expiry_date") else None,
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    return {"id": med.id, "message": "Medication added"}

@app.put("/api/pharmacy/medications/{med_id}")
async def update_medication(
    med_id: int, data: dict,
    db: Session = Depends(get_db), current_user: User = Depends(require_role("admin")),
):
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    for f in ["name", "generic_name", "category", "manufacturer", "unit", "price", "stock_quantity", "reorder_level", "is_active"]:
        if f in data:
            setattr(med, f, sanitize(str(data[f])) if isinstance(data[f], str) else data[f])
    if data.get("expiry_date"):
        try:
            med.expiry_date = datetime.strptime(data["expiry_date"], "%Y-%m-%d").date()
        except ValueError:
            pass
    med.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Medication updated"}

@app.delete("/api/pharmacy/medications/{med_id}")
async def delete_medication(
    med_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin")),
):
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    med.is_active = False
    db.commit()
    return {"message": "Medication removed"}

@app.put("/api/pharmacy/medications/{med_id}/stock")
async def adjust_stock(
    med_id: int, data: dict,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    adjustment = int(data.get("adjustment", 0))
    med.stock_quantity = max(0, med.stock_quantity + adjustment)
    med.updated_at = datetime.utcnow()
    db.commit()
    return {"message": f"Stock updated", "new_quantity": med.stock_quantity}

@app.get("/api/pharmacy/dispenses")
async def list_dispenses(
    search: str = None, skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    q = db.query(PharmacyDispense)
    if search:
        q = q.join(Patient, PharmacyDispense.patient_id == Patient.id, isouter=True).filter(
            Patient.first_name.ilike(f"%{search}%") | Patient.last_name.ilike(f"%{search}%")
        )
    dispenses = q.order_by(PharmacyDispense.dispensed_at.desc()).offset(skip).limit(limit).all()
    result = []
    for d in dispenses:
        result.append({
            "id": d.id, "dispense_number": d.dispense_number,
            "patient_id": d.patient_id,
            "patient_name": d.patient.full_name if d.patient else "Walk-in",
            "total_amount": float(d.total_amount or 0),
            "discount": float(d.discount or 0),
            "status": d.status, "notes": d.notes,
            "dispensed_at": d.dispensed_at.isoformat() if d.dispensed_at else None,
            "items": [{
                "id": i.id, "medication_id": i.medication_id,
                "medication_name": i.medication.name if i.medication else "",
                "quantity": i.quantity, "unit_price": float(i.unit_price or 0),
                "subtotal": float(i.subtotal or 0),
            } for i in d.items],
        })
    return result

@app.post("/api/pharmacy/dispenses", status_code=201)
async def create_dispense(
    data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    items_data = data.get("items", [])
    if not items_data:
        raise HTTPException(status_code=400, detail="At least one medication item is required")
    dispense = PharmacyDispense(
        dispense_number=_next_dispense_number(db),
        patient_id=data.get("patient_id"),
        prescription_id=data.get("prescription_id"),
        discount=data.get("discount", 0),
        notes=sanitize(data.get("notes", "") or ""),
        dispensed_by=current_user.id,
        status="dispensed",
    )
    total = 0
    db_items = []
    for item in items_data:
        med_id = item.get("medication_id")
        qty = int(item.get("quantity", 1))
        if not med_id or qty <= 0:
            raise HTTPException(status_code=400, detail="Invalid item: medication_id and quantity required")
        med = db.query(Medication).filter(Medication.id == med_id, Medication.is_active == True).first()
        if not med:
            raise HTTPException(status_code=404, detail=f"Medication ID {med_id} not found")
        if med.stock_quantity < qty:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {med.name}. Available: {med.stock_quantity}")
        unit_price = float(item.get("unit_price", float(med.price)))
        subtotal = unit_price * qty
        total += subtotal
        db_items.append((med, qty, unit_price, subtotal))
    dispense.total_amount = max(0, total - float(data.get("discount", 0)))
    db.add(dispense)
    db.flush()
    for med, qty, unit_price, subtotal in db_items:
        db.add(PharmacyDispenseItem(
            dispense_id=dispense.id, medication_id=med.id,
            quantity=qty, unit_price=unit_price, subtotal=subtotal,
        ))
        med.stock_quantity -= qty
        med.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dispense)
    return {"id": dispense.id, "dispense_number": dispense.dispense_number, "total_amount": float(dispense.total_amount), "message": "Dispensed successfully"}

@app.put("/api/pharmacy/dispenses/{dispense_id}")
async def update_dispense(
    dispense_id: int, data: dict,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    """Update dispense notes, discount, or status. Does not change items (delete + recreate for that)."""
    d = db.query(PharmacyDispense).filter(PharmacyDispense.id == dispense_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dispense not found")
    for field in ["notes", "discount", "status", "payment_method"]:
        if field in data:
            setattr(d, field, data[field])
    # Recalculate net if discount changed
    if "discount" in data:
        d.net_amount = float(d.total_amount or 0) - float(data.get("discount", 0))
    db.commit()
    return {"message": "Dispense updated"}


@app.delete("/api/pharmacy/dispenses/{dispense_id}")
async def delete_dispense(
    dispense_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin")),
):
    d = db.query(PharmacyDispense).filter(PharmacyDispense.id == dispense_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dispense not found")
    for item in d.items:
        med = db.query(Medication).filter(Medication.id == item.medication_id).first()
        if med:
            med.stock_quantity += item.quantity
    db.delete(d)
    db.commit()
    return {"message": "Dispense reversed and stock restored"}

@app.get("/api/pharmacy/stats")
async def pharmacy_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today()
    total_meds = db.query(Medication).filter(Medication.is_active == True).count()
    low_stock = db.query(Medication).filter(Medication.is_active == True, Medication.stock_quantity <= Medication.reorder_level).count()
    today_dispenses = db.query(PharmacyDispense).filter(func.date(PharmacyDispense.dispensed_at) == today).count()
    today_revenue = db.query(func.sum(PharmacyDispense.total_amount)).filter(func.date(PharmacyDispense.dispensed_at) == today).scalar() or 0
    return {
        "total_medications": total_meds, "low_stock_count": low_stock,
        "today_dispenses": today_dispenses, "today_revenue": float(today_revenue),
    }


# =============================================
# HR / PAYROLL MODULE
# =============================================

MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June",
               "July", "August", "September", "October", "November", "December"]


def _salary_profile_dict(profile: StaffSalaryProfile, user: User) -> dict:
    gross = (float(profile.basic_salary) + float(profile.house_allowance) +
             float(profile.medical_allowance) + float(profile.transport_allowance) +
             float(profile.other_allowance))
    deductions = float(profile.tax_deduction) + float(profile.other_deduction)
    return {
        "profile_id": profile.id,
        "user_id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "designation": profile.designation or "",
        "department": profile.department or "",
        "join_date": profile.join_date.isoformat() if profile.join_date else None,
        "basic_salary": float(profile.basic_salary),
        "house_allowance": float(profile.house_allowance),
        "medical_allowance": float(profile.medical_allowance),
        "transport_allowance": float(profile.transport_allowance),
        "other_allowance": float(profile.other_allowance),
        "gross_salary": round(gross, 2),
        "tax_deduction": float(profile.tax_deduction),
        "other_deduction": float(profile.other_deduction),
        "total_deductions": round(deductions, 2),
        "net_salary": round(gross - deductions, 2),
        "bank_name": profile.bank_name or "",
        "account_number": profile.account_number or "",
        "cnic": profile.cnic or "",
    }


@app.get("/api/hr/staff")
async def list_hr_staff(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    users = db.query(User).filter(User.is_active == True).order_by(User.full_name).all()
    result = []
    for u in users:
        profile = db.query(StaffSalaryProfile).filter(StaffSalaryProfile.user_id == u.id).first()
        if not profile:
            profile = StaffSalaryProfile(user_id=u.id, basic_salary=0, house_allowance=0,
                medical_allowance=0, transport_allowance=0, other_allowance=0,
                tax_deduction=0, other_deduction=0)
            db.add(profile)
            db.commit()
            db.refresh(profile)
        result.append(_salary_profile_dict(profile, u))
    return result


@app.put("/api/hr/staff/{user_id}/salary")
async def update_salary_profile(
    user_id: int, data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    profile = db.query(StaffSalaryProfile).filter(StaffSalaryProfile.user_id == user_id).first()
    if not profile:
        profile = StaffSalaryProfile(user_id=user_id)
        db.add(profile)
    for f in ["designation", "department", "basic_salary", "house_allowance",
              "medical_allowance", "transport_allowance", "other_allowance",
              "tax_deduction", "other_deduction", "bank_name", "account_number", "cnic"]:
        if f in data:
            val = data[f]
            setattr(profile, f, sanitize(str(val)) if isinstance(val, str) else val)
    if data.get("join_date"):
        try:
            profile.join_date = datetime.strptime(data["join_date"], "%Y-%m-%d").date()
        except ValueError:
            pass
    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    log_action(db, current_user, "UPDATE", "salary_profile", user_id, f"Salary updated for {user.full_name}")
    return {"message": "Salary profile updated", "profile": _salary_profile_dict(profile, user)}


@app.get("/api/hr/advances")
async def list_advances(
    user_id: int = None, status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    q = db.query(SalaryAdvance).order_by(SalaryAdvance.advance_date.desc())
    if user_id:
        q = q.filter(SalaryAdvance.user_id == user_id)
    if status:
        q = q.filter(SalaryAdvance.status == status)
    result = []
    for a in q.all():
        u = db.query(User).filter(User.id == a.user_id).first()
        result.append({
            "id": a.id, "user_id": a.user_id,
            "employee_name": u.full_name if u else "Unknown",
            "amount": float(a.amount), "reason": a.reason or "",
            "advance_date": a.advance_date.isoformat() if a.advance_date else None,
            "deduct_month": a.deduct_month, "deduct_year": a.deduct_year,
            "deduct_month_name": MONTH_NAMES[a.deduct_month] if a.deduct_month else "",
            "status": a.status, "notes": a.notes or "",
            "created_at": a.created_at.strftime("%d-%b-%Y") if a.created_at else "",
        })
    return result


@app.post("/api/hr/advances", status_code=201)
async def create_advance(
    data: dict, db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if not data.get("user_id") or not data.get("amount"):
        raise HTTPException(status_code=400, detail="user_id and amount required")
    user = db.query(User).filter(User.id == data["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    adv = SalaryAdvance(
        user_id=data["user_id"], amount=float(data["amount"]),
        reason=sanitize(data.get("reason", "") or ""),
        advance_date=datetime.strptime(data["advance_date"], "%Y-%m-%d").date() if data.get("advance_date") else date.today(),
        deduct_month=data.get("deduct_month"), deduct_year=data.get("deduct_year"),
        status="approved", approved_by=current_user.id,
        notes=sanitize(data.get("notes", "") or ""),
    )
    db.add(adv)
    db.commit()
    db.refresh(adv)
    log_action(db, current_user, "CREATE", "salary_advance", adv.id, f"Advance Rs.{adv.amount} for {user.full_name}")
    return {"id": adv.id, "message": "Advance recorded"}


@app.put("/api/hr/advances/{advance_id}")
async def update_advance(
    advance_id: int, data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    adv = db.query(SalaryAdvance).filter(SalaryAdvance.id == advance_id).first()
    if not adv:
        raise HTTPException(status_code=404, detail="Advance not found")
    for f in ["amount", "reason", "deduct_month", "deduct_year", "status", "notes"]:
        if f in data:
            setattr(adv, f, data[f])
    db.commit()
    return {"message": "Advance updated"}


@app.delete("/api/hr/advances/{advance_id}")
async def delete_advance(
    advance_id: int, db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    adv = db.query(SalaryAdvance).filter(SalaryAdvance.id == advance_id).first()
    if not adv:
        raise HTTPException(status_code=404, detail="Advance not found")
    if adv.status == "deducted":
        raise HTTPException(status_code=400, detail="Cannot delete an already-deducted advance")
    db.delete(adv)
    db.commit()
    return {"message": "Advance deleted"}


@app.get("/api/hr/payroll")
async def list_payroll(
    month: int = None, year: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    q = db.query(SalaryPayment).order_by(SalaryPayment.year.desc(), SalaryPayment.month.desc())
    if month:
        q = q.filter(SalaryPayment.month == month)
    if year:
        q = q.filter(SalaryPayment.year == year)
    result = []
    for p in q.all():
        u = db.query(User).filter(User.id == p.user_id).first()
        result.append({
            "id": p.id, "user_id": p.user_id,
            "employee_name": u.full_name if u else "Unknown",
            "role": u.role if u else "",
            "month": p.month, "year": p.year,
            "month_label": f"{MONTH_NAMES[p.month]} {p.year}",
            "basic_salary": float(p.basic_salary),
            "house_allowance": float(p.house_allowance),
            "medical_allowance": float(p.medical_allowance),
            "transport_allowance": float(p.transport_allowance),
            "other_allowance": float(p.other_allowance),
            "gross_salary": float(p.gross_salary),
            "advance_deducted": float(p.advance_deducted),
            "tax_deduction": float(p.tax_deduction),
            "other_deduction": float(p.other_deduction),
            "total_deductions": float(p.total_deductions),
            "net_salary": float(p.net_salary),
            "working_days": p.working_days, "present_days": p.present_days,
            "status": p.status, "payment_method": p.payment_method,
            "paid_at": p.paid_at.strftime("%d-%b-%Y %I:%M %p") if p.paid_at else None,
            "notes": p.notes or "",
        })
    return result


@app.post("/api/hr/payroll/generate", status_code=201)
async def generate_payroll(
    data: dict, db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    month = data.get("month")
    year = data.get("year")
    if not month or not year:
        raise HTTPException(status_code=400, detail="month and year required")
    users = db.query(User).filter(User.is_active == True).all()
    created, skipped = [], []
    for u in users:
        existing = db.query(SalaryPayment).filter(
            SalaryPayment.user_id == u.id, SalaryPayment.month == month, SalaryPayment.year == year
        ).first()
        if existing:
            skipped.append(u.full_name)
            continue
        profile = db.query(StaffSalaryProfile).filter(StaffSalaryProfile.user_id == u.id).first()
        if not profile:
            profile = StaffSalaryProfile(user_id=u.id)
        advances = db.query(SalaryAdvance).filter(
            SalaryAdvance.user_id == u.id, SalaryAdvance.deduct_month == month,
            SalaryAdvance.deduct_year == year, SalaryAdvance.status == "approved",
        ).all()
        advance_total = sum(float(a.amount) for a in advances)
        basic = float(profile.basic_salary or 0)
        house = float(profile.house_allowance or 0)
        medical = float(profile.medical_allowance or 0)
        transport = float(profile.transport_allowance or 0)
        other_allow = float(profile.other_allowance or 0)
        gross = basic + house + medical + transport + other_allow
        tax = float(profile.tax_deduction or 0)
        other_ded = float(profile.other_deduction or 0)
        total_ded = advance_total + tax + other_ded
        payment = SalaryPayment(
            user_id=u.id, month=month, year=year,
            basic_salary=basic, house_allowance=house, medical_allowance=medical,
            transport_allowance=transport, other_allowance=other_allow,
            gross_salary=gross, advance_deducted=advance_total,
            tax_deduction=tax, other_deduction=other_ded,
            total_deductions=total_ded, net_salary=gross - total_ded,
            status="pending", payment_method="cash",
        )
        db.add(payment)
        db.flush()
        for a in advances:
            a.status = "deducted"
        created.append(u.full_name)
    db.commit()
    return {"message": f"Payroll generated for {MONTH_NAMES[month]} {year}",
            "created": len(created), "skipped": len(skipped), "employees": created}


@app.put("/api/hr/payroll/{payment_id}")
async def update_payroll_record(
    payment_id: int, data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    p = db.query(SalaryPayment).filter(SalaryPayment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    for f in ["working_days", "present_days", "advance_deducted", "other_deduction",
              "tax_deduction", "payment_method", "notes"]:
        if f in data:
            setattr(p, f, data[f])
    gross = float(p.gross_salary)
    total_ded = float(p.advance_deducted) + float(p.tax_deduction) + float(p.other_deduction)
    p.total_deductions = total_ded
    p.net_salary = gross - total_ded
    db.commit()
    return {"message": "Updated"}


@app.put("/api/hr/payroll/{payment_id}/pay")
async def mark_salary_paid(
    payment_id: int, data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    p = db.query(SalaryPayment).filter(SalaryPayment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    if p.status == "paid":
        raise HTTPException(status_code=400, detail="Already paid")
    p.status = "paid"
    p.payment_method = data.get("payment_method", "cash")
    p.paid_at = datetime.utcnow()
    p.paid_by = current_user.id
    p.notes = sanitize(data.get("notes", p.notes or ""))
    db.commit()
    u = db.query(User).filter(User.id == p.user_id).first()
    log_action(db, current_user, "UPDATE", "salary_payment", p.id,
               f"Paid: {u.full_name if u else ''} — Rs.{p.net_salary} — {MONTH_NAMES[p.month]} {p.year}")
    return {"message": "Salary marked as paid"}


@app.delete("/api/hr/payroll/{payment_id}")
async def delete_payroll_record(
    payment_id: int, db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    p = db.query(SalaryPayment).filter(SalaryPayment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    if p.status == "paid":
        raise HTTPException(status_code=400, detail="Cannot delete a paid record")
    db.delete(p)
    db.commit()
    return {"message": "Deleted"}


@app.get("/api/hr/payroll/{payment_id}/slip")
async def get_salary_slip(
    payment_id: int, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(SalaryPayment).filter(SalaryPayment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    u = db.query(User).filter(User.id == p.user_id).first()
    profile = db.query(StaffSalaryProfile).filter(StaffSalaryProfile.user_id == p.user_id).first()
    lab_settings = {s.key: s.value for s in db.query(LabSettings).all()}
    defs = get_settings()
    return {
        "payment_id": p.id,
        "month_label": f"{MONTH_NAMES[p.month]} {p.year}",
        "month": p.month, "year": p.year,
        "status": p.status, "payment_method": p.payment_method,
        "paid_at": p.paid_at.strftime("%d-%b-%Y") if p.paid_at else None,
        "employee": {
            "full_name": u.full_name if u else "", "username": u.username if u else "",
            "role": u.role if u else "",
            "designation": profile.designation if profile else "",
            "department": profile.department if profile else "",
            "join_date": profile.join_date.strftime("%d-%b-%Y") if profile and profile.join_date else "",
            "cnic": profile.cnic if profile else "",
            "bank_name": profile.bank_name if profile else "",
            "account_number": profile.account_number if profile else "",
        },
        "earnings": {
            "basic_salary": float(p.basic_salary),
            "house_allowance": float(p.house_allowance),
            "medical_allowance": float(p.medical_allowance),
            "transport_allowance": float(p.transport_allowance),
            "other_allowance": float(p.other_allowance),
            "gross_salary": float(p.gross_salary),
        },
        "deductions": {
            "advance_deducted": float(p.advance_deducted),
            "tax_deduction": float(p.tax_deduction),
            "other_deduction": float(p.other_deduction),
            "total_deductions": float(p.total_deductions),
        },
        "working_days": p.working_days, "present_days": p.present_days,
        "net_salary": float(p.net_salary),
        "lab": {
            "name": lab_settings.get("lab_name", defs.LAB_NAME),
            "address": lab_settings.get("lab_address", defs.LAB_ADDRESS),
            "phone": lab_settings.get("lab_phone", defs.LAB_PHONE),
        },
    }


@app.get("/api/hr/summary")
async def hr_summary(
    month: int = None, year: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    now = datetime.utcnow()
    m = month or now.month
    y = year or now.year
    payments = db.query(SalaryPayment).filter(SalaryPayment.month == m, SalaryPayment.year == y).all()
    total_staff = db.query(User).filter(User.is_active == True).count()
    return {
        "month": m, "year": y, "month_label": f"{MONTH_NAMES[m]} {y}",
        "total_staff": total_staff,
        "payroll_generated": len(payments),
        "paid_count": sum(1 for p in payments if p.status == "paid"),
        "pending_count": sum(1 for p in payments if p.status == "pending"),
        "total_gross_payroll": round(sum(float(p.gross_salary) for p in payments), 2),
        "total_net_payroll": round(sum(float(p.net_salary) for p in payments), 2),
        "pending_advances_count": db.query(SalaryAdvance).filter(
            SalaryAdvance.status == "approved",
            SalaryAdvance.deduct_month == m, SalaryAdvance.deduct_year == y,
        ).count(),
    }


# ── Attendance ────────────────────────────────────────────────────────────────

@app.post("/api/attendance/clock-in")
async def clock_in(
    data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as dt_date
    today = dt_date.today()
    # Check if already clocked in today
    existing = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today
    ).first()
    if existing:
        if existing.clock_in and not existing.clock_out:
            raise HTTPException(status_code=400, detail="Already clocked in. Clock out first.")
        if existing.clock_in and existing.clock_out:
            raise HTTPException(status_code=400, detail="Already completed attendance for today.")

    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
    now = datetime.utcnow()

    # Determine status (late if after 9:30 AM PKT = 4:30 UTC)
    pkt_hour = (now.hour + 5) % 24
    pkt_minute = now.minute
    status = 'late' if (pkt_hour > 9 or (pkt_hour == 9 and pkt_minute > 30)) else 'present'

    if existing:
        existing.clock_in = now
        existing.status = status
        existing.ip_address = client_ip
        existing.location_lat = data.get('lat')
        existing.location_lng = data.get('lng')
        record = existing
    else:
        record = Attendance(
            user_id=current_user.id,
            date=today,
            clock_in=now,
            ip_address=client_ip,
            location_lat=data.get('lat'),
            location_lng=data.get('lng'),
            status=status,
            notes=data.get('notes', '')
        )
        db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "status": record.status,
        "clock_in": record.clock_in.isoformat() if record.clock_in else None,
        "message": f"Clocked in at {record.clock_in.strftime('%H:%M')} UTC"
    }


@app.post("/api/attendance/clock-out")
async def clock_out(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as dt_date
    today = dt_date.today()
    record = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today
    ).first()
    if not record or not record.clock_in:
        raise HTTPException(status_code=400, detail="Not clocked in today.")
    if record.clock_out:
        raise HTTPException(status_code=400, detail="Already clocked out today.")

    record.clock_out = datetime.utcnow()
    # Store clock-out location separately in notes if different from clock-in
    if data.get('lat') and data.get('lng'):
        out_note = f"Clock-out location: {data['lat']:.6f},{data['lng']:.6f}"
        record.notes = f"{record.notes}\n{out_note}".strip() if record.notes else out_note
    # Calculate hours
    hours = (record.clock_out - record.clock_in).total_seconds() / 3600
    if hours < 4:
        record.status = 'half_day'
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "status": record.status,
        "clock_out": record.clock_out.isoformat(),
        "hours_worked": round(hours, 2),
        "message": f"Clocked out. Total: {hours:.1f} hrs"
    }


@app.get("/api/attendance/today")
async def get_today_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as dt_date
    today = dt_date.today()
    record = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today
    ).first()
    if not record:
        return {"status": "not_clocked_in", "clock_in": None, "clock_out": None}
    return {
        "id": record.id,
        "status": record.status,
        "clock_in": record.clock_in.isoformat() if record.clock_in else None,
        "clock_out": record.clock_out.isoformat() if record.clock_out else None,
        "location_lat": float(record.location_lat) if record.location_lat else None,
        "location_lng": float(record.location_lng) if record.location_lng else None,
    }


@app.get("/api/attendance/my-history")
async def get_my_attendance(
    month: int = None,
    year: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as dt_date
    today = dt_date.today()
    m = month or today.month
    y = year or today.year
    records = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        extract('month', Attendance.date) == m,
        extract('year', Attendance.date) == y,
    ).order_by(Attendance.date.desc()).all()

    result = []
    for r in records:
        hours = None
        if r.clock_in and r.clock_out:
            hours = round((r.clock_out - r.clock_in).total_seconds() / 3600, 2)
        result.append({
            "id": r.id,
            "date": r.date.isoformat(),
            "clock_in": r.clock_in.isoformat() if r.clock_in else None,
            "clock_out": r.clock_out.isoformat() if r.clock_out else None,
            "hours_worked": hours,
            "status": r.status,
            "location_lat": float(r.location_lat) if r.location_lat else None,
            "location_lng": float(r.location_lng) if r.location_lng else None,
        })
    return result


@app.get("/api/attendance/report")
async def get_attendance_report(
    month: int = None,
    year: int = None,
    user_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: full attendance report for all or one staff member."""
    from datetime import date as dt_date
    require_role("admin")(current_user)
    today = dt_date.today()
    m = month or today.month
    y = year or today.year

    q = db.query(Attendance).filter(
        extract('month', Attendance.date) == m,
        extract('year', Attendance.date) == y,
    )
    if user_id:
        q = q.filter(Attendance.user_id == user_id)
    records = q.order_by(Attendance.date.desc(), Attendance.user_id).all()

    result = []
    for r in records:
        hours = None
        if r.clock_in and r.clock_out:
            hours = round((r.clock_out - r.clock_in).total_seconds() / 3600, 2)
        result.append({
            "id": r.id,
            "user_id": r.user_id,
            "user_name": r.user.full_name if hasattr(r.user, 'full_name') else r.user.username,
            "date": r.date.isoformat(),
            "clock_in": r.clock_in.isoformat() if r.clock_in else None,
            "clock_out": r.clock_out.isoformat() if r.clock_out else None,
            "hours_worked": hours,
            "status": r.status,
            "ip_address": r.ip_address,
        })
    return result


@app.put("/api/attendance/{att_id}")
async def update_attendance(
    att_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin can correct attendance records."""
    require_role("admin")(current_user)
    record = db.query(Attendance).filter(Attendance.id == att_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    for field in ["status", "notes"]:
        if field in data:
            setattr(record, field, data[field])
    db.commit()
    return {"ok": True}


# =============================================
# STARTUP
# =============================================

@app.on_event("startup")
async def startup():
    from backend.database.models import create_tables
    create_tables()
    # Add new columns to existing tables if they don't exist (safe migration)
    try:
        from sqlalchemy import text
        from backend.database.models import get_engine
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text(
                "ALTER TABLE results ADD COLUMN IF NOT EXISTS pathologist_notes TEXT"
            ))
            conn.commit()
    except Exception as e:
        logger.warning("Column migration warning (safe to ignore if already exists): {}", e)
    logger.info("LIS API starting up...")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
