import { useState, useEffect, useContext, useRef } from 'react'
import api from '../api'
import { ThemeContext } from '../App'
import ModalPortal from '../components/ModalPortal'

const MONTHS = ["", "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"]
const ROLES = { admin: '🔑', technician: '🔬', doctor: '🩺', receptionist: '📋' }

export default function HR() {
  const { darkMode } = useContext(ThemeContext)
  const [tab, setTab] = useState('staff')           // staff | advances | payroll | slip
  const now = new Date()
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [selYear, setSelYear] = useState(now.getFullYear())

  // Staff tab
  const [staff, setStaff] = useState([])
  const [staffLoading, setStaffLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  // Advances tab
  const [advances, setAdvances] = useState([])
  const [advLoading, setAdvLoading] = useState(false)
  const [advModal, setAdvModal] = useState(false)
  const [advForm, setAdvForm] = useState({ user_id: '', amount: '', reason: '', deduction_per_month: '', advance_date: now.toISOString().slice(0,10), deduct_month: selMonth, deduct_year: selYear })

  // Payroll tab
  const [payroll, setPayroll] = useState([])
  const [payLoading, setPayLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [payModal, setPayModal] = useState(null)     // { id, name, net }
  const [payMethod, setPayMethod] = useState('cash')

  // Salary slip
  const [slip, setSlip] = useState(null)
  const [slipLoading, setSlipLoading] = useState(false)
  const [slipPickStaff, setSlipPickStaff] = useState('')
  const [slipPickMonth, setSlipPickMonth] = useState(now.getMonth() + 1)
  const [slipPickYear, setSlipPickYear]   = useState(now.getFullYear())

  // ── Loaders ──────────────────────────────────────────────────────────────
  const loadStaff = async () => {
    setStaffLoading(true)
    try { const r = await api.get('/hr/staff'); setStaff(r.data) } catch {}
    setStaffLoading(false)
  }

  const loadAdvances = async () => {
    setAdvLoading(true)
    try { const r = await api.get('/hr/advances'); setAdvances(r.data) } catch {}
    setAdvLoading(false)
  }

  const loadPayroll = async () => {
    setPayLoading(true)
    try {
      const [pr, sm] = await Promise.all([
        api.get('/hr/payroll', { params: { month: selMonth, year: selYear } }),
        api.get('/hr/summary', { params: { month: selMonth, year: selYear } }),
      ])
      setPayroll(pr.data)
      setSummary(sm.data)
    } catch {}
    setPayLoading(false)
  }

  useEffect(() => {
    if (tab === 'staff') loadStaff()
    if (tab === 'advances') loadAdvances()
    if (tab === 'payroll') loadPayroll()
    // Pre-load staff list for the slip picker
    if (tab === 'slip' && staff.length === 0) loadStaff()
  }, [tab])

  useEffect(() => {
    if (tab === 'payroll') loadPayroll()
  }, [selMonth, selYear])

  // ── Staff save ────────────────────────────────────────────────────────────
  const saveProfile = async (userId) => {
    try {
      await api.put(`/hr/staff/${userId}/salary`, editForm)
      setEditingId(null)
      loadStaff()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save')
    }
  }

  // ── Advance create ────────────────────────────────────────────────────────
  const createAdvance = async () => {
    if (!advForm.user_id || !advForm.amount) return alert('Employee and amount required')
    try {
      await api.post('/hr/advances', {
        ...advForm,
        amount: parseFloat(advForm.amount),
        deduction_per_month: advForm.deduction_per_month ? parseFloat(advForm.deduction_per_month) : undefined,
      })
      setAdvModal(false)
      setAdvForm({ user_id: '', amount: '', reason: '', deduction_per_month: '', advance_date: now.toISOString().slice(0,10), deduct_month: selMonth, deduct_year: selYear })
      loadAdvances()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed')
    }
  }

  // ── Payroll generate ──────────────────────────────────────────────────────
  const generatePayroll = async () => {
    if (!confirm(`Generate payroll for ${MONTHS[selMonth]} ${selYear}?`)) return
    setGenerating(true)
    try {
      const r = await api.post('/hr/payroll/generate', { month: selMonth, year: selYear })
      alert(`${r.data.message}\nCreated: ${r.data.created} | Skipped (existing): ${r.data.skipped}`)
      loadPayroll()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to generate payroll')
    }
    setGenerating(false)
  }

  // ── Mark paid ─────────────────────────────────────────────────────────────
  const markPaid = async () => {
    try {
      await api.put(`/hr/payroll/${payModal.id}/pay`, { payment_method: payMethod })
      setPayModal(null)
      loadPayroll()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed')
    }
  }

  // ── Load slip by ID ───────────────────────────────────────────────────────
  const loadSlip = async (id) => {
    setSlipLoading(true)
    setSlip(null)
    setTab('slip')
    try { const r = await api.get(`/hr/payroll/${id}/slip`); setSlip(r.data) } catch {}
    setSlipLoading(false)
  }

  // ── Load slip via picker (staff + month + year) ───────────────────────────
  const loadSlipByPicker = async () => {
    if (!slipPickStaff) return alert('Please select an employee.')
    setSlipLoading(true)
    setSlip(null)
    try {
      // Fetch the payroll list for that month/year then find matching employee
      const r = await api.get('/hr/payroll', { params: { month: slipPickMonth, year: slipPickYear } })
      const record = r.data.find(p => String(p.user_id) === String(slipPickStaff))
      if (!record) {
        alert(`No payroll record found for ${MONTHS[slipPickMonth]} ${slipPickYear}. Please generate payroll first.`)
        setSlipLoading(false)
        return
      }
      const s = await api.get(`/hr/payroll/${record.id}/slip`)
      setSlip(s.data)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to load slip.')
    }
    setSlipLoading(false)
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const card = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
  const inp = `w-full px-2.5 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-700 border-slate-600' : 'border-slate-300'}`

  const tabs = [
    { id: 'staff',    label: '👥 Staff & Salary',   },
    { id: 'advances', label: '💸 Advances',          },
    { id: 'payroll',  label: '📋 Monthly Payroll',   },
    { id: 'slip',     label: '🖨️ Salary Slip',       },
  ]

  return (
    <div className="animate-fadeIn max-w-6xl mx-auto">
      {/* Header — hidden when printing */}
      <div className="mb-6 print:hidden">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">HR & Payroll</h2>
        <p className="text-sm text-slate-500 mt-1">Staff salaries, advances, monthly payroll & salary slips</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 flex-wrap print:hidden">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.id ? 'bg-blue-600 text-white shadow' : `${card} border text-slate-600 hover:bg-blue-50`
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          TAB: STAFF & SALARY
         ══════════════════════════════════════════════════════════ */}
      {tab === 'staff' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-slate-500">{staff.length} active employees — click Edit to set salary structure</p>
            <button onClick={loadStaff} className="text-xs text-blue-600 hover:underline">{staffLoading ? '⏳' : '↻ Refresh'}</button>
          </div>

          <div className="space-y-3">
            {staff.map(s => (
              <div key={s.user_id} className={`rounded-xl border shadow-sm overflow-x-auto ${card}`}>
                {/* Employee header */}
                <div className={`flex items-center justify-between px-4 py-3 ${darkMode ? 'bg-slate-750' : 'bg-slate-50'} border-b ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg ${darkMode ? 'bg-slate-600' : 'bg-white border border-slate-200'}`}>
                      {ROLES[s.role] || '👤'}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{s.full_name}</div>
                      <div className="text-xs text-slate-400">
                        @{s.username} · <span className="capitalize">{s.role}</span>
                        {s.designation && ` · ${s.designation}`}
                        {s.department && ` · ${s.department}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-slate-400">Net Salary</div>
                      <div className="font-bold text-green-600">Rs. {s.net_salary.toLocaleString()}</div>
                    </div>
                    {editingId === s.user_id ? (
                      <div className="flex gap-2">
                        <button onClick={() => saveProfile(s.user_id)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-xs hover:bg-slate-50">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(s.user_id); setEditForm({ ...s }) }}
                        className="px-3 py-1.5 border border-blue-300 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-50">
                        ✏️ Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Salary details */}
                {editingId === s.user_id ? (
                  // Edit mode
                  <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Designation', key: 'designation', type: 'text' },
                      { label: 'Department', key: 'department', type: 'text' },
                      { label: 'Join Date', key: 'join_date', type: 'date' },
                      { label: 'CNIC', key: 'cnic', type: 'text' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                        <input type={f.type} value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({...p, [f.key]: e.target.value}))} className={inp} />
                      </div>
                    ))}
                    <div className="col-span-2 md:col-span-4 border-t pt-3 mt-1">
                      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Earnings (Rs.)</p>
                    </div>
                    {[
                      { label: 'Basic Salary', key: 'basic_salary' },
                      { label: 'House Allowance', key: 'house_allowance' },
                      { label: 'Medical Allowance', key: 'medical_allowance' },
                      { label: 'Transport Allowance', key: 'transport_allowance' },
                      { label: 'Other Allowance', key: 'other_allowance' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                        <input type="number" min="0" value={editForm[f.key] || 0}
                          onChange={e => setEditForm(p => ({...p, [f.key]: parseFloat(e.target.value) || 0}))}
                          className={inp} />
                      </div>
                    ))}
                    <div className={`rounded-lg p-2.5 flex flex-col justify-center ${darkMode ? 'bg-green-900/30' : 'bg-green-50'}`}>
                      <div className="text-xs text-green-600">Gross</div>
                      <div className="font-bold text-green-700 text-sm">
                        Rs. {(
                          (parseFloat(editForm.basic_salary)||0) +
                          (parseFloat(editForm.house_allowance)||0) +
                          (parseFloat(editForm.medical_allowance)||0) +
                          (parseFloat(editForm.transport_allowance)||0) +
                          (parseFloat(editForm.other_allowance)||0)
                        ).toLocaleString()}
                      </div>
                    </div>
                    <div className="col-span-2 md:col-span-4 border-t pt-3 mt-1">
                      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Deductions (Rs.)</p>
                    </div>
                    {[
                      { label: 'Income Tax', key: 'tax_deduction' },
                      { label: 'Other Deduction', key: 'other_deduction' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                        <input type="number" min="0" value={editForm[f.key] || 0}
                          onChange={e => setEditForm(p => ({...p, [f.key]: parseFloat(e.target.value) || 0}))}
                          className={inp} />
                      </div>
                    ))}
                    <div className={`rounded-lg p-2.5 flex flex-col justify-center ${darkMode ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                      <div className="text-xs text-blue-600">Net Salary</div>
                      <div className="font-bold text-blue-700 text-sm">
                        Rs. {Math.max(0,
                          (parseFloat(editForm.basic_salary)||0) +
                          (parseFloat(editForm.house_allowance)||0) +
                          (parseFloat(editForm.medical_allowance)||0) +
                          (parseFloat(editForm.transport_allowance)||0) +
                          (parseFloat(editForm.other_allowance)||0) -
                          (parseFloat(editForm.tax_deduction)||0) -
                          (parseFloat(editForm.other_deduction)||0)
                        ).toLocaleString()}
                      </div>
                    </div>
                    <div className="col-span-2 md:col-span-4 border-t pt-3 mt-1">
                      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Bank Info</p>
                    </div>
                    {[
                      { label: 'Bank Name', key: 'bank_name' },
                      { label: 'Account Number', key: 'account_number' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                        <input type="text" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({...p, [f.key]: e.target.value}))} className={inp} />
                      </div>
                    ))}
                  </div>
                ) : (
                  // View mode
                  <div className="px-4 py-3 grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
                    {[
                      { label: 'Basic', value: s.basic_salary, color: 'text-slate-700' },
                      { label: 'House', value: s.house_allowance, color: 'text-slate-600' },
                      { label: 'Medical', value: s.medical_allowance, color: 'text-slate-600' },
                      { label: 'Transport', value: s.transport_allowance, color: 'text-slate-600' },
                      { label: 'Gross', value: s.gross_salary, color: 'text-green-600 font-bold' },
                      { label: 'Net Pay', value: s.net_salary, color: 'text-blue-600 font-bold' },
                    ].map(f => (
                      <div key={f.label} className={`rounded-lg p-2 ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                        <div className="text-[10px] text-slate-400 mb-0.5">{f.label}</div>
                        <div className={`text-xs ${f.color}`}>Rs. {f.value.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {!staffLoading && staff.length === 0 && (
              <div className={`rounded-xl border p-12 text-center ${card}`}>
                <div className="text-3xl mb-2">👥</div>
                <div className="text-slate-500">No active staff found</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: ADVANCES
         ══════════════════════════════════════════════════════════ */}
      {tab === 'advances' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-slate-500">{advances.length} advance records</p>
            <button onClick={() => setAdvModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
              + New Advance
            </button>
          </div>

          <div className={`rounded-xl border shadow-sm overflow-x-auto ${card}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-500'}`}>
                  <th className="text-left px-4 py-3">Employee</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Reason</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Deduct Month</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {advances.map(a => (
                  <tr key={a.id} className={darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3 font-medium">{a.employee_name}</td>
                    <td className="px-4 py-3 text-right font-bold text-orange-600">Rs. {a.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{a.reason || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{a.advance_date}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {a.deduct_month_name ? `${a.deduct_month_name} ${a.deduct_year}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.status === 'deducted' ? 'bg-green-100 text-green-700' :
                        a.status === 'cancelled' ? 'bg-slate-100 text-slate-500' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {a.status === 'approved' ? '⏳ Pending Deduction' : a.status === 'deducted' ? '✅ Deducted' : '❌ Cancelled'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.status === 'approved' && (
                        <button onClick={async () => {
                          if (!confirm('Cancel this advance?')) return
                          await api.put(`/hr/advances/${a.id}`, { status: 'cancelled' })
                          loadAdvances()
                        }} className="text-xs text-red-500 hover:underline">Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {advances.length === 0 && (
              <div className="p-12 text-center text-slate-400">
                <div className="text-3xl mb-2">💸</div>
                No advances recorded yet
              </div>
            )}
          </div>

          {/* Advance Modal */}
          {advModal && (
            <ModalPortal>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className={`rounded-2xl border shadow-2xl w-full max-w-md ${card}`}>
                <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">New Salary Advance</h3>
                  <button onClick={() => setAdvModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Employee *</label>
                    <select value={advForm.user_id} onChange={e => setAdvForm(p => ({...p, user_id: e.target.value}))} className={inp}>
                      <option value="">Select employee...</option>
                      {staff.map(s => <option key={s.user_id} value={s.user_id}>{s.full_name} ({s.role})</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Amount (Rs.) *</label>
                      <input type="number" min="0" value={advForm.amount} onChange={e => setAdvForm(p => ({...p, amount: e.target.value}))} className={inp} placeholder="5000" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Advance Date</label>
                      <input type="date" value={advForm.advance_date} onChange={e => setAdvForm(p => ({...p, advance_date: e.target.value}))} className={inp} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
                    <input value={advForm.reason} onChange={e => setAdvForm(p => ({...p, reason: e.target.value}))} className={inp} placeholder="Medical emergency, personal need..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Monthly Deduction Amount (Rs.) <span className="text-slate-400 font-normal">— leave blank to deduct full amount</span></label>
                    <input type="number" min="0" value={advForm.deduction_per_month} onChange={e => setAdvForm(p => ({...p, deduction_per_month: e.target.value}))} className={inp} placeholder="e.g., 1000" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Deduct Month</label>
                      <select value={advForm.deduct_month} onChange={e => setAdvForm(p => ({...p, deduct_month: parseInt(e.target.value)}))} className={inp}>
                        {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Deduct Year</label>
                      <input type="number" value={advForm.deduct_year} onChange={e => setAdvForm(p => ({...p, deduct_year: parseInt(e.target.value)}))} className={inp} />
                    </div>
                  </div>
                </div>
                <div className="p-5 pt-0 flex gap-3 justify-end">
                  <button onClick={() => setAdvModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancel</button>
                  <button onClick={createAdvance} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Record Advance</button>
                </div>
              </div>
            </div>
            </ModalPortal>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: MONTHLY PAYROLL
         ══════════════════════════════════════════════════════════ */}
      {tab === 'payroll' && (
        <div>
          {/* Month/Year picker + Generate */}
          <div className={`rounded-xl border p-4 mb-5 flex flex-wrap gap-4 items-end ${card} shadow-sm`}>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
              <select value={selMonth} onChange={e => setSelMonth(parseInt(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
              <input type="number" value={selYear} onChange={e => setSelYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-24 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <button onClick={generatePayroll} disabled={generating}
              className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {generating ? '⏳ Generating...' : '⚡ Generate Payroll'}
            </button>
            <button onClick={loadPayroll} className="text-xs text-blue-600 hover:underline ml-auto">↻ Refresh</button>
          </div>

          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { label: 'Total Staff', value: summary.total_staff, icon: '👥', col: 'text-blue-600' },
                { label: 'Payroll Generated', value: summary.payroll_generated, icon: '📋', col: 'text-purple-600' },
                { label: 'Total Gross', value: `Rs. ${summary.total_gross_payroll.toLocaleString()}`, icon: '💰', col: 'text-green-600' },
                { label: 'Total Net Payout', value: `Rs. ${summary.total_net_payroll.toLocaleString()}`, icon: '💵', col: 'text-orange-600' },
              ].map((s, i) => (
                <div key={i} className={`rounded-xl border p-4 shadow-sm ${card}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{s.icon}</span>
                    <span className="text-xs text-slate-500">{s.label}</span>
                  </div>
                  <div className={`text-xl font-extrabold ${s.col}`}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Payroll table */}
          {payroll.length === 0 ? (
            <div className={`rounded-xl border p-12 text-center ${card}`}>
              <div className="text-4xl mb-3">📋</div>
              <div className="font-semibold text-slate-600">No payroll records for {MONTHS[selMonth]} {selYear}</div>
              <div className="text-sm text-slate-400 mt-1">Click "Generate Payroll" to create records for all active staff</div>
            </div>
          ) : (
            <div className={`rounded-xl border shadow-sm overflow-x-auto ${card}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-500'}`}>
                    <th className="text-left px-4 py-3">Employee</th>
                    <th className="text-right px-4 py-3">Gross</th>
                    <th className="text-right px-4 py-3">Deductions</th>
                    <th className="text-right px-4 py-3">Net Pay</th>
                    <th className="text-center px-4 py-3">Days</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payroll.map(p => (
                    <tr key={p.id} className={darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.employee_name}</div>
                        <div className="text-xs text-slate-400 capitalize">{p.role}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">Rs. {p.gross_salary.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-red-500">
                        {p.total_deductions > 0 ? `- Rs. ${p.total_deductions.toLocaleString()}` : '—'}
                        {p.advance_deducted > 0 && (
                          <div className="text-[10px] text-orange-500">Advance: Rs. {p.advance_deducted.toLocaleString()}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">Rs. {p.net_salary.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500">
                        {p.present_days}/{p.working_days}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {p.status === 'paid' ? `✅ Paid ${p.payment_method}` : '⏳ Pending'}
                        </span>
                        {p.paid_at && <div className="text-[10px] text-slate-400 mt-0.5">{p.paid_at}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => loadSlip(p.id)}
                            className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                            🖨️ Slip
                          </button>
                          {p.status !== 'paid' && (
                            <button onClick={() => setPayModal({ id: p.id, name: p.employee_name, net: p.net_salary })}
                              className="text-xs text-green-600 hover:underline whitespace-nowrap">
                              ✓ Pay
                            </button>
                          )}
                          {p.status !== 'paid' && (
                            <button onClick={async () => {
                              if (!confirm('Delete this payroll record?')) return
                              await api.delete(`/hr/payroll/${p.id}`)
                              loadPayroll()
                            }} className="text-xs text-red-400 hover:underline">🗑</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pay confirmation modal */}
          {payModal && (
            <ModalPortal>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className={`rounded-2xl border shadow-2xl w-full max-w-sm ${card}`}>
                <div className="p-5">
                  <h3 className="font-bold text-slate-800 mb-1">Mark Salary as Paid</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    <strong>{payModal.name}</strong> — Rs. {payModal.net.toLocaleString()}
                  </p>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inp}>
                      <option value="cash">💵 Cash</option>
                      <option value="bank">🏦 Bank Transfer</option>
                      <option value="cheque">📝 Cheque</option>
                    </select>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setPayModal(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancel</button>
                    <button onClick={markPaid} className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                      ✅ Confirm Paid
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </ModalPortal>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: SALARY SLIP (printable)
         ══════════════════════════════════════════════════════════ */}
      {tab === 'slip' && (
        <div>
          {/* ── Slip picker ──────────────────────────────────────── */}
          <div className={`rounded-xl border shadow-sm p-4 mb-5 print:hidden flex flex-wrap gap-3 items-end ${card}`}>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Employee</label>
              <select value={slipPickStaff} onChange={e => setSlipPickStaff(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[180px]">
                <option value="">Select employee...</option>
                {staff.map(s => (
                  <option key={s.user_id} value={s.user_id}>{s.full_name} ({s.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
              <select value={slipPickMonth} onChange={e => setSlipPickMonth(parseInt(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
              <input type="number" value={slipPickYear} onChange={e => setSlipPickYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-24 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <button onClick={loadSlipByPicker} disabled={slipLoading}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {slipLoading ? '⏳ Loading...' : '🔍 Fetch Slip'}
            </button>
            {slip && (
              <button onClick={() => setSlip(null)}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
                Clear
              </button>
            )}
          </div>

          {slipLoading && (
            <div className="text-center py-20 text-slate-500">Loading salary slip...</div>
          )}
          {!slipLoading && !slip && (
            <div className={`rounded-xl border p-12 text-center ${card}`}>
              <div className="text-4xl mb-3">🖨️</div>
              <div className="font-semibold text-slate-600">No slip selected</div>
              <div className="text-sm text-slate-400 mt-1">
                Use the picker above, or go to <strong>Monthly Payroll</strong> and click 🖨️ Slip on any row.
              </div>
              <button onClick={() => setTab('payroll')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                Go to Payroll
              </button>
            </div>
          )}

          {slip && (
            <div className="print:block">
              <div className="flex gap-3 mb-6 print:hidden">
                <button onClick={() => window.print()}
                  className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 flex items-center gap-2">
                  🖨️ Print Slip
                </button>
                <button onClick={() => setTab('payroll')}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600">
                  ← Back to Payroll
                </button>
                <span className={`ml-auto px-3 py-1.5 rounded-full text-xs font-bold ${
                  slip.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {slip.status === 'paid' ? '✅ PAID' : '⏳ PENDING'}
                </span>
              </div>

              {/* Slip document — full page when printing */}
              <style>{`
                @media print {
                  @page { size: A4 portrait; margin: 12mm; }
                  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
              `}</style>
              <div className="bg-white text-slate-800 rounded-xl shadow border border-slate-200 max-w-2xl mx-auto p-8 print:shadow-none print:rounded-none print:border-none print:max-w-full print:p-6 print:m-0">
                {/* Header */}
                <div className="text-center border-b-2 border-blue-800 pb-4 mb-5">
                  <h1 className="text-xl font-bold text-blue-800">{slip.lab.name}</h1>
                  <p className="text-xs text-slate-500">{slip.lab.address} | {slip.lab.phone}</p>
                  <div className="mt-2 inline-block bg-blue-800 text-white px-4 py-1 rounded text-sm font-bold tracking-wide">
                    SALARY SLIP — {slip.month_label.toUpperCase()}
                  </div>
                </div>

                {/* Employee Info */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-5 text-sm border rounded-lg p-4 bg-slate-50">
                  <div><span className="text-slate-500">Employee Name:</span> <strong>{slip.employee.full_name}</strong></div>
                  <div><span className="text-slate-500">Designation:</span> <strong>{slip.employee.designation || slip.employee.role}</strong></div>
                  <div><span className="text-slate-500">Department:</span> <strong>{slip.employee.department || '—'}</strong></div>
                  <div><span className="text-slate-500">Join Date:</span> <strong>{slip.employee.join_date || '—'}</strong></div>
                  <div><span className="text-slate-500">CNIC:</span> <strong>{slip.employee.cnic || '—'}</strong></div>
                  <div><span className="text-slate-500">Bank / Account:</span> <strong>{slip.employee.bank_name ? `${slip.employee.bank_name} — ${slip.employee.account_number}` : '—'}</strong></div>
                  <div><span className="text-slate-500">Working Days:</span> <strong>{slip.working_days}</strong></div>
                  <div><span className="text-slate-500">Present Days:</span> <strong>{slip.present_days}</strong></div>
                </div>

                {/* Earnings + Deductions side by side */}
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div>
                    <div className="bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-t">EARNINGS</div>
                    <table className="w-full text-sm border border-t-0 rounded-b overflow-hidden">
                      <tbody>
                        {[
                          ['Basic Salary', slip.earnings.basic_salary],
                          ['House Allowance', slip.earnings.house_allowance],
                          ['Medical Allowance', slip.earnings.medical_allowance],
                          ['Transport Allowance', slip.earnings.transport_allowance],
                          ['Other Allowance', slip.earnings.other_allowance],
                        ].filter(r => r[1] > 0).map(([label, val], i) => (
                          <tr key={label} className={i % 2 === 0 ? 'bg-green-50' : ''}>
                            <td className="px-3 py-1.5 text-slate-600">{label}</td>
                            <td className="px-3 py-1.5 text-right font-medium">Rs. {val.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="bg-green-100 font-bold border-t">
                          <td className="px-3 py-2 text-green-800">Gross Salary</td>
                          <td className="px-3 py-2 text-right text-green-800">Rs. {slip.earnings.gross_salary.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <div className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-t">DEDUCTIONS</div>
                    <table className="w-full text-sm border border-t-0 rounded-b overflow-hidden">
                      <tbody>
                        {[
                          ['Advance Deducted', slip.deductions.advance_deducted],
                          ['Income Tax', slip.deductions.tax_deduction],
                          ['Other Deduction', slip.deductions.other_deduction],
                        ].filter(r => r[1] > 0).map(([label, val], i) => (
                          <tr key={label} className={i % 2 === 0 ? 'bg-red-50' : ''}>
                            <td className="px-3 py-1.5 text-slate-600">{label}</td>
                            <td className="px-3 py-1.5 text-right font-medium text-red-600">- Rs. {val.toLocaleString()}</td>
                          </tr>
                        ))}
                        {slip.deductions.total_deductions === 0 && (
                          <tr><td colSpan={2} className="px-3 py-4 text-center text-slate-400 text-xs">No deductions</td></tr>
                        )}
                        <tr className="bg-red-100 font-bold border-t">
                          <td className="px-3 py-2 text-red-800">Total Deductions</td>
                          <td className="px-3 py-2 text-right text-red-800">Rs. {slip.deductions.total_deductions.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Net Pay */}
                <div className="bg-blue-800 text-white rounded-xl p-4 flex justify-between items-center mb-6">
                  <div>
                    <div className="text-xs opacity-70 font-medium uppercase tracking-wide">Net Salary Payable</div>
                    <div className="text-2xl font-extrabold mt-0.5">Rs. {slip.net_salary.toLocaleString()}</div>
                  </div>
                  <div className="text-right text-xs opacity-70">
                    <div>{MONTHS[slip.month]} {slip.year}</div>
                    {slip.paid_at && <div>Paid: {slip.paid_at}</div>}
                    {slip.payment_method && <div className="capitalize">{slip.payment_method}</div>}
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-3 gap-4 text-center text-xs text-slate-500 pt-4 border-t">
                  <div>
                    <div className="h-10 border-b border-slate-300 mb-1"></div>
                    <div>Employee Signature</div>
                  </div>
                  <div>
                    <div className="h-10 border-b border-slate-300 mb-1"></div>
                    <div>Accounts Officer</div>
                  </div>
                  <div>
                    <div className="h-10 border-b border-slate-300 mb-1"></div>
                    <div>Authorized Signatory</div>
                  </div>
                </div>
                <p className="text-center text-[10px] text-slate-400 mt-4">
                  This is a computer-generated salary slip. No signature required if printed.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
