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


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    discount_percent = Column(Integer, default=0)
    payment_method = Column(String(20), default="cash")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    patient = relationship("Patient")
    items = relationship("InvoiceItem", back_populates="invoice")


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
