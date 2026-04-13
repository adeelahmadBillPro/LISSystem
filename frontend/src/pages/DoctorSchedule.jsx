import { useState, useEffect } from 'react'
import api from '../api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function DoctorSchedule() {
  const [doctors, setDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [schedule, setSchedule] = useState({}) // { day_of_week: entry }
  const [todayDoctors, setTodayDoctors] = useState([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // Editing state for each day
  const [editing, setEditing] = useState({})

  useEffect(() => {
    api.get('/doctors').then(r => setDoctors(r.data)).catch(() => {})
    api.get('/schedule/today').then(r => setTodayDoctors(r.data)).catch(() => {})
  }, [])

  const loadSchedule = async (doctorId) => {
    setLoading(true)
    try {
      const res = await api.get(`/doctors/${doctorId}/schedule`)
      setSelectedDoctor(res.data.doctor)
      const map = {}
      res.data.schedule.forEach(s => { map[s.day_of_week] = s })
      setSchedule(map)
      // Init editing from loaded data
      const ed = {}
      DAYS.forEach((_, i) => {
        ed[i] = map[i] ? { ...map[i] } : {
          day_of_week: i, start_time: '09:00', end_time: '17:00',
          is_available: false, notes: ''
        }
      })
      setEditing(ed)
    } catch (err) {
      setMsg('Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }

  const saveDay = async (day) => {
    if (!selectedDoctor) return
    setSaving(true)
    try {
      await api.post(`/doctors/${selectedDoctor.id}/schedule`, editing[day])
      setMsg(`${DAYS[day]} schedule saved`)
      setTimeout(() => setMsg(''), 2000)
      await loadSchedule(selectedDoctor.id)
    } catch (err) {
      setMsg('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const updateEditing = (day, field, value) => {
    setEditing(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }))
  }

  const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Doctor Schedules</h2>
        <p className="text-sm text-slate-500 mt-1">Set working hours for each doctor per day of week</p>
      </div>

      {/* Today's Available Doctors */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">Today Available — {today}</h3>
        {todayDoctors.length === 0 ? (
          <p className="text-sm text-blue-400">No doctor schedules set for today</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {todayDoctors.map(d => (
              <div key={d.doctor_id} className="bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-blue-800">Dr. {d.doctor_name}</span>
                {d.specialization && <span className="text-blue-500 ml-1">({d.specialization})</span>}
                <span className="ml-2 text-green-700 font-medium">{d.start_time} – {d.end_time}</span>
                {d.notes && <span className="text-slate-500 ml-2 text-xs">· {d.notes}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Doctor Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">Select Doctor to Configure</label>
        <div className="flex gap-3">
          <select
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={e => e.target.value && loadSchedule(Number(e.target.value))}
            defaultValue=""
          >
            <option value="">-- Choose a doctor --</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>Dr. {d.name} {d.specialization ? `(${d.specialization})` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Schedule Grid */}
      {loading && <div className="text-center py-10 text-slate-400">Loading schedule...</div>}

      {selectedDoctor && !loading && (
        <div>
          <h3 className="font-semibold text-slate-700 mb-3">
            Schedule for Dr. {selectedDoctor.name}
          </h3>
          {msg && (
            <div className="mb-3 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm">{msg}</div>
          )}
          <div className="grid gap-3">
            {DAYS.map((dayName, i) => {
              const ed = editing[i] || {}
              const hasSchedule = !!schedule[i]
              return (
                <div
                  key={i}
                  className={`bg-white rounded-xl border p-4 ${
                    ed.is_available ? 'border-green-200' : 'border-slate-200 opacity-70'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Day + Toggle */}
                    <div className="w-28">
                      <div className="font-semibold text-slate-700">{dayName}</div>
                      <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ed.is_available || false}
                          onChange={e => updateEditing(i, 'is_available', e.target.checked)}
                          className="w-4 h-4 accent-green-600"
                        />
                        <span className={`text-xs font-medium ${ed.is_available ? 'text-green-600' : 'text-slate-400'}`}>
                          {ed.is_available ? 'Available' : 'Off'}
                        </span>
                      </label>
                    </div>

                    {/* Times */}
                    <div className="flex items-center gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Start</label>
                        <input
                          type="time"
                          value={ed.start_time || '09:00'}
                          onChange={e => updateEditing(i, 'start_time', e.target.value)}
                          disabled={!ed.is_available}
                          className="border border-slate-200 rounded px-2 py-1 text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <span className="text-slate-400 mt-4">–</span>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">End</label>
                        <input
                          type="time"
                          value={ed.end_time || '17:00'}
                          onChange={e => updateEditing(i, 'end_time', e.target.value)}
                          disabled={!ed.is_available}
                          className="border border-slate-200 rounded px-2 py-1 text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
                      <input
                        type="text"
                        value={ed.notes || ''}
                        onChange={e => updateEditing(i, 'notes', e.target.value)}
                        placeholder="e.g. Morning only, Lunch break 13-14"
                        className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Save */}
                    <button
                      onClick={() => saveDay(i)}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 self-end"
                    >
                      Save
                    </button>

                    {hasSchedule && (
                      <span className="text-xs text-green-600 self-end pb-1">✓ Saved</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
