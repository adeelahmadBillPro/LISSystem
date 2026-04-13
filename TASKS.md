# TASKS.md — LISSystem Task Tracker
# ⚠️ Claude Code: Check this file FIRST. Do only the next [ ] task. Mark [x] when done.

---

## HOW TO USE
- `[ ]` = Not started
- `[x]` = Complete
- Claude Code must do tasks IN ORDER — never skip
- After each task: test → commit → mark complete → move to next

---

## PHASE 1 — SECURITY & FOUNDATION (Do These First)

### Task 1 — Fix Security: Move Secrets to .env
- Status: `[ ]`
- Files: `backend/config.py`, `.env`, `.env.example`, `.gitignore`
- What to do:
  1. Open `backend/config.py`
  2. Make sure `SECRET_KEY` has NO hardcoded default value — must come from .env only
  3. Make sure `DATABASE_URL` has NO hardcoded password — must come from .env only
  4. Open `.env` file — add `SECRET_KEY` and `DATABASE_URL` with real values
  5. Open `.env.example` — add placeholder versions of all keys
  6. Open `.gitignore` — make sure `.env` is listed (not `.env.example`)
  7. Update CORS in `backend/main.py` — read `ALLOWED_ORIGINS` from settings instead of hardcoded localhost list
  8. Add `ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000` to `.env`
- Test: Run `uvicorn backend.main:app --reload` — login must still work
- Commit message: `fix: move all secrets to .env, remove hardcoded credentials`

---

### Task 2 — Add All Missing Database Models
- Status: `[ ]`
- Files: `backend/database/models.py`
- What to do: Add these 19 new models following the existing pattern in models.py

