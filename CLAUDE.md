# CLAUDE.md — LISSystem Project Guide
> Drop this file in your LISSystem/ root folder. Claude Code reads it automatically every session.

---

## 🏗️ PROJECT OVERVIEW

**LISSystem** is a full-stack Laboratory Information System (LIS) for hospitals and diagnostic labs.

- **Backend:** FastAPI (Python) + SQLAlchemy + PostgreSQL
- **Frontend:** React 18 + Vite + Tailwind CSS + Axios
- **Auth:** JWT Bearer tokens (python-jose), bcrypt, role-based access
- **Integrations:** HL7 v2.x / ASTM parser, serial port (pyserial), WhatsApp, SMS, barcode/QR (reportlab), email reports

---

## 📁 PROJECT STRUCTURE

```
LISSystem/
├── backend/
│   ├── main.py                  # All API routes (2296 lines — needs splitting into routers)
│   ├── database/
│   │   ├── models.py            # SQLAlchemy ORM models
│   │   └── connection.py        # DB session / get_db dependency
│   ├── auth.py                  # JWT + password helpers
│   ├── config.py                # Settings (pydantic-settings, reads .env)
│   ├── schemas.py               # Pydantic request/response schemas
│   ├── report_generator.py      # PDF report generation (reportlab)
│   ├── hl7_parser.py            # HL7 v2.x message parser
│   ├── machine_adapter.py       # ASTM/HL7 machine adapter
│   ├── serial_listener.py       # Serial port listener
│   ├── barcode_service.py       # Barcode/QR PDF generation
│   ├── sms_service.py           # SMS notifications
│   ├── whatsapp_service.py      # WhatsApp link + report share
│   ├── audit_service.py         # Audit log helpers
│   └── tests/
│       └── test_hl7_parser.py   # Only existing test file
├── frontend/
│   └── src/
│       ├── App.jsx              # Router + ThemeContext (darkMode)
│       ├── api.js               # Axios instance with JWT interceptor, baseURL='/api'
│       ├── components/
│       │   ├── Layout.jsx       # Sidebar + nav wrapper
│       │   ├── ModalPortal.jsx  # Portal for modals
│       │   └── PasswordInput.jsx
│       └── pages/               # 58 React page components
├── requirements.txt
├── docker-compose.yml
└── CLAUDE.md                    # ← This file
```

---

## ⚙️ KEY COMMANDS

```bash
# Backend
uvicorn backend.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev        # Runs on http://localhost:5173

# Tests
pytest backend/tests/ -v

# Database migrations (after setting up Alembic)
alembic upgrade head
```

---

## 📐 CODING CONVENTIONS — FOLLOW THESE EXACTLY

### Backend Rules
- All routes are prefixed `/api/...` (e.g. `/api/patients`, `/api/appointments`)
- All routes use auth dependency: `current_user: User = Depends(get_current_user)`
- Admin-only routes use: `current_user: User = Depends(require_role("admin"))`
- Always use `db: Session = Depends(get_db)` for database access
- Sanitize all string inputs using the `sanitize()` function already in main.py
- Import models from: `from backend.database.models import ...`
- Import auth from: `from backend.auth import get_current_user, require_role`
- Log actions using: `log_action(db, user_id, action, details)` from audit_service
- Return `HTTPException(status_code=404, detail="Not found")` for missing records
- User roles are: `admin`, `technician`, `doctor`, `receptionist`

### Frontend Rules
- Import axios instance: `import api from '../api'` (always use this, never raw fetch)
- Import theme: `import { ThemeContext } from '../App'` then `const { darkMode } = useContext(ThemeContext)`
- All API calls go inside `useEffect` or async event handlers
- Always wrap API calls in try/catch and show user-facing error messages
- Use Tailwind CSS only — no custom CSS files
- Dark mode classes pattern: `darkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'`
- Never use `catch {}` empty blocks — always handle errors visibly to the user

### Database Model Pattern
```python
class MyModel(Base):
    __tablename__ = "my_table"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # relationships use back_populates
```

---

## ✅ WHAT IS ALREADY COMPLETE (DO NOT REBUILD)

These features are fully working — do not recreate them:

