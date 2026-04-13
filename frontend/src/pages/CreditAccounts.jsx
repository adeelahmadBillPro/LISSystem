import { useState, useEffect, useContext } from 'react'
import api from '../api'
import { ThemeContext } from '../App'
import ModalPortal from '../components/ModalPortal'

const TYPE_CONFIG = {
  company:    { label: 'Company',    color: 'bg-blue-100 text-blue-700' },
  hospital:   { label: 'Hospital',   color: 'bg-purple-100 text-purple-700' },
  government: { label: 'Govt',       color: 'bg-green-100 text-green-700' },
  individual: { label: 'Individual', color: 'bg-slate-100 text-slate-600' },
}

const METHOD_ICONS = { cash: '💵', card: '💳', online: '📲', bank: '🏦', cheque: '📝' }

const EMPTY_FORM = {
  account_name: '', type: 'company', contact_person: '',
  phone: '', email: '', address: '', credit_limit: '', notes: '',
}

export default function CreditAccounts() {
  const { darkMode } = useContext(ThemeContext)
  const [accounts, setAccounts]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [editId, setEditId]           = useState(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')
  const [expandedId, setExpandedId]   = useState(null)
  const [invoicesMap, setInvoicesMap] = useState({})
  const [invLoading, setInvLoading]   = useState(false)
  const [payModal, setPayModal]       = useState(null)   // account object
  const [payForm, setPayForm]         = useState({ method: 'cash', selected: [] })
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [search, setSearch]           = useState('')

  const card  = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
  const input = `w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'}`
  const th    = `text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-500'}`

  useEffect(() => { fetchAccounts() }, [])

  const fetchAccounts = async () => {
    setLoading(true)
    try { const r = await api.get('/credit-accounts'); setAccounts(r.data) } catch {}
    setLoading(false)
  }

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setError(''); setShowModal(true) }
  const openEdit = (acc) => {
    setEditId(acc.id)
    setForm({
      account_name:   acc.account_name   || '',
      type:           acc.type           || 'company',
      contact_person: acc.contact_person || '',
      phone:          acc.phone          || '',
      email:          acc.email          || '',
      address:        acc.address        || '',
      credit_limit:   acc.credit_limit   ?? '',
      notes:          acc.notes          || '',
    })
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!form.account_name.trim()) return setError('Account name is required')
    setSubmitting(true); setError('')
    try {
      const payload = { ...form, credit_limit: parseFloat(form.credit_limit) || 0 }
      if (editId) await api.put(`/credit-accounts/${editId}`, payload)
      else        await api.post('/credit-accounts', payload)
      setShowModal(false)
      fetchAccounts()
    } catch (e) { setError(e.response?.data?.detail || 'Failed to save') }
    setSubmitting(false)
  }

  const toggleExpand = async (acc) => {
    if (expandedId === acc.id) { setExpandedId(null); return }
    setExpandedId(acc.id)
    if (!invoicesMap[acc.id]) {
      setInvLoading(true)
      try {
        const r = await api.get(`/credit-accounts/${acc.id}/invoices`)
        setInvoicesMap(m => ({ ...m, [acc.id]: r.data }))
      } catch { setInvoicesMap(m => ({ ...m, [acc.id]: [] })) }
      setInvLoading(false)
    }
  }

  const openPayModal = (acc, e) => {
    e.stopPropagation()
    setPayModal(acc)
    setPayForm({ method: 'cash', selected: [] })
  }

  const toggleInvoiceSel = (invId) => {
    setPayForm(f => ({
      ...f,
      selected: f.selected.includes(invId)
        ? f.selected.filter(x => x !== invId)
        : [...f.selected, invId],
    }))
  }

  const submitPayment = async () => {
    if (!payForm.selected.length) return
    setPaySubmitting(true)
    try {
      await api.post(`/credit-accounts/${payModal.id}/record-payment`, {
        invoice_ids:    payForm.selected,
        payment_method: payForm.method,
      })
      setPayModal(null)
      setInvoicesMap(m => ({ ...m, [payModal.id]: undefined }))
      fetchAccounts()
    } catch (e) { alert(e.response?.data?.detail || 'Payment failed') }
    setPaySubmitting(false)
  }

  const filtered = accounts.filter(a =>
    a.account_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
    a.phone?.includes(search)
  )

  // Summary stats
  const totalBilled      = accounts.reduce((s, a) => s + (a.total_billed  || 0), 0)
  const totalOutstanding = accounts.reduce((s, a) => s + (a.outstanding   || 0), 0)
  const overLimit        = accounts.filter(a => (a.outstanding || 0) > (a.credit_limit || 0)).length

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Credit Accounts</h2>
          <p className="text-sm text-slate-500">Manage corporate & hospital credit clients</p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 flex items-center gap-2"
        >
          + New Account
        </button>
      </div>

      {/* Summary Cards — 2-column grid on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { label: 'Total Accounts',    value: accounts.length,                              icon: '🏢', color: 'text-slate-700 dark:text-slate-200' },
          { label: 'Total Billed',      value: `Rs. ${totalBilled.toLocaleString()}`,        icon: '📄', color: 'text-blue-600' },
          { label: 'Total Outstanding', value: `Rs. ${totalOutstanding.toLocaleString()}`,   icon: '⏳', color: totalOutstanding > 0 ? 'text-red-600' : 'text-green-600' },
          { label: 'Over Limit',        value: overLimit,                                    icon: '⚠️', color: overLimit > 0 ? 'text-red-600' : 'text-green-600' },
        ].map((s, i) => (
          <div key={i} className={`rounded-2xl border p-4 shadow-sm ${card}`}>
            <div className="text-xl sm:text-2xl mb-1">{s.icon}</div>
            <div className={`text-lg sm:text-2xl font-extrabold leading-tight ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className={`rounded-2xl border p-4 mb-4 ${card}`}>
        <input
          placeholder="Search by name, contact or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={input}
        />
      </div>

      {/* Table */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">No credit accounts found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Account Name</th>
                  <th className={th}>Type</th>
                  {/* Contact person hidden on mobile */}
                  <th className={`${th} hidden md:table-cell`}>Contact</th>
                  <th className={th}>Phone</th>
                  <th className={`${th} text-right hidden sm:table-cell`}>Credit Limit</th>
                  <th className={`${th} text-right`}>Total Billed</th>
                  <th className={`${th} text-right`}>Outstanding</th>
                  <th className={`${th} text-center`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                {filtered.map(acc => (
                  <>
                    <tr
                      key={acc.id}
                      onClick={() => toggleExpand(acc)}
                      className={`cursor-pointer ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-4 py-3 font-medium">
                        {/* On mobile: stack account name + type vertically */}
                        <div className="flex items-center gap-2">
                          <span className={`transition-transform flex-shrink-0 ${expandedId === acc.id ? 'rotate-90' : ''}`}>▶</span>
                          <div>
                            <div>{acc.account_name}</div>
                            {/* Phone shown under name on small screens */}
                            <div className="text-xs text-slate-400 sm:hidden">{acc.phone || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_CONFIG[acc.type]?.color || 'bg-slate-100 text-slate-600'}`}>
                          {TYPE_CONFIG[acc.type]?.label || acc.type}
                        </span>
                      </td>
                      {/* Contact person hidden on mobile */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 hidden md:table-cell">
                        {acc.contact_person || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{acc.phone || '—'}</td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        Rs. {Number(acc.credit_limit || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        Rs. {Number(acc.total_billed || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        <span className={(acc.outstanding || 0) > 0 ? 'text-red-600' : 'text-green-600'}>
                          Rs. {Number(acc.outstanding || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => openEdit(acc)}
                            className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={e => openPayModal(acc, e)}
                            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                          >
                            Payment
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded invoices row — scrollable on mobile */}
                    {expandedId === acc.id && (
                      <tr key={`${acc.id}-expand`} className={darkMode ? 'bg-slate-900' : 'bg-slate-50'}>
                        <td colSpan={8} className="px-4 sm:px-6 py-4">
                          <div className="text-xs font-semibold text-slate-500 uppercase mb-3">
                            Invoices for {acc.account_name}
                          </div>
                          {invLoading ? (
                            <div className="text-slate-400 text-sm py-3">Loading invoices...</div>
                          ) : !invoicesMap[acc.id] || invoicesMap[acc.id].length === 0 ? (
                            <div className="text-slate-400 text-sm py-3">No invoices found for this account.</div>
                          ) : (
                            /* Scrollable wrapper on mobile */
                            <div className="overflow-x-auto -mx-4 sm:mx-0">
                              <table className="w-full text-xs min-w-[480px]">
                                <thead>
                                  <tr className={`${darkMode ? 'text-slate-400' : 'text-slate-500'} uppercase`}>
                                    <th className="text-left pb-2 px-2 sm:px-0">Date</th>
                                    <th className="text-left pb-2 px-2 sm:px-0">Patient</th>
                                    <th className="text-right pb-2 px-2 sm:px-0">Amount</th>
                                    <th className="text-left pb-2 px-2 sm:px-0">Method</th>
                                    <th className="text-left pb-2 px-2 sm:px-0">Status</th>
                                  </tr>
                                </thead>
                                <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-200'}`}>
                                  {invoicesMap[acc.id].map(inv => (
                                    <tr key={inv.id}>
                                      <td className="py-2 px-2 sm:px-0 whitespace-nowrap">
                                        {inv.date || inv.created_at?.slice(0, 10)}
                                      </td>
                                      <td className="py-2 px-2 sm:px-0">{inv.patient_name || '—'}</td>
                                      <td className="py-2 px-2 sm:px-0 text-right font-medium whitespace-nowrap">
                                        Rs. {Number(inv.amount || 0).toLocaleString()}
                                      </td>
                                      <td className="py-2 px-2 sm:px-0 whitespace-nowrap">
                                        {METHOD_ICONS[inv.payment_method]} {inv.payment_method}
                                      </td>
                                      <td className="py-2 px-2 sm:px-0">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                          inv.status === 'paid'    ? 'bg-green-100 text-green-700' :
                                          inv.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-red-100 text-red-700'
                                        }`}>
                                          {inv.status || 'pending'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New / Edit Account Modal */}
      {showModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-slate-800 text-white' : 'bg-white'}`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-lg">{editId ? 'Edit Account' : 'New Credit Account'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Account Name *</label>
                <input
                  value={form.account_name}
                  onChange={e => setForm({ ...form, account_name: e.target.value })}
                  className={input}
                  placeholder="e.g. City Hospital"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={input}>
                  <option value="company">Company</option>
                  <option value="hospital">Hospital</option>
                  <option value="government">Government</option>
                  <option value="individual">Individual</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Credit Limit (Rs.)</label>
                <input
                  type="number"
                  value={form.credit_limit}
                  onChange={e => setForm({ ...form, credit_limit: e.target.value })}
                  className={input}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Contact Person</label>
                <input
                  value={form.contact_person}
                  onChange={e => setForm({ ...form, contact_person: e.target.value })}
                  className={input}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
                <input
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className={input}
                  placeholder="0300-0000000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className={input}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                <input
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  className={input}
                  placeholder="City, Area"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className={input}
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>
              {error && <div className="sm:col-span-2 text-sm text-red-500">{error}</div>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editId ? 'Update Account' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Record Payment Modal */}
      {payModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-slate-800 text-white' : 'bg-white'}`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-lg">Record Payment — {payModal.account_name}</h3>
              <button onClick={() => setPayModal(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-5">
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                <select
                  value={payForm.method}
                  onChange={e => setPayForm({ ...payForm, method: e.target.value })}
                  className={input}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="online">Online Transfer</option>
                  <option value="bank">Bank Deposit</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
                Select Invoices to Mark as Paid
              </div>
              {(invoicesMap[payModal.id] || []).filter(i => i.status !== 'paid').length === 0 ? (
                <div className="text-sm text-slate-400 py-4 text-center">No pending invoices</div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(invoicesMap[payModal.id] || []).filter(i => i.status !== 'paid').map(inv => (
                    <label
                      key={inv.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${
                        darkMode ? 'border-slate-600 hover:bg-slate-700' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={payForm.selected.includes(inv.id)}
                        onChange={() => toggleInvoiceSel(inv.id)}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{inv.patient_name || `Invoice #${inv.id}`}</div>
                        <div className="text-xs text-slate-500">{inv.date || inv.created_at?.slice(0, 10)}</div>
                      </div>
                      <div className="font-bold text-sm">Rs. {Number(inv.amount || 0).toLocaleString()}</div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setPayModal(null)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={submitPayment}
                disabled={paySubmitting || !payForm.selected.length}
                className="px-5 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
              >
                {paySubmitting ? 'Processing...' : `Mark ${payForm.selected.length} as Paid`}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}