```
Model 1: Appointment
  - id, patient_id (FK patients), doctor_id (FK doctors), appointment_date (DateTime)
  - type (String: opd/lab/ipd/other), status (String: scheduled/arrived/completed/cancelled)
  - notes (Text), created_at, updated_at

Model 2: Ward
  - id, name (String 100), ward_type (String: general/private/icu/emergency)
  - total_beds (Integer), is_active (Boolean default True), created_at

Model 3: Bed
  - id, ward_id (FK wards), bed_number (String 20)
  - is_occupied (Boolean default False), patient_id (FK patients, nullable)
  - created_at

Model 4: Admission (IPD)
  - id, patient_id (FK patients), ward_id (FK wards), bed_id (FK beds)
  - doctor_id (FK doctors), admitted_at (DateTime default now)
  - discharged_at (DateTime nullable), diagnosis (Text), discharge_summary (Text nullable)
  - treatment_notes (Text nullable), status (String: admitted/discharged/transferred)
  - created_at, updated_at

Model 5: OPDVisit
  - id, patient_id (FK patients), doctor_id (FK doctors)
  - visit_date (DateTime default now), complaint (Text), diagnosis (Text nullable)
  - fee (Numeric 10,2 default 0), status (String: waiting/in_progress/completed)
  - referred_to_lab (Boolean default False), admit_to_ipd (Boolean default False)
  - notes (Text nullable), created_at, updated_at

Model 6: OTTheater
  - id, name (String 100), status (String: available/in_use/cleaning)
  - created_at, updated_at

Model 7: Surgery
  - id, patient_id (FK patients), theater_id (FK ot_theaters)
  - surgeon_name (String 200), anesthesiologist (String 200 nullable)
  - procedure_name (String 200), scheduled_at (DateTime)
  - started_at (DateTime nullable), ended_at (DateTime nullable)
  - status (String: scheduled/in_progress/completed/cancelled)
  - pre_op_notes (Text nullable), post_op_notes (Text nullable)
  - created_at, updated_at

Model 8: Staff
  - id, full_name (String 200), role (String 100), department (String 100 nullable)
  - phone (String 20 nullable), email (String 200 nullable)
  - salary (Numeric 10,2 default 0), joining_date (Date nullable)
  - is_active (Boolean default True), address (Text nullable), created_at, updated_at

Model 9: Attendance
  - id, staff_id (FK staff), date (Date), clock_in (DateTime)
  - clock_out (DateTime nullable), hours_worked (Numeric 5,2 nullable)
  - notes (Text nullable), created_at

Model 10: Shift
  - id, staff_id (FK staff), shift_date (Date)
  - shift_type (String: morning/evening/night)
  - start_time (String 10), end_time (String 10)
  - notes (Text nullable), created_at

Model 11: Medication
  - id, name (String 200), generic_name (String 200 nullable)
  - category (String 100 nullable), stock (Integer default 0)
  - reorder_level (Integer default 10), price_per_unit (Numeric 10,2 default 0)
  - unit (String 30 default 'tablet'), manufacturer (String 200 nullable)
  - expiry_date (Date nullable), is_active (Boolean default True)
  - created_at, updated_at

Model 12: Prescription
  - id, patient_id (FK patients), doctor_id (FK doctors)
  - visit_id (FK opd_visits nullable), prescribed_at (DateTime default now)
  - is_dispensed (Boolean default False), notes (Text nullable), created_at

Model 13: PrescriptionItem
  - id, prescription_id (FK prescriptions), medication_id (FK medications nullable)
  - medication_name (String 200), dosage (String 100), frequency (String 100)
  - duration (String 100 nullable), notes (Text nullable)

Model 14: DispenseRecord
  - id, patient_id (FK patients), prescription_id (FK prescriptions nullable)
  - dispensed_by (FK users), dispensed_at (DateTime default now)
  - total_amount (Numeric 10,2 default 0), notes (Text nullable)

Model 15: DispenseItem
  - id, dispense_id (FK dispense_records), medication_id (FK medications)
  - medication_name (String 200), quantity (Integer), unit_price (Numeric 10,2)
  - total_price (Numeric 10,2)

Model 16: CreditAccount
  - id, name (String 200), credit_limit (Numeric 10,2 default 0)
  - current_balance (Numeric 10,2 default 0), contact_person (String 200 nullable)
  - phone (String 20 nullable), email (String 200 nullable)
  - address (Text nullable), notes (Text nullable), is_active (Boolean default True)
  - created_at, updated_at

Model 17: CreditTransaction
  - id, account_id (FK credit_accounts), amount (Numeric 10,2)
  - transaction_type (String: charge/payment), notes (Text nullable)
  - invoice_id (FK invoices nullable), created_by (FK users nullable), created_at

Model 18: InsuranceClaim
  - id, patient_id (FK patients), invoice_id (FK invoices nullable)
  - insurance_provider (String 200), policy_number (String 100)
  - claim_amount (Numeric 10,2), approved_amount (Numeric 10,2 nullable)
  - status (String: submitted/approved/rejected/paid)
  - submitted_at (DateTime default now), notes (Text nullable), updated_at

Model 19: RadiologyOrder
  - id, patient_id (FK patients), doctor_id (FK doctors nullable)
  - test_type (String: XRay/CT/MRI/Ultrasound/Other), ordered_at (DateTime default now)
  - status (String: pending/in_progress/reported)
  - report_notes (Text nullable), reported_at (DateTime nullable)
  - reported_by (FK users nullable), created_at
```

- Also: Add `email = Column(String(200), nullable=True)` to existing User model
- Also: Add `paid_amount = Column(Numeric(10,2), default=0)` and `status = Column(String(20), default='unpaid')` to existing Invoice model
- Also: Update `create_tables()` at bottom of models.py — it auto-includes new models since they inherit Base
- Test: Run backend — no errors on startup, all tables created
- Commit message: `feat: add 19 missing database models (IPD, OPD, OT, Pharmacy, HR, etc)`

---

## PHASE 2 — CLINICAL BACKBONE (Tasks 3-7)

### Task 3 — Implement Wards & Beds API
- Status: `[ ]`
- Files: `backend/main.py` (add routes at end of file)
- Frontend: `frontend/src/pages/Wards.jsx` (already built, needs these endpoints)
- Add these routes:
```
GET  /api/wards
  - Return all wards with: id, name, ward_type, total_beds, occupied_beds (count), available_beds
  - occupied_beds = count of Bed where is_occupied=True for that ward

POST /api/wards
  - Body: {name, ward_type, total_beds}
  - Create Ward record
  - Auto-create Bed records: loop from 1 to total_beds, create Bed(ward_id, bed_number=f"{ward.name[:3]}-{i}")
  - Role: admin only

PUT /api/wards/{ward_id}
  - Body: {name, ward_type, is_active}
  - Update ward details
  - Role: admin only

GET /api/wards/{ward_id}/beds
  - Return all beds for that ward with: id, bed_number, is_occupied, patient name if occupied
  - Join Bed with Patient where bed.patient_id = patient.id
```
- Test: Open Wards page in browser — should show empty list, can add ward, beds auto-create
- Commit message: `feat: implement wards and beds API`

