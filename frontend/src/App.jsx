import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext } from 'react'
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

export const ThemeContext = createContext()

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('darkMode', darkMode)
  }, [darkMode])

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
            <Route path="users" element={<Users />} />
            <Route path="tests" element={<TestManagement />} />
            <Route path="packages" element={<TestPackages />} />
            <Route path="categories" element={<Categories />} />
            <Route path="branches" element={<Branches />} />
            <Route path="token-queue" element={<TokenQueue />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="report-templates" element={<ReportTemplates />} />
            <Route path="manual-results/:sampleId" element={<ManualResults />} />
            <Route path="receipt/:invoiceId" element={<InvoiceReceipt />} />
            <Route path="export" element={<DataExport />} />
            <Route path="import" element={<DataImport />} />
            <Route path="guide" element={<UserGuide />} />
            <Route path="api-docs" element={<ApiDocs />} />
            <Route path="machine-test" element={<MachineTest />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </div>
    </ThemeContext.Provider>
  )
}
