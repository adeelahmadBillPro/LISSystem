"""SQLAlchemy ORM models for the Laboratory Information System."""

from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, DateTime, Date, Boolean, Text,
    ForeignKey, Numeric, CheckConstraint, UniqueConstraint, create_engine
)
from sqlalchemy.orm import relationship, declarative_base, sessionmaker
from backend.config import get_settings

Base = declarative_base()


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    mrn = Column(String(50), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    dob = Column(Date, nullable=True)
    gender = Column(String(1), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    samples = relationship("Sample", back_populates="patient")

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def age(self):
        if self.dob:
            today = date.today()
            return today.year - self.dob.year - (
                (today.month, today.day) < (self.dob.month, self.dob.day)
            )
        return None


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    specialization = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    samples = relationship("Sample", back_populates="doctor")
    schedules = relationship("DoctorSchedule", back_populates="doctor", cascade="all, delete-orphan")


class Sample(Base):
    __tablename__ = "samples"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(String(50), unique=True, nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    test_panel = Column(String(100), nullable=True)
    collected_at = Column(DateTime, default=datetime.utcnow)
    received_at = Column(DateTime, nullable=True)
    reported_at = Column(DateTime, nullable=True)
    machine_id = Column(String(50), nullable=True)
    status = Column(String(20), default="pending")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="samples")
    doctor = relationship("Doctor", back_populates="samples")
    results = relationship("Result", back_populates="sample")


class Result(Base):
    __tablename__ = "results"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    test_code = Column(String(20), nullable=False, index=True)
    test_name = Column(String(100), nullable=False)
    value = Column(String(50), nullable=True)
    unit = Column(String(30), nullable=True)
    ref_low = Column(Numeric(10, 3), nullable=True)
    ref_high = Column(Numeric(10, 3), nullable=True)
    flag = Column(String(5), default="N")
    status = Column(String(20), default="pending")
    received_at = Column(DateTime, default=datetime.utcnow)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    pathologist_notes = Column(Text, nullable=True)

    # Relationships
    sample = relationship("Sample", back_populates="results")
    verifier = relationship("User", back_populates="verified_results")


class ReferenceRange(Base):
    __tablename__ = "reference_ranges"

    id = Column(Integer, primary_key=True, index=True)
    test_code = Column(String(20), nullable=False, index=True)
    test_name = Column(String(100), nullable=False)
    gender = Column(String(1), nullable=True)  # M, F, A(ll)
    age_min = Column(Integer, default=0)
    age_max = Column(Integer, default=150)
    ref_low = Column(Numeric(10, 3), nullable=True)
    ref_high = Column(Numeric(10, 3), nullable=True)
    unit = Column(String(30), nullable=True)
    critical_low = Column(Numeric(10, 3), nullable=True)
    critical_high = Column(Numeric(10, 3), nullable=True)

    __table_args__ = (
        UniqueConstraint("test_code", "gender", "age_min", "age_max"),
    )


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=False)
    role = Column(String(20), nullable=False)  # admin, technician, doctor, receptionist
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    signature_path = Column(String(255), nullable=True)  # Path to signature image

    # Relationships
    verified_results = relationship("Result", back_populates="verifier")
    attendance = relationship("Attendance", back_populates="user")


class CreditAccount(Base):
    """Corporate/hospital credit accounts — invoices billed on credit."""
    __tablename__ = "credit_accounts"

    id             = Column(Integer, primary_key=True, index=True)
    account_name   = Column(String(100), nullable=False)
    account_type   = Column(String(20), default="company")   # company / hospital / government / individual
    contact_person = Column(String(100), nullable=True)
    phone          = Column(String(20), nullable=True)
    email          = Column(String(100), nullable=True)
    address        = Column(Text, nullable=True)
    credit_limit   = Column(Numeric(12, 2), default=0)
    notes          = Column(Text, nullable=True)
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime, default=datetime.utcnow)

    invoices = relationship("Invoice", back_populates="credit_account")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    sample_id  = Column(Integer, ForeignKey("samples.id"), nullable=True)  # link to specific sample
    credit_account_id = Column(Integer, ForeignKey("credit_accounts.id"), nullable=True)
    total_amount = Column(Numeric(10, 2), nullable=False)
    discount_percent = Column(Integer, default=0)
    payment_method = Column(String(20), default="cash")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Insurance / TPA fields
    insurance_company  = Column(String(100), nullable=True)
    policy_number      = Column(String(60), nullable=True)
    tpa_name           = Column(String(100), nullable=True)
    claim_status       = Column(String(20), nullable=True)
    claim_amount       = Column(Numeric(10, 2), nullable=True)
    claim_note         = Column(Text, nullable=True)
    claim_submitted_at = Column(DateTime, nullable=True)
    claim_settled_at   = Column(DateTime, nullable=True)

    # Relationships
    patient        = relationship("Patient")
    credit_account = relationship("CreditAccount", back_populates="invoices")
    items          = relationship("InvoiceItem", back_populates="invoice")