---

### Task 4 — Implement Appointments API
- Status: `[ ]`
- Files: `backend/main.py`
- Frontend: `frontend/src/pages/Appointments.jsx`
- Add these routes:
```
GET  /api/appointments
  - Query params: ?date= (filter by date), ?doctor_id=, ?status=
  - Return list with patient name, doctor name, date, type, status, notes
  - Join Appointment with Patient and Doctor

POST /api/appointments
  - Body: {patient_id, doctor_id, appointment_date, type, notes}
  - Create Appointment with status='scheduled'
  - Log audit action

PUT  /api/appointments/{appt_id}
  - Body: {status, notes, appointment_date} (all optional)
  - Update only provided fields
  - Log audit action

DELETE /api/appointments/{appt_id}
  - Soft delete: set status='cancelled'
  - Admin only
```
- Test: Open Appointments page — list loads, can book new appointment, can change status
- Commit message: `feat: implement appointments API`

---

### Task 5 — Implement IPD Admissions API
- Status: `[ ]`
- Files: `backend/main.py`
- Frontend: `frontend/src/pages/IPD.jsx`
- Add these routes:
```
GET  /api/admissions
  - Query params: ?status=admitted/discharged, ?ward_id=
  - Return list with patient name, ward name, bed number, doctor name, admitted_at, status
  - Join Admission with Patient, Ward, Bed, Doctor

POST /api/admissions
  - Body: {patient_id, ward_id, bed_id, doctor_id, diagnosis, notes}
  - Create Admission with status='admitted', admitted_at=now
  - Update Bed: is_occupied=True, patient_id=patient_id
  - Log audit

PUT  /api/admissions/{admission_id}
  - Body can contain any of: {treatment_notes, ward_id, bed_id, status, discharge_summary}
  - If status='discharged': set discharged_at=now, update old Bed to is_occupied=False/patient_id=None
  - If ward transfer: update old bed (free), update new bed (occupy)
  - Log audit

GET  /api/admissions/stats
  - Return: {total_admitted, available_beds (total across all wards), today_admissions, today_discharges}
```
- Test: Open IPD page — stats show, can admit patient, bed becomes occupied, can discharge
- Commit message: `feat: implement IPD admissions API`

---

### Task 6 — Implement OPD Visits API
- Status: `[ ]`
- Files: `backend/main.py`
- Frontend: `frontend/src/pages/OPD.jsx`
- Add these routes:
```
GET  /api/opd/visits
  - Query params: ?date=, ?doctor_id=, ?status=
  - Return list with patient name, doctor name, complaint, status, fee, visit_date
  - Default: today's visits

POST /api/opd/visits
  - Body: {patient_id, doctor_id, complaint, diagnosis, fee, referred_to_lab, admit_to_ipd, notes}
  - Create OPDVisit with status='waiting', visit_date=now
  - Log audit

PUT  /api/opd/visits/{visit_id}/status
  - Body: {status}  (waiting/in_progress/completed)
  - Update status only

PUT  /api/opd/visits/{visit_id}
  - Body: {diagnosis, notes, referred_to_lab, admit_to_ipd}
  - Update visit details

GET  /api/opd/stats
  - Return: {today_total, waiting, in_progress, completed}
  - Count only today's visits
```
- Test: Open OPD page — today stats show, can create visit, can change status
- Commit message: `feat: implement OPD visits API`

---

### Task 7 — Implement OT (Operation Theater) API
- Status: `[ ]`
- Files: `backend/main.py`
- Frontend: `frontend/src/pages/OT.jsx`
- Add these routes:
```
GET  /api/ot/theaters
  - Return all theaters with id, name, status

POST /api/ot/theaters
  - Body: {name, status}
  - Create theater. Admin only.

PUT  /api/ot/theaters/{theater_id}
  - Body: {status}  (available/in_use/cleaning)

GET  /api/ot/surgeries
  - Query params: ?date=, ?status=, ?theater_id=
  - Return list with patient name, procedure, surgeon, theater name, scheduled_at, status

POST /api/ot/surgeries
  - Body: {patient_id, theater_id, surgeon_name, anesthesiologist, procedure_name, scheduled_at, pre_op_notes}
  - Create Surgery with status='scheduled'
  - Update theater status to 'in_use'
  - Log audit

PUT  /api/ot/surgeries/{surgery_id}
  - Body: {status, post_op_notes, started_at, ended_at}
  - If status='completed': update theater back to 'available'
  - Log audit

GET  /api/ot/stats
  - Return: {today_scheduled, in_progress, completed, theaters_available}
```
- Test: Open OT page — can add theater, schedule surgery, update status
- Commit message: `feat: implement OT surgeries and theaters API`

