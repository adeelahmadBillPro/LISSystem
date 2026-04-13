# CLAUDE.md — LISSystem / BLOODSAMPLEPROJECT
# ⚠️ READ THIS ENTIRE FILE BEFORE DOING ANYTHING

---

## 🚨 STRICT RULES — FOLLOW EVERY TIME

1. **ALWAYS check TASKS.md first** — find the next incomplete task, do ONLY that task
2. **NEVER skip a task** — each task depends on the previous one
3. **NEVER do two tasks at once** — finish one completely, then move to the next
4. **ALWAYS run the project after each task** to verify nothing is broken
5. **ALWAYS update TASKS.md** — mark task complete after finishing it
6. **ALWAYS do a git commit** after each task with a clear message
7. **NEVER modify files not related to the current task**
8. **If something is unclear** — check existing code patterns first, then ask

---

## 🏗️ PROJECT OVERVIEW

**Project:** Laboratory Information System (LIS) for hospitals and diagnostic labs
**Stack:**
- Backend: FastAPI (Python) + SQLAlchemy + PostgreSQL
- Frontend: React 18 + Vite + Tailwind CSS + Axios
- Auth: JWT Bearer tokens (python-jose), bcrypt, role-based access
- Integrations: HL7/ASTM parser, WhatsApp, SMS, barcode, email reports

---

## 📁 FOLDER STRUCTURE

```
BLOODSAMPLEPROJECT/
├── CLAUDE.md                    ← You are reading this
├── TASKS.md                     ← Track every task here (check before starting)
├── .env                         ← Secrets (never commit)
├── .env.example                 ← Template for env vars
├── .gitignore
├── requirements.txt
├── docker-compose.yml
├── backend/
│   ├── main.py                  ← FastAPI app + all routes (being split into routers)
│   ├── database/
│   │   ├── models.py            ← SQLAlchemy ORM models
│   │   └── connection.py        ← get_db dependency
│   ├── routers/                 ← Split route files (created in Task 22)
│   │   ├── auth.py
│   │   ├── patients.py
│   │   ├── samples.py
│   │   ├── billing.py
│   │   ├── clinical.py
│   │   ├── pharmacy.py
│   │   ├── hr.py
│   │   └── inventory.py
│   ├── auth.py                  ← JWT + password helpers
│   ├── config.py                ← Settings from .env
│   ├── schemas.py               ← Pydantic schemas
│   ├── report_generator.py      ← PDF generation
│   ├── hl7_parser.py            ← HL7 message parser
│   ├── barcode_service.py       ← Barcode/QR PDF
│   ├── sms_service.py
│   ├── whatsapp_service.py
│   ├── audit_service.py
│   └── tests/
│       ├── conftest.py
│       └── test_api.py
├── frontend/
│   └── src/
│       ├── App.jsx              ← Router + ThemeContext
│       ├── api.js               ← Axios instance (baseURL='/api')
│       ├── components/
│       └── pages/               ← 58 React pages
└── migrations/                  ← Alembic migrations (Task 23)
```

---

## ⚙️ COMMANDS

```bash
# Start backend
uvicorn backend.main:app --reload --port 8000

# Start frontend
cd frontend && npm run dev

# Run tests
pytest backend/tests/ -v

# Database migrations
alembic upgrade head

# Check backend is working
curl http://localhost:8000/docs
```

---

## 📐 CODING RULES — NEVER BREAK THESE

### Backend
- All routes prefixed `/api/...`
- All routes use: `current_user: User = Depends(get_current_user)`
- Admin routes use: `current_user: User = Depends(require_role("admin"))`
- Always use `db: Session = Depends(get_db)` for database
- Always sanitize string inputs using `sanitize()` from main.py
- Always use `log_action(db, user_id, action, details)` for audit logging
- Return `HTTPException(status_code=404, detail="Not found")` for missing records
- User roles: `admin`, `technician`, `doctor`, `receptionist`

### Frontend
- Always import axios as: `import api from '../api'`
- Always use ThemeContext: `const { darkMode } = useContext(ThemeContext)`
- Always wrap API calls in try/catch with user-visible error messages
- NEVER use empty `catch {}` — always show error to user
- Use Tailwind CSS only — no custom CSS files
- Dark mode pattern: `darkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'`

### Database Models Pattern
```python
class NewModel(Base):
    __tablename__ = "table_name"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

---

## ✅ ALREADY COMPLETE — DO NOT REBUILD

- Patient registration, CRUD, MRN auto-generation
- Doctor CRUD
- Sample registration, tracking, status management
- Result entry (HL7/ASTM machine + manual)
- Reference ranges (age/gender specific)
- PDF report generation with QR + digital signature
- WhatsApp + SMS notifications
- Test catalog (TestCatalog, TestPackage, Categories)
- Billing / Invoice creation with line items
- Inventory with stock alerts
- User management with roles
- Audit logging
- Token/Queue system
- Branch management
- Report templates
- CSV import/export
- Barcode/QR PDF generation
- Patient portal
- MIS reports, daily closing
- Machine integration (HL7, ASTM, serial port)

---

## 🗄️ EXISTING DB MODELS (in models.py — do not recreate)

`Patient, Doctor, Sample, Result, ReferenceRange, User, Invoice, InvoiceItem,`
`TestCatalog, TestPackage, TestPackageItem, Branch, Token, InventoryItem,`
`InventoryLog, ReportTemplate, LabSettings, Category`

---

## 🔗 EXISTING API ENDPOINTS (in main.py — do not recreate)

```
Auth:      POST /api/auth/login, register, signup, forgot-password, reset-password
Patients:  GET/POST /api/patients, GET/PUT /api/patients/{id}
Samples:   GET/POST /api/samples, GET /api/samples/{id}/results
Results:   POST /api/results
Reports:   GET /api/samples/{id}/report, /report/pdf
Dashboard: GET /api/dashboard
MIS:       GET /api/reports/mis, /reports/daily-closing
Billing:   GET/POST /api/billing/invoices
Tests:     GET/POST/PUT/DELETE /api/tests
Inventory: GET/POST/PUT /api/inventory, /inventory/{id}/stock
Users:     GET/POST/DELETE /api/users, /users/{id}/toggle
Settings:  GET/PUT /api/settings
Branches:  GET/POST/DELETE /api/branches
Packages:  GET/POST/DELETE /api/packages
Tokens:    GET/POST /api/tokens, /tokens/current, /tokens/{id}/call|complete|cancel
Categories: GET /api/categories/{type}, POST /api/categories/seed-defaults
Audit:     GET /api/audit-logs
Backup:    GET /api/backup
Templates: GET/POST/PUT/DELETE /api/report-templates
Machine:   POST /api/machine/test-parse
Export:    GET /api/export/patients|results|invoices
Import:    POST /api/import/patients|doctors
Barcodes:  GET /api/samples/{id}/barcode, POST /api/barcodes/batch
Share:     POST /api/samples/{id}/whatsapp|sms|email
Portal:    GET /api/portal/login|reports
Signature: GET /api/signature/{id}, POST /api/signature/upload
```

---

## 📋 HOW TO USE THIS WITH CLAUDE CODE

Open Claude Code in your project folder and run ONE task at a time:

```
Check TASKS.md and do the next incomplete task
```

Or specifically:
```
Do Task 1 from TASKS.md
```

After each task, Claude Code will:
1. Implement the code
2. Test it works
3. Mark it complete in TASKS.md
4. Git commit with clear message