class TestCatalog(Base):
    __tablename__ = "test_catalog"

    id = Column(Integer, primary_key=True, index=True)
    test_code = Column(String(20), unique=True, nullable=False, index=True)
    test_name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=True)
    price = Column(Numeric(10, 2), default=0)
    unit = Column(String(30), nullable=True)
    sample_type = Column(String(30), default="Blood")
    ref_low_male = Column(Numeric(10, 3), nullable=True)
    ref_high_male = Column(Numeric(10, 3), nullable=True)
    ref_low_female = Column(Numeric(10, 3), nullable=True)
    ref_high_female = Column(Numeric(10, 3), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TestPackage(Base):
    __tablename__ = "test_packages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)  # Discounted package price
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("TestPackageItem", back_populates="package")


class TestPackageItem(Base):
    __tablename__ = "test_package_items"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("test_packages.id"), nullable=False)
    test_code = Column(String(20), nullable=False)
    test_name = Column(String(100), nullable=False)
    individual_price = Column(Numeric(10, 2), default=0)

    package = relationship("TestPackage", back_populates="items")


class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(10), unique=True, nullable=False)
    address = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Token(Base):
    __tablename__ = "tokens"

    id = Column(Integer, primary_key=True, index=True)
    token_number = Column(Integer, nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    patient_name = Column(String(200), nullable=True)
    phone = Column(String(20), nullable=True)
    status = Column(String(20), default="waiting")  # waiting, in_progress, completed, cancelled
    counter = Column(String(20), nullable=True)  # e.g., "Counter 1", "Blood Draw"
    notes = Column(Text, nullable=True)
    date = Column(Date, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow)
    called_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


class InventoryItem(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=True)  # Reagent, Consumable, Equipment
    sku = Column(String(50), nullable=True)
    quantity = Column(Integer, default=0)
    min_quantity = Column(Integer, default=10)  # Alert when below this
    unit = Column(String(20), default="pcs")  # pcs, ml, box, pack
    price_per_unit = Column(Numeric(10, 2), default=0)
    supplier = Column(String(200), nullable=True)
    expiry_date = Column(Date, nullable=True)
    location = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class InventoryLog(Base):
    __tablename__ = "inventory_logs"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("inventory.id"), nullable=False)
    action = Column(String(20), nullable=False)  # add, use, adjust, expired
    quantity = Column(Integer, nullable=False)
    notes = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ReportTemplate(Base):
    __tablename__ = "report_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    test_panel = Column(String(100), nullable=True)  # e.g., "CBC", "LFT"
    header_text = Column(Text, nullable=True)
    footer_text = Column(Text, nullable=True)
    notes_text = Column(Text, nullable=True)
    show_qr = Column(Boolean, default=True)
    show_signature = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class LabSettings(Base):
    __tablename__ = "lab_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(Text, nullable=True)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(30), nullable=False, index=True)  # 'test_category', 'sample_type', 'test_panel', 'specialization'
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("type", "name"),
    )


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    test_code = Column(String(20), nullable=False)
    test_name = Column(String(100), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="items")


class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Mon … 6=Sun
    start_time = Column(String(5), nullable=False)  # "09:00"
    end_time = Column(String(5), nullable=False)    # "17:00"
    is_available = Column(Boolean, default=True)
    notes = Column(String(200), nullable=True)

    doctor = relationship("Doctor", back_populates="schedules")

    __table_args__ = (UniqueConstraint("doctor_id", "day_of_week"),)


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=True)
    diagnosis = Column(Text, nullable=True)
    chief_complaint = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient")
    doctor = relationship("Doctor")
    items = relationship("PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan")


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    medicine_name = Column(String(200), nullable=False)
    dosage = Column(String(100), nullable=True)       # e.g. "500mg"
    frequency = Column(String(100), nullable=True)    # e.g. "3 times a day"
    duration = Column(String(100), nullable=True)     # e.g. "7 days"
    route = Column(String(50), nullable=True)         # e.g. "Oral", "IV"
    instructions = Column(Text, nullable=True)        # e.g. "After meal"

    prescription = relationship("Prescription", back_populates="items")


# =============================================
# HOSPITAL MODULES
# =============================================

