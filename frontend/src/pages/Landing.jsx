import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const featureGroups = [
  {
    group: 'Lab Core',
    color: 'blue',
    icon: '🔬',
    items: [
      { icon: '🔬', title: 'Machine Integration', desc: 'Sysmex, Mindray, Roche, Abbott — results auto aate hain, zero manual entry.' },
      { icon: '📱', title: 'WhatsApp Reports', desc: 'Verify karo — patient ko PDF report WhatsApp pe auto send.' },
      { icon: '📄', title: 'PDF Reports', desc: 'Lab logo, QR code, digital signature ke saath branded PDF.' },
      { icon: '⚠️', title: 'Critical Alerts', desc: 'Critical value pe doctor ko WhatsApp alert automatic.' },
      { icon: '📈', title: 'Result Trend', desc: 'Patient ke past results ka trend chart — deterioration instantly visible.' },
      { icon: '⏱️', title: 'TAT Tracking', desc: 'Sample collection se report tak time automatically track hota hai.' },
    ],
  },
  {
    group: 'Hospital',
    color: 'green',
    icon: '🏥',
    items: [
      { icon: '🏥', title: 'OPD', desc: 'Outpatient visits — doctor assignment, visit notes, lab referral button.' },
      { icon: '🛏️', title: 'IPD / Admissions', desc: 'Patient admission, ward/bed assignment, discharge workflow.' },
      { icon: '🗂️', title: 'Wards & Beds', desc: 'Bed availability real-time — occupied, vacant, maintenance status.' },
      { icon: '📡', title: 'Radiology', desc: 'X-ray, MRI, CT scan orders linked to patient record.' },
      { icon: '⚕️', title: 'Operation Theater', desc: 'OT scheduling, surgeon assignment, procedure tracking.' },
      { icon: '💊', title: 'Pharmacy', desc: 'Medicine dispensing, stock management, expiry alerts.' },
    ],
  },
  {
    group: 'Finance',
    color: 'yellow',
    icon: '💰',
    items: [
      { icon: '💰', title: 'Billing & Invoicing', desc: 'Invoice, packages, discounts, thermal receipt printing.' },
      { icon: '📒', title: 'Credit Accounts', desc: 'Corporate/panel clients — monthly billing, outstanding tracking.' },
      { icon: '🏥', title: 'Insurance / TPA', desc: 'Claim submission, tracking, status: pending → submitted → settled.' },
      { icon: '🧾', title: 'Patient Statement', desc: 'Full billing history per patient — printable statement.' },
      { icon: '💵', title: 'Referral Commission', desc: 'Doctor referral tracking aur commission auto calculate.' },
      { icon: '📝', title: 'Daily Closing', desc: 'End-of-day cash reconciliation aur revenue summary.' },
    ],
  },
  {
    group: 'Clinical',
    color: 'purple',
    icon: '🩺',
    items: [
      { icon: '📅', title: 'Appointments', desc: 'Day-view timeline — book, reschedule, status track karo.' },
      { icon: '📝', title: 'Prescriptions', desc: 'Digital prescription — medicine, dosage, frequency, print ready.' },
      { icon: '🩺', title: 'Doctor Dashboard', desc: 'Doctor apni patients aur test orders khud manage karta hai.' },
      { icon: '📅', title: 'Doctor Schedule', desc: 'Har doctor ki availability — reception ko pata hoga kaun available hai.' },
      { icon: '👥', title: 'HR & Payroll', desc: 'Staff salary, advance, leave management, slip print.' },
      { icon: '👆', title: 'Staff Attendance', desc: 'Clock-in / clock-out with GPS location. Admin report.' },
    ],
  },
  {
    group: 'More',
    color: 'slate',
    icon: '⚙️',
    items: [
      { icon: '🏢', title: 'Multi-Branch', desc: 'Ek system, multiple branches, centralized data.' },
      { icon: '🎫', title: 'Token Queue', desc: 'Walk-in patients ka queue — number display screen pe.' },
      { icon: '📦', title: 'Inventory', desc: 'Reagents track karo — low stock alert aata hai pehle.' },
      { icon: '🔒', title: 'Secure & Audited', desc: 'Role-based access, encrypted login, full audit log.' },
      { icon: '💾', title: 'Data Backup', desc: 'One-click database backup & restore — data kabhi nahi jaata.' },
      { icon: '📲', title: 'Patient Portal', desc: 'Patient apne reports online dekhe — MRN aur phone se login.' },
    ],
  },
]