---

## PHASE 3 — PHARMACY & PRESCRIPTIONS (Tasks 8-9)

### Task 8 — Implement Pharmacy API
- Status: `[ ]`
- Files: `backend/main.py`
- Frontend: `frontend/src/pages/PharmacyStore.jsx`
- Add these routes:
```
GET  /api/pharmacy/medications
  - Query params: ?category=, ?low_stock=true
  - If low_stock=true: return only where stock <= reorder_level
  - Return full medication details

POST /api/pharmacy/medications
  - Body: {name, generic_name, category, stock, reorder_level, price_per_unit, unit, manufacturer, expiry_date}

PUT  /api/pharmacy/medications/{med_id}
  - Update medication details

POST /api/pharmacy/medications/{med_id}/stock
  - Body: {action: 'add'/'remove'/'set', quantity, reason}
  - add: stock += quantity
  - remove: stock -= quantity (check not going below 0)
  - set: stock = quantity
  - Log inventory action in audit

GET  /api/pharmacy/dispenses
  - Return list of dispense records with patient name, items, total, date
  - Join DispenseRecord with Patient and DispenseItem

POST /api/pharmacy/dispenses
  - Body: {patient_id, prescription_id (optional), items: [{medication_id, quantity}]}
  - Create DispenseRecord
  - For each item: create DispenseItem, reduce medication stock
  - If prescription_id: mark Prescription.is_dispensed = True
  - Calculate total_amount from item quantities * prices
  - Log audit

GET  /api/pharmacy/stats
  - Return: {total_medications, low_stock_count, today_dispenses, today_revenue}
```
- Test: Open Pharmacy page — can add medication, adjust stock, dispense to patient
- Commit message: `feat: implement pharmacy medications and dispenses API`

---

### Task 9 — Implement Prescriptions API
- Status: `[ ]`
- Files: `backend/main.py`
- Frontend: `frontend/src/pages/Prescriptions.jsx`
- Add these routes:
```
GET  /api/prescriptions
  - Query params: ?patient_id=, ?doctor_id=, ?is_dispensed=
  - Return with patient name, doctor name, item count, is_dispensed, prescribed_at

POST /api/prescriptions
  - Body: {patient_id, doctor_id, visit_id (optional), items: [{medication_id, medication_name, dosage, frequency, duration, notes}], notes}
  - Create Prescription + PrescriptionItems
  - Log audit

GET  /api/prescriptions/{prescription_id}
  - Return full prescription with all items

PUT  /api/prescriptions/{prescription_id}/dispense
  - Mark is_dispensed = True
```
- Test: Open Prescriptions page — can create prescription with items, can mark dispensed
- Commit message: `feat: implement prescriptions API`

---

## PHASE 4 — HR, ATTENDANCE & SHIFTS (Tasks 10-12)

### Task 10 — Implement HR Staff & Payroll API
- Status: `[ ]`
- Files: `backend/main.py`
- Frontend: `frontend/src/pages/HR.jsx`
- Add these routes:
```
GET  /api/hr/staff
  - Return all staff: id, full_name, role, department, phone, salary, joining_date, is_active

POST /api/hr/staff
  - Body: {full_name, role, department, phone, email, salary, joining_date, address}
  - Admin only

PUT  /api/hr/staff/{staff_id}
  - Update staff details. Admin only.

GET  /api/hr/advances
  - Return all salary advances with staff name, amount, reason, remaining balance

POST /api/hr/advances
  - Body: {staff_id, amount, reason, deduction_per_month}
  - Create advance record

GET  /api/hr/payroll
  - Query params: ?month=, ?year=
  - Return payroll records for that month

POST /api/hr/payroll/generate
  - Body: {month, year}
  - For each active staff:
    * base_salary = staff.salary
    * deductions = sum of pending advance deductions for this staff
    * net_salary = base_salary - deductions
    * Create payroll record
  - Return summary

GET  /api/hr/summary
  - Return: {total_staff, active_staff, total_monthly_payroll (sum of all salaries), pending_advances_total}
```
- Test: Open HR page — staff list loads, can add staff, generate payroll
- Commit message: `feat: implement HR staff and payroll API`