class OPDVisit(Base):
    __tablename__ = "opd_visits"

    id              = Column(Integer, primary_key=True, index=True)
    visit_number    = Column(String(30), unique=True, nullable=False, index=True)
    patient_id      = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id       = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    visit_date      = Column(Date, default=date.today)
    chief_complaint = Column(Text, nullable=True)
    diagnosis       = Column(Text, nullable=True)
    notes           = Column(Text, nullable=True)
    fee             = Column(Numeric(10, 2), default=0)
    status          = Column(String(20), default="waiting")   # waiting / in_progress / completed
    referred_to_lab = Column(Boolean, default=False)
    referred_to_radiology = Column(Boolean, default=False)
    referred_to_pharmacy  = Column(Boolean, default=False)
    created_by      = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient  = relationship("Patient")
    doctor   = relationship("Doctor")
    creator  = relationship("User", foreign_keys=[created_by])


class Ward(Base):
    __tablename__ = "wards"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(100), nullable=False)
    code        = Column(String(20), unique=True, nullable=False)
    ward_type   = Column(String(30), default="general")   # general / icu / maternity / pediatric / surgical / private
    floor       = Column(String(20), nullable=True)
    total_beds  = Column(Integer, default=0)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    beds = relationship("Bed", back_populates="ward", cascade="all, delete-orphan")


class Bed(Base):
    __tablename__ = "beds"

    id          = Column(Integer, primary_key=True, index=True)
    ward_id     = Column(Integer, ForeignKey("wards.id"), nullable=False)
    bed_number  = Column(String(20), nullable=False)
    bed_type    = Column(String(20), default="standard")   # standard / icu / isolation
    status      = Column(String(20), default="available")  # available / occupied / maintenance / reserved
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    ward        = relationship("Ward", back_populates="beds")
    admissions  = relationship("Admission", back_populates="bed")

    __table_args__ = (UniqueConstraint("ward_id", "bed_number"),)


class Admission(Base):
    __tablename__ = "admissions"

    id              = Column(Integer, primary_key=True, index=True)
    admission_number= Column(String(30), unique=True, nullable=False, index=True)
    patient_id      = Column(Integer, ForeignKey("patients.id"), nullable=False)
    bed_id          = Column(Integer, ForeignKey("beds.id"), nullable=True)
    doctor_id       = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    admission_date  = Column(DateTime, default=datetime.utcnow)
    discharge_date  = Column(DateTime, nullable=True)
    admission_type  = Column(String(20), default="planned")   # planned / emergency
    diagnosis       = Column(Text, nullable=True)
    notes           = Column(Text, nullable=True)
    status          = Column(String(20), default="admitted")  # admitted / discharged / transferred
    created_by      = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    patient  = relationship("Patient")
    bed      = relationship("Bed", back_populates="admissions")
    doctor   = relationship("Doctor")
    creator  = relationship("User", foreign_keys=[created_by])


class RadiologyOrder(Base):
    __tablename__ = "radiology_orders"

    id          = Column(Integer, primary_key=True, index=True)
    order_number= Column(String(30), unique=True, nullable=False, index=True)
    patient_id  = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id   = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    modality    = Column(String(30), nullable=False)   # X-Ray / MRI / CT / Ultrasound / Echo / Mammography
    body_part   = Column(String(100), nullable=True)
    clinical_info = Column(Text, nullable=True)
    priority    = Column(String(20), default="routine")  # routine / urgent / emergency
    status      = Column(String(20), default="ordered")  # ordered / in_progress / completed / cancelled
    price       = Column(Numeric(10, 2), default=0)
    ordered_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    ordered_at  = Column(DateTime, default=datetime.utcnow)

    patient     = relationship("Patient")
    doctor      = relationship("Doctor")
    report      = relationship("RadiologyReport", back_populates="order", uselist=False)


class RadiologyReport(Base):
    __tablename__ = "radiology_reports"

    id              = Column(Integer, primary_key=True, index=True)
    order_id        = Column(Integer, ForeignKey("radiology_orders.id"), nullable=False, unique=True)
    radiologist_name= Column(String(200), nullable=True)
    findings        = Column(Text, nullable=True)
    impression      = Column(Text, nullable=True)
    recommendations = Column(Text, nullable=True)
    image_path      = Column(String(500), nullable=True)
    reported_at     = Column(DateTime, default=datetime.utcnow)

    order = relationship("RadiologyOrder", back_populates="report")


class OperationTheater(Base):
    __tablename__ = "operation_theaters"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(50), nullable=False)   # OT-1, OT-2
    ot_type    = Column(String(30), default="general")  # general / cardiac / ortho / neuro
    status     = Column(String(20), default="available")  # available / occupied / maintenance / cleaning
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    surgeries = relationship("Surgery", back_populates="theater")


