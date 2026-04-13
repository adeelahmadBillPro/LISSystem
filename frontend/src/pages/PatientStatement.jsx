import { useState, useEffect, useContext, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { ThemeContext } from '../App'

const METHOD_ICONS = { cash: '💵', card: '💳', online: '📲', insurance: '🏥', credit: '📒' }

export default function PatientStatement() {
  const { darkMode } = useContext(ThemeContext)
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState([])
  const [searching, setSearching]   = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [patient, setPatient]       = useState(null)
  const [statement, setStatement]   = useState(null)
  const [stmtLoading, setStmtLoading] = useState(false)
  const [expandedInv, setExpandedInv] = useState(null)
  const searchRef                   = useRef(null)
  const dropdownRef                 = useRef(null)

  const card  = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
  const input = `w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-800'}`
  const th    = `text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-500'}`

  // Search patients with debounce
  useEffect(() => {
    if (!query.trim()) { setResults([]); setShowDropdown(false); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await api.get('/patients', { params: { search: query, limit: 10 } })
        setResults(r.data)
        setShowDropdown(true)
      } catch { setResults([]) }
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectPatient = async (p) => {
    setPatient(p)
    setQuery(p.name || p.full_name || '')
    setShowDropdown(false)
    setStmtLoading(true)
    try {
      const r = await api.get(`/patients/${p.id}/statement`)
      setStatement(r.data)
    } catch { setStatement(null) }
    setStmtLoading(false)
  }

  const clearPatient = () => {
    setPatient(null); setStatement(null); setQuery(''); setResults([])
  }

  // Derived summary
  const totalVisits      = statement?.invoices?.length || 0
  const totalBilled      = statement?.invoices?.reduce((s, i) => s + (i.total_amount || 0), 0) || 0
  const totalPaid        = statement?.invoices?.reduce((s, i) => s + (i.paid_amount || i.total_amount || 0), 0) || 0
  const totalOutstanding = totalBilled - totalPaid

  return (
    <div className="animate-fadeIn print:p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Patient Statement</h2>
          <p className="text-sm text-slate-500">View complete billing history for a patient</p>
        </div>
        {patient && (
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm hover:bg-slate-700 flex items-center gap-2">
            🖨️ Print Statement
          </button>
        )}
      </div>

      {/* Print header (only shows on print) */}
      <div className="hidden print:block mb-6">
        <h2 className="text-xl font-bold">Patient Billing Statement</h2>
        {patient && <p className="text-sm text-slate-600">Patient: {patient.name || patient.full_name} · MRN: {patient.mrn || '—'}</p>}
        <p className="text-xs text-slate-400">Generated: {new Date().toLocaleDateString()}</p>
      </div>

      {/* Patient Search */}
      <div className={`rounded-2xl border p-5 mb-6 print:hidden ${card}`}>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Search Patient</label>
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1" ref={searchRef}>
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); if (!e.target.value) clearPatient() }}
                placeholder="Search by name, MRN or phone..."
                className={input}
              />
              {searching && <div className="absolute right-3 top-2.5 text-slate-400 text-xs">Searching...</div>}
            </div>
            {patient && (
              <button onClick={clearPatient}
                className="px-3 py-2 text-sm text-slate-500 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                Clear
              </button>
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && results.length > 0 && (
            <div ref={dropdownRef}
              className={`absolute top-full mt-1 w-full rounded-xl shadow-lg border z-30 overflow-hidden ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              {results.map(p => (
                <button key={p.id} onClick={() => selectPatient(p)}
                  className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                  <div>
                    <div className="font-medium">{p.name || p.full_name}</div>
                    <div className="text-xs text-slate-400">{p.phone} · {p.mrn ? `MRN: ${p.mrn}` : 'No MRN'}</div>
                  </div>
                  <div className="text-xs text-slate-400">{p.gender}, {p.age}y</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Placeholder */}
      {!patient && !stmtLoading && (
        <div className={`rounded-2xl border p-16 text-center ${card}`}>
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-slate-400 font-medium">Select a patient to view their billing statement</div>
          <div className="text-slate-400 text-sm mt-1">Search by name, MRN or phone number above</div>
        </div>
      )}

      {/* Loading */}
      {stmtLoading && (
        <div className={`rounded-2xl border p-16 text-center ${card}`}>
          <div className="text-slate-400">Loading statement...</div>
        </div>
      )}

      {/* Statement content */}
      {patient && statement && !stmtLoading && (
        <>
          {/* Patient info card */}
          <div className={`rounded-2xl border p-5 mb-6 flex flex-wrap gap-6 ${card}`}>
            <div>
              <div className="text-xs text-slate-500">Patient</div>
              <div className="font-bold text-base">{patient.name || patient.full_name}</div>
              <div className="text-xs text-slate-500">{patient.gender} · {patient.age}y</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">MRN</div>
              <div className="font-mono font-bold">{patient.mrn || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Phone</div>
              <div className="font-medium">{patient.phone || '—'}</div>
            </div>
            {patient.email && (
              <div>
                <div className="text-xs text-slate-500">Email</div>
                <div className="font-medium">{patient.email}</div>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Visits',  value: totalVisits,                          icon: '🏥', color: 'text-slate-700 dark:text-slate-200' },
              { label: 'Total Billed',  value: `Rs. ${totalBilled.toLocaleString()}`, icon: '📄', color: 'text-blue-600' },
              { label: 'Total Paid',    value: `Rs. ${totalPaid.toLocaleString()}`,   icon: '✅', color: 'text-green-600' },
              { label: 'Outstanding',   value: `Rs. ${totalOutstanding.toLocaleString()}`, icon: '⏳', color: totalOutstanding > 0 ? 'text-red-600' : 'text-green-600' },
            ].map((s, i) => (
              <div key={i} className={`rounded-2xl border p-5 shadow-sm ${card}`}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Invoice History Table */}
          <div className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
            <div className={`px-5 py-3 border-b font-semibold text-sm ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              Invoice History
            </div>
            {statement.invoices?.length === 0 ? (
              <div className="text-center py-12 text-slate-400">No invoices found for this patient</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={th}>Date</th>
                      <th className={th}>Invoice #</th>
                      <th className={th}>Tests</th>
                      <th className={`${th} text-right`}>Amount</th>
                      <th className={`${th} text-right`}>Discount</th>
                      <th className={`${th} text-right`}>Net</th>
                      <th className={th}>Method</th>
                      <th className={th}>Insurance</th>
                      <th className={`${th} text-center print:hidden`}>Report</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                    {statement.invoices?.map(inv => {
                      const testNames = (inv.items || []).map(i => i.test_name || i.name).join(', ')
                      const discountAmt = inv.discount_amount || ((inv.total_amount * (inv.discount || 0)) / 100) || 0
                      const net = inv.net_amount ?? (inv.total_amount - discountAmt)
                      return (
                        <>
                          <tr key={inv.id}
                            onClick={() => setExpandedInv(expandedInv === inv.id ? null : inv.id)}
                            className={`cursor-pointer ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {inv.date || inv.created_at?.slice(0,10)}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">
                              <div className="flex items-center gap-1">
                                <span className={`transition-transform ${expandedInv === inv.id ? 'rotate-90' : ''}`}>▶</span>
                                INV-{String(inv.id).padStart(5,'0')}
                              </div>
                            </td>
                            <td className="px-4 py-3 max-w-[200px]">
                              <div className="truncate text-slate-600 dark:text-slate-300" title={testNames}>
                                {testNames || '—'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">Rs. {Number(inv.total_amount || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-orange-500">
                              {discountAmt > 0 ? `-Rs. ${discountAmt.toLocaleString()}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold">Rs. {Number(net).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1">
                                {METHOD_ICONS[inv.payment_method]} {inv.payment_method || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {inv.insurance_company ? (
                                <div>
                                  <div className="text-xs font-medium">{inv.insurance_company}</div>
                                  {inv.claim_status && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                      inv.claim_status === 'settled' ? 'bg-green-100 text-green-700' :
                                      inv.claim_status === 'approved' ? 'bg-cyan-100 text-cyan-700' :
                                      'bg-yellow-100 text-yellow-700'
                                    }`}>{inv.claim_status}</span>
                                  )}
                                </div>
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center print:hidden">
                              {inv.sample_id ? (
                                <Link to={`/report/${inv.sample_id}`}
                                  onClick={e => e.stopPropagation()}
                                  className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                                  View
                                </Link>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>

                          {/* Expanded test breakdown */}
                          {expandedInv === inv.id && (
                            <tr key={`${inv.id}-expand`} className={darkMode ? 'bg-slate-900' : 'bg-slate-50'}>
                              <td colSpan={9} className="px-8 py-3">
                                <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Test Breakdown</div>
                                {(inv.items || []).length === 0 ? (
                                  <div className="text-xs text-slate-400">No item details available</div>
                                ) : (
                                  <table className="text-xs w-auto">
                                    <thead>
                                      <tr className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                                        <th className="text-left pr-8 pb-1">Test</th>
                                        <th className="text-right pr-8 pb-1">Price</th>
                                        <th className="text-right pr-8 pb-1">Discount</th>
                                        <th className="text-right pb-1">Net</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {inv.items.map((item, idx) => (
                                        <tr key={idx}>
                                          <td className="pr-8 py-1">{item.test_name || item.name}</td>
                                          <td className="pr-8 py-1 text-right">Rs. {Number(item.price || 0).toLocaleString()}</td>
                                          <td className="pr-8 py-1 text-right text-orange-500">
                                            {item.discount ? `-Rs. ${Number(item.discount).toLocaleString()}` : '—'}
                                          </td>
                                          <td className="py-1 text-right font-medium">
                                            Rs. {Number(item.net_price ?? item.price ?? 0).toLocaleString()}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
