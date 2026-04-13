import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../api'
import ModalPortal from '../components/ModalPortal'

const WARD_TYPES = ['general', 'icu', 'maternity', 'pediatric', 'surgical', 'private']
const BED_TYPES  = ['standard', 'icu', 'isolation']
const STATUS_COLORS = {
  available:   'bg-green-100 text-green-700 border-green-200',
  occupied:    'bg-red-100 text-red-700 border-red-200',
  maintenance: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  reserved:    'bg-blue-100 text-blue-700 border-blue-200',
}

// Cross-ward patient bed finder component
function PatientBedFinder({ query, wards }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const all = await Promise.all(
          wards.map(w => api.get(`/wards/${w.id}/beds`).then(r => r.data.map(b => ({ ...b, ward_name: w.name, ward_type: w.ward_type }))))
        )
        const occupied = all.flat().filter(b => b.status === 'occupied' && b.patient_name)
        const matched = occupied.filter(b => b.patient_name.toLowerCase().includes(query.toLowerCase()))
        setResults(matched)
      } catch {}
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, wards])

  if (loading) return <div className="mt-2 text-xs text-slate-400 animate-pulse">Searching across all wards...</div>
  if (!results.length && query.length >= 2) return <div className="mt-2 text-xs text-slate-400">No patient found with name "{query}"</div>

  return results.length > 0 ? (
    <div className="mt-3 space-y-2">
      {results.map(b => (
        <div key={b.id} className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <div className="text-2xl">🛏️</div>
          <div>
            <div className="font-bold text-slate-800">{b.patient_name}</div>
            <div className="text-xs text-slate-600">
              Ward: <strong>{b.ward_name}</strong> ({b.ward_type}) · Bed: <strong>{b.bed_number}</strong> ({b.bed_type})
            </div>
            {b.admission_number && (
              <div className="text-xs text-slate-400">Admission: {b.admission_number}</div>
            )}
          </div>
          <div className="ml-auto">
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium">Occupied</span>
          </div>
        </div>
      ))}
    </div>
  ) : null
}

