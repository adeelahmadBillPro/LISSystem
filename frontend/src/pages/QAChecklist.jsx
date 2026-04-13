import { useState, useEffect, useRef } from 'react'

const SECTIONS = [
  {
    title: '🔐 Auth & Access',
    items: [
      { id: 'auth1', text: 'Login with admin credentials → lands on Dashboard' },
      { id: 'auth2', text: 'Login with wrong password → shows error, no redirect' },
      { id: 'auth3', text: 'Logout → redirects to /login, token cleared' },
      { id: 'auth4', text: 'Direct URL /users → blocked for non-admin (Access Denied page)' },
      { id: 'auth5', text: 'Direct URL /settings → blocked for non-admin' },
      { id: 'auth6', text: 'Refresh page → stays logged in (token in localStorage)' },
      { id: 'auth7', text: 'Token expires → redirected to login automatically' },
    ]
  },
  {
    title: '🧪 Lab Core Flow',
    items: [
      { id: 'lab1', text: 'Register new patient → MRN auto-generated, saved' },
      { id: 'lab2', text: 'Register sample → search patient by name/MRN, select, save' },
      { id: 'lab3', text: 'Enter results → values, flags (H/L/N), verify' },
      { id: 'lab4', text: 'View report → patient info, results table, reference ranges' },
      { id: 'lab5', text: 'Print report → print dialog opens, layout correct' },
      { id: 'lab6', text: 'Download PDF → file downloads to computer' },
      { id: 'lab7', text: 'Send via WhatsApp → wa.me link opens (if no API key)' },
      { id: 'lab8', text: 'Barcode print → barcode PDF downloads' },
      { id: 'lab9', text: 'Manual results → enter values manually for walk-in tests' },
      { id: 'lab10', text: 'Result trend → graph shows multiple results over time' },
    ]
  },
  {
    title: '📅 Appointment Flow',
    items: [
      { id: 'appt1', text: 'Book appointment (staff) → select patient, doctor, date, time, save' },
      { id: 'appt2', text: 'Public booking (Landing page) → fill form, get booking reference' },
      { id: 'appt3', text: 'Online booking shows orange banner in Appointments page' },
      { id: 'appt4', text: '✅ Arrived button → status changes to arrived, action panel shows' },
      { id: 'appt5', text: '🏥 OPD Visit Kholo → OPD page opens with patient pre-selected' },
      { id: 'appt6', text: '🧪 Lab Sample Register → SampleRegister opens with patient pre-selected' },
      { id: 'appt7', text: '🛏️ IPD Admit Karo → IPD page opens, modal auto-opens with patient' },
      { id: 'appt8', text: 'Time-slot rows also have Arrived button and action panel' },
      { id: 'appt9', text: 'Appointment auto-marks completed after OPD/Lab/IPD action' },
      { id: 'appt10', text: 'Print appointments → clean table, no sidebar/buttons' },
    ]
  },
  {
    title: '🏥 OPD Flow',
    items: [
      { id: 'opd1', text: 'Create OPD visit → patient search, doctor, complaint, fee' },
      { id: 'opd2', text: 'Navigate from appointment → patient pre-filled, modal opens' },
      { id: 'opd3', text: '🧪 Sample button (referred_to_lab) → opens SampleRegister with patient' },
      { id: 'opd4', text: '🛏️ Admit IPD button → opens IPD with patient pre-filled' },
      { id: 'opd5', text: 'Change status Waiting → In Progress → Completed' },
      { id: 'opd6', text: 'OPD stats update correctly (today total, waiting, in progress, completed)' },
      { id: 'opd7', text: 'Filter by date → shows only that day\'s visits' },
    ]
  },
  {
    title: '🛏️ IPD Flow',
    items: [
      { id: 'ipd1', text: 'Admit patient → search patient, select ward, bed, doctor, save' },
      { id: 'ipd2', text: 'Navigate from Appointment arrival → admission modal opens with patient' },
      { id: 'ipd3', text: 'Navigate from OPD → same pre-fill behavior' },
      { id: 'ipd4', text: 'Navigate from OT → surgery row has 🛏️ Admit IPD button' },
      { id: 'ipd5', text: 'Add treatment notes → timestamped, appended to existing notes' },
      { id: 'ipd6', text: 'Ward transfer → select new ward, available beds only shown' },
      { id: 'ipd7', text: 'Discharge → fills discharge date, notes, saves' },
      { id: 'ipd8', text: 'After discharge → prompt to go to Billing' },
      { id: 'ipd9', text: 'Billing opens with IPD admission data pre-filled (orange banner)' },
      { id: 'ipd10', text: 'IPD stats: admitted, available beds, today admissions/discharges' },
    ]
  },
  {
    title: '💊 Pharmacy Flow',
    items: [
      { id: 'pha1', text: 'Add medication → name, generic, stock, price, reorder level' },
      { id: 'pha2', text: 'Adjust stock → add/remove with reason logged' },
      { id: 'pha3', text: 'Low stock alert → highlighted when below reorder level' },
      { id: 'pha4', text: 'Dispense medicines → select patient, add items, save receipt' },
      { id: 'pha5', text: 'Dispense from Prescription → loads prescription items automatically' },
      { id: 'pha6', text: 'Print dispense receipt → clean thermal receipt layout' },
    ]
  },
  {
    title: '🔬 Radiology Flow',
    items: [
      { id: 'rad1', text: 'Create order → patient, modality (X-Ray/MRI/CT), body part, priority' },
      { id: 'rad2', text: 'Upload image → image thumbnail shows in table' },
      { id: 'rad3', text: 'Add report → radiologist, findings, impression, recommendations' },
      { id: 'rad4', text: 'Edit report → modal shows "✏️ Edit Report", existing data pre-filled' },
      { id: 'rad5', text: 'Print radiology report → correct layout with header' },
      { id: 'rad6', text: 'Radiology stats → today orders, pending, completed counts' },
    ]
  },
  {
    title: '🏨 OT Flow',
    items: [
      { id: 'ot1', text: 'Schedule surgery → patient, surgeon, theater, date/time' },
      { id: 'ot2', text: 'Pre-op checklist → 6 items, progress bar updates' },
      { id: 'ot3', text: 'Post-op notes → opens modal, saves to surgery record' },
      { id: 'ot4', text: '🛏️ Admit IPD button → navigates to IPD with patient pre-filled' },
      { id: 'ot5', text: 'Theater status → available/occupied/maintenance/cleaning' },
      { id: 'ot6', text: 'Change surgery status → scheduled → in_progress → completed' },
    ]
  },
  {
    title: '💰 Billing & Finance',
    items: [
      { id: 'bil1', text: 'Create invoice → search patient, add tests, discount, payment method' },
      { id: 'bil2', text: 'Payment methods → cash/card/online/insurance/credit all work' },
      { id: 'bil3', text: 'Insurance fields → company, policy, TPA show when insurance selected' },
      { id: 'bil4', text: 'Credit account → linked to credit account, balance tracked' },
      { id: 'bil5', text: 'Invoice list → search, filter by method, filter by date range' },
      { id: 'bil6', text: 'Print receipt → thermal format (max-w-xs, dashed border)' },
      { id: 'bil7', text: 'Daily Closing → totals by payment method, print layout correct' },
    ]
  },
  {
    title: '👆 Attendance',
    items: [
      { id: 'att1', text: 'Clock In → live clock shows, GPS captured at moment of click' },
      { id: 'att2', text: 'Location indicator shows "Getting location..." then coordinates' },
      { id: 'att3', text: 'Location denied → warning shown, attendance still recorded' },
      { id: 'att4', text: 'Clock in twice → blocked with "Already clocked in"' },
      { id: 'att5', text: 'After 9:30 AM → status auto-set to Late' },
      { id: 'att6', text: 'Clock Out → hours worked calculated, shows in today record' },
      { id: 'att7', text: 'Under 4 hours → status becomes Half Day' },
      { id: 'att8', text: 'My History tab → monthly table with Present/Late/Half Day summary' },
      { id: 'att9', text: 'Admin Report tab → shows for all staff, filter by month/staff' },
      { id: 'att10', text: 'Admin Report tab NOT visible to non-admin staff' },
    ]
  },
  {
    title: '👥 HR & Payroll',
    items: [
      { id: 'hr1', text: 'Staff list → shows all users with salary profile' },
      { id: 'hr2', text: 'Edit salary → basic, allowances, deductions save correctly' },
      { id: 'hr3', text: 'Add advance → amount, deduction per month, notes' },
      { id: 'hr4', text: 'Generate payroll → calculates net from gross minus deductions' },
      { id: 'hr5', text: 'Salary slip → picker selects employee + month + year' },
      { id: 'hr6', text: 'Print salary slip → colors print correctly (green/red/blue headers)' },
      { id: 'hr7', text: 'Print hides HR page header and tabs, shows only slip' },
    ]
  },
  {
    title: '⚙️ Settings & Admin',
    items: [
      { id: 'set1', text: 'Save lab name/phone/address → reflects in report headers' },
      { id: 'set2', text: 'Upload logo → shows in browser favicon and report' },
      { id: 'set3', text: 'Toggle dark mode → persists after refresh' },
      { id: 'set4', text: 'Switch sidebar ↔ top nav → switches live, persists after refresh' },
      { id: 'set5', text: 'Module manager → disable/enable IPD, OPD, etc. hides nav items' },
      { id: 'set6', text: 'Database backup → downloads .sql file' },
      { id: 'set7', text: 'Restore backup → file picker, confirm dialog, success message' },
      { id: 'set8', text: 'Non-admin → Settings page shows "Access Denied"' },
    ]
  },
  {
    title: '👤 Users & Activation',
    items: [
      { id: 'usr1', text: 'Users list → shows active and pending (amber badge) users' },
      { id: 'usr2', text: 'Pending users count banner shown at top' },
      { id: 'usr3', text: 'Activate button → changes user to active, refreshes list' },
      { id: 'usr4', text: 'Disable button → disables active user' },
      { id: 'usr5', text: 'Create user → role dropdown (admin/technician/doctor/receptionist)' },
      { id: 'usr6', text: 'Delete user → confirm dialog, removed from list' },
      { id: 'usr7', text: 'Non-admin going to /users → Access Denied page' },
    ]
  },
  {
    title: '🌐 Patient Portal',
    items: [
      { id: 'por1', text: 'Login with MRN + phone → shows patient reports' },
      { id: 'por2', text: 'Wrong credentials → error message, no redirect' },
      { id: 'por3', text: 'View report PDF → downloads correctly' },
      { id: 'por4', text: 'Book appointment tab → selects doctor, date, time' },
      { id: 'por5', text: '"Back to Home" link → goes to /landing' },
      { id: 'por6', text: 'Logout → back to portal login' },
    ]
  },
  {
    title: '📊 Reports & Export',
    items: [
      { id: 'rep1', text: 'MIS Reports → revenue chart, test volume, doctor stats' },
      { id: 'rep2', text: 'Date range filter → data updates correctly' },
      { id: 'rep3', text: 'Export Patients CSV → file downloads with today\'s date in filename' },
      { id: 'rep4', text: 'Export Results CSV → file downloads' },
      { id: 'rep5', text: 'Export Invoices CSV → file downloads' },
      { id: 'rep6', text: 'Audit Log → shows all critical actions (delete, discharge, billing)' },
      { id: 'rep7', text: 'Audit log: deleting a patient shows in log' },
    ]
  },
  {
    title: '📱 Mobile & Print',
    items: [
      { id: 'mob1', text: 'Login page on mobile → form readable, no overflow' },
      { id: 'mob2', text: 'Dashboard on mobile → cards stack vertically' },
      { id: 'mob3', text: 'Patients list on mobile → table scrolls horizontally' },
      { id: 'mob4', text: 'Report print → sidebar hidden, buttons hidden, content only' },
      { id: 'mob5', text: 'Receipt print → thermal width (max ~80mm), dashed lines' },
      { id: 'mob6', text: 'IPD print → admissions table without action buttons' },
      { id: 'mob7', text: 'Attendance print → only the table, no tabs/header' },
    ]
  },
]

