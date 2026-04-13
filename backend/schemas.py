"""Pydantic models for request/response validation."""

from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field


# --- Auth ---
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6)
    full_name: str
    role: str = Field(pattern="^(admin|technician|doctor|receptionist)$")


# --- Patient ---
class PatientCreate(BaseModel):
    mrn: str = Field(max_length=50)
    first_name: str = Field(max_length=100)
    last_name: str = Field(max_length=100)
    dob: Optional[date] = None
    gender: Optional[str] = Field(None, pattern="^[MFO]$")
    phone: Optional[str] = None
    address: Optional[str] = None

class PatientResponse(BaseModel):
    id: int
    mrn: str
    first_name: str
    last_name: str
    full_name: str
    dob: Optional[date]
    gender: Optional[str]
    phone: Optional[str]
    age: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


# --- Doctor ---
class DoctorCreate(BaseModel):
    name: str
    specialization: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class DoctorResponse(BaseModel):
    id: int
    name: str
    specialization: Optional[str]
    phone: Optional[str]

    class Config:
        from_attributes = True


# --- Sample ---
class SampleCreate(BaseModel):
    sample_id: str = Field(max_length=50)
    patient_id: int
    doctor_id: Optional[int] = None
    test_panel: Optional[str] = None
    notes: Optional[str] = None

class SampleResponse(BaseModel):
    id: int
    sample_id: str
    patient_id: int
    doctor_id: Optional[int]
    test_panel: Optional[str]
    status: str
    collected_at: Optional[datetime]
    machine_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# --- Result ---
class ResultCreate(BaseModel):
    sample_id: str  # The barcode sample ID (not DB id)
    test_code: str
    test_name: str
    value: str
    unit: Optional[str] = None
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None
    flag: str = "N"

class ResultResponse(BaseModel):
    id: int
    test_code: str
    test_name: str
    value: Optional[str]
    unit: Optional[str]
    ref_low: Optional[float]
    ref_high: Optional[float]
    flag: str
    status: str
    received_at: datetime
    pathologist_notes: Optional[str] = None

    class Config:
        from_attributes = True

class MachineResultsBatch(BaseModel):
    """Batch of results from a machine (parsed HL7/ASTM message)."""
    sample_id: str
    machine_id: Optional[str] = None
    patient_id: Optional[str] = None  # MRN from HL7
    results: list[ResultCreate]


# --- Report ---
class ReportResponse(BaseModel):
    patient: PatientResponse
    sample: SampleResponse
    doctor: Optional[DoctorResponse]
    results: list[ResultResponse]


# --- Dashboard ---
class DashboardResponse(BaseModel):
    total_patients: int
    today_samples: int
    pending_results: int
    completed_today: int
    critical_alerts: int
    recent_samples: list[SampleResponse]