class Surgery(Base):
    __tablename__ = "surgeries"

    id                 = Column(Integer, primary_key=True, index=True)
    surgery_number     = Column(String(30), unique=True, nullable=False, index=True)
    patient_id         = Column(Integer, ForeignKey("patients.id"), nullable=False)
    surgeon_id         = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    theater_id         = Column(Integer, ForeignKey("operation_theaters.id"), nullable=True)
    procedure_name     = Column(String(200), nullable=False)
    scheduled_at       = Column(DateTime, nullable=True)
    started_at         = Column(DateTime, nullable=True)
    completed_at       = Column(DateTime, nullable=True)
    status             = Column(String(20), default="scheduled")  # scheduled / in_progress / completed / cancelled / postponed
    anesthesiologist   = Column(String(200), nullable=True)
    anesthesia_type    = Column(String(50), nullable=True)   # General / Spinal / Local / Epidural
    notes              = Column(Text, nullable=True)
    post_op_notes      = Column(Text, nullable=True)
    created_by         = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at         = Column(DateTime, default=datetime.utcnow)

    patient  = relationship("Patient")
    surgeon  = relationship("Doctor")
    theater  = relationship("OperationTheater", back_populates="surgeries")
    creator  = relationship("User", foreign_keys=[created_by])


class Medication(Base):
    __tablename__ = "medications"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(200), nullable=False)
    generic_name    = Column(String(200), nullable=True)
    category        = Column(String(50), nullable=True)   # Tablet / Syrup / Injection / Cream / Drops / Inhaler
    manufacturer    = Column(String(200), nullable=True)
    unit            = Column(String(20), default="tablet")  # tablet / ml / vial / strip / bottle
    price           = Column(Numeric(10, 2), default=0)
    stock_quantity  = Column(Integer, default=0)
    reorder_level   = Column(Integer, default=10)
    expiry_date     = Column(Date, nullable=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PharmacyDispense(Base):
    __tablename__ = "pharmacy_dispenses"

    id              = Column(Integer, primary_key=True, index=True)
    dispense_number = Column(String(30), unique=True, nullable=False, index=True)
    patient_id      = Column(Integer, ForeignKey("patients.id"), nullable=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=True)
    total_amount    = Column(Numeric(10, 2), default=0)
    discount        = Column(Numeric(10, 2), default=0)
    status          = Column(String(20), default="dispensed")  # dispensed / partial / returned
    dispensed_by    = Column(Integer, ForeignKey("users.id"), nullable=True)
    dispensed_at    = Column(DateTime, default=datetime.utcnow)
    notes           = Column(Text, nullable=True)

    patient      = relationship("Patient")
    prescription = relationship("Prescription")
    dispenser    = relationship("User", foreign_keys=[dispensed_by])
    items        = relationship("PharmacyDispenseItem", back_populates="dispense", cascade="all, delete-orphan")


class PharmacyDispenseItem(Base):
    __tablename__ = "pharmacy_dispense_items"

    id           = Column(Integer, primary_key=True, index=True)
    dispense_id  = Column(Integer, ForeignKey("pharmacy_dispenses.id"), nullable=False)
    medication_id= Column(Integer, ForeignKey("medications.id"), nullable=False)
    quantity     = Column(Integer, nullable=False, default=1)
    unit_price   = Column(Numeric(10, 2), default=0)
    subtotal     = Column(Numeric(10, 2), default=0)

    dispense    = relationship("PharmacyDispense", back_populates="items")
    medication  = relationship("Medication")


# =============================================
# HR / PAYROLL MODULE
# =============================================

class StaffSalaryProfile(Base):
    """Monthly salary structure per employee."""
    __tablename__ = "staff_salary_profiles"

    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    designation         = Column(String(100), nullable=True)   # e.g. Lab Technician, Receptionist
    department          = Column(String(100), nullable=True)   # e.g. Lab, Admin, Reception
    join_date           = Column(Date, nullable=True)
    basic_salary        = Column(Numeric(10, 2), default=0)
    house_allowance     = Column(Numeric(10, 2), default=0)
    medical_allowance   = Column(Numeric(10, 2), default=0)
    transport_allowance = Column(Numeric(10, 2), default=0)
    other_allowance     = Column(Numeric(10, 2), default=0)
    tax_deduction       = Column(Numeric(10, 2), default=0)
    other_deduction     = Column(Numeric(10, 2), default=0)
    bank_name           = Column(String(100), nullable=True)
    account_number      = Column(String(50), nullable=True)
    cnic                = Column(String(20), nullable=True)
    is_active           = Column(Boolean, default=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class SalaryAdvance(Base):
    """Advance salary requests — deducted from specified month's payroll."""
    __tablename__ = "salary_advances"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount       = Column(Numeric(10, 2), nullable=False)
    reason       = Column(Text, nullable=True)
    advance_date = Column(Date, default=date.today)
    deduct_month = Column(Integer, nullable=True)   # 1-12
    deduct_year  = Column(Integer, nullable=True)
    status       = Column(String(20), default="approved")  # approved / deducted / cancelled
    approved_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes        = Column(Text, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)

    user     = relationship("User", foreign_keys=[user_id])
    approver = relationship("User", foreign_keys=[approved_by])


class SalaryPayment(Base):
    """Monthly payroll record — one row per employee per month."""
    __tablename__ = "salary_payments"

    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(Integer, ForeignKey("users.id"), nullable=False)
    month               = Column(Integer, nullable=False)   # 1-12
    year                = Column(Integer, nullable=False)
    # Earnings snapshot at payment time
    basic_salary        = Column(Numeric(10, 2), default=0)
    house_allowance     = Column(Numeric(10, 2), default=0)
    medical_allowance   = Column(Numeric(10, 2), default=0)
    transport_allowance = Column(Numeric(10, 2), default=0)
    other_allowance     = Column(Numeric(10, 2), default=0)
    gross_salary        = Column(Numeric(10, 2), default=0)
    # Deductions
    advance_deducted    = Column(Numeric(10, 2), default=0)
    tax_deduction       = Column(Numeric(10, 2), default=0)
    other_deduction     = Column(Numeric(10, 2), default=0)
    total_deductions    = Column(Numeric(10, 2), default=0)
    net_salary          = Column(Numeric(10, 2), default=0)
    # Payment info
    working_days        = Column(Integer, default=26)
    present_days        = Column(Integer, default=26)
    status              = Column(String(20), default="pending")  # pending / paid
    payment_method      = Column(String(20), default="cash")     # cash / bank / cheque
    paid_at             = Column(DateTime, nullable=True)
    paid_by             = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes               = Column(Text, nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)

    user    = relationship("User", foreign_keys=[user_id])
    payer   = relationship("User", foreign_keys=[paid_by])

    __table_args__ = (UniqueConstraint("user_id", "month", "year"),)


# =============================================
# SHIFT MANAGEMENT
# =============================================

class Shift(Base):
    __tablename__ = "shifts"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    shift_date  = Column(Date, nullable=False)
    shift_type  = Column(String(20), default="morning")   # morning / evening / night / custom
    start_time  = Column(String(10), nullable=True)        # "08:00"
    end_time    = Column(String(10), nullable=True)        # "14:00"
    status      = Column(String(20), default="scheduled") # scheduled / active / completed / absent / leave
    notes       = Column(Text, nullable=True)
    created_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    user    = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by])