- Patient registration, search, CRUD (MRN auto-generation)
- Doctor CRUD
- Sample registration, collection tracking, status management
- Result entry — machine (HL7/ASTM) and manual
- Reference range management (age/gender specific)
- PDF report generation with QR code and digital signature
- WhatsApp share + SMS notification on report ready
- Test catalog management (TestCatalog, TestPackage, Categories)
- Billing / Invoice creation with line items and discount
- Inventory management with stock adjustment and alerts
- User management with role-based access
- Audit log (every action tracked)
- Token / Queue system for patient flow
- Branch management (multi-location)
- Report templates (custom header/footer per test panel)
- Data import CSV (patients, doctors) and export
- Barcode label and batch PDF generation
- Patient portal (view reports via MRN + phone)
- MIS reports, daily closing report
- Machine integration (HL7, ASTM, serial port)
- Docker setup (dev environment)

---

## ❌ MISSING — TASKS TO COMPLETE

Work through these tasks IN ORDER. Each task has a priority and exact instructions.

---

### 🔴 TASK 1 — Fix Security: Move Secrets to .env [CRITICAL — DO FIRST]

**Problem:** `SECRET_KEY = "change-this-in-production"` and DB password are hardcoded in `backend/config.py`. Anyone with the repo can forge JWT tokens.

**Instructions:**
1. Create a `.env` file in the project root (never commit this file)
2. Add `.env` to `.gitignore`
3. Create `.env.example` with placeholder values
4. Update `config.py` so all secrets come from environment variables only — no hardcoded fallback values for SECRET_KEY or DATABASE_URL