---

### Task 11 — Implement Attendance API
- Status: `[ ]`
- Files: `backend/main.py`
- Frontend: `frontend/src/pages/Attendance.jsx`
- Add these routes:
```
GET  /api/attendance/today
  - Return all staff with their today's clock-in/out status
  - For each staff: id, name, role, clock_in (null if not clocked in), clock_out, hours_worked

POST /api/attendance/clock-in
  - For current_user: check no existing clock-in for today
  - Create Attendance(staff_id=current_user.id, date=today, clock_in=now)
  - Error if already clocked in today

POST /api/attendance/clock-out
  - For current_user: find today's attendance record with no clock_out
  - Set clock_out=now, calculate hours_worked = (clock_out - clock_in).seconds / 3600
  - Error if not clocked in

GET  /api/attendance/my-history
  - Return last 30 days attendance for current_user
  - Include: date, clock_in, clock_out, hours_worked

GET  /api/attendance/report
  - Query params: ?staff_id=, ?from_date=, ?to_date=
  - Admin only
  - Return attendance records matching filters
```
- Test: Clock-in works, clock-out works, history shows correctly
- Commit message: `feat: implement attendance clock-in/out API`

---

### Task 12 — Implement Shift Management API
- Status: `[ ]`
- Files: `backend/main.py`
- Frontend: `frontend/src/pages/ShiftManagement.jsx`
- Add these routes:
```
GET  /api/shifts
  - Query params: ?staff_id=, ?from_date=, ?to_date=, ?shift_type=
  - Return shifts with staff name, date, type, times

POST /api/shifts
  - Body: {staff_id, shift_date, shift_type, start_time, end_time, notes}
  - Check no duplicate shift for same staff on same date
  - Admin only

PUT  /api/shifts/{shift_id}
  - Body: {shift_type, start_time, end_time, notes}
  - Admin only

DELETE /api/shifts/{shift_id}
  - Delete shift. Admin only.

GET  /api/shifts/summary
  - Query params: ?from_date=, ?to_date=
  - Return staff-wise: {staff_id, staff_name, total_shifts, morning_shifts, evening_shifts, night_shifts}
```
- Test: Open ShiftManagement page — can assign shifts to staff, view weekly schedule
- Commit message: `feat: implement shift management API`

---

## PHASE 5 — FINANCE MODULES (Tasks 13-15)

### Task 13 — Implement Credit Accounts API
- Status: `[ ]`
- Files: `backend/main.py`
- Frontend: `frontend/src/pages/CreditAccounts.jsx`
- Add these routes:
```
GET  /api/credit-accounts
  - Return all: id, name, credit_limit, current_balance, balance_remaining, contact_person, phone, is_active
  - balance_remaining = credit_limit - current_balance

POST /api/credit-accounts
  - Body: {name, credit_limit, contact_person, phone, email, address, notes}

PUT  /api/credit-accounts/{account_id}
  - Update details. Admin only.

GET  /api/credit-accounts/{account_id}/ledger
  - Return all CreditTransaction for this account, newest first
  - Include: date, type, amount, notes, running balance

POST /api/credit-accounts/{account_id}/charge
  - Body: {amount, invoice_id (optional), notes}
  - Create CreditTransaction(type='charge')
  - Update account current_balance += amount
  - Check credit_limit not exceeded

POST /api/credit-accounts/{account_id}/payment
  - Body: {amount, notes}
  - Create CreditTransaction(type='payment')
  - Update account current_balance -= amount
```
- Test: Open CreditAccounts page — can create account, charge, pay, view ledger
- Commit message: `feat: implement credit accounts and ledger API`

---

