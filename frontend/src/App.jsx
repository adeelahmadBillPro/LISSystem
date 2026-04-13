import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext } from 'react'
import api from './api'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import PatientRegister from './pages/PatientRegister'
import PatientDetail from './pages/PatientDetail'
import Samples from './pages/Samples'
import SampleRegister from './pages/SampleRegister'
import Results from './pages/Results'
import Report from './pages/Report'
import Doctors from './pages/Doctors'
import Verification from './pages/Verification'
import Users from './pages/Users'
import Billing from './pages/Billing'
import MISReports from './pages/MISReports'
import Settings from './pages/Settings'
import TestManagement from './pages/TestManagement'
import Categories from './pages/Categories'
import AuditLog from './pages/AuditLog'
import TestPackages from './pages/TestPackages'
import DailyClosing from './pages/DailyClosing'
import PatientPortal from './pages/PatientPortal'
import Branches from './pages/Branches'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import TokenQueue from './pages/TokenQueue'
import Inventory from './pages/Inventory'
import ReportTemplates from './pages/ReportTemplates'
import ManualResults from './pages/ManualResults'
import InvoiceReceipt from './pages/InvoiceReceipt'
import DataExport from './pages/DataExport'
import Landing from './pages/Landing'
import DataImport from './pages/DataImport'
import UserGuide from './pages/UserGuide'
import ApiDocs from './pages/ApiDocs'
import MachineTest from './pages/MachineTest'
import DoctorDashboard from './pages/DoctorDashboard'
import DoctorSchedule from './pages/DoctorSchedule'
import Prescriptions from './pages/Prescriptions'
import SystemFlow from './pages/SystemFlow'
import OPD from './pages/OPD'
import ReferralCommission from './pages/ReferralCommission'
import HR from './pages/HR'
import IPD from './pages/IPD'
import Wards from './pages/Wards'
import Radiology from './pages/Radiology'
import OT from './pages/OT'
import PharmacyStore from './pages/PharmacyStore'
import InsuranceClaims from './pages/InsuranceClaims'
import Appointments from './pages/Appointments'
import CreditAccounts from './pages/CreditAccounts'
import PatientStatement from './pages/PatientStatement'
import ResultTrend from './pages/ResultTrend'
import ShiftManagement from './pages/ShiftManagement'
import Attendance from './pages/Attendance'
import QAChecklist from './pages/QAChecklist'

export const ThemeContext = createContext()
export const ModulesContext = createContext({})

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

// Blocks non-admin users from accessing admin-only pages
function AdminRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-slate-700 mb-2">Access Denied</h2>
        <p className="text-slate-500 text-sm max-w-sm">
          This page is restricted to <strong>Administrators</strong> only. Contact your admin if you need access.
        </p>
      </div>
    )
  }
  return children
}

function ModuleRoute({ moduleKey, children }) {
  const [enabled, setEnabled] = useState(null)
  useEffect(() => {
    api.get('/settings/modules').then(r => {
      setEnabled(r.data[moduleKey] !== false)
    }).catch(() => setEnabled(true)) // default: show if API fails
  }, [moduleKey])
  if (enabled === null) return null
  if (!enabled) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-5xl mb-4">🧩</div>
      <h2 className="text-xl font-bold text-slate-700 mb-2">Module Disabled</h2>
      <p className="text-slate-500 text-sm max-w-sm">
        This module has been disabled for your account. Contact your administrator to enable it in <strong>Settings → Module Manager</strong>.
      </p>
    </div>
  )
  return children
}