**`.env` should contain:**
```
SECRET_KEY=generate-with-openssl-rand-hex-32
DATABASE_URL=postgresql+psycopg://postgres:yourpassword@localhost:5432/lis_db
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

**Also fix CORS in `main.py`:** Read `ALLOWED_ORIGINS` from settings instead of hardcoded localhost list.

---

### 🔴 TASK 2 — Add 16 Missing Database Models [CRITICAL]

**Problem:** The following frontend modules have NO database tables. Add all these models to `backend/database/models.py` following the existing pattern.

**Add these models:**

```
1.  Appointment       - patient_id, doctor_id, appointment_date (DateTime), type (opd/lab/ipd), status (scheduled/arrived/completed/cancelled), notes
2.  Ward              - name, type (general/private/icu/emergency), total_beds, is_active
3.  Bed               - ward_id (FK), bed_number, is_occupied, patient_id (FK nullable)
4.  Admission         - patient_id (FK), ward_id (FK), bed_id (FK), doctor_id (FK), admitted_at (DateTime), discharged_at (DateTime nullable), diagnosis, discharge_summary, status (admitted/discharged/transferred)
5.  OPDVisit          - patient_id (FK), doctor_id (FK), visit_date (DateTime), complaint (Text), diagnosis (Text), fee (Numeric), status (waiting/in_progress/completed), referred_to_lab (Boolean), admit_to_ipd (Boolean), notes (Text)
6.  OTTheater         - name, status (available/in_use/cleaning)
7.  Surgery           - patient_id (FK), theater_id (FK), surgeon_name, procedure_name, scheduled_at (DateTime), started_at (DateTime nullable), ended_at (DateTime nullable), status (scheduled/in_progress/completed/cancelled), pre_op_notes (Text), post_op_notes (Text), anesthesiologist
8.  Staff             - full_name, role, department, phone, email, salary (Numeric), joining_date (Date), is_active (Boolean), address (Text)
9.  Attendance        - staff_id (FK), date (Date), clock_in (DateTime), clock_out (DateTime nullable), hours_worked (Numeric nullable), notes
10. Shift             - staff_id (FK), shift_date (Date), shift_type (morning/evening/night), start_time (String), end_time (String), notes
11. Medication        - name, generic_name, category, stock (Integer), reorder_level (Integer), price_per_unit (Numeric), unit (tablet/ml/vial/etc), manufacturer, expiry_date (Date nullable), is_active
12. Prescription      - patient_id (FK), doctor_id (FK), visit_id (FK nullable), prescribed_at (DateTime), is_dispensed (Boolean default False), notes
13. PrescriptionItem  - prescription_id (FK), medication_id (FK), medication_name, dosage, frequency, duration, notes
14. DispenseRecord    - patient_id (FK), prescription_id (FK nullable), dispensed_by (FK users), dispensed_at (DateTime), total_amount (Numeric)
15. DispenseItem      - dispense_id (FK), medication_id (FK), medication_name, quantity, unit_price, total_price
16. CreditAccount     - name, credit_limit (Numeric), current_balance (Numeric default 0), contact_person, phone, email, address, notes, is_active
17. CreditTransaction  - account_id (FK), amount (Numeric), transaction_type (charge/payment), notes, invoice_id (FK nullable), created_by (FK users), created_at
18. InsuranceClaim    - patient_id (FK), invoice_id (FK), insurance_provider, policy_number, claim_amount (Numeric), approved_amount (Numeric nullable), status (submitted/approved/rejected/paid), submitted_at (DateTime), notes
19. RadiologyOrder    - patient_id (FK), doctor_id (FK), test_type (XRay/CT/MRI/Ultrasound/Other), ordered_at (DateTime), status (pending/in_progress/reported), report_notes (Text), reported_at (DateTime nullable), reported_by (FK users nullable)
```

After adding models, also update `create_tables()` at the bottom of models.py so all new tables are created.

---

### 🔴 TASK 3 — Implement Appointments API [HIGH]

**Missing endpoints:** `/api/appointments`

**Frontend file:** `frontend/src/pages/Appointments.jsx` (9 API calls)

**Implement these routes in `backend/main.py`:**
```
GET  /api/appointments              — list all, filter by ?date=&doctor_id=&status=
POST /api/appointments              — create: {patient_id, doctor_id, appointment_date, type, notes}
PUT  /api/appointments/{id}         — update: status, notes, appointment_date
DELETE /api/appointments/{id}       — cancel appointment
GET  /api/appointments/today        — today's appointments count by status (for dashboard)
```

---

### 🔴 TASK 4 — Implement Wards & Beds API [HIGH]

**Missing endpoints:** `/api/wards`

**Frontend file:** `frontend/src/pages/Wards.jsx` (10 API calls)

**Implement:**
```
GET  /api/wards                     — list all wards with bed counts (total, occupied, available)
POST /api/wards                     — create ward: {name, type, total_beds}
PUT  /api/wards/{id}                — update ward details
DELETE /api/wards/{id}              — deactivate ward
GET  /api/wards/{id}/beds           — list beds in a ward with occupancy status
```
When creating a ward, auto-generate Bed records (1 per bed up to total_beds).

---

### 🔴 TASK 5 — Implement IPD Admissions API [HIGH]

**Missing endpoints:** `/api/admissions`, `/api/admissions/stats`

**Frontend file:** `frontend/src/pages/IPD.jsx` (16 API calls)

**Implement:**
```
GET  /api/admissions                — list admissions, filter by ?status=admitted/discharged
POST /api/admissions                — admit patient: {patient_id, ward_id, bed_id, doctor_id, diagnosis, notes}
PUT  /api/admissions/{id}           — update: add treatment note, transfer ward/bed, discharge with summary
GET  /api/admissions/stats          — {total_admitted, available_beds, today_admissions, today_discharges}
```
On admission: mark Bed.is_occupied=True, Bed.patient_id=patient_id
On discharge: mark Bed.is_occupied=False, Bed.patient_id=None, set discharged_at

---

### 🔴 TASK 6 — Implement OPD Visits API [HIGH]

**Missing endpoints:** `/api/opd/visits`, `/api/opd/stats`

**Frontend file:** `frontend/src/pages/OPD.jsx` (10 API calls)

**Implement:**
```
GET  /api/opd/visits                — list visits, filter by ?date=&doctor_id=&status=
POST /api/opd/visits                — create: {patient_id, doctor_id, complaint, diagnosis, fee, referred_to_lab, notes}
PUT  /api/opd/visits/{id}           — update status (waiting/in_progress/completed), add notes
GET  /api/opd/stats                 — {today_total, waiting, in_progress, completed}
```

---

### 🔴 TASK 7 — Implement OT (Operation Theater) API [HIGH]

**Missing endpoints:** `/api/ot/surgeries`, `/api/ot/theaters`, `/api/ot/stats`

**Frontend file:** `frontend/src/pages/OT.jsx` (14 API calls)

**Implement:**
```
GET  /api/ot/theaters               — list theaters with status
POST /api/ot/theaters               — create: {name, status}
PUT  /api/ot/theaters/{id}          — update status (available/in_use/cleaning)
GET  /api/ot/surgeries              — list, filter by ?date=&status=
POST /api/ot/surgeries              — schedule: {patient_id, theater_id, surgeon_name, procedure_name, scheduled_at, pre_op_notes, anesthesiologist}
PUT  /api/ot/surgeries/{id}         — update status, add post_op_notes, set started_at/ended_at
GET  /api/ot/stats                  — {today_scheduled, in_progress, completed, theaters_available}
```

---

### 🔴 TASK 8 — Implement Pharmacy API [HIGH]

**Missing endpoints:** `/api/pharmacy/medications`, `/api/pharmacy/dispenses`, `/api/pharmacy/stats`

**Frontend file:** `frontend/src/pages/PharmacyStore.jsx` (14 API calls)

**Implement:**
```
GET  /api/pharmacy/medications              — list all, filter by ?category=&low_stock=true
POST /api/pharmacy/medications              — add: {name, generic_name, category, stock, reorder_level, price_per_unit, unit, manufacturer, expiry_date}
PUT  /api/pharmacy/medications/{id}         — update details
POST /api/pharmacy/medications/{id}/stock   — adjust: {action: add/remove/set, quantity, reason}
GET  /api/pharmacy/dispenses                — list dispense records with items
POST /api/pharmacy/dispenses                — dispense: {patient_id, prescription_id, items: [{medication_id, quantity}]}
GET  /api/pharmacy/stats                    — {total_medications, low_stock_count, today_dispenses, today_revenue}
```

---

### 🔴 TASK 9 — Implement Prescriptions API [HIGH]

**Missing endpoints:** `/api/prescriptions`

**Frontend file:** `frontend/src/pages/Prescriptions.jsx` (9 API calls)

**Implement:**
```
GET  /api/prescriptions             — list, filter by ?patient_id=&doctor_id=&is_dispensed=
POST /api/prescriptions             — create: {patient_id, doctor_id, visit_id, items: [{medication_id, medication_name, dosage, frequency, duration, notes}], notes}
GET  /api/prescriptions/{id}        — get single with all items
PUT  /api/prescriptions/{id}/dispense — mark as dispensed
```

---

### 🔴 TASK 10 — Implement HR Module API [HIGH]

**Missing endpoints:** `/api/hr/staff`, `/api/hr/payroll`, `/api/hr/advances`, `/api/hr/summary`, `/api/hr/payroll/generate`

**Frontend file:** `frontend/src/pages/HR.jsx` (13 API calls)

**Implement:**
```
GET  /api/hr/staff                  — list all staff
POST /api/hr/staff                  — add: {full_name, role, department, phone, email, salary, joining_date}
PUT  /api/hr/staff/{id}             — update staff details
GET  /api/hr/advances               — list salary advances
POST /api/hr/advances               — create: {staff_id, amount, reason, deduction_per_month}
PUT  /api/hr/advances/{id}/pay      — record installment payment
GET  /api/hr/payroll                — list payroll records, filter by ?month=&year=
POST /api/hr/payroll/generate       — generate monthly payroll: {month, year} → calculate salary - pending advance deductions for all staff
GET  /api/hr/summary                — {total_staff, total_monthly_payroll, pending_advances_total}
```

---

### 🔴 TASK 11 — Implement Attendance API [HIGH]

**Missing endpoints:** `/api/attendance/*`

**Frontend file:** `frontend/src/pages/Attendance.jsx` (6 API calls)

**Implement:**
```
GET  /api/attendance/today          — all staff with their today clock-in/out status
POST /api/attendance/clock-in       — clock in for current_user: records datetime, date
POST /api/attendance/clock-out      — clock out for current_user: records datetime, calculates hours_worked
GET  /api/attendance/my-history     — current user's attendance log (last 30 days)
GET  /api/attendance/report         — all staff attendance, filter by ?staff_id=&from_date=&to_date=
```

---

### 🔴 TASK 12 — Implement Shift Management API [HIGH]

**Missing endpoints:** `/api/shifts`, `/api/shifts/summary`

**Frontend file:** `frontend/src/pages/ShiftManagement.jsx` (11 API calls)

**Implement:**
```
GET  /api/shifts                    — list shifts, filter by ?staff_id=&date=&shift_type=
POST /api/shifts                    — assign: {staff_id, shift_date, shift_type, start_time, end_time, notes}
PUT  /api/shifts/{id}               — update shift
DELETE /api/shifts/{id}             — remove shift
GET  /api/shifts/summary            — staff-wise hours summary for ?from_date=&to_date=
```

---

### 🔴 TASK 13 — Implement Radiology API [HIGH]

**Missing endpoints:** `/api/radiology/orders`, `/api/radiology/stats`

**Frontend file:** `frontend/src/pages/Radiology.jsx` (10 API calls)

**Implement:**
```
GET  /api/radiology/orders          — list, filter by ?status=&date=&test_type=
POST /api/radiology/orders          — create: {patient_id, doctor_id, test_type, notes}
PUT  /api/radiology/orders/{id}     — update status, add report_notes, set reported_at
GET  /api/radiology/stats           — {today_orders, pending, in_progress, reported, by_type_counts}
```

---

### 🔴 TASK 14 — Implement Referral Commission API [HIGH]

**Missing endpoint:** `/api/referral/commission`

**Frontend file:** `frontend/src/pages/ReferralCommission.jsx`

**Implement:**
```
GET  /api/referral/commission       — query params: ?from_date=&to_date=
```
Join Sample → Invoice → Doctor tables. Group by doctor. Return:
```json
[{
  "doctor_id": 1,
  "doctor_name": "Dr. Ahmed",
  "sample_count": 45,
  "total_billed": 125000.00,
  "samples": [{"sample_id": "...", "patient_name": "...", "amount": 2500.00, "date": "..."}]
}]
```

---

### 🔴 TASK 15 — Implement Credit Accounts API [HIGH]

**Missing endpoint:** `/api/credit-accounts`

**Frontend file:** `frontend/src/pages/CreditAccounts.jsx` (9 API calls)

**Implement:**
```
GET  /api/credit-accounts           — list all with current_balance
POST /api/credit-accounts           — create: {name, credit_limit, contact_person, phone, email, address, notes}
PUT  /api/credit-accounts/{id}      — update details
GET  /api/credit-accounts/{id}/ledger — transaction history
POST /api/credit-accounts/{id}/charge — add charge: {amount, invoice_id, notes} → increases balance
POST /api/credit-accounts/{id}/payment — record payment: {amount, notes} → reduces balance
```

---

### 🔴 TASK 16 — Implement Insurance Claims API [HIGH]

**Missing endpoint:** `/api/insurance/claims`

**Frontend file:** `frontend/src/pages/InsuranceClaims.jsx` (5 API calls)

**Implement:**
```
GET  /api/insurance/claims          — list, filter by ?status=&from_date=&to_date=
POST /api/insurance/claims          — create: {patient_id, invoice_id, insurance_provider, policy_number, claim_amount, notes}
PUT  /api/insurance/claims/{id}     — update status (submitted/approved/rejected/paid), approved_amount, notes
GET  /api/insurance/claims/stats    — {total_claims, approved, pending, rejected, total_amount_claimed, total_amount_approved}
```

---

### 🔴 TASK 17 — Implement Doctor Dashboard & Schedule API [HIGH]

**Missing endpoints:** `/api/doctor/dashboard`, `/api/schedule/today`

**Frontend files:** `frontend/src/pages/DoctorDashboard.jsx`, `frontend/src/pages/DoctorSchedule.jsx`

**Implement:**
```
GET  /api/doctor/dashboard          — for logged-in doctor: {today_opd_count, pending_prescriptions, recent_patients (last 10 samples referred by this doctor)}
GET  /api/schedule/today            — today's appointments for current logged-in doctor user
```
Note: You'll need to link User.id to Doctor.id — add `user_id` FK column to Doctor model, or match by name.

---

### 🟠 TASK 18 — Fix User Model: Add Email + Real Forgot Password [MEDIUM]

**Problem:** User model has no email field. The forgot-password flow exists in frontend but backend just returns a stub.

**Instructions:**
1. Add `email = Column(String(200), unique=True, nullable=True)` to User model
2. Update register/signup endpoints to accept and save email
3. Update `/api/auth/forgot-password`: look up user by email, generate a time-limited reset token (signed JWT with 1hr expiry), store token in DB or cache, send email with reset link using smtplib
4. Update `/api/auth/reset-password`: validate the token, allow password change

---

### 🟠 TASK 19 — Fix Invoice Model: Add Payment Tracking [MEDIUM]

**Problem:** Invoice has no `paid_amount` or `status` — can't track partial payments or outstanding balances.

**Instructions:**
1. Add to Invoice model: `paid_amount = Column(Numeric(10,2), default=0)`, `status = Column(String(20), default='unpaid')` (unpaid/partial/paid), `due_date = Column(Date, nullable=True)`
2. Add endpoint: `POST /api/billing/invoices/{id}/payment` — body: `{amount, payment_method, notes}` → update paid_amount, recalculate status
3. Update billing list response to include balance_due = total_amount - paid_amount

---

### 🟠 TASK 20 — Persist QA Checklist to Backend [MEDIUM]

**Problem:** `QAChecklist.jsx` has 0 API calls — all checkbox state lives in browser memory only. Refreshing loses all data.

**Instructions:**
1. Create `QAChecklistEntry` model: `{user_id, date (Date), section (String), item_id (String), is_checked (Boolean), notes (Text)}`
2. Add endpoints:
   - `GET /api/qa-checklist?date=` — return today's saved checklist state
   - `POST /api/qa-checklist/toggle` — body: `{date, section, item_id, is_checked}` — save/update one checkbox
3. Update `QAChecklist.jsx` to load saved state on mount and POST every checkbox toggle

---

### 🟠 TASK 21 — Fix All Empty catch{} Blocks in Frontend [MEDIUM]

**Problem:** Many pages have empty `catch {}` or `catch(e) {}` blocks — errors are silently swallowed and the user sees a blank/frozen page with no explanation.

**Instructions:**
Search ALL files in `frontend/src/pages/` for empty catch blocks and replace them with user-visible error handling. Example pattern:

```javascript
// WRONG — silent failure
try {
  const res = await api.get('/something')
} catch {}

// CORRECT — user sees the error
try {
  const res = await api.get('/something')
} catch (err) {
  const msg = err.response?.data?.detail || 'Something went wrong. Please try again.'
  alert(msg)  // or use a toast notification
}
```

---

### 🟠 TASK 22 — Split main.py into Router Modules [MEDIUM]

**Problem:** `backend/main.py` is 2,296 lines — all routes in one file. This makes it very hard to maintain.

**Instructions:**
Create these router files and move relevant routes into each:
```
backend/routers/
  auth.py          # /api/auth/*
  patients.py      # /api/patients/*
  samples.py       # /api/samples/*
  billing.py       # /api/billing/*
  appointments.py  # /api/appointments/*
  clinical.py      # /api/opd/*, /api/admissions/*, /api/ot/*, /api/wards/*
  pharmacy.py      # /api/pharmacy/*, /api/prescriptions/*
  hr.py            # /api/hr/*, /api/attendance/*, /api/shifts/*
  inventory.py     # /api/inventory/*
  settings.py      # /api/settings/*, /api/users/*, /api/branches/*
```

In `main.py` register them:
```python
from backend.routers import auth, patients, samples, billing
app.include_router(auth.router)
app.include_router(patients.router)
# etc.
```

---

### 🟠 TASK 23 — Initialize Alembic for Database Migrations [MEDIUM]

**Problem:** No migration system — schema changes require manual DB edits.

**Instructions:**
```bash
pip install alembic
alembic init migrations
```
Configure `migrations/env.py`:
- Import `Base` from `backend.database.models`
- Set `target_metadata = Base.metadata`
- Read `DATABASE_URL` from settings

Then:
```bash
alembic revision --autogenerate -m "initial_schema"
alembic upgrade head
```

Add `alembic upgrade head` to `Dockerfile` startup command.

---

### 🟡 TASK 24 — Add API Test Suite [LOW]

**Problem:** Only `test_hl7_parser.py` exists — zero coverage for API endpoints.

**Instructions:**
Create `backend/tests/conftest.py`:
- Override `DATABASE_URL` with SQLite test DB
- Provide `test_client` fixture using `httpx.AsyncClient`
- Seed an admin user and test patient

Create `backend/tests/test_api.py` covering:
- Login (valid credentials → token, invalid → 401)
- Patient CRUD (create, list, get, update)
- Sample creation
- Result entry
- Invoice creation
- Billing list

---

### 🟡 TASK 25 — Production Docker Setup with Nginx [LOW]

**Problem:** docker-compose.yml exists for dev but no production setup (no nginx, no HTTPS config).

**Instructions:**
Create `docker-compose.prod.yml` with:
1. `postgres` service with volume
2. `backend` service: FastAPI behind gunicorn (`gunicorn backend.main:app -w 4 -k uvicorn.workers.UvicornWorker`)
3. `frontend` service: Vite build stage → nginx serving static files
4. `nginx` reverse proxy: `location /api` → backend, `location /` → frontend static

Create `nginx.conf`:
```nginx
server {
    listen 80;
    location /api { proxy_pass http://backend:8000; }
    location / { root /usr/share/nginx/html; try_files $uri /index.html; }
}
```

Create `.env.prod.example` with all required variables.

---

### 🟡 TASK 26 — Fix CORS for Production [LOW]

**Problem:** CORS is hardcoded to `localhost` only — app cannot be deployed to production domain.

**Instructions:**
In `backend/config.py` add:
```python
ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
```

In `backend/main.py` update CORS middleware:
```python
settings = get_settings()
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]
app.add_middleware(CORSMiddleware, allow_origins=origins, ...)
```

---

## 🚀 HOW TO USE THIS FILE WITH CLAUDE CODE

Open Claude Code in your LISSystem folder and type commands like:

```
Do Task 1 from CLAUDE.md
Do Task 2 from CLAUDE.md — add all 16 missing database models
Do Tasks 3 and 4 from CLAUDE.md
Do Task 10 (HR module) from CLAUDE.md
```

Claude Code will read this file automatically and implement exactly what is described.

**Recommended order:** Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10 → Task 11 → Task 12 → Task 13 → Task 14 → Task 15 → Task 16 → Task 17 → Task 18 → Task 19 → Task 20 → Task 21 → Task 22 → Task 23

---

## 🗄️ EXISTING DATABASE MODELS (Already in models.py)

These are already created — do not recreate them:
`Patient, Doctor, Sample, Result, ReferenceRange, User, Invoice, InvoiceItem, TestCatalog, TestPackage, TestPackageItem, Branch, Token, InventoryItem, InventoryLog, ReportTemplate, LabSettings, Category`

---

## 🔑 EXISTING API ENDPOINTS (Already in main.py)

These routes already exist and work — do not recreate:
```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/signup
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/patients
POST   /api/patients
GET    /api/patients/{id}
PUT    /api/patients/{id}
GET    /api/patients/{id}/samples
GET    /api/doctors
POST   /api/doctors
GET    /api/samples
POST   /api/samples
GET    /api/samples/{id}/results
POST   /api/results
GET    /api/samples/{id}/report
GET    /api/samples/{id}/report/pdf
GET    /api/dashboard
GET    /api/reports/mis
GET    /api/reports/daily-closing
POST   /api/billing/invoices
GET    /api/billing/invoices
GET    /api/billing/invoices/{id}/receipt
GET    /api/tests
POST   /api/tests
PUT    /api/tests/{id}
DELETE /api/tests/{id}
GET    /api/inventory
POST   /api/inventory
PUT    /api/inventory/{id}
POST   /api/inventory/{id}/stock
GET    /api/users
POST   /api/users (register)
PUT    /api/users/{id}/toggle
DELETE /api/users/{id}
GET    /api/settings
PUT    /api/settings
GET    /api/branches
POST   /api/branches
DELETE /api/branches/{id}
GET    /api/packages
POST   /api/packages
DELETE /api/packages/{id}
GET    /api/tokens
POST   /api/tokens
GET    /api/tokens/current
PUT    /api/tokens/{id}/call
PUT    /api/tokens/{id}/complete
PUT    /api/tokens/{id}/cancel
GET    /api/categories/{type}
POST   /api/categories/seed-defaults
GET    /api/audit-logs
GET    /api/backup
GET    /api/report-templates
POST   /api/report-templates
PUT    /api/report-templates/{id}
DELETE /api/report-templates/{id}
POST   /api/machine/test-parse
GET    /api/export/patients
GET    /api/export/results
GET    /api/export/invoices
POST   /api/import/patients
POST   /api/import/doctors
GET    /api/samples/{id}/barcode
POST   /api/barcodes/batch
POST   /api/samples/{id}/whatsapp
POST   /api/samples/{id}/sms
POST   /api/samples/{id}/email
GET    /api/portal/login
GET    /api/portal/reports
GET    /api/signature/{user_id}
POST   /api/signature/upload
```