### Task 14 — Implement Insurance Claims API
- Status: `[ ]`
- Files: `backend/main.py`
- Frontend: `frontend/src/pages/InsuranceClaims.jsx`
- Add these routes:
```
GET  /api/insurance/claims
  - Query params: ?status=, ?from_date=, ?to_date=
  - Return with patient name, provider, amount, status, date

POST /api/insurance/claims
  - Body: {patient_id, invoice_id, insurance_provider, policy_number, claim_amount, notes}
  - Create with status='submitted', submitted_at=now

PUT  /api/insurance/claims/{claim_id}
  - Body: {status, approved_amount, notes}
  - Update claim status and approved amount

GET  /api/insurance/claims/stats
  - Return: {total_claims, submitted, approved, rejected, paid, total_claimed, total_approved}
```
- Test: Open InsuranceClaims page — can create claim, update status, stats show correctly
- Commit message: `feat: implement insurance claims API`

---

### Task 15 — Implement Invoice Payment Tracking
- Status: `[ ]`
- Files: `backend/main.py`, `backend/database/models.py`
- What: Invoice already exists but has no payment tracking (paid_amount was added in Task 2)
- Add these routes:
```
POST /api/billing/invoices/{invoice_id}/payment
  - Body: {amount, payment_method, notes}
  - Update invoice: paid_amount += amount
  - Recalculate status:
    * paid_amount == 0: status = 'unpaid'
    * paid_amount < total_amount: status = 'partial'
    * paid_amount >= total_amount: status = 'paid'
  - Log audit

GET /api/billing/invoices (UPDATE existing endpoint)
  - Add balance_due = total_amount - paid_amount to each invoice in response
  - Add status field to response
```
- Test: Create invoice → make partial payment → status shows 'partial' → full payment → status 'paid'
- Commit message: `feat: add invoice payment tracking and balance calculation`

---

## PHASE 6 — RADIOLOGY & OTHER MODULES (Tasks 16-17)

### Task 16 — Implement Radiology API
- Status: `[ ]`
- Files: `backend/main.py`
- Frontend: `frontend/src/pages/Radiology.jsx`
- Add these routes:
```
GET  /api/radiology/orders
  - Query params: ?status=, ?date=, ?test_type=
  - Return with patient name, doctor name, test_type, status, ordered_at

POST /api/radiology/orders
  - Body: {patient_id, doctor_id, test_type, notes}
  - Create with status='pending', ordered_at=now

PUT  /api/radiology/orders/{order_id}
  - Body: {status, report_notes}
  - If status='reported': set reported_at=now, reported_by=current_user.id

GET  /api/radiology/stats
  - Return: {today_orders, pending, in_progress, reported, xray_count, ct_count, mri_count, ultrasound_count}
```
- Test: Open Radiology page — can create order, update to reported with notes, stats correct
- Commit message: `feat: implement radiology orders API`

---

### Task 17 — Implement Referral Commission API
- Status: `[ ]`
- Files: `backend/main.py`
- Frontend: `frontend/src/pages/ReferralCommission.jsx`
- Add this route:
```
GET  /api/referral/commission
  - Query params: ?from_date=, ?to_date= (required)
  - Logic:
    1. Query all Samples where collected_at between from_date and to_date
    2. For each sample, get the invoice amount (join Sample → Patient → Invoice via patient_id and date match)
    3. Group by doctor_id
    4. For each doctor return:
       {
         doctor_id, doctor_name, sample_count,
         total_billed (sum of invoice amounts for their samples),
         samples: [{sample_id, patient_name, date, amount}]
       }
  - Return empty list [] if no data found (never crash)
```
- Test: Open ReferralCommission page — select date range → doctor list with amounts appears
- Commit message: `feat: implement referral commission calculation API`

---

### Task 18 — Implement Doctor Dashboard API
- Status: `[ ]`
- Files: `backend/main.py`
- Frontend: `frontend/src/pages/DoctorDashboard.jsx`, `DoctorSchedule.jsx`
- Add these routes:
```
GET  /api/doctor/dashboard
  - For current logged-in user (role must be 'doctor')
  - Find doctor by matching User.full_name to Doctor.name (or add user_id FK to Doctor)
  - Return: {
      today_opd_count: count of today's OPD visits for this doctor,
      pending_prescriptions: count of undispensed prescriptions by this doctor,
      recent_patients: last 10 samples where doctor_id matches this doctor
    }

GET  /api/schedule/today
  - Return today's appointments where doctor matches current_user
  - Include: patient name, time, type, status
```
- Test: Login as doctor user → DoctorDashboard page shows their stats
- Commit message: `feat: implement doctor dashboard and today schedule API`

---

## PHASE 7 — CODE QUALITY (Tasks 19-23)