export default function App() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('darkMode', darkMode)
  }, [darkMode])

  // Dynamic favicon & page title from lab settings/logo
  useEffect(() => {
    api.get('/settings').then(r => {
      const name = r.data.lab_name
      if (name) document.title = name
    }).catch(() => {})

    // Try to replace favicon with uploaded lab logo; keep SVG fallback if none
    const logoUrl = `/api/settings/logo?t=${Date.now()}`
    fetch(logoUrl).then(res => {
      if (res.ok) {
        const link = document.getElementById('favicon')
        if (link) {
          link.type = 'image/png'
          link.href = logoUrl
        }
      }
    }).catch(() => {})
  }, [])

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
      <div className={darkMode ? 'dark' : ''}>
        <Routes>
          <Route path="/landing" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/portal" element={<PatientPortal />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="patients" element={<Patients />} />
            <Route path="patients/new" element={<PatientRegister />} />
            <Route path="patients/:patientId" element={<PatientDetail />} />
            <Route path="samples" element={<Samples />} />
            <Route path="samples/new" element={<SampleRegister />} />
            <Route path="results/:sampleId" element={<Results />} />
            <Route path="report/:sampleId" element={<Report />} />
            <Route path="doctors" element={<Doctors />} />
            <Route path="verification" element={<Verification />} />
            <Route path="billing" element={<Billing />} />
            <Route path="daily-closing" element={<DailyClosing />} />
            <Route path="reports" element={<MISReports />} />
            <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
            <Route path="tests" element={<TestManagement />} />
            <Route path="packages" element={<TestPackages />} />
            <Route path="categories" element={<AdminRoute><Categories /></AdminRoute>} />
            <Route path="branches" element={<AdminRoute><Branches /></AdminRoute>} />
            <Route path="token-queue" element={<ModuleRoute moduleKey="token_queue"><TokenQueue /></ModuleRoute>} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="report-templates" element={<ReportTemplates />} />
            <Route path="manual-results/:sampleId" element={<ManualResults />} />
            <Route path="receipt/:invoiceId" element={<InvoiceReceipt />} />
            <Route path="export" element={<ModuleRoute moduleKey="export"><DataExport /></ModuleRoute>} />
            <Route path="referral" element={<ModuleRoute moduleKey="referral"><ReferralCommission /></ModuleRoute>} />
            <Route path="hr" element={<ModuleRoute moduleKey="hr"><HR /></ModuleRoute>} />
            <Route path="import" element={<DataImport />} />
            <Route path="guide" element={<UserGuide />} />
            <Route path="api-docs" element={<ApiDocs />} />
            <Route path="machine-test" element={<MachineTest />} />
            <Route path="audit-log" element={<AdminRoute><ModuleRoute moduleKey="audit_log"><AuditLog /></ModuleRoute></AdminRoute>} />
            <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
            <Route path="doctor-dashboard" element={<ModuleRoute moduleKey="doctor_dashboard"><DoctorDashboard /></ModuleRoute>} />
            <Route path="doctor-schedule" element={<DoctorSchedule />} />
            <Route path="prescriptions" element={<ModuleRoute moduleKey="prescriptions"><Prescriptions /></ModuleRoute>} />
            <Route path="system-flow" element={<SystemFlow />} />
            <Route path="opd" element={<ModuleRoute moduleKey="opd"><OPD /></ModuleRoute>} />
            <Route path="ipd" element={<ModuleRoute moduleKey="ipd"><IPD /></ModuleRoute>} />
            <Route path="wards" element={<ModuleRoute moduleKey="wards"><Wards /></ModuleRoute>} />
            <Route path="radiology" element={<ModuleRoute moduleKey="radiology"><Radiology /></ModuleRoute>} />
            <Route path="ot" element={<ModuleRoute moduleKey="ot"><OT /></ModuleRoute>} />
            <Route path="pharmacy-store" element={<ModuleRoute moduleKey="pharmacy"><PharmacyStore /></ModuleRoute>} />
            <Route path="insurance-claims" element={<ModuleRoute moduleKey="insurance"><InsuranceClaims /></ModuleRoute>} />
            <Route path="appointments" element={<ModuleRoute moduleKey="appointments"><Appointments /></ModuleRoute>} />
            <Route path="credit-accounts" element={<ModuleRoute moduleKey="credit"><CreditAccounts /></ModuleRoute>} />
            <Route path="patients/:patientId/statement" element={<PatientStatement />} />
            <Route path="result-trend" element={<ResultTrend />} />
            <Route path="shifts" element={<ShiftManagement />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="qa-checklist" element={<AdminRoute><QAChecklist /></AdminRoute>} />
          </Route>
        </Routes>
      </div>
    </ThemeContext.Provider>
  )
}
