import { useState, useEffect } from 'react'
import api from '../api'

export default function ReportTemplates() {
  const [templates, setTemplates] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({
    name: '', test_panel: '', header_text: '', footer_text: '', notes_text: '',
    show_qr: true, show_signature: true, is_default: false,
  })

  useEffect(() => { fetchTemplates() }, [])

  const fetchTemplates = async () => {
    try { const r = await api.get('/report-templates'); setTemplates(r.data) } catch(e) {}
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editId) {
        await api.put(`/report-templates/${editId}`, form)
      } else {
        await api.post('/report-templates', form)
      }
      resetForm(); fetchTemplates()
    } catch(err) { alert(err.response?.data?.detail || 'Failed') }
  }

  const resetForm = () => {
    setForm({ name: '', test_panel: '', header_text: '', footer_text: '', notes_text: '', show_qr: true, show_signature: true, is_default: false })
    setEditId(null); setShowForm(false)
  }

  const editTemplate = (t) => {
    setForm(t); setEditId(t.id); setShowForm(true)
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Report Templates</h2>
          <p className="text-sm text-slate-500">Customize PDF report layouts per test panel</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          {showForm ? 'Cancel' : '+ New Template'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6 mb-6 animate-slideDown">
          {/* Variable cheatsheet */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
            <p className="text-xs font-bold text-blue-700 mb-2">📌 Available Variables — use in Header, Notes, Footer text:</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                '{{patient_name}}','{{patient_age}}','{{patient_gender}}','{{patient_mrn}}','{{patient_phone}}',
                '{{sample_id}}','{{test_panel}}','{{doctor_name}}',
                '{{lab_name}}','{{lab_phone}}','{{lab_address}}',
                '{{date}}','{{time}}',
              ].map(v => (
                <code key={v} onClick={() => navigator.clipboard?.writeText(v)}
                  className="px-2 py-0.5 bg-white border border-blue-200 rounded text-xs text-blue-700 cursor-pointer hover:bg-blue-100 select-all" title="Click to copy">
                  {v}
                </code>
              ))}
            </div>
            <p className="text-[10px] text-blue-500 mt-2">Click any variable to copy. Variables are replaced with real patient/lab data in the PDF.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Template Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                placeholder="e.g., CBC Report Template"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Test Panel (auto-apply)</label>
              <input value={form.test_panel} onChange={e => setForm({...form, test_panel: e.target.value})}
                placeholder="e.g., CBC, LFT, Thyroid Profile"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-slate-400 mt-1">Leave empty for default template</p>
            </div>
          </div>
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Header Text (below lab name)</label>
              <textarea value={form.header_text} onChange={e => setForm({...form, header_text: e.target.value})} rows="2"
                placeholder="e.g., Department of Hematology | PMDC Reg# 12345"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Clinical Notes (after results)</label>
              <textarea value={form.notes_text} onChange={e => setForm({...form, notes_text: e.target.value})} rows="2"
                placeholder="e.g., Note: Fasting sample required for accurate results"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Footer Text</label>
              <textarea value={form.footer_text} onChange={e => setForm({...form, footer_text: e.target.value})} rows="2"
                placeholder="e.g., Please consult your physician for interpretation"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-6 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.show_qr} onChange={e => setForm({...form, show_qr: e.target.checked})} className="rounded" />
              <span className="text-sm">Show QR Code</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.show_signature} onChange={e => setForm({...form, show_signature: e.target.checked})} className="rounded" />
              <span className="text-sm">Show Signature</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_default} onChange={e => setForm({...form, is_default: e.target.checked})} className="rounded" />
              <span className="text-sm">Set as Default</span>
            </label>
          </div>
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {editId ? 'Update Template' : 'Create Template'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-stagger">
        {templates.map(t => (
          <div key={t.id} className="bg-white rounded-2xl shadow-sm border p-5 card-animate">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-slate-800">{t.name}</h3>
                {t.test_panel && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{t.test_panel}</span>}
                {t.is_default && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded ml-1">Default</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => editTemplate(t)} className="text-xs text-blue-600 hover:underline">Edit</button>
                <button onClick={async () => { await api.delete(`/report-templates/${t.id}`); fetchTemplates() }}
                  className="text-xs text-red-600 hover:underline">Delete</button>
              </div>
            </div>
            {t.header_text && <p className="text-xs text-slate-500 mb-1"><strong>Header:</strong> {t.header_text}</p>}
            {t.notes_text && <p className="text-xs text-slate-500 mb-1"><strong>Notes:</strong> {t.notes_text}</p>}
            {t.footer_text && <p className="text-xs text-slate-500 mb-1"><strong>Footer:</strong> {t.footer_text}</p>}
            <div className="flex gap-4 mt-3 text-xs text-slate-400">
              <span>{t.show_qr ? 'QR Code' : 'No QR'}</span>
              <span>{t.show_signature ? 'Signature' : 'No Signature'}</span>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="col-span-2 text-center py-12 text-slate-400">No templates yet. Create one to customize report layouts.</div>
        )}
      </div>
    </div>
  )
}
