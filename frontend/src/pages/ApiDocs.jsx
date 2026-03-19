import { useState } from 'react'

export default function ApiDocs() {
  const [activeSection, setActiveSection] = useState('overview')

  const endpoints = [
    {
      category: 'Authentication',
      color: 'blue',
      apis: [
        { method: 'POST', path: '/api/auth/login', desc: 'Staff login — returns JWT token', body: '{ username, password }', auth: false },
        { method: 'POST', path: '/api/auth/signup', desc: 'Register new user (inactive until admin enables)', body: '{ username, password, full_name, role }', auth: false },
        { method: 'POST', path: '/api/portal/login', desc: 'Patient portal login', body: '{ mrn, phone }', auth: false },
      ],
    },
    {
      category: 'Patients',
      color: 'green',
      apis: [
        { method: 'GET', path: '/api/patients', desc: 'List all patients (searchable)', body: '?search=ahmed', auth: true },
        { method: 'POST', path: '/api/patients', desc: 'Register new patient', body: '{ mrn, first_name, last_name, gender, dob, phone }', auth: true },
        { method: 'GET', path: '/api/patients/{id}', desc: 'Get patient details', auth: true },
        { method: 'PUT', path: '/api/patients/{id}', desc: 'Update patient info', auth: true },
        { method: 'GET', path: '/api/patients/{id}/samples', desc: 'Get all samples for a patient', auth: true },
      ],
    },
    {
      category: 'Samples & Results',
      color: 'purple',
      apis: [
        { method: 'POST', path: '/api/samples', desc: 'Create new sample', body: '{ sample_id, patient_id, doctor_id, test_panel }', auth: true },
        { method: 'GET', path: '/api/samples', desc: 'List all samples', body: '?status=pending', auth: true },
        { method: 'PUT', path: '/api/samples/{id}/status', desc: 'Update sample status', body: '{ status: "completed" }', auth: true },
        { method: 'POST', path: '/api/results', desc: 'Receive results from machine (HL7 parsed)', body: '{ sample_id, results: [...] }', auth: false },
        { method: 'GET', path: '/api/samples/{id}/results', desc: 'Get results for a sample', auth: true },
        { method: 'PUT', path: '/api/samples/{id}/verify', desc: 'Verify/approve results', auth: true },
      ],
    },
    {
      category: 'Reports',
      color: 'amber',
      apis: [
        { method: 'GET', path: '/api/samples/{id}/report', desc: 'Get report data (JSON)', auth: true },
        { method: 'GET', path: '/api/samples/{id}/report/pdf', desc: 'Download PDF report', auth: true },
        { method: 'GET', path: '/api/samples/{id}/barcode', desc: 'Download barcode label PDF', auth: true },
        { method: 'POST', path: '/api/samples/{id}/whatsapp', desc: 'Send report via WhatsApp', body: '{ phone }', auth: true },
        { method: 'POST', path: '/api/samples/{id}/email', desc: 'Email report as PDF', body: '{ email }', auth: true },
      ],
    },
    {
      category: 'Billing',
      color: 'emerald',
      apis: [
        { method: 'POST', path: '/api/billing/invoices', desc: 'Create invoice', body: '{ patient_id, tests, total_amount, payment_method }', auth: true },
        { method: 'GET', path: '/api/billing/invoices', desc: 'List all invoices', auth: true },
        { method: 'GET', path: '/api/billing/invoices/{id}/receipt', desc: 'Get receipt data for printing', auth: true },
      ],
    },
    {
      category: 'Dashboard & Reports',
      color: 'cyan',
      apis: [
        { method: 'GET', path: '/api/dashboard', desc: 'Dashboard statistics', auth: true },
        { method: 'GET', path: '/api/reports/mis', desc: 'MIS analytics', body: '?range=today|week|month', auth: true },
        { method: 'GET', path: '/api/reports/daily-closing', desc: 'Daily cash closing report', body: '?report_date=2026-03-20', auth: true },
        { method: 'GET', path: '/api/notifications', desc: 'Get alerts (critical results, pending, low stock)', auth: true },
      ],
    },
    {
      category: 'Data Import/Export',
      color: 'orange',
      apis: [
        { method: 'POST', path: '/api/import/patients', desc: 'Import patients from CSV', body: 'multipart/form-data (file)', auth: true },
        { method: 'POST', path: '/api/import/doctors', desc: 'Import doctors from CSV', body: 'multipart/form-data (file)', auth: true },
        { method: 'GET', path: '/api/export/patients', desc: 'Export patients as CSV', auth: true },
        { method: 'GET', path: '/api/export/results', desc: 'Export results as CSV', auth: true },
        { method: 'GET', path: '/api/export/invoices', desc: 'Export invoices as CSV', auth: true },
      ],
    },
  ]

  const methodColors = {
    GET: 'bg-green-600', POST: 'bg-blue-600', PUT: 'bg-amber-600', DELETE: 'bg-red-600',
  }

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">API Documentation</h2>
        <p className="text-sm text-slate-500 mt-1">REST API endpoints for external system integration</p>
      </div>

      {/* Quick Start */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
        <h3 className="font-bold text-slate-800 mb-4">Quick Start — How to Integrate</h3>
        <div className="space-y-3 text-sm">
          <div className="p-3 bg-slate-50 rounded-lg font-mono text-xs">
            <p className="text-slate-500 mb-1"># Step 1: Get auth token</p>
            <p>POST /api/auth/login</p>
            <p className="text-green-600">Body: {"{"} "username": "admin", "password": "admin123" {"}"}</p>
            <p className="text-blue-600 mt-1">Response: {"{"} "access_token": "eyJhb..." {"}"}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg font-mono text-xs">
            <p className="text-slate-500 mb-1"># Step 2: Use token in all requests</p>
            <p>GET /api/patients</p>
            <p className="text-amber-600">Header: Authorization: Bearer eyJhb...</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg font-mono text-xs">
            <p className="text-slate-500 mb-1"># Step 3: Create patient from your HMS</p>
            <p>POST /api/patients</p>
            <p className="text-green-600">Body: {"{"} "mrn": "PAT001", "first_name": "Ahmed", "last_name": "Khan", "gender": "M", "phone": "0300-1234567" {"}"}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-4">Base URL: <code>http://your-server:8000</code> | All responses are JSON | All dates in ISO format</p>
      </div>

      {/* Integration Diagram */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
        <h3 className="font-bold text-slate-800 mb-4">Integration Architecture</h3>
        <div className="bg-slate-50 rounded-xl p-6 text-center font-mono text-xs">
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="p-4 bg-blue-100 rounded-xl">
              <div className="text-2xl mb-2">🏥</div>
              <div className="font-bold text-blue-800">Hospital HMS</div>
              <div className="text-blue-600 mt-1">Patient Registration</div>
              <div className="text-blue-600">Doctor Orders</div>
            </div>
            <div>
              <div className="text-2xl mb-2">↔️</div>
              <div className="font-bold text-slate-600">REST API</div>
              <div className="text-slate-500 text-[10px]">JSON over HTTP</div>
              <div className="text-slate-500 text-[10px]">JWT Authentication</div>
            </div>
            <div className="p-4 bg-green-100 rounded-xl">
              <div className="text-2xl mb-2">🧬</div>
              <div className="font-bold text-green-800">LIS System</div>
              <div className="text-green-600 mt-1">Results & Reports</div>
              <div className="text-green-600">Machine Interface</div>
            </div>
          </div>
          <div className="mt-4 text-slate-500">
            HMS sends patient → LIS processes sample → LIS returns results to HMS
          </div>
        </div>
      </div>

      {/* API Endpoints */}
      <div className="space-y-6 animate-stagger">
        {endpoints.map((section, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-slate-50">
              <h3 className="font-bold text-slate-800">{section.category}</h3>
            </div>
            <div className="divide-y">
              {section.apis.map((api, j) => (
                <div key={j} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${methodColors[api.method]}`}>
                      {api.method}
                    </span>
                    <code className="text-sm font-mono text-blue-600">{api.path}</code>
                    {api.auth && <span className="text-xs text-amber-600">🔒 Auth Required</span>}
                  </div>
                  <p className="text-sm text-slate-600 ml-16">{api.desc}</p>
                  {api.body && <p className="text-xs text-slate-400 ml-16 mt-1 font-mono">{api.body}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Webhook Info */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mt-6">
        <h3 className="font-bold text-slate-800 mb-3">For Hospital IT Teams</h3>
        <div className="text-sm text-slate-600 space-y-2">
          <p><strong>Authentication:</strong> JWT Bearer token in Authorization header</p>
          <p><strong>Content-Type:</strong> application/json (except file uploads which use multipart/form-data)</p>
          <p><strong>Error format:</strong> {"{"} "detail": "Error message" {"}"} with appropriate HTTP status codes</p>
          <p><strong>Pagination:</strong> Use ?skip=0&limit=50 on list endpoints</p>
          <p><strong>Search:</strong> Use ?search=keyword on patient list</p>
          <p><strong>Interactive docs:</strong> Visit <code>/docs</code> for auto-generated Swagger UI</p>
        </div>
      </div>
    </div>
  )
}
