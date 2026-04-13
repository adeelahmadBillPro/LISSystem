import { useState, useEffect, useContext } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../api'
import { ThemeContext } from '../App'

const PAYMENT_ICONS = { cash: '💵', card: '💳', online: '📲', insurance: '🏥', credit: '📒' }

export default function Billing() {
  const { darkMode } = useContext(ThemeContext)
  const location = useLocation()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [patients, setPatients] = useState([])
  const [packages, setPackages] = useState([])
  const [testPrices, setTestPrices] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [patSearch, setPatSearch] = useState('')
  const [testSearch, setTestSearch] = useState('')
  const [testTab, setTestTab] = useState('tests')   // tests | packages
  const [invSearch, setInvSearch] = useState('')
  const [invMethod, setInvMethod] = useState('')
  const [invDateFrom, setInvDateFrom] = useState('')
  const [invDateTo, setInvDateTo] = useState('')
  const [creditAccounts, setCreditAccounts] = useState([])

  const [form, setForm] = useState({
    patient_id: '', patient_name: '',
    tests: [],
    discount: 0,
    payment_method: 'cash',
    insurance_company: '', insurance_policy: '', tpa_name: '',
    credit_account_id: '',
    notes: '',
  })

  const defaultTests = [
    { code: 'CBC', name: 'Complete Blood Count', price: 800 },
    { code: 'LFT', name: 'Liver Function Test', price: 1500 },
    { code: 'RFT', name: 'Renal Function Test', price: 1200 },
    { code: 'LIPID', name: 'Lipid Profile', price: 1800 },
    { code: 'THYROID', name: 'Thyroid Profile', price: 2500 },
    { code: 'HBA1C', name: 'HbA1c', price: 1200 },
    { code: 'GLU_F', name: 'Glucose Fasting', price: 300 },
    { code: 'GLU_R', name: 'Glucose Random', price: 300 },
    { code: 'URINE', name: 'Urine R/E', price: 400 },
    { code: 'ESR', name: 'ESR', price: 300 },
  ]

  // Pre-fill from IPD discharge navigation state
  const ipdState = location.state
  const [ipdBanner, setIpdBanner] = useState(!!ipdState?.ipd_admission_id)
  useEffect(() => {
    if (ipdState?.ipd_admission_id && ipdState?.patient_id) {
      setForm(f => ({
        ...f,
        patient_id: ipdState.patient_id,
        patient_name: `${ipdState.patient_name || ''} (${ipdState.admission_number || ''})`,
        notes: [
          `IPD Admission: ${ipdState.admission_number || ''}`,
          ipdState.ward_name ? `Ward: ${ipdState.ward_name}` : '',
          ipdState.bed_number ? `Bed: ${ipdState.bed_number}` : '',
          ipdState.doctor_name ? `Dr: ${ipdState.doctor_name}` : '',
          ipdState.admission_date ? `Admitted: ${ipdState.admission_date}` : '',
          ipdState.discharge_date ? `Discharged: ${ipdState.discharge_date}` : '',
        ].filter(Boolean).join(' | '),
      }))
      setShowForm(true)
    }
  }, [])

  useEffect(() => {
    fetchInvoices()
    api.get('/patients').then(r => setPatients(r.data)).catch(() => {})
    api.get('/tests').then(r => {
      const dbTests = r.data.map(t => ({ code: t.test_code, name: t.test_name, price: parseFloat(t.price) }))
      setTestPrices(dbTests.length > 0 ? dbTests : defaultTests)
    }).catch(() => setTestPrices(defaultTests))
    api.get('/packages').then(r => setPackages(r.data)).catch(() => {})
    api.get('/credit-accounts').then(r => setCreditAccounts(r.data)).catch(() => {})
  }, [])

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/billing/invoices')
      setInvoices(res.data)
    } catch {}
    finally { setLoading(false) }
  }

  const toggleTest = (test) => {
    const exists = form.tests.find(t => t.code === test.code)
    if (exists) setForm({ ...form, tests: form.tests.filter(t => t.code !== test.code) })
    else setForm({ ...form, tests: [...form.tests, test] })
  }

  const addPackage = (pkg) => {
    const pkgTests = pkg.items?.map(i => ({ code: i.test_code, name: i.test_name, price: 0 })) || []
    const discountedTest = { code: `PKG-${pkg.id}`, name: pkg.name, price: parseFloat(pkg.price) }
    if (form.tests.find(t => t.code === discountedTest.code)) {
      setForm({ ...form, tests: form.tests.filter(t => t.code !== discountedTest.code) })
    } else {
      setForm({ ...form, tests: [...form.tests.filter(t => !pkgTests.find(p => p.code === t.code)), discountedTest] })
    }
  }

  const selectPatient = (p) => {
    setForm({ ...form, patient_id: p.id, patient_name: `${p.mrn} — ${p.full_name}` })
    setPatSearch('')
  }

  const subtotal = form.tests.reduce((sum, t) => sum + t.price, 0)
  const discountAmt = Math.round(subtotal * (form.discount / 100))
  const total = subtotal - discountAmt

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.patient_id) { setError('Select a patient'); return }
    if (form.tests.length === 0) { setError('Select at least one test'); return }
    setSubmitting(true)
    try {
      const payload = {
        patient_id: parseInt(form.patient_id),
        tests: form.tests.map(t => ({ test_code: t.code, test_name: t.name, price: t.price })),
        discount_percent: form.discount,
        total_amount: total,
        payment_method: form.payment_method,
        insurance_company: form.payment_method === 'insurance' ? form.insurance_company : undefined,
        insurance_policy: form.payment_method === 'insurance' ? form.insurance_policy : undefined,
        tpa_name: form.payment_method === 'insurance' ? form.tpa_name : undefined,
        credit_account_id: form.payment_method === 'credit' && form.credit_account_id ? parseInt(form.credit_account_id) : undefined,
        notes: [
          form.notes,
          form.payment_method === 'insurance' && form.insurance_company ? `Insurance: ${form.insurance_company}` : '',
          form.payment_method === 'insurance' && form.insurance_policy ? `Policy: ${form.insurance_policy}` : '',
          form.payment_method === 'insurance' && form.tpa_name ? `TPA: ${form.tpa_name}` : '',
        ].filter(Boolean).join(' | '),
      }
      const res = await api.post('/billing/invoices', payload)
      setSuccess(`Invoice created! #INV-${String(res.data?.invoice_id || '').padStart(5, '0')}`)
      setForm({ patient_id: '', patient_name: '', tests: [], discount: 0, payment_method: 'cash', insurance_company: '', insurance_policy: '', tpa_name: '', credit_account_id: '', notes: '' })
      setShowForm(false)
      fetchInvoices()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create invoice')
    } finally {
      setSubmitting(false)
    }
  }

  // Filtered patients dropdown
  const filteredPatients = patSearch.length >= 1
    ? patients.filter(p => `${p.full_name} ${p.mrn} ${p.phone || ''}`.toLowerCase().includes(patSearch.toLowerCase())).slice(0, 8)
    : []

  // Filtered tests
  const filteredTests = testSearch
    ? testPrices.filter(t => t.name.toLowerCase().includes(testSearch.toLowerCase()) || t.code.toLowerCase().includes(testSearch.toLowerCase()))
    : testPrices

  // Filtered invoices
  const filteredInvoices = invoices.filter(inv => {
    if (invSearch && !inv.patient_name?.toLowerCase().includes(invSearch.toLowerCase()) &&
        !`INV-${String(inv.id).padStart(5,'0')}`.toLowerCase().includes(invSearch.toLowerCase())) return false
    if (invMethod && inv.payment_method !== invMethod) return false
    if (invDateFrom && new Date(inv.created_at) < new Date(invDateFrom)) return false
    if (invDateTo && new Date(inv.created_at) > new Date(invDateTo + 'T23:59:59')) return false
    return true
  })

  const card = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
  const inp = `w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-700 border-slate-600' : 'border-slate-300'}`

  // Summary stats
  const todayTotal = invoices.filter(i => new Date(i.created_at).toDateString() === new Date().toDateString()).reduce((a, i) => a + parseFloat(i.total_amount || 0), 0)
  const todayCount = invoices.filter(i => new Date(i.created_at).toDateString() === new Date().toDateString()).length

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Billing</h2>
          <p className="text-sm text-slate-500">Today: {todayCount} invoices · Rs. {todayTotal.toLocaleString()}</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${showForm ? 'bg-slate-200 text-slate-700' : 'bg-blue-600 text-white hover:bg-blue-700 shadow'}`}>
          {showForm ? '✕ Cancel' : '+ New Invoice'}
        </button>
      </div>

      {ipdBanner && ipdState?.ipd_admission_id && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <span className="text-orange-600 text-lg">🛏️</span>
          <div className="flex-1 text-sm text-orange-800">
            <span className="font-semibold">IPD Discharge Billing</span> — {ipdState.patient_name} ({ipdState.admission_number})
            {ipdState.ward_name && <span className="ml-2 text-orange-600">· {ipdState.ward_name} Bed {ipdState.bed_number}</span>}
          </div>
          <button onClick={() => setIpdBanner(false)} className="text-orange-400 hover:text-orange-600 text-lg">✕</button>
        </div>
      )}
      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm border border-red-200">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm border border-green-200 flex items-center gap-2">✅ {success}</div>}

      {/* ── New Invoice Form ── */}
      {showForm && (
        <form onSubmit={handleSubmit} className={`rounded-2xl border shadow-sm mb-6 overflow-hidden ${card}`}>
          <div className={`px-6 py-4 border-b font-semibold ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
            New Invoice
          </div>
          <div className="p-6 space-y-5">
            {/* Patient search */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-slate-600 mb-1">Patient *</label>
                {form.patient_id ? (
                  <div className="flex items-center gap-2">
                    <div className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-blue-50 border-blue-200'} text-blue-700`}>
                      👤 {form.patient_name}
                    </div>
                    <button type="button" onClick={() => setForm({...form, patient_id:'', patient_name:''})}
                      className="text-xs text-red-500 hover:underline px-2">Change</button>
                  </div>
                ) : (
                  <>
                    <input value={patSearch} onChange={e => setPatSearch(e.target.value)}
                      placeholder="Search by name, MRN or phone..."
                      className={inp} />
                    {filteredPatients.length > 0 && (
                      <div className={`absolute top-full left-0 right-0 z-20 border rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
                        {filteredPatients.map(p => (
                          <div key={p.id} onClick={() => selectPatient(p)}
                            className={`px-4 py-2.5 cursor-pointer text-sm hover:bg-blue-50 flex justify-between`}>
                            <span className="font-medium">{p.full_name}</span>
                            <span className="text-slate-400 text-xs">{p.mrn} · {p.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {patSearch && filteredPatients.length === 0 && (
                      <div className="text-xs text-slate-400 mt-1 px-1">No patients found — <Link to="/patients/new" className="text-blue-600 underline">register new</Link></div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Payment Method</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[['cash','💵','Cash'],['card','💳','Card'],['online','📲','Online'],['insurance','🏥','Insurance'],['credit','📒','Credit']].map(([val, icon, label]) => (
                    <button key={val} type="button" onClick={() => setForm({...form, payment_method: val})}
                      className={`py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-0.5 border ${
                        form.payment_method === val
                          ? 'bg-blue-600 text-white border-blue-600 shadow'
                          : `${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'} hover:border-blue-400`
                      }`}>
                      <span className="text-base">{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Credit account selector */}
            {form.payment_method === 'credit' && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <label className="block text-xs font-medium text-orange-700 mb-1">Credit Account *</label>
                <select
                  value={form.credit_account_id}
                  onChange={e => setForm({...form, credit_account_id: e.target.value})}
                  className={inp}
                >
                  <option value="">— Select credit account —</option>
                  {creditAccounts.map(ca => (
                    <option key={ca.id} value={ca.id}>{ca.name} {ca.company ? `(${ca.company})` : ''}</option>
                  ))}
                </select>
                {creditAccounts.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1">No credit accounts configured. <Link to="/credit-accounts" className="underline">Set up credit accounts</Link></p>
                )}
              </div>
            )}

            {/* Insurance fields */}
            {form.payment_method === 'insurance' && (
              <div className="grid grid-cols-3 gap-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Insurance Company *</label>
                  <input value={form.insurance_company} onChange={e => setForm({...form, insurance_company: e.target.value})}
                    placeholder="e.g. Jubilee Insurance" className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Policy / Card No.</label>
                  <input value={form.insurance_policy} onChange={e => setForm({...form, insurance_policy: e.target.value})}
                    placeholder="Policy number" className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">TPA Name</label>
                  <input value={form.tpa_name} onChange={e => setForm({...form, tpa_name: e.target.value})}
                    placeholder="Third Party Administrator" className={inp} />
                </div>
              </div>
            )}

            {/* Tests / Packages */}
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex gap-2">
                  {['tests','packages'].map(t => (
                    <button key={t} type="button" onClick={() => setTestTab(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${testTab === t ? 'bg-blue-600 text-white' : `${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'} hover:bg-blue-50`}`}>
                      {t === 'tests' ? '🔬 Individual Tests' : '📦 Packages'}
                    </button>
                  ))}
                </div>
                {testTab === 'tests' && (
                  <input value={testSearch} onChange={e => setTestSearch(e.target.value)}
                    placeholder="Search tests..." className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-44 outline-none focus:ring-1 focus:ring-blue-500" />
                )}
              </div>

              {testTab === 'tests' ? (
                <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-56 overflow-y-auto border rounded-xl p-3 ${darkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                  {filteredTests.map(test => {
                    const selected = form.tests.find(t => t.code === test.code)
                    return (
                      <div key={test.code} onClick={() => toggleTest(test)}
                        className={`p-2.5 rounded-lg cursor-pointer text-xs transition-all border-2 ${
                          selected ? 'bg-blue-100 border-blue-500 text-blue-800' : `${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`
                        }`}>
                        <div className="font-medium leading-tight">{test.name}</div>
                        <div className={`mt-0.5 ${selected ? 'text-blue-600' : 'text-slate-500'}`}>Rs. {test.price.toLocaleString()}</div>
                      </div>
                    )
                  })}
                  {filteredTests.length === 0 && <div className="col-span-4 text-center text-slate-400 py-4 text-xs">No tests found</div>}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto border rounded-xl p-3 border-slate-200">
                  {packages.map(pkg => {
                    const selected = form.tests.find(t => t.code === `PKG-${pkg.id}`)
                    return (
                      <div key={pkg.id} onClick={() => addPackage(pkg)}
                        className={`p-3 rounded-lg cursor-pointer text-xs border-2 transition-all ${
                          selected ? 'bg-blue-100 border-blue-500' : 'bg-slate-50 border-transparent hover:bg-slate-100'
                        }`}>
                        <div className="font-semibold text-sm">{pkg.name}</div>
                        <div className="text-slate-500 mt-0.5">{pkg.items?.length || 0} tests included</div>
                        <div className="font-bold text-green-700 mt-1">Rs. {parseFloat(pkg.price).toLocaleString()}</div>
                      </div>
                    )
                  })}
                  {packages.length === 0 && <div className="col-span-2 text-center text-slate-400 py-4 text-xs">No packages configured — <Link to="/packages" className="text-blue-600 underline">create packages</Link></div>}
                </div>
              )}
            </div>

            {/* Selected tests chips */}
            {form.tests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.tests.map(t => (
                  <span key={t.code} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {t.name}
                    <button type="button" onClick={() => toggleTest(t)} className="hover:text-red-500 ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}

            {/* Summary + notes row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div className={`rounded-xl p-4 border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tests selected</span>
                    <span className="font-medium">{form.tests.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal</span>
                    <span>Rs. {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Discount</span>
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" max="100" value={form.discount}
                        onChange={e => setForm({...form, discount: parseInt(e.target.value)||0})}
                        className="w-14 px-2 py-0.5 border border-slate-300 rounded text-center text-xs" />
                      <span className="text-xs text-slate-500">% = Rs. {discountAmt.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2 mt-1">
                    <span>Total</span>
                    <span className="text-green-600">Rs. {total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                  rows={3} className={inp} placeholder="Optional notes..." />
              </div>
            </div>
          </div>

          <div className={`px-6 py-4 border-t flex justify-end gap-3 ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 disabled:opacity-50 shadow">
              {submitting ? '⏳ Creating...' : `✅ Create Invoice — Rs. ${total.toLocaleString()}`}
            </button>
          </div>
        </form>
      )}

      {/* ── Invoice List ── */}
      <div className={`rounded-2xl border shadow-sm ${card}`}>
        {/* Filters */}
        <div className={`p-4 border-b flex flex-wrap gap-3 items-center ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
          <h3 className="font-semibold text-slate-700 dark:text-white mr-2">Invoices</h3>
          <input value={invSearch} onChange={e => setInvSearch(e.target.value)}
            placeholder="Search patient / invoice#..."
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-44 outline-none focus:ring-1 focus:ring-blue-500" />
          <select value={invMethod} onChange={e => setInvMethod(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">All Methods</option>
            {['cash','card','online','insurance','credit'].map(m => <option key={m} value={m} className="capitalize">{m}</option>)}
          </select>
          <input type="date" value={invDateFrom} onChange={e => setInvDateFrom(e.target.value)}
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
          <span className="text-slate-400 text-xs">to</span>
          <input type="date" value={invDateTo} onChange={e => setInvDateTo(e.target.value)}
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
          {(invSearch||invMethod||invDateFrom||invDateTo) && (
            <button onClick={() => { setInvSearch(''); setInvMethod(''); setInvDateFrom(''); setInvDateTo('') }}
              className="text-xs text-slate-400 hover:text-slate-600">✕ Clear</button>
          )}
          <span className="ml-auto text-xs text-slate-400">{filteredInvoices.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-500'}`}>
                <th className="text-left px-4 py-3">Invoice #</th>
                <th className="text-left px-4 py-3">Patient</th>
                <th className="text-left px-4 py-3">Tests</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Method</th>
                <th className="text-left px-4 py-3">Date & Time</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredInvoices.map(inv => (
                <tr key={inv.id} className={darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3 font-mono font-medium text-xs">INV-{String(inv.id).padStart(5,'0')}</td>
                  <td className="px-4 py-3 font-medium">{inv.patient_name}</td>
                  <td className="px-4 py-3 text-slate-500">{inv.test_count} tests</td>
                  <td className="px-4 py-3 text-right font-bold text-green-600">Rs. {parseFloat(inv.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      inv.payment_method === 'cash' ? 'bg-green-100 text-green-700' :
                      inv.payment_method === 'card' ? 'bg-blue-100 text-blue-700' :
                      inv.payment_method === 'insurance' ? 'bg-purple-100 text-purple-700' :
                      inv.payment_method === 'online' ? 'bg-cyan-100 text-cyan-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {PAYMENT_ICONS[inv.payment_method] || '💰'} {inv.payment_method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(inv.created_at).toLocaleString('en-PK')}</td>
                  <td className="px-4 py-3 space-x-3">
                    <Link to={`/receipt/${inv.id}`} className="text-blue-600 hover:underline text-xs whitespace-nowrap">🧾 Receipt</Link>
                    {inv.patient_id && (
                      <Link to={`/patients/${inv.patient_id}/statement`} className="text-purple-600 hover:underline text-xs whitespace-nowrap">📋 Statement</Link>
                    )}
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && !loading && (
                <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-400">No invoices found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