const steps = [
  { n: '1', icon: '👤', title: 'Patient Register', desc: 'Receptionist patient register karta hai, barcode label print hota hai, token milta hai.' },
  { n: '2', icon: '🧪', title: 'Sample Register', desc: 'Sample collect ho ke machine pe jaata hai. System mein sample ID link hoti hai.' },
  { n: '3', icon: '🔬', title: 'Auto Results', desc: 'Machine ka result automatically system mein aata hai. Flag laga deta hai H/L/HH/LL.' },
  { n: '4', icon: '✅', title: 'Verify', desc: 'Pathologist notes add karta hai, verify karta hai. Digital signature.' },
  { n: '5', icon: '📱', title: 'Report Delivered', desc: 'Patient ko WhatsApp pe PDF. Doctor ko critical alert. Done.' },
]

const plans = [
  {
    name: 'Basic',
    price: '50,000',
    tag: 'Choti Lab ke liye',
    features: ['1 branch', '3 users', '1 machine', 'PDF reports', 'Billing', '3 months support'],
    cta: 'Demo Lein',
    highlight: false,
  },
  {
    name: 'Professional',
    price: '1,50,000',
    tag: 'Bari Lab ke liye',
    features: ['Multi-branch', 'Unlimited users', '5 machines', 'WhatsApp delivery', 'Prescriptions', 'Doctor portal', 'Insurance/TPA', 'Credit accounts', 'MIS reports', '1 year support'],
    cta: 'Most Popular — Demo Lein',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Contact',
    tag: 'Hospital / Chain',
    features: ['Full hospital suite', 'OPD + IPD + OT', 'Pharmacy', 'HR & Payroll', 'Cloud hosted', 'Custom setup', 'Staff training', 'Dedicated support'],
    cta: 'Baat Karein',
    highlight: false,
  },
]

const testimonials = [
  { name: 'Dr. Amir Hussain', lab: 'City Diagnostic Lab, Lahore', text: 'Reports jaate hain automatically WhatsApp pe. Staff ka waqt bachta hai aur patients khush hain. Kamal ka system hai.' },
  { name: 'Mr. Tariq Mehmood', lab: 'Al-Shifa Pathology, Karachi', text: 'Machine se seedha result aata hai. Koi manual entry nahi. Errors zero ho gaye hain pichle 6 mahine se.' },
  { name: 'Dr. Sadia Malik', lab: 'Metro Labs, Islamabad', text: 'Billing, inventory, OPD — sab ek jagah. Pehle 3 alag software use karte thay, ab sirf yeh ek. Bht acha system hai!' },
]