### Task 19 — Fix All Empty catch{} Blocks in Frontend
- Status: `[ ]`
- Files: All files in `frontend/src/pages/`
- What to do:
  1. Search ALL .jsx files for: `catch {}` or `catch(e) {}` or `catch(err) {}` with empty body
  2. Replace every one with proper error handling:
     ```javascript
     catch (err) {
       const msg = err.response?.data?.detail || 'Something went wrong. Please try again.'
       alert(msg)
     }
     ```
  3. If the page has a setError state, use that instead of alert
  4. Every API call must give user feedback on failure
- Test: Break an API call intentionally → user sees error message
- Commit message: `fix: replace all empty catch blocks with user-visible error handling`

---

### Task 20 — Persist QA Checklist to Backend
- Status: `[ ]`
- Files: `backend/main.py`, `backend/database/models.py`, `frontend/src/pages/QAChecklist.jsx`
- What: QAChecklist page currently saves nothing — all data lost on page refresh
- Add model `QAChecklistEntry`:
  ```
  id, user_id (FK users), check_date (Date), section (String), item_id (String)
  is_checked (Boolean default False), notes (Text nullable), updated_at
  UniqueConstraint(user_id, check_date, item_id)
  ```
- Add routes:
  ```
  GET  /api/qa-checklist?date=YYYY-MM-DD
    - Return all checked items for that date and current user
    - Return: [{item_id, is_checked, notes}]

  POST /api/qa-checklist/toggle
    - Body: {date, section, item_id, is_checked, notes}
    - Upsert: create or update the record
  ```
- Update QAChecklist.jsx:
  - On load: call GET /api/qa-checklist?date=today, restore checkbox states
  - On every checkbox click: call POST /api/qa-checklist/toggle
- Test: Check boxes → refresh page → boxes still checked
- Commit message: `feat: persist QA checklist state to database`

---

### Task 21 — Fix User Email + Forgot Password
- Status: `[ ]`
- Files: `backend/main.py`, `backend/database/models.py`
- What: User model now has email (added in Task 2). Wire up the forgot-password flow.
- Update routes:
  ```
  POST /api/auth/forgot-password (UPDATE EXISTING)
    - Body: {email}
    - Find user by email
    - Generate reset token: JWT with {sub: user.username, exp: now+1hr, type: 'reset'}
    - For now: return the token in the response (or log it)
    - Future: send via email using smtplib

  POST /api/auth/reset-password (UPDATE EXISTING)
    - Body: {token, new_password}
    - Decode token, verify type='reset' and not expired
    - Update user password_hash
    - Return success message

  POST /api/auth/register (UPDATE EXISTING)
  POST /api/auth/signup (UPDATE EXISTING)
    - Accept email field and save to user.email
  ```
- Test: Request reset → get token → use token to set new password → login with new password
- Commit message: `feat: wire up email field and forgot-password reset flow`

---

