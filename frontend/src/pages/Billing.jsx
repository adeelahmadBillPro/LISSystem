import { useState, useEffect } from 'react'
import api from '../api'

export default function Billing() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [patients, setPatients] = useState([])
  const [testPrices, setTestPrices] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    patient_id: '',
    tests: [],
    discount: 0,
    payment_method: 'cash',
    notes: '',
  })

  // Fallback test prices (used if no tests in DB yet)
  const defaultTests = [
    { code: 'CBC', name: 'Complete Blood Count', price: 800 },
    { code: 'LFT', name: 'Liver Function Test', price: 1500 },
    { code: 'RFT', name: 'Renal Function Test', price: 1200 },
    { code: 'LIPID', name: 'Lipid Profile', price: 1800 },
    { code: 'THYROID', name: 'Thyroid Profile (T3, T4, TSH)', price: 2500 },
    { code: 'HBA1C', name: 'HbA1c', price: 1200 },
    { code: 'GLU_F', name: 'Glucose Fasting', price: 300 },
    { code: 'GLU_R', name: 'Glucose Random', price: 300 },
    { code: 'URINE', name: 'Urine R/E', price: 400 },
    { code: 'ESR', name: 'ESR', price: 300 },
  ]

  useEffect(() => {
    fetchInvoices()
    api.get('/patients').then(r => setPatients(r.data)).catch(console.error)
    // Load tests from DB, fallback to defaults
    api.get('/tests').then(r => {
      const dbTests = r.data.map(t => ({ code: t.test_code, name: t.test_name, price: t.price }))
      setTestPrices(dbTests.length > 0 ? dbTests : defaultTests)
    }).catch(() => setTestPrices(defaultTests))
  }, [])

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/billing/invoices')
      setInvoices(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const toggleTest = (test) => {
    const exists = form.tests.find(t => t.code === test.code)
    if (exists) {
      setForm({ ...form, tests: form.tests.filter(t => t.code !== test.code) })
    } else {
      setForm({ ...form, tests: [...form.tests, test] })
    }
  }

  const subtotal = form.tests.reduce((sum, t) => sum + t.price, 0)
  const discountAmount = Math.round(subtotal * (form.discount / 100))
  const total = subtotal - discountAmount

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.patient_id) { setError('Select a patient'); return }
    if (form.tests.length === 0) { setError('Select at least one test'); return }

    try {
      await api.post('/billing/invoices', {
        patient_id: parseInt(form.patient_id),
        tests: form.tests.map(t => ({ test_code: t.code, test_name: t.name, price: t.price })),
        discount_percent: form.discount,
        total_amount: total,
        payment_method: form.payment_method,
        notes: form.notes,
      })
      setSuccess('Invoice created successfully!')
      setForm({ patient_id: '', tests: [], discount: 0, payment_method: 'cash', notes: '' })
      setShowForm(false)
      fetchInvoices()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create invoice')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Billing</h2>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          {showForm ? 'Cancel' : '+ New Invoice'}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Patient *</label>
              <select value={form.patient_id} onChange={(e) => setForm({...form, patient_id: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Select Patient</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.mrn} - {p.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
              <select value={form.payment_method} onChange={(e) => setForm({...form, payment_method: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="online">Online Transfer</option>
                <option value="insurance">Insurance</option>
              </select>
            </div>
          </div>

          {/* Test Selection */}
          <label className="block text-sm font-medium text-slate-700 mb-2">Select Tests *</label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4 max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-3">
            {testPrices.map((test) => {
              const selected = form.tests.find(t => t.code === test.code)
              return (
                <div
                  key={test.code}
                  onClick={() => toggleTest(test)}
                  className={`p-2 rounded-lg cursor-pointer text-sm transition-colors ${
                    selected ? 'bg-blue-100 border-2 border-blue-500' : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <div className="font-medium">{test.name}</div>
                  <div className="text-slate-500">Rs. {test.price}</div>
                </div>
              )
            })}
          </div>

          {/* Summary */}
          <div className="bg-slate-50 rounded-lg p-4 mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Selected Tests: {form.tests.length}</span>
              <span>Subtotal: Rs. {subtotal}</span>
            </div>
            <div className="flex items-center gap-2 text-sm mb-1">
              <span>Discount:</span>
              <input type="number" min="0" max="100" value={form.discount}
                onChange={(e) => setForm({...form, discount: parseInt(e.target.value) || 0})}
                className="w-16 px-2 py-1 border rounded text-center" />
              <span>% = Rs. {discountAmount}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
              <span>Total:</span>
              <span className="text-green-700">Rs. {total}</span>
            </div>
          </div>

          <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Create Invoice
          </button>
        </form>
      )}

      {/* Invoices List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">Recent Invoices</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Invoice #</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Patient</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Tests</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Amount</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Payment</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Date</th>
              <th className="text-left px-6 py-3 text-slate-600 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium">INV-{String(inv.id).padStart(5, '0')}</td>
                <td className="px-6 py-4">{inv.patient_name}</td>
                <td className="px-6 py-4">{inv.test_count} tests</td>
                <td className="px-6 py-4 font-bold text-green-700">Rs. {inv.total_amount}</td>
                <td className="px-6 py-4">{inv.payment_method}</td>
                <td className="px-6 py-4 text-slate-500">{new Date(inv.created_at).toLocaleString()}</td>
                <td className="px-6 py-4">
                  <a href={`/receipt/${inv.id}`} className="text-blue-600 hover:underline text-xs">Print Receipt</a>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-400">No invoices yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