# =============================================
# APPOINTMENTS
# =============================================

class Appointment(Base):
    __tablename__ = "appointments"

    id              = Column(Integer, primary_key=True, index=True)
    patient_id      = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id       = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    appt_date       = Column(Date, nullable=False)
    appt_time       = Column(String(10), nullable=True)   # e.g. "09:30"
    appt_type       = Column(String(30), default="consultation")  # consultation / follow_up / lab / radiology / other
    reason          = Column(Text, nullable=True)
    notes           = Column(Text, nullable=True)
    status          = Column(String(20), default="scheduled")  # scheduled / confirmed / completed / cancelled / no_show
    created_by      = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient  = relationship("Patient")
    doctor   = relationship("Doctor")
    creator  = relationship("User", foreign_keys=[created_by])


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    clock_in = Column(DateTime, nullable=True)
    clock_out = Column(DateTime, nullable=True)
    location_lat = Column(Numeric(10, 7), nullable=True)
    location_lng = Column(Numeric(10, 7), nullable=True)
    ip_address = Column(String(45), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), default='present')  # present, late, half_day, absent
    created_at = Column(DateTime, default=datetime.utcnow)

    # Unique: one record per user per day
    __table_args__ = (UniqueConstraint('user_id', 'date', name='uq_attendance_user_date'),)

    user = relationship("User", back_populates="attendance")


# Database session setup
def get_engine():
    settings = get_settings()
    return create_engine(settings.DATABASE_URL, pool_pre_ping=True)


def get_session_factory():
    engine = get_engine()
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_tables():
    """Create all tables in the database."""
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
