import { useState, useEffect, useContext, useRef } from 'react'
import api from '../api'
import { ThemeContext } from '../App'

const FLAG_CONFIG = {
  H:  { color: 'text-red-600',   bg: 'bg-red-100 text-red-700',   label: 'H' },
  HH: { color: 'text-red-700',   bg: 'bg-red-200 text-red-800',   label: 'HH' },
  L:  { color: 'text-blue-600',  bg: 'bg-blue-100 text-blue-700', label: 'L' },
  LL: { color: 'text-blue-700',  bg: 'bg-blue-200 text-blue-800', label: 'LL' },
  N:  { color: 'text-green-600', bg: 'bg-green-100 text-green-700', label: 'N' },
}

function getFlag(val, refLow, refHigh) {
  const v = parseFloat(val)
  if (isNaN(v)) return null
  const lo = parseFloat(refLow)
  const hi = parseFloat(refHigh)
  if (!isNaN(hi) && v > hi * 1.5) return 'HH'
  if (!isNaN(hi) && v > hi)       return 'H'
  if (!isNaN(lo) && v < lo * 0.5) return 'LL'
  if (!isNaN(lo) && v < lo)       return 'L'
  return 'N'
}

function parseRefRange(rangeStr) {
  if (!rangeStr) return { low: null, high: null }
  const m = String(rangeStr).match(/([\d.]+)\s*[-–]\s*([\d.]+)/)
  if (m) return { low: parseFloat(m[1]), high: parseFloat(m[2]) }
  const up = String(rangeStr).match(/[<≤]\s*([\d.]+)/)
  if (up) return { low: 0, high: parseFloat(up[1]) }
  return { low: null, high: null }
}

function TrendBar({ value, refLow, refHigh }) {
  const v    = parseFloat(value)
  const lo   = parseFloat(refLow)
  const hi   = parseFloat(refHigh)
  if (isNaN(v) || isNaN(hi) || hi === 0) return null

  const pct    = Math.min((v / hi) * 100, 150)
  const flag   = getFlag(v, lo, hi)
  const color  = flag === 'H' || flag === 'HH' ? 'bg-red-400'
               : flag === 'L' || flag === 'LL' ? 'bg-blue-400'
               : 'bg-green-400'

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden relative">
        {/* Normal zone marker */}
        {!isNaN(lo) && (
          <div
            className="absolute top-0 bottom-0 bg-green-100 dark:bg-green-900/40 rounded-full"
            style={{ left: `${(lo / hi) * 100}%`, right: '0%' }}
          />
        )}
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8">{Math.round(pct)}%</span>
    </div>
  )
}