### Task 22 — Split main.py into Router Modules
- Status: `[ ]`
- Files: `backend/main.py`, new files in `backend/routers/`
- What: main.py is 2296+ lines — split into router files
- Steps:
  1. Create folder `backend/routers/`
  2. Create `backend/routers/__init__.py` (empty)
  3. Create these router files, moving relevant routes from main.py:
     - `auth.py` → /api/auth/* routes
     - `patients.py` → /api/patients/* routes
     - `samples.py` → /api/samples/*, /api/results/* routes
     - `billing.py` → /api/billing/*, /api/reports/daily-closing, /api/reports/mis routes
     - `clinical.py` → /api/opd/*, /api/admissions/*, /api/ot/*, /api/wards/*, /api/radiology/* routes
     - `pharmacy.py` → /api/pharmacy/*, /api/prescriptions/* routes
     - `hr.py` → /api/hr/*, /api/attendance/*, /api/shifts/* routes
     - `inventory.py` → /api/inventory/* routes
  4. Each router file: `router = APIRouter()` then `@router.get(...)` etc.
  5. In main.py: import and register all routers:
     ```python
     from backend.routers import auth, patients, samples, billing, clinical, pharmacy, hr, inventory
     app.include_router(auth.router)
     # etc.
     ```
  6. Keep only app setup, CORS, and startup code in main.py
- Test: ALL existing endpoints still work after split — run full test via browser
- Commit message: `refactor: split main.py into router modules`

---

### Task 23 — Initialize Alembic Migrations
- Status: `[ ]`
- Files: New `migrations/` folder
- Steps:
  ```bash
  pip install alembic
  alembic init migrations
  ```
  Edit `migrations/env.py`:
  - Add: `from backend.database.models import Base`
  - Set: `target_metadata = Base.metadata`
  - Set sqlalchemy.url from settings: `from backend.config import get_settings; settings = get_settings()`

  Then run:
  ```bash
  alembic revision --autogenerate -m "initial_schema_with_all_models"
  alembic upgrade head
  ```
  Add to `requirements.txt`: `alembic`
- Test: `alembic history` shows one migration. `alembic upgrade head` runs clean with no errors.
- Commit message: `feat: initialize Alembic database migrations`

---

### Task 24 — Add Backend API Tests
- Status: `[ ]`
- Files: `backend/tests/conftest.py`, `backend/tests/test_api.py`
- Create `conftest.py`:
  ```python
  # Override DATABASE_URL to use test SQLite DB
  # Create test client with httpx AsyncClient
  # Seed: 1 admin user, 1 test patient, 1 test doctor
  # Cleanup after each test
  ```
- Create `test_api.py` with tests:
  ```
  test_login_valid()          → POST /api/auth/login → 200 + token
  test_login_invalid()        → POST /api/auth/login → 401
  test_create_patient()       → POST /api/patients → 200 + patient data
  test_list_patients()        → GET /api/patients → 200 + list
  test_create_sample()        → POST /api/samples → 200
  test_create_invoice()       → POST /api/billing/invoices → 200
  test_dashboard()            → GET /api/dashboard → 200 + stats
  ```
- Test: `pytest backend/tests/ -v` → all pass
- Commit message: `test: add API test suite with core endpoint coverage`

---

### Task 25 — Production Docker Setup
- Status: `[ ]`
- Files: `docker-compose.prod.yml`, `nginx.conf`, `.env.prod.example`
- Create `docker-compose.prod.yml`:
  ```yaml
  services:
    postgres:
      image: postgres:15
      environment: {POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD from .env}
      volumes: [postgres_data:/var/lib/postgresql/data]

    backend:
      build: .
      command: gunicorn backend.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
      depends_on: [postgres]
      env_file: .env

    frontend:
      build:
        context: ./frontend
        dockerfile: Dockerfile.frontend
      (multi-stage: node build → nginx serve)

    nginx:
      image: nginx:alpine
      ports: ["80:80"]
      volumes: [./nginx.conf:/etc/nginx/nginx.conf]
      depends_on: [backend, frontend]
  ```
- Create `nginx.conf` with:
  - `location /api` → proxy to backend:8000
  - `location /` → serve frontend static files with try_files fallback
- Create `frontend/Dockerfile.frontend` multi-stage build
- Create `.env.prod.example` with all required variables
- Commit message: `feat: add production Docker setup with nginx reverse proxy`

---

## PROGRESS TRACKER

| Task | Description | Status |
|------|-------------|--------|
| Task 1 | Fix security / .env | [ ] |
| Task 2 | Add 19 DB models | [ ] |
| Task 3 | Wards & Beds API | [ ] |
| Task 4 | Appointments API | [ ] |
| Task 5 | IPD Admissions API | [ ] |
| Task 6 | OPD Visits API | [ ] |
| Task 7 | OT Surgeries API | [ ] |
| Task 8 | Pharmacy API | [ ] |
| Task 9 | Prescriptions API | [ ] |
| Task 10 | HR Staff & Payroll API | [ ] |
| Task 11 | Attendance API | [ ] |
| Task 12 | Shift Management API | [ ] |
| Task 13 | Credit Accounts API | [ ] |
| Task 14 | Insurance Claims API | [ ] |
| Task 15 | Invoice Payment Tracking | [ ] |
| Task 16 | Radiology API | [ ] |
| Task 17 | Referral Commission API | [ ] |
| Task 18 | Doctor Dashboard API | [ ] |
| Task 19 | Fix empty catch blocks | [ ] |
| Task 20 | QA Checklist persist | [ ] |
| Task 21 | User email + forgot password | [ ] |
| Task 22 | Split main.py into routers | [ ] |
| Task 23 | Alembic migrations | [ ] |
| Task 24 | API test suite | [ ] |
| Task 25 | Production Docker setup | [ ] |