export default function Wards() {
  const [wards, setWards]         = useState([])
  const [selectedWard, setSelectedWard] = useState(null)
  const [beds, setBeds]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [bedsLoading, setBedsLoading] = useState(false)
  const [bedPatientSearch, setBedPatientSearch] = useState('')
  const [showWardModal, setShowWardModal] = useState(false)
  const [showBedModal, setShowBedModal]   = useState(false)
  const [editWard, setEditWard]   = useState(null)
  const [editBed, setEditBed]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [wardForm, setWardForm] = useState({ name: '', code: '', ward_type: 'general', floor: '', total_beds: 0 })
  const [bedForm, setBedForm]   = useState({ bed_number: '', bed_type: 'standard', status: 'available' })

  const loadWards = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/wards')
      setWards(r.data)
    } catch {}
    setLoading(false)
  }, [])

  const loadBeds = useCallback(async (wardId) => {
    setBedsLoading(true)
    try {
      const r = await api.get(`/wards/${wardId}/beds`)
      setBeds(r.data)
    } catch {}
    setBedsLoading(false)
  }, [])

  useEffect(() => { loadWards() }, [loadWards])

  useEffect(() => {
    if (selectedWard) loadBeds(selectedWard.id)
    else setBeds([])
  }, [selectedWard, loadBeds])

  const openNewWard = () => {
    setEditWard(null)
    setWardForm({ name: '', code: '', ward_type: 'general', floor: '', total_beds: 0 })
    setShowWardModal(true)
  }

  const openEditWard = (w) => {
    setEditWard(w)
    setWardForm({ name: w.name, code: w.code, ward_type: w.ward_type, floor: w.floor || '', total_beds: w.total_beds })
    setShowWardModal(true)
  }

  const handleSaveWard = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editWard) {
        await api.put(`/wards/${editWard.id}`, wardForm)
      } else {
        await api.post('/wards', wardForm)
      }
      setShowWardModal(false)
      loadWards()
      if (selectedWard && editWard?.id === selectedWard.id) {
        setSelectedWard(prev => ({ ...prev, ...wardForm }))
      }
    } catch (err) { alert(err.response?.data?.detail || 'Save failed') }
    setSaving(false)
  }

  const handleDeleteWard = async (w) => {
    if (!confirm(`Deactivate ward "${w.name}"?`)) return
    try {
      await api.delete(`/wards/${w.id}`)
      if (selectedWard?.id === w.id) setSelectedWard(null)
      loadWards()
    } catch (err) { alert(err.response?.data?.detail || 'Delete failed') }
  }

  const openNewBed = () => {
    setEditBed(null)
    setBedForm({ bed_number: '', bed_type: 'standard', status: 'available' })
    setShowBedModal(true)
  }

  const openEditBed = (b) => {
    setEditBed(b)
    setBedForm({ bed_number: b.bed_number, bed_type: b.bed_type, status: b.status })
    setShowBedModal(true)
  }

  const handleSaveBed = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editBed) {
        await api.put(`/beds/${editBed.id}`, bedForm)
      } else {
        await api.post(`/wards/${selectedWard.id}/beds`, bedForm)
      }
      setShowBedModal(false)
      loadBeds(selectedWard.id)
      loadWards()
    } catch (err) { alert(err.response?.data?.detail || 'Save failed') }
    setSaving(false)
  }

  const handleDeleteBed = async (b) => {
    if (b.status === 'occupied') { alert('Bed is occupied. Discharge patient first.'); return }
    if (!confirm(`Remove bed "${b.bed_number}"?`)) return
    try {
      await api.delete(`/beds/${b.id}`)
      loadBeds(selectedWard.id)
      loadWards()
    } catch (err) { alert(err.response?.data?.detail || 'Delete failed') }
  }

  const quickBedStatus = async (b, status) => {
    if (b.status === 'occupied' && status !== 'available') { alert('Cannot change status of occupied bed'); return }
    try {
      await api.put(`/beds/${b.id}`, { status })
      loadBeds(selectedWard.id)
      loadWards()
    } catch (err) { alert(err.response?.data?.detail || 'Update failed') }
  }

  return (
    <div className="animate-fadeIn space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Wards & Bed Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage wards and bed allocation</p>
        </div>
        <button onClick={openNewWard} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
          ➕ Add Ward
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Ward List */}
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-700 text-sm">Wards ({wards.length})</h3>
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : wards.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-white rounded-xl border">No wards yet</div>
          ) : wards.map(w => (
            <div key={w.id}
              onClick={() => setSelectedWard(selectedWard?.id === w.id ? null : w)}
              className={`bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${selectedWard?.id === w.id ? 'border-blue-400 shadow-md ring-2 ring-blue-100' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold text-slate-800">{w.name}</div>
                  <div className="text-xs text-slate-400">{w.code} · {w.ward_type} · Floor: {w.floor || '—'}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={e => { e.stopPropagation(); openEditWard(w) }}
                    className="p-1 text-slate-400 hover:text-blue-600 text-xs">✏️</button>
                  <button onClick={e => { e.stopPropagation(); handleDeleteWard(w) }}
                    className="p-1 text-slate-400 hover:text-red-600 text-xs">🗑️</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mt-2">
                <div className="bg-green-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-green-700">{w.available_beds}</div>
                  <div className="text-[10px] text-green-600">Available</div>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-red-700">{w.occupied_beds}</div>
                  <div className="text-[10px] text-red-600">Occupied</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-slate-700">{w.total_beds}</div>
                  <div className="text-[10px] text-slate-500">Total</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Bed Grid */}
        <div className="lg:col-span-2 space-y-4">
          {/* Patient Finder — always visible */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <span className="text-lg">🔍</span>
              <div className="flex-1">
                <input value={bedPatientSearch} onChange={e => setBedPatientSearch(e.target.value)}
                  placeholder="Search patient by name to find their bed..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {bedPatientSearch && (
                <button onClick={() => setBedPatientSearch('')} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
              )}
            </div>
            {/* Search results across all wards */}
            {bedPatientSearch.length >= 2 && (() => {
              const allOccupied = wards.flatMap(w => {
                // We don't have beds loaded for all wards, so show a hint
                return []
              })
              return (
                <PatientBedFinder query={bedPatientSearch} wards={wards} />
              )
            })()}
          </div>

          {!selectedWard ? (
            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <div className="text-5xl mb-4">🏥</div>
              <p className="text-sm">Select a ward from the left to view beds</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">{selectedWard.name} — Visual Bed Map</h3>
                  <div className="flex gap-3 mt-1">
                    {['available','occupied','maintenance','reserved'].map(s => (
                      <span key={s} className={`px-2 py-0.5 rounded text-[10px] font-medium border ${STATUS_COLORS[s]}`}>
                        {beds.filter(b => b.status === s).length} {s}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={openNewBed}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                  ➕ Add Bed
                </button>
              </div>

              {/* Legend */}
              <div className="px-4 pt-3 flex gap-4 text-[11px] flex-wrap">
                {[['available','🟢','Available'],['occupied','🔴','Occupied (patient)'],['maintenance','🟡','Maintenance'],['reserved','🔵','Reserved']].map(([s,e,l]) => (
                  <span key={s} className="flex items-center gap-1 text-slate-500">{e} {l}</span>
                ))}
              </div>

              {bedsLoading ? (
                <div className="p-8 text-center text-slate-400">Loading beds...</div>
              ) : beds.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <p className="mb-3">No beds in this ward</p>
                  <button onClick={openNewBed} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Add First Bed</button>
                </div>
              ) : (
                <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {beds.map(b => {
                    const isHighlighted = bedPatientSearch.length >= 2 && b.patient_name &&
                      b.patient_name.toLowerCase().includes(bedPatientSearch.toLowerCase())
                    return (
                      <div key={b.id}
                        className={`border-2 rounded-xl p-3 text-center relative group transition-all
                          ${STATUS_COLORS[b.status] || 'border-slate-200 bg-slate-50'}
                          ${isHighlighted ? 'ring-4 ring-yellow-400 scale-105 shadow-lg z-10' : ''}
                        `}>
                        {/* Bed icon */}
                        <div className="text-xl mb-0.5">
                          {b.status === 'occupied' ? '🛏️' : b.status === 'maintenance' ? '🔧' : b.status === 'reserved' ? '📌' : '🛏️'}
                        </div>
                        <div className="text-sm font-bold">{b.bed_number}</div>
                        <div className="text-[10px] text-slate-500 mb-1">{b.bed_type}</div>
                        {b.status === 'occupied' && b.patient_name && (
                          <div className={`text-[10px] font-semibold truncate px-1 py-0.5 rounded mt-1 ${isHighlighted ? 'bg-yellow-200 text-yellow-900' : 'bg-white/70 text-slate-700'}`}
                            title={b.patient_name}>
                            {b.patient_name}
                          </div>
                        )}
                        {b.status === 'occupied' && b.admission_date && (
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            {Math.floor((Date.now() - new Date(b.admitted_at || b.admission_date)) / 86400000)}d
                          </div>
                        )}
                        {b.status !== 'occupied' && (
                          <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                            <button onClick={() => openEditBed(b)} className="p-0.5 bg-white rounded text-blue-600 text-[10px] shadow">✏️</button>
                            <button onClick={() => handleDeleteBed(b)} className="p-0.5 bg-white rounded text-red-600 text-[10px] shadow">✕</button>
                          </div>
                        )}
                        <select value={b.status} onChange={e => quickBedStatus(b, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="w-full text-[9px] bg-transparent border-0 outline-none cursor-pointer font-medium text-center mt-1 opacity-60 hover:opacity-100">
                          <option value="available">available</option>
                          <option value="occupied">occupied</option>
                          <option value="maintenance">maintenance</option>
                          <option value="reserved">reserved</option>
                        </select>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ward Modal */}
      {showWardModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editWard ? 'Edit Ward' : 'New Ward'}</h3>
              <button onClick={() => setShowWardModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSaveWard} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ward Name *</label>
                  <input value={wardForm.name} onChange={e => setWardForm(f => ({ ...f, name: e.target.value }))}
                    required placeholder="e.g. Male General"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ward Code *</label>
                  <input value={wardForm.code} onChange={e => setWardForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    required placeholder="e.g. MGEN" maxLength={10} disabled={!!editWard}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select value={wardForm.ward_type} onChange={e => setWardForm(f => ({ ...f, ward_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    {WARD_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Floor</label>
                  <input value={wardForm.floor} onChange={e => setWardForm(f => ({ ...f, floor: e.target.value }))}
                    placeholder="e.g. 2nd Floor"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Beds (count)</label>
                <input type="number" value={wardForm.total_beds} onChange={e => setWardForm(f => ({ ...f, total_beds: parseInt(e.target.value) || 0 }))} min="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : editWard ? 'Update' : 'Create Ward'}
                </button>
                <button type="button" onClick={() => setShowWardModal(false)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Bed Modal */}
      {showBedModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editBed ? 'Edit Bed' : `Add Bed — ${selectedWard?.name}`}</h3>
              <button onClick={() => setShowBedModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSaveBed} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bed Number *</label>
                <input value={bedForm.bed_number} onChange={e => setBedForm(f => ({ ...f, bed_number: e.target.value }))}
                  required placeholder="e.g. A-01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bed Type</label>
                <select value={bedForm.bed_type} onChange={e => setBedForm(f => ({ ...f, bed_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  {BED_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              {editBed && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select value={bedForm.status} onChange={e => setBedForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="available">Available</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="reserved">Reserved</option>
                  </select>
                </div>
              )}
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : editBed ? 'Update Bed' : 'Add Bed'}
                </button>
                <button type="button" onClick={() => setShowBedModal(false)}
                  className="px-5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}
