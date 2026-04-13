import { useState, useEffect, useContext } from 'react'
import api from '../api'
import { ThemeContext } from '../App'
import ModalPortal from '../components/ModalPortal'

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'bg-yellow-100 text-yellow-700' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Approved',  color: 'bg-cyan-100 text-cyan-700' },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-700' },
  settled:   { label: 'Settled',   color: 'bg-green-100 text-green-700' },
}

const STATUS_FLOW = ['pending', 'submitted', 'approved', 'rejected', 'settled']

export default function InsuranceClaims() {
  const { darkMode } = useContext(ThemeContext)
  const [claims, setClaims]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate]     = useState('')
  const [editId, setEditId]     = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving]     = useState(false)
  // mobile bottom-sheet state
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => { fetchClaims() }, [statusFilter, fromDate, toDate])

  const fetchClaims = async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status    = statusFilter
      if (fromDate)     params.from_date = fromDate
      if (toDate)       params.to_date   = toDate
      const r = await api.get('/insurance/claims', { params })
      setClaims(r.data)
    } catch {}
    finally { setLoading(false) }
  }

  const openEdit = (claim) => {
    setEditId(claim.id)
    setEditForm({
      claim_status:      claim.claim_status      || 'pending',
      claim_amount:      claim.claim_amount      || '',
      claim_note:        claim.claim_note        || '',
      insurance_company: claim.insurance_company || '',
      policy_number:     claim.policy_number     || '',
      tpa_name:          claim.tpa_name          || '',
    })
    // open bottom-sheet on mobile
    setSheetOpen(true)
  }

  const closeEdit = () => {
    setEditId(null)
    setSheetOpen(false)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await api.put(`/insurance/claims/${editId}`, editForm)
      closeEdit()
      fetchClaims()
    } catch {}
    finally { setSaving(false) }
  }

  const card = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'

  // Summary counts
  const counts = STATUS_FLOW.reduce((acc, s) => {
    acc[s] = claims.filter(c => (c.claim_status || 'pending') === s).length
    return acc
  }, {})
  const totalPending = claims
    .filter(c => ['pending', 'submitted'].includes(c.claim_status || 'pending'))
    .reduce((s, c) => s + c.total_amount, 0)
  const totalSettled = claims
    .filter(c => c.claim_status === 'settled')
    .reduce((s, c) => s + (c.claim_amount || c.total_amount), 0)

  // The inline edit panel (used both in the table row and in the bottom sheet)
  const EditPanel = ({ claim }) => (
    <div className={`px-4 py-4 ${darkMode ? 'bg-slate-700/50' : 'bg-blue-50'}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Claim Status</label>
          <select
            value={editForm.claim_status}
            onChange={e => setEditForm({ ...editForm, claim_status: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_FLOW.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Claim Amount (Rs.)</label>
          <input
            type="number"
            value={editForm.claim_amount}
            onChange={e => setEditForm({ ...editForm, claim_amount: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Insurance Company</label>
          <input
            type="text"
            value={editForm.insurance_company}
            onChange={e => setEditForm({ ...editForm, insurance_company: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">TPA Name</label>
          <input
            type="text"
            value={editForm.tpa_name}
            onChange={e => setEditForm({ ...editForm, tpa_name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Policy Number</label>
          <input
            type="text"
            value={editForm.policy_number}
            onChange={e => setEditForm({ ...editForm, policy_number: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
          <input
            type="text"
            value={editForm.claim_note}
            onChange={e => setEditForm({ ...editForm, claim_note: e.target.value })}
            placeholder="e.g. Rejected – missing documents"
            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={saveEdit}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : '💾 Save'}
        </button>
        <button
          onClick={closeEdit}
          className="px-4 py-2 border text-slate-600 rounded-lg text-sm hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
      {claim?.claim_note && (
        <p className="text-xs text-slate-500 mt-2">Last note: {claim.claim_note}</p>
      )}
    </div>
  )

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Insurance / TPA Claims</h2>
          <p className="text-sm text-slate-500">Track & manage insurance billing claims</p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm hover:bg-slate-700 flex items-center gap-2 print:hidden"
        >
          🖨️ Print
        </button>
      </div>

      {/* Summary cards — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Claims',         value: claims.length,                         icon: '📋', color: 'text-slate-700' },
          { label: 'Pending / Submitted',  value: counts.pending + counts.submitted,     icon: '⏳', color: 'text-yellow-600' },
          { label: 'Approved',             value: counts.approved,                       icon: '✅', color: 'text-cyan-600' },
          { label: 'Settled',              value: counts.settled,                        icon: '💰', color: 'text-green-600' },
        ].map((s, i) => (
          <div key={i} className={`rounded-2xl border p-4 sm:p-5 shadow-sm ${card}`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-xl sm:text-2xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Amount summary */}
      <div className={`rounded-2xl border p-4 mb-6 flex gap-6 flex-wrap ${card}`}>
        <div>
          <div className="text-xs text-slate-500">Pending Collection</div>
          <div className="text-lg font-bold text-yellow-600">Rs. {totalPending.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Settled Amount</div>
          <div className="text-lg font-bold text-green-600">Rs. {totalSettled.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-2xl border p-4 mb-6 flex flex-wrap gap-3 items-end print:hidden ${card}`}>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            {STATUS_FLOW.map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => { setStatusFilter(''); setFromDate(''); setToDate('') }}
          className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border rounded-lg"
        >
          Clear
        </button>
      </div>

      {/* Claims Table */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading...</div>
        ) : claims.length === 0 ? (
          <div className="text-center py-16 text-slate-400">No insurance claims found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-500'}`}>
                  <th className="text-left px-4 py-3">Invoice</th>
                  <th className="text-left px-4 py-3">Patient</th>
                  {/* Hide Insurance/TPA on mobile — still show company name inline */}
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Insurance / TPA</th>
                  <th className="text-right px-4 py-3">Bill Amt</th>
                  <th className="text-right px-4 py-3">Claim Amt</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Date</th>
                  <th className="text-center px-4 py-3 print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {claims.map(c => (
                  <>
                    <tr key={c.id} className={darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3 font-mono text-xs">INV-{String(c.id).padStart(5, '0')}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.patient_name}</div>
                        <div className="text-xs text-slate-400">{c.patient_mrn}</div>
                        {/* Show insurance co on mobile under patient name */}
                        <div className="text-xs text-slate-500 sm:hidden mt-0.5">
                          {c.insurance_company || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="font-medium text-sm">{c.insurance_company || '—'}</div>
                        <div className="text-xs text-slate-400">
                          {c.tpa_name ? `TPA: ${c.tpa_name}` : ''}
                          {c.policy_number ? ` · ${c.policy_number}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        Rs. {c.total_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">
                        {c.claim_amount != null ? `Rs. ${Number(c.claim_amount).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[c.claim_status || 'pending']?.color}`}>
                          {STATUS_CONFIG[c.claim_status || 'pending']?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('en-PK') : '—'}
                        {c.claim_submitted_at && (
                          <div className="text-[10px]">
                            Sub: {new Date(c.claim_submitted_at).toLocaleDateString('en-PK')}
                          </div>
                        )}
                        {c.claim_settled_at && (
                          <div className="text-[10px] text-green-600">
                            Settled: {new Date(c.claim_settled_at).toLocaleDateString('en-PK')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center print:hidden">
                        <button
                          onClick={() => editId === c.id ? closeEdit() : openEdit(c)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs hover:bg-blue-200"
                        >
                          {editId === c.id ? 'Close' : 'Update'}
                        </button>
                      </td>
                    </tr>

                    {/* Inline edit panel — visible only on md+ screens; mobile uses bottom sheet */}
                    {editId === c.id && (
                      <tr key={`edit-${c.id}`} className="hidden md:table-row">
                        <td colSpan={8}>
                          <EditPanel claim={c} />
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

      {/* Mobile bottom-sheet edit panel */}
      {sheetOpen && editId && (
        <ModalPortal>
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              onClick={closeEdit}
            />
            {/* Sheet */}
            <div className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Update Claim</h3>
                <button onClick={closeEdit} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
              </div>
              <EditPanel claim={claims.find(c => c.id === editId)} />
            </div>
          </>
        </ModalPortal>
      )}
    </div>
  )
}
