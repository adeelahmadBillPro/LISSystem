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
from sqlalchemy import func
from loguru import logger

from fastapi import Request
from backend.config import get_settings
from backend.database.connection import get_db
from backend.database.models import (
    Patient, Doctor, Sample, Result, User, ReferenceRange, Invoice, InvoiceItem,
    TestCatalog, Category, TestPackage, TestPackageItem, Branch, LabSettings,
    Token, InventoryItem, InventoryLog, ReportTemplate,
)
from backend.sms_service import send_report_ready_sms
from backend.audit_service import AuditLog, log_action
from backend.whatsapp_service import generate_whatsapp_link, send_whatsapp_report
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

    return {
        "patient": PatientResponse.model_validate(patient),
        "sample": SampleResponse.model_validate(sample),
        "doctor": DoctorResponse.model_validate(doctor) if doctor else None,
        "results": [ResultResponse.model_validate(r) for r in results],
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

    output_path = f"./reports/{sample_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
    generate_report(patient_dict, sample_dict, results_list, output_path)

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
    return {"message": f"Sample {sample_id} verified by {current_user.full_name}"}


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
    invoice = Invoice(
        patient_id=data["patient_id"],
        total_amount=data["total_amount"],
        discount_percent=data.get("discount_percent", 0),
        payment_method=data.get("payment_method", "cash"),
        notes=data.get("notes", ""),
        created_by=current_user.id,
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
            "patient_name": f"{pat.first_name} {pat.last_name}",
            "total_amount": float(inv.total_amount),
            "discount_percent": inv.discount_percent,
            "payment_method": inv.payment_method,
            "test_count": len(inv.items),
            "created_at": inv.created_at,
        }
        for inv, pat in invoices
    ]


# =============================================
# MIS REPORTS
# =============================================

@app.get("/api/reports/mis")
async def get_mis_reports(
    range: str = "today",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today_start = datetime.combine(date.today(), datetime.min.time())

    if range == "week":
        start_date = today_start - timedelta(days=7)
    elif range == "month":
        start_date = today_start - timedelta(days=30)
    else:
        start_date = today_start

    total_samples = db.query(func.count(Sample.id)).filter(Sample.created_at >= start_date).scalar() or 0
    patients_served = db.query(func.count(func.distinct(Sample.patient_id))).filter(
        Sample.created_at >= start_date
    ).scalar() or 0
    tests_performed = db.query(func.count(Result.id)).filter(Result.received_at >= start_date).scalar() or 0

    # Revenue
    total_revenue = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.created_at >= start_date
    ).scalar() or 0

    # Test breakdown
    test_breakdown = (
        db.query(Sample.test_panel, func.count(Sample.id).label("count"))
        .filter(Sample.created_at >= start_date, Sample.test_panel.isnot(None))
        .group_by(Sample.test_panel)
        .all()
    )

    # Payment breakdown
    payment_breakdown = (
        db.query(Invoice.payment_method, func.sum(Invoice.total_amount).label("total"))
        .filter(Invoice.created_at >= start_date)
        .group_by(Invoice.payment_method)
        .all()
    )

    # Status breakdown
    status_counts = (
        db.query(Sample.status, func.count(Sample.id))
        .filter(Sample.created_at >= start_date)
        .group_by(Sample.status)
        .all()
    )
    status_breakdown = {s: c for s, c in status_counts}

    return {
        "total_samples": total_samples,
        "total_revenue": float(total_revenue),
        "patients_served": patients_served,
        "tests_performed": tests_performed,
        "test_breakdown": [{"test_panel": t, "count": c} for t, c in test_breakdown],
        "payment_breakdown": [{"method": m, "total": float(t)} for m, t in payment_breakdown],
        "status_breakdown": status_breakdown,
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
    }
    # Override with DB values if they exist
    for setting in db.query(LabSettings).all():
        if setting.key in result:
            result[setting.key] = setting.value
    return result


@app.put("/api/settings")
async def update_settings_api(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    allowed_keys = ["lab_name", "lab_phone", "lab_address", "lab_email"]
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


# =============================================
# CATEGORIES (dynamic dropdowns)
# =============================================

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

    # Try Twilio first, fallback to wa.me link
    report_url = data.get("report_url", f"http://localhost:8000/api/samples/{sample_id}/report/pdf")

    result = send_whatsapp_report(
        phone=phone,
        patient_name=patient.full_name,
        sample_id=sample_id,
        report_url=report_url,
    )

    # Always generate wa.me link as fallback
    message = (
        f"Assalam o Alaikum {patient.full_name},\n\n"
        f"Your lab report (Sample: {sample_id}) is ready.\n"
        f"Please visit the lab to collect your report.\n\n"
        f"Thank you."
    )
    whatsapp_link = generate_whatsapp_link(phone, message)

    log_action(db, current_user, "WHATSAPP", "sample", sample_id, f"Sent to {phone}")

    return {
        "success": result.get("success", False),
        "whatsapp_link": whatsapp_link,
        "message": "WhatsApp link generated" if not result.get("success") else "Message sent via Twilio",
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
        headers={"Content-Disposition": "attachment; filename=patients_export.csv"},
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
        headers={"Content-Disposition": "attachment; filename=results_export.csv"},
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
        headers={"Content-Disposition": "attachment; filename=invoices_export.csv"},
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
# STARTUP
# =============================================

@app.on_event("startup")
async def startup():
    from backend.database.models import create_tables
    create_tables()
    logger.info("LIS API starting up...")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