export default function ResultTrend() {
  const { darkMode } = useContext(ThemeContext)
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState([])
  const [searching, setSearching]   = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [patient, setPatient]       = useState(null)
  const [testCode, setTestCode]     = useState('')
  const [history, setHistory]       = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const [limit, setLimit]           = useState(10)
  const searchRef                   = useRef(null)
  const dropdownRef                 = useRef(null)

  const card  = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
  const input = `w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-800'}`
  const th    = `text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-500'}`

  // Debounced patient search
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

  const selectPatient = (p) => {
    setPatient(p)
    setQuery(p.name || p.full_name || '')
    setShowDropdown(false)
    setHistory([])
  }

  const clearPatient = () => {
    setPatient(null); setQuery(''); setHistory([])
  }

  const fetchHistory = async (lim = limit) => {
    if (!patient) return
    setHistLoading(true)
    try {
      const params = { limit: lim }
      if (testCode.trim()) params.test_code = testCode.trim().toUpperCase()
      const r = await api.get(`/patients/${patient.id}/test-history`, { params })
      setHistory(r.data)
    } catch { setHistory([]) }
    setHistLoading(false)
  }

  useEffect(() => {
    if (patient) fetchHistory()
  }, [patient, testCode, limit])

  const showMore = (newLimit) => {
    setLimit(newLimit)
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Result Trends</h2>
          <p className="text-sm text-slate-500">View historical test results and trends for a patient</p>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className={`rounded-2xl border p-5 mb-6 ${card}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Patient search */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Patient</label>
            <div className="relative">
              <div className="flex gap-2" ref={searchRef}>
                <div className="relative flex-1">
                  <input
                    value={query}
                    onChange={e => { setQuery(e.target.value); if (!e.target.value) clearPatient() }}
                    placeholder="Search by name, MRN or phone..."
                    className={input}
                  />
                  {searching && <div className="absolute right-3 top-2.5 text-slate-400 text-xs">...</div>}
                </div>
                {patient && (
                  <button onClick={clearPatient}
                    className="px-3 py-2 text-sm text-slate-500 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    Clear
                  </button>
                )}
              </div>

              {showDropdown && results.length > 0 && (
                <div ref={dropdownRef}
                  className={`absolute top-full mt-1 w-full rounded-xl shadow-lg border z-30 overflow-hidden ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  {results.map(p => (
                    <button key={p.id} onClick={() => selectPatient(p)}
                      className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                      <div>
                        <div className="font-medium">{p.name || p.full_name}</div>
                        <div className="text-xs text-slate-400">{p.phone} · {p.mrn ? `MRN: ${p.mrn}` : ''}</div>
                      </div>
                      <div className="text-xs text-slate-400">{p.gender}, {p.age}y</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Test code filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Filter by Test Code</label>
            <input
              value={testCode}
              onChange={e => setTestCode(e.target.value)}
              placeholder="e.g. CBC, HBA1C..."
              className={input}
              disabled={!patient}
            />
          </div>
        </div>

        {/* Patient info pill */}
        {patient && (
          <div className={`mt-4 flex items-center gap-4 px-4 py-2 rounded-xl text-sm ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
            <span className="font-medium">{patient.name || patient.full_name}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500">{patient.gender}, {patient.age}y</span>
            {patient.mrn && <><span className="text-slate-400">·</span><span className="font-mono text-xs text-slate-500">MRN: {patient.mrn}</span></>}
          </div>
        )}
      </div>

      {/* Placeholder */}
      {!patient && (
        <div className={`rounded-2xl border p-16 text-center ${card}`}>
          <div className="text-4xl mb-3">📈</div>
          <div className="text-slate-400 font-medium">Select a patient to view result trends</div>
          <div className="text-slate-400 text-sm mt-1">Then optionally filter by a specific test code</div>
        </div>
      )}

      {/* Loading */}
      {patient && histLoading && (
        <div className={`rounded-2xl border p-12 text-center ${card}`}>
          <div className="text-slate-400">Loading results...</div>
        </div>
      )}

      {/* Results table */}
      {patient && !histLoading && (
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
          <div className={`flex items-center justify-between px-5 py-3 border-b ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
            <span className="font-semibold text-sm">
              {testCode ? `Results for ${testCode.toUpperCase()}` : 'All Test Results'}
              {history.length > 0 && <span className="ml-2 text-slate-400 font-normal">({history.length} shown)</span>}
            </span>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No results found{testCode ? ` for test code "${testCode}"` : ''}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={th}>Date</th>
                      <th className={th}>Sample ID</th>
                      <th className={th}>Test Name</th>
                      <th className={`${th} text-center`}>Value</th>
                      <th className={th}>Unit</th>
                      <th className={th}>Ref Range</th>
                      <th className={`${th} text-center`}>Flag</th>
                      <th className={th}>Trend</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                    {history.map((row, idx) => {
                      const { low, high } = parseRefRange(row.reference_range)
                      const flag = row.flag || getFlag(row.value, low, high)
                      const fc   = FLAG_CONFIG[flag] || { color: 'text-slate-600', bg: 'bg-slate-100 text-slate-600', label: flag || '—' }
                      return (
                        <tr key={idx} className={darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                            {row.result_date || row.created_at?.slice(0,10)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.sample_id || '—'}</td>
                          <td className="px-4 py-3 font-medium">{row.test_name}</td>
                          <td className={`px-4 py-3 text-center font-bold tabular-nums ${fc.color}`}>
                            {row.value ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{row.unit || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{row.reference_range || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            {flag ? (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${fc.bg}`}>
                                {fc.label}
                              </span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <TrendBar value={row.value} refLow={low} refHigh={high} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Show more buttons */}
              <div className={`flex items-center gap-3 px-5 py-4 border-t ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                <span className="text-xs text-slate-400">Showing last {limit} results</span>
                {limit < 20 && (
                  <button onClick={() => showMore(20)}
                    className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                    Show 20
                  </button>
                )}
                {limit < 50 && (
                  <button onClick={() => showMore(50)}
                    className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                    Show 50
                  </button>
                )}
                {limit > 10 && (
                  <button onClick={() => showMore(10)}
                    className="px-3 py-1.5 text-xs text-slate-500 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                    Reset
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