const groupColors = {
  blue:   { icon: 'bg-blue-50 group-hover:bg-blue-100',   border: 'hover:border-blue-400' },
  green:  { icon: 'bg-green-50 group-hover:bg-green-100',  border: 'hover:border-green-400' },
  yellow: { icon: 'bg-yellow-50 group-hover:bg-yellow-100',border: 'hover:border-yellow-400' },
  purple: { icon: 'bg-purple-50 group-hover:bg-purple-100',border: 'hover:border-purple-400' },
  slate:  { icon: 'bg-slate-50 group-hover:bg-slate-100',  border: 'hover:border-slate-400' },
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', lab: '', city: '' })
  const [submitted, setSubmitted] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [activeGroup, setActiveGroup] = useState('Lab Core')

  const [bookForm, setBookForm] = useState({ name: '', phone: '', doctor_id: '', appt_date: '', appt_time: '', reason: '', appt_type: 'consultation' })
  const [bookDoctors, setBookDoctors] = useState([])
  const [bookStatus, setBookStatus] = useState(null)
  const bookRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll)
    const timer = setInterval(() => setActiveStep(s => (s + 1) % steps.length), 2500)
    return () => { window.removeEventListener('scroll', onScroll); clearInterval(timer) }
  }, [])

  useEffect(() => {
    fetch('/api/doctors').then(r => r.json()).then(data => {
      setBookDoctors(Array.isArray(data) ? data : [])
    }).catch(() => {})
  }, [])

  const handleBookAppointment = async (e) => {
    e.preventDefault()
    setBookStatus('loading')
    try {
      const res = await fetch('/api/appointments/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Booking failed')
      setBookStatus({ ref: data.booking_ref, mrn: data.patient_mrn })
      setBookForm({ name: '', phone: '', doctor_id: '', appt_date: '', appt_time: '', reason: '', appt_type: 'consultation' })
    } catch {
      setBookStatus('error')
    }
  }

  const handleContact = (e) => {
    e.preventDefault()
    const msg = `Assalam o Alaikum!\n\nLIS System demo chahiye.\n\nNaam: ${form.name}\nPhone: ${form.phone}\nLab: ${form.lab || '—'}\nCity: ${form.city || '—'}`
    window.open(`https://wa.me/923001234567?text=${encodeURIComponent(msg)}`, '_blank')
    setSubmitted(true)
  }

  const currentGroup = featureGroups.find(g => g.group === activeGroup) || featureGroups[0]
  const colors = groupColors[currentGroup.color] || groupColors.slate

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ══════════ NAVBAR ══════════ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-slate-900/98 shadow-xl backdrop-blur-md' : 'bg-slate-900/85 backdrop-blur-md'}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-xl shadow">🧬</div>
            <div>
              <div className="font-bold text-white text-sm leading-none">LabPro LIS</div>
              <div className="text-[10px] text-slate-400 leading-none mt-0.5">Pakistan Lab Software</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {[['#features','Features'],['#how','Workflow'],['#book','Book Appointment'],['#pricing','Pricing'],['#contact','Contact']].map(([h,l]) => (
              <a key={h} href={h} className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all">{l}</a>
            ))}
            <Link to="/portal" className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all ml-1">Patient Portal</Link>
            <Link to="/login" className="ml-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all">
              Staff Login →
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-white/10 transition-all">
            <span className={`block w-5 h-0.5 bg-slate-300 transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-slate-300 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-slate-300 transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-slate-700/50 px-4 py-4 space-y-1">
            {[['#features','🔬 Features'],['#how','⚙️ Workflow'],['#book','📅 Book Appointment'],['#pricing','💰 Pricing'],['#contact','📱 Contact']].map(([h,l]) => (
              <a key={h} href={h} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-white/10 hover:text-white rounded-xl transition-all">
                {l}
              </a>
            ))}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <Link to="/portal" onClick={() => setMenuOpen(false)}
                className="text-center py-3 border border-slate-600 text-slate-300 text-sm font-medium rounded-xl hover:bg-white/5">
                Patient Portal
              </Link>
              <Link to="/login" onClick={() => setMenuOpen(false)}
                className="text-center py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-500">
                Staff Login →
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════ HERO ══════════ */}
      <section className="relative pt-20 pb-14 md:pt-32 md:pb-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-8 md:gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-full mb-5">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Pakistan Labs ka Complete System — Lab + Hospital
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-5">
              Lab ko<br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Digital</span><br />
              karo aaj hi
            </h1>
            <p className="text-slate-300 text-sm md:text-lg mb-7 leading-relaxed max-w-md">
              Blood sample se patient ka <strong className="text-white">WhatsApp report</strong> tak — sab kuch automatic.
              OPD, IPD, Pharmacy, Insurance sab ek system mein.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href="#contact"
                className="px-6 py-3.5 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl shadow-xl shadow-green-500/30 transition-all text-center text-sm md:text-base active:scale-95">
                📱 Free Demo Lein
              </a>
              <a href="#features"
                className="px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium rounded-xl transition-all text-center text-sm md:text-base">
                Features Dekhein →
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
              <span className="flex items-center gap-1.5"><span className="text-green-400">✓</span> No monthly fees</span>
              <span className="flex items-center gap-1.5"><span className="text-green-400">✓</span> One-time payment</span>
              <span className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Training included</span>
            </div>
          </div>

          {/* Animated workflow — desktop only */}
          <div className="hidden md:block">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-2xl">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-4">Live Workflow</p>
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 ${
                    i === activeStep ? 'bg-white/15 border border-white/20 shadow-lg scale-[1.02]' : ''
                  }`}>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      i === activeStep ? 'bg-blue-500 text-white' : 'bg-white/5 text-slate-500'
                    }`}>{s.n}</span>
                    <span className="text-lg">{s.icon}</span>
                    <div>
                      <div className={`text-sm font-semibold ${i === activeStep ? 'text-white' : 'text-slate-400'}`}>{s.title}</div>
                      {i === activeStep && <div className="text-xs text-slate-300 mt-0.5">{s.desc}</div>}
                    </div>
                    {i === activeStep && <span className="ml-auto text-blue-400 text-lg">→</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 inset-x-0">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-10 md:h-16">
            <path d="M0,30 C480,60 960,0 1440,30 L1440,60 L0,60 Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ══════════ STATS ══════════ */}
      <section className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
          {[
            { num: '35+', label: 'Features', icon: '📋', sub: 'Lab + Hospital' },
            { num: '10+', label: 'Machine Brands', icon: '🔬', sub: 'Sysmex, Mindray...' },
            { num: '24/7', label: 'Support', icon: '🤝', sub: 'Training included' },
            { num: '100%', label: 'Pakistan Made', icon: '🇵🇰', sub: 'Local support' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center hover:shadow-md transition-all">
              <div className="text-2xl mb-1.5">{s.icon}</div>
              <div className="text-2xl md:text-3xl font-extrabold text-blue-600">{s.num}</div>
              <div className="text-xs font-semibold text-slate-700 mt-0.5">{s.label}</div>
              <div className="text-[10px] text-slate-400">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ FEATURES ══════════ */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-10 md:py-16">
        <div className="text-center mb-8">
          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full mb-3">Features</span>
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900">Aapki Lab ka Har Kaam</h2>
          <p className="text-slate-500 mt-2 text-sm md:text-base">Single room lab se multi-branch hospital tak — ek system, sab kuch</p>
        </div>

        {/* Group tabs — scrollable on mobile */}
        <div className="flex gap-2 justify-start md:justify-center overflow-x-auto pb-2 mb-6 scrollbar-none">
          {featureGroups.map(g => (
            <button key={g.group}
              onClick={() => setActiveGroup(g.group)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                activeGroup === g.group
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
              }`}>
              <span>{g.icon}</span> {g.group}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentGroup.items.map((f, i) => (
            <div key={i} className={`group bg-white border border-slate-200 rounded-2xl p-5 ${colors.border} hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300`}>
              <div className={`w-11 h-11 ${colors.icon} rounded-xl flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-all`}>
                {f.icon}
              </div>
              <h3 className="font-bold text-slate-800 text-sm mb-1">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ WHY CHOOSE US ══════════ */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 bg-blue-900 text-blue-300 text-xs font-semibold rounded-full mb-3">Why LabPro</span>
            <h2 className="text-2xl md:text-4xl font-extrabold">Lab se Hospital tak — Poora System</h2>
            <p className="text-slate-400 mt-2 text-sm">Sab kuch ek jagah — alag alag software ki zaroorat nahi</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: '🔗', title: 'OPD → Lab Integration', desc: 'OPD visit se direct lab sample registration — ek click, patient pre-filled.' },
              { icon: '📅', title: 'Appointment Booking', desc: 'Online booking form, day-view schedule, patient live search.' },
              { icon: '📒', title: 'Credit / Panel Billing', desc: 'Corporate clients ka monthly billing, outstanding auto calculate.' },
              { icon: '🏥', title: 'Insurance / TPA', desc: 'Policy number, claim submission, status: pending → settled.' },
              { icon: '🧾', title: 'Patient Statement', desc: 'Full billing history per patient — printable aur shareable.' },
              { icon: '🛏️', title: 'IPD → Billing Link', desc: 'Discharge pe billing auto-populate — no duplicate entry.' },
              { icon: '👆', title: 'Staff Attendance', desc: 'Clock-in / clock-out with GPS. Late detection. Admin report.' },
              { icon: '💊', title: 'Pharmacy Stock', desc: 'Medicine dispensing, expiry alerts, low stock notification.' },
              { icon: '📲', title: 'Patient Portal', desc: 'Patient ghar se reports dekhe — MRN aur phone se login.' },
            ].map((f, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 hover:border-white/20 transition-all">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-white text-sm mb-1">{f.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section id="how" className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full mb-3">Workflow</span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900">Kaise Kaam Karta Hai?</h2>
            <p className="text-slate-500 mt-2 text-sm">5 steps — patient registration se report delivery tak</p>
          </div>

          {/* Mobile: vertical list, Desktop: horizontal */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            {steps.map((s, i) => (
              <div key={i} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden sm:block absolute top-8 left-1/2 w-full h-0.5 bg-blue-200 z-0" />
                )}
                <div className="relative z-10 bg-white rounded-2xl border border-slate-200 p-4 text-center hover:border-blue-300 hover:shadow-lg transition-all">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3 shadow-lg shadow-blue-500/30">
                    {s.n}
                  </div>
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <h3 className="font-bold text-slate-800 text-sm mb-1">{s.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ TESTIMONIALS ══════════ */}
      <section className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full mb-3">Reviews</span>
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900">Labs Kya Kehti Hain</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:-translate-y-1 transition-all">
              <div className="flex gap-0.5 mb-3">
                {'★★★★★'.split('').map((s, j) => <span key={j} className="text-yellow-400 text-lg">{s}</span>)}
              </div>
              <p className="text-slate-700 text-sm leading-relaxed mb-4">"{t.text}"</p>
              <div className="pt-4 border-t border-slate-100">
                <div className="font-bold text-slate-800 text-sm">{t.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{t.lab}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ APPOINTMENT BOOKING ══════════ */}
      <section id="book" ref={bookRef} className="bg-gradient-to-br from-blue-50 to-indigo-50 border-y border-blue-100">
        <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
          <div className="text-center mb-8">
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full mb-3">Online Booking</span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900">Appointment Book Karein</h2>
            <p className="text-slate-500 mt-2 text-sm">Pehli baar aaiye bhi — sirf naam aur phone number kafi hai.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              {[
                { icon: '🆓', title: 'Bilkul Free', desc: 'Appointment book karna completely free hai — koi charge nahi.' },
                { icon: '⚡', title: 'Instant Confirmation', desc: 'Staff 1-2 ghante mein confirm karte hain WhatsApp pe.' },
                { icon: '🆕', title: 'Naye Patients Welcome', desc: 'Pehli dafa aaiye bhi — MRN ya previous record ki zaroorat nahi.' },
                { icon: '📱', title: 'WhatsApp Reminder', desc: 'Appointment se pehle staff WhatsApp pe remind karte hain.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-4 p-4 bg-white rounded-2xl border border-blue-100 shadow-sm">
                  <div className="text-2xl flex-shrink-0">{item.icon}</div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{item.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
              <div className="p-4 bg-blue-600 text-white rounded-2xl">
                <div className="text-sm font-bold mb-1">Existing Patient?</div>
                <p className="text-xs text-blue-100 mb-3">Pehle aa chuke hain? Patient Portal se apne reports bhi dekh sakte hain.</p>
                <Link to="/portal" className="inline-block px-4 py-2 bg-white text-blue-700 text-xs font-bold rounded-xl hover:bg-blue-50 transition-colors">
                  Patient Portal →
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-blue-200 shadow-xl p-6">
              {bookStatus && bookStatus !== 'loading' && bookStatus !== 'error' ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">✅</div>
                  <h3 className="text-xl font-extrabold text-slate-800 mb-2">Appointment Request Bhej Di!</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                    <div className="text-xs text-slate-500 mb-1">Booking Reference</div>
                    <div className="text-2xl font-extrabold text-blue-700">{bookStatus.ref}</div>
                    <div className="text-xs text-slate-400 mt-1">Yeh number sambhal ke rakhein</div>
                  </div>
                  <p className="text-slate-500 text-sm">Staff 1-2 ghante mein WhatsApp pe confirm karenge InshAllah.</p>
                  <button onClick={() => setBookStatus(null)}
                    className="mt-5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-500 transition-colors">
                    Dobara Book Karein
                  </button>
                </div>
              ) : (
                <form onSubmit={handleBookAppointment} className="space-y-4">
                  <h3 className="text-lg font-extrabold text-slate-800">Online Appointment</h3>
                  <p className="text-xs text-slate-400">* Zaroori fields</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Aap ka naam *</label>
                      <input required type="text" value={bookForm.name}
                        onChange={e => setBookForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Ahmad Ali"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp / Phone *</label>
                      <input required type="tel" value={bookForm.phone}
                        onChange={e => setBookForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="0300 1234567"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Doctor (optional)</label>
                      <select value={bookForm.doctor_id}
                        onChange={e => setBookForm(f => ({ ...f, doctor_id: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
                        <option value="">Koi bhi</option>
                        {bookDoctors.map(d => (
                          <option key={d.id} value={d.id}>{d.name}{d.specialization ? ` — ${d.specialization}` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Visit Type</label>
                      <select value={bookForm.appt_type}
                        onChange={e => setBookForm(f => ({ ...f, appt_type: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
                        <option value="consultation">Consultation</option>
                        <option value="lab_test">Lab Test</option>
                        <option value="follow_up">Follow-up</option>
                        <option value="emergency">Emergency</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Tarikh (Date) *</label>
                      <input required type="date" value={bookForm.appt_date}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setBookForm(f => ({ ...f, appt_date: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Waqt (Time)</label>
                      <input type="time" value={bookForm.appt_time}
                        onChange={e => setBookForm(f => ({ ...f, appt_time: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Wajah / Symptoms</label>
                      <textarea value={bookForm.reason} rows={2}
                        onChange={e => setBookForm(f => ({ ...f, reason: e.target.value }))}
                        placeholder="Maslan: bukhar, khoon ki report, sugar check..."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 resize-none" />
                    </div>
                  </div>
                  {bookStatus === 'error' && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      Booking submit nahi ho saki. Dobara try karein ya WhatsApp pe contact karein.
                    </div>
                  )}
                  <button type="submit" disabled={bookStatus === 'loading'}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all text-sm">
                    {bookStatus === 'loading' ? 'Bhej raha hai...' : '📅 Appointment Book Karein'}
                  </button>
                  <p className="text-xs text-center text-slate-400">Staff confirm kar ke WhatsApp pe message karenge</p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ PRICING ══════════ */}
      <section id="pricing" className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1 bg-blue-900 text-blue-300 text-xs font-semibold rounded-full mb-3">Pricing</span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white">Simple Pricing</h2>
            <p className="text-slate-400 mt-2 text-sm">Ek dafa payment — koi monthly charge nahi</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {plans.map((p, i) => (
              <div key={i} className={`rounded-2xl p-6 transition-all ${
                p.highlight
                  ? 'bg-blue-600 ring-2 ring-yellow-400 shadow-2xl shadow-blue-600/30 md:scale-105'
                  : 'bg-slate-800 border border-slate-700 hover:border-slate-500 hover:shadow-xl'
              }`}>
                {p.highlight && (
                  <div className="inline-block text-xs bg-yellow-400 text-slate-900 font-bold px-3 py-1 rounded-full mb-3">⭐ Most Popular</div>
                )}
                <h3 className="text-xl font-extrabold text-white">{p.name}</h3>
                <p className="text-sm text-slate-300 mt-0.5 mb-4">{p.tag}</p>
                <div className="mb-5">
                  <span className="text-3xl font-extrabold text-white">
                    {p.price === 'Contact' ? 'Contact' : `Rs. ${p.price}`}
                  </span>
                  {p.price !== 'Contact' && <span className="text-slate-300 text-sm ml-2">one-time</span>}
                </div>
                <ul className="space-y-2.5 mb-6">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <span className="text-green-400 font-bold">✓</span>
                      <span className={p.highlight ? 'text-blue-100' : 'text-slate-300'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <a href="#contact"
                  className={`block text-center py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                    p.highlight
                      ? 'bg-yellow-400 text-slate-900 hover:bg-yellow-300 shadow-lg'
                      : 'bg-blue-600 text-white hover:bg-blue-500'
                  }`}>
                  {p.cta}
                </a>
              </div>
            ))}
          </div>
          <p className="text-center text-slate-500 text-xs mt-6">Sab prices include: installation + training + initial setup</p>
        </div>
      </section>

      {/* ══════════ CONTACT ══════════ */}
      <section id="contact" className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full mb-4">Free Demo</span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 mb-3">Aaj hi baat karein</h2>
            <p className="text-slate-500 text-sm md:text-base mb-6 leading-relaxed">
              Demo book karo — hum aapki lab mein aa kar system dikhayenge.<br />
              Installation se training tak — sab hum handle karte hain.
            </p>
            <div className="space-y-3">
              {[
                { icon: '💬', label: 'WhatsApp', val: '+92 300 1234567' },
                { icon: '📧', label: 'Email', val: 'info@labprolis.pk' },
                { icon: '🕐', label: 'Working Hours', val: 'Mon–Sat  9am – 6pm' },
                { icon: '📍', label: 'Coverage', val: 'Punjab, KPK, Sindh, AJK' },
              ].map((c, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">{c.icon}</div>
                  <div>
                    <div className="text-xs text-slate-500">{c.label}</div>
                    <div className="text-slate-800 font-semibold text-sm">{c.val}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 md:p-8">
            {submitted ? (
              <div className="text-center py-10">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Shukriya!</h3>
                <p className="text-slate-500 text-sm">Aap ka WhatsApp message gaya. Hum jald contact karenge InshAllah.</p>
                <button onClick={() => setSubmitted(false)} className="mt-6 text-sm text-blue-600 hover:underline">Dobara bhejein</button>
              </div>
            ) : (
              <form onSubmit={handleContact} className="space-y-4">
                <h3 className="text-lg font-extrabold text-slate-800">Free Demo Book Karein</h3>
                <p className="text-xs text-slate-500">Form fill karo — WhatsApp message khud bhej dega</p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Aap ka naam *</label>
                  <input required type="text" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Dr. Ahmad Ali"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Number *</label>
                  <input required type="tel" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="0300 1234567"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Lab ka naam</label>
                    <input type="text" value={form.lab}
                      onChange={e => setForm(f => ({ ...f, lab: e.target.value }))}
                      placeholder="City Lab"
                      className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                    <input type="text" value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      placeholder="Lahore"
                      className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
                  </div>
                </div>
                <button type="submit"
                  className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-xl shadow-green-500/30 transition-all active:scale-95 text-sm md:text-base">
                  📱 WhatsApp pe Demo Book Karein
                </button>
                <p className="text-xs text-center text-slate-400">Free consultation — koi commitment nahi</p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="bg-slate-900 border-t border-slate-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">

            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-xl">🧬</div>
                <div>
                  <div className="font-bold text-white leading-none">LabPro LIS</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Pakistan Lab Software</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Pakistan ka complete Lab + Hospital management system. Private labs aur hospitals ke liye built.
              </p>
              <a href="https://wa.me/923001234567" target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-xl transition-colors">
                💬 WhatsApp pe Contact
              </a>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Quick Links</h4>
              <div className="space-y-2.5">
                {[['#features','Features'],['#how','How It Works'],['#pricing','Pricing'],['#contact','Contact Us']].map(([h,l]) => (
                  <a key={h} href={h} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                    <span className="w-1 h-1 bg-slate-600 rounded-full flex-shrink-0" />
                    {l}
                  </a>
                ))}
              </div>
            </div>

            {/* Access */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Access</h4>
              <div className="space-y-2.5">
                <Link to="/login" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                  <span className="text-base">🔐</span> Staff Login
                </Link>
                <Link to="/portal" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                  <span className="text-base">🏥</span> Patient Portal
                </Link>
                <Link to="/signup" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                  <span className="text-base">📝</span> Register Account
                </Link>
                <a href="#book" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                  <span className="text-base">📅</span> Book Appointment
                </a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-slate-800 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-600">© 2025 LabPro LIS — Made with ❤️ in Pakistan 🇵🇰</p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-600">Lab · Hospital · Finance · Clinical</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