const STATUS = {
  untested: { label: '—', color: 'bg-slate-100 text-slate-400' },
  pass:     { label: '✅ Pass', color: 'bg-green-100 text-green-700' },
  fail:     { label: '❌ Fail', color: 'bg-red-100 text-red-700' },
  skip:     { label: '⏭ Skip', color: 'bg-yellow-100 text-yellow-700' },
}

export default function QAChecklist() {
  const STORAGE_KEY = 'qa_checklist_state'
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  const [state, setState] = useState(saved)
  const [notes, setNotes] = useState(JSON.parse(localStorage.getItem(STORAGE_KEY + '_notes') || '{}'))
  const [filter, setFilter] = useState('all')
  const [activeSection, setActiveSection] = useState(0)
  const observerRef = useRef(null)

  const save = (newState, newNotes) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
    localStorage.setItem(STORAGE_KEY + '_notes', JSON.stringify(newNotes))
  }

  const setStatus = (id, status) => {
    const ns = { ...state, [id]: status }
    setState(ns)
    save(ns, notes)
  }

  const setNote = (id, text) => {
    const nn = { ...notes, [id]: text }
    setNotes(nn)
    save(state, nn)
  }

  const reset = () => {
    if (!confirm('Reset all QA results?')) return
    setState({})
    setNotes({})
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY + '_notes')
  }

  // Filter function reused in both visible sections and left nav counts
  const filterFn = (item) => {
    if (filter === 'all')      return true
    if (filter === 'fail')     return state[item.id] === 'fail'
    if (filter === 'pass')     return state[item.id] === 'pass'
    if (filter === 'untested') return !state[item.id] || state[item.id] === 'untested'
    return true
  }

  const filteredSections = SECTIONS.map((section, sectionIdx) => ({
    ...section,
    sectionIdx,
    items: section.items.filter(filterFn),
  })).filter(s => s.items.length > 0)

  // IntersectionObserver — track which section is in view
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to top of viewport that is intersecting
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          const idx = parseInt(visible[0].target.dataset.sectionIdx, 10)
          if (!isNaN(idx)) setActiveSection(idx)
        }
      },
      { threshold: 0.15, rootMargin: '-60px 0px -50% 0px' }
    )

    // Small delay to let DOM settle after filter change
    const t = setTimeout(() => {
      SECTIONS.forEach((_, i) => {
        const el = document.getElementById(`section-${i}`)
        if (el) observerRef.current.observe(el)
      })
    }, 50)

    return () => {
      clearTimeout(t)
      if (observerRef.current) observerRef.current.disconnect()
    }
  }, [filter])

  const scrollToSection = (idx) => {
    // If section is hidden by filter, clear filter first
    const sectionVisible = SECTIONS[idx].items.some(filterFn)
    if (!sectionVisible) setFilter('all')

    setTimeout(() => {
      const el = document.getElementById(`section-${idx}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setActiveSection(idx)
      }
    }, sectionVisible ? 0 : 60)
  }

  const allItems = SECTIONS.flatMap(s => s.items)
  const total    = allItems.length
  const passed   = allItems.filter(i => state[i.id] === 'pass').length
  const failed   = allItems.filter(i => state[i.id] === 'fail').length
  const skipped  = allItems.filter(i => state[i.id] === 'skip').length
  const untested = total - passed - failed - skipped
  const pct      = Math.round(passed / total * 100)

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">QA Checklist</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manual test checklist — mark each item Pass / Fail / Skip</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm hover:bg-slate-200">
            🖨️ Print
          </button>
          <button onClick={reset} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm hover:bg-red-100">
            🔄 Reset All
          </button>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 print:hidden mb-4">
        {[
          { label: 'Total',    val: total,    color: 'bg-slate-50 border-slate-200 text-slate-700' },
          { label: 'Passed',   val: passed,   color: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'Failed',   val: failed,   color: 'bg-red-50 border-red-200 text-red-700' },
          { label: 'Skipped',  val: skipped,  color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
          { label: 'Untested', val: untested, color: 'bg-blue-50 border-blue-200 text-blue-700' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-3 ${s.color}`}>
            <div className="text-xs mb-1">{s.label}</div>
            <div className="text-2xl font-bold">{s.val}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="print:hidden mb-4">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Overall Pass Rate</span>
          <span className="font-bold text-slate-700">{pct}%</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 print:hidden mb-4">
        {[['all','All'],['untested','Untested'],['fail','Failed'],['pass','Passed']].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === k ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Mobile section tabs — horizontal scroll */}
      <div className="md:hidden print:hidden mb-4 -mx-1 overflow-x-auto">
        <div className="flex gap-2 pb-1 px-1 min-w-max">
          {SECTIONS.map((s, i) => {
            const visCount = s.items.filter(filterFn).length
            const isActive = activeSection === i
            return (
              <button key={i} onClick={() => scrollToSection(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                } ${visCount === 0 ? 'opacity-50' : ''}`}>
                <span>{s.title}</span>
                {visCount > 0 && visCount < s.items.length && (
                  <span className={`text-xs rounded-full px-1 ${isActive ? 'bg-white/20' : 'bg-slate-200 text-slate-500'}`}>
                    {visCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-5 items-start">

        {/* Left sticky nav — desktop only */}
        <div className="hidden md:block w-52 shrink-0 print:hidden">
          <div className="sticky top-16">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-slate-800 text-white px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                Sections
              </div>
              <div className="divide-y divide-slate-50 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                {SECTIONS.map((s, i) => {
                  const passCount = s.items.filter(item => state[item.id] === 'pass').length
                  const failCount = s.items.filter(item => state[item.id] === 'fail').length
                  const visCount  = s.items.filter(filterFn).length
                  const isActive  = activeSection === i
                  return (
                    <button key={i} onClick={() => scrollToSection(i)}
                      className={`w-full text-left px-4 py-2.5 transition-colors flex flex-col gap-0.5 ${
                        isActive
                          ? 'bg-blue-50 border-l-[3px] border-blue-500'
                          : 'border-l-[3px] border-transparent hover:bg-slate-50'
                      } ${visCount === 0 ? 'opacity-40' : ''}`}>
                      <span className={`text-xs font-medium leading-snug ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>
                        {s.title}
                      </span>
                      <span className="flex items-center gap-2 mt-0.5">
                        {passCount > 0 && (
                          <span className="text-[10px] text-green-600 font-medium">✓{passCount}</span>
                        )}
                        {failCount > 0 && (
                          <span className="text-[10px] text-red-600 font-medium">✗{failCount}</span>
                        )}
                        <span className="text-[10px] text-slate-400">{s.items.length} items</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Mini legend */}
            <div className="mt-3 bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 space-y-1.5">
              {[
                { label: 'Pass', cls: 'bg-green-500' },
                { label: 'Fail', cls: 'bg-red-500' },
                { label: 'Skip', cls: 'bg-yellow-400' },
                { label: 'Untested', cls: 'bg-slate-300' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-xs text-slate-500">
                  <span className={`w-2 h-2 rounded-full ${item.cls}`}></span>
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: checklist sections */}
        <div className="flex-1 min-w-0 space-y-6">
          {filteredSections.map(section => (
            <div
              key={section.title}
              id={`section-${section.sectionIdx}`}
              data-section-idx={section.sectionIdx}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
            >
              <div className="bg-slate-800 text-white px-5 py-3 font-semibold text-sm">
                {section.title}
              </div>
              <div className="divide-y divide-slate-50">
                {section.items.map(item => {
                  const s = state[item.id] || 'untested'
                  return (
                    <div key={item.id} className={`px-5 py-3 ${s === 'fail' ? 'bg-red-50' : s === 'pass' ? 'bg-green-50/30' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 text-sm text-slate-700 pt-0.5">{item.text}</div>
                        <div className="flex gap-1.5 shrink-0 print:hidden">
                          {Object.entries(STATUS).filter(([k]) => k !== 'untested').map(([k, v]) => (
                            <button key={k} onClick={() => setStatus(item.id, s === k ? 'untested' : k)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${s === k ? v.color + ' ring-2 ring-offset-1 ring-current' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                              {v.label}
                            </button>
                          ))}
                        </div>
                        {/* Print-only status */}
                        <span className={`hidden print:inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS[s].color}`}>
                          {STATUS[s].label}
                        </span>
                      </div>
                      {s === 'fail' && (
                        <input
                          value={notes[item.id] || ''}
                          onChange={e => setNote(item.id, e.target.value)}
                          placeholder="Describe the issue..."
                          className="mt-2 w-full px-3 py-1.5 border border-red-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-red-400 bg-white print:hidden"
                        />
                      )}
                      {notes[item.id] && s === 'fail' && (
                        <p className="hidden print:block text-xs text-red-600 mt-1 italic">Issue: {notes[item.id]}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Print summary */}
          <div className="hidden print:block border-t pt-4 mt-6 text-sm">
            <strong>Summary:</strong> {passed} passed · {failed} failed · {skipped} skipped · {untested} untested
            &nbsp;|&nbsp; Pass rate: {pct}%
            &nbsp;|&nbsp; Tested on: {new Date().toLocaleDateString('en-PK')}
          </div>
        </div>

      </div>
    </div>
  )
}
