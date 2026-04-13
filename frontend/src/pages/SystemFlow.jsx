import { useState } from 'react'
import { Link } from 'react-router-dom'

// ─── Complete system flow data ───────────────────────────────────────────────
const PHASES = [
  {
    id: 'setup',
    phase: 'PHASE 0',
    title: 'Lab Setup (Ek Dafa)',
    subtitle: 'Sirf pehli baar — phir dobara nahi',
    icon: '⚙️',
    color: 'slate',
    steps: [
      {
        n: '0.1', icon: '🏥', title: 'Lab Info Set Karo',
        desc: 'Lab ka naam, phone, address, logo, pathologist signature — sab settings mein daalo.',
        page: '/settings', pageLabel: 'Settings',
        role: 'Admin', time: '5 min',
        detail: 'Settings → Lab name, address, WhatsApp API key, email. Yeh info sab reports pe print hogi.',
        status: 'ready',
      },
      {
        n: '0.2', icon: '👥', title: 'Users / Staff Banao',
        desc: 'Receptionist, technician, doctor — har role ke liye alag login.',
        page: '/users', pageLabel: 'Users',
        role: 'Admin', time: '5 min',
        detail: 'Admin → Users → Add User. Roles: admin, receptionist, technician, doctor. Har role alag pages dekhta hai.',
        status: 'ready',
      },
      {
        n: '0.3', icon: '🔬', title: 'Test Catalog Add Karo',
        desc: 'CBC, LFT, RFT, HbA1c — sab tests, unki prices, reference ranges.',
        page: '/tests', pageLabel: 'Test Catalog',
        role: 'Admin', time: '15 min',
        detail: 'Tests mein test code, naam, price, unit, normal range (male/female alag) daalo. Ya CSV se import karo.',
        status: 'ready',
      },
      {
        n: '0.4', icon: '📦', title: 'Test Packages Banao',
        desc: '"Basic Health Package" = CBC + LFT + RFT — discount price mein.',
        page: '/packages', pageLabel: 'Test Packages',
        role: 'Admin', time: '10 min',
        detail: 'Multiple tests ko ek package mein bundle karo. Billing mein easily select ho jata hai.',
        status: 'ready',
      },
      {
        n: '0.5', icon: '🩺', title: 'Doctors Add Karo',
        desc: 'Referring doctors — jinke patients tests karwate hain.',
        page: '/doctors', pageLabel: 'Doctors',
        role: 'Admin', time: '10 min',
        detail: 'Doctor naam, specialization, phone number. Sample register karte waqt doctor select hoga. Critical result pe doctor ko WhatsApp alert jayega.',
        status: 'ready',
      },
      {
        n: '0.6', icon: '📅', title: 'Doctor Schedule Set Karo',
        desc: 'Kaun doctor kaun se din available hai — reception dekhti hai.',
        page: '/doctor-schedule', pageLabel: 'Doctor Schedule',
        role: 'Admin', time: '5 min',
        detail: 'Har doctor ke liye days aur timing set karo. Aaj kaun available hai — dashboard pe dikhta hai.',
        status: 'ready',
      },
      {
        n: '0.7', icon: '🏢', title: 'Branches (Optional)',
        desc: 'Multiple lab locations — sab ek system mein.',
        page: '/branches', pageLabel: 'Branches',
        role: 'Admin', time: '5 min',
        detail: 'Agar aapki multiple branches hain toh yahan set karo. Reports branch-wise filter ho sakti hain.',
        status: 'ready',
      },
      {
        n: '0.8', icon: '🔌', title: 'Machine Connect Karo',
        desc: 'Sysmex, Mindray etc — COM port ya LAN se connect.',
        page: '/machine-test', pageLabel: 'Machine Test',
        role: 'Admin/Technician', time: '30 min',
        detail: 'Machine Test → Demo Simulator se pehle test karo. Real machine ke liye: Settings → Machine → COM port set karo → Start Listener.',
        status: 'ready',
      },
    ],
  },
  {
    id: 'patient',
    phase: 'PHASE 1',
    title: 'Patient Aaya',
    subtitle: 'Har roz — har patient ke liye',
    icon: '👤',
    color: 'blue',
    steps: [
      {
        n: '1.1', icon: '🎫', title: 'Token / Queue Number Do',
        desc: 'Patient aata hai — token machine se number milta hai. Waiting room mein display hota hai.',
        page: '/token-queue', pageLabel: 'Token Queue',
        role: 'Receptionist', time: '30 sec',
        detail: 'Token Queue → New Token → Patient naam, phone → Token number print ya display. "Counter 1", "Blood Draw" jaise counters set kar sakte ho.',
        status: 'ready',
      },
      {
        n: '1.2', icon: '👤', title: 'Patient Register Karo',
        desc: 'Naam, age, gender, phone, address — MRN auto generate hoti hai.',
        page: '/patients/new', pageLabel: 'New Patient',
        role: 'Receptionist', time: '1 min',
        detail: 'New Patient → fill form → Save. MRN automatic banti hai (e.g. MRN-2026-001). Dobara aane wale patient already exist karega — search karo.',
        status: 'ready',
      },
      {
        n: '1.3', icon: '💰', title: 'Invoice Banao / Payment Lo',
        desc: 'Tests select karo, price auto aati hai, discount do, payment method choose karo.',
        page: '/billing', pageLabel: 'Billing',
        role: 'Receptionist', time: '1 min',
        detail: 'Billing → Patient search → Tests add karo (ya package select) → Total auto calculate → Cash/Card → Save. Receipt print hoti hai.',
        status: 'ready',
      },
    ],
  },
  {
    id: 'sample',
    phase: 'PHASE 2',
    title: 'Sample Collection',
    subtitle: 'Lab technician / Phlebotomist',
    icon: '🧪',
    color: 'purple',
    steps: [
      {
        n: '2.1', icon: '🏷️', title: 'Sample Register + Barcode',
        desc: 'Sample ID generate ho, barcode print ho, tube pe laga do.',
        page: '/samples/new', pageLabel: 'New Sample',
        role: 'Technician', time: '30 sec',
        detail: 'New Sample → Patient search → Test panel select → Sample ID auto ya manual → Save → Barcode label print. Tube pe chipka do.',
        status: 'ready',
      },
      {
        n: '2.2', icon: '🩸', title: 'Blood Draw / Collection',
        desc: 'Phlebotomist blood draw karta hai — tube barcode scan hoti hai.',
        page: null, pageLabel: null,
        role: 'Phlebotomist', time: '3-5 min',
        detail: 'Yeh physical process hai — system mein alag page nahi. Sample collect ho kar machine ke paas jaata hai.',
        status: 'physical',
      },
      {
        n: '2.3', icon: '🔬', title: 'Machine Pe Sample Load',
        desc: 'Tube machine mein daalo — machine barcode scan karta hai automatically.',
        page: null, pageLabel: null,
        role: 'Technician', time: '1 min',
        detail: 'Machine ka barcode reader tube scan karta hai — patient ID aur sample ID automatically match hoti hai.',
        status: 'physical',
      },
    ],
  },
  {
    id: 'results',
    phase: 'PHASE 3',
    title: 'Results Aaye',
    subtitle: 'Machine se automatic ya manual entry',
    icon: '📊',
    color: 'green',
    steps: [
      {
        n: '3.1', icon: '📡', title: 'Machine Results Auto-Receive',
        desc: 'Machine analysis karta hai → HL7/ASTM data bhejta hai → System receive karta hai.',
        page: '/machine-test', pageLabel: 'Machine Test',
        role: 'Automatic', time: '0 sec',
        detail: 'Background mein listener chalta hai. Machine ka data automatically aata hai, parse hota hai, database mein save hota hai. Koi action nahi chahiye.',
        status: 'auto',
      },
      {
        n: '3.2', icon: '✍️', title: 'Manual Entry (Backup)',
        desc: 'Agar machine connected nahi — values manually type karo.',
        page: '/manual-results/SAMPLE-ID', pageLabel: 'Manual Results',
        role: 'Technician', time: '2-5 min',
        detail: 'Samples → Sample ID → Manual Results → values type karo → Save. System automatically H/L/HH/LL flag lagata hai values vs reference range compare karke.',
        status: 'ready',
      },
      {
        n: '3.3', icon: '🏷️', title: 'Auto Flag — H / L / HH / LL',
        desc: 'Value normal range se bahar ho toh system automatically flag lagata hai.',
        page: null, pageLabel: null,
        role: 'Automatic', time: '0 sec',
        detail: 'H = High, L = Low, HH = Critical High, LL = Critical Low. Yeh sab automatically hota hai — technician ko manually dekhna nahi padta.',
        status: 'auto',
      },
    ],
  },
  {
    id: 'verify',
    phase: 'PHASE 4',
    title: 'Verification & Report',
    subtitle: 'Pathologist / Senior Technician',
    icon: '✅',
    color: 'orange',
    steps: [
      {
        n: '4.1', icon: '🔍', title: 'Results Review Karo',
        desc: 'Results table dekho — flagged values red/blue mein highlight hain. Previous results bhi dikhte hain comparison ke liye.',
        page: '/results/SAMPLE-ID', pageLabel: 'Results',
        role: 'Pathologist', time: '2 min',
        detail: 'Results page → test values + flag + previous result (trend) + reference range. HH/LL values immediately dikhti hain.',
        status: 'ready',
      },
      {
        n: '4.2', icon: '📝', title: 'Pathologist Notes Likho',
        desc: 'Har test ke liye clinical comment — yeh PDF report pe print hoga.',
        page: '/results/SAMPLE-ID', pageLabel: 'Results → Notes',
        role: 'Pathologist', time: '2 min',
        detail: 'Results page ke neeche "Pathologist Notes" section hai. Har test ke liye alag comment — "Repeat test suggested", "Clinical correlation advised" etc.',
        status: 'ready',
      },
      {
        n: '4.3', icon: '✅', title: 'Verify Karo',
        desc: 'Verification click karo — report final ho jata hai.',
        page: '/verification', pageLabel: 'Verification',
        role: 'Pathologist', time: '10 sec',
        detail: 'Verification page → Pending samples list → Verify button. Is ek click se: report final, WhatsApp send, critical alert doctor ko.',
        status: 'ready',
      },
      {
        n: '4.4', icon: '📱', title: 'Auto WhatsApp — Patient',
        desc: 'Verify hote hi patient ko PDF report WhatsApp pe chali jaati hai.',
        page: null, pageLabel: null,
        role: 'Automatic', time: '0 sec',
        detail: 'Patient ke phone number pe PDF attachment ke saath WhatsApp message. "Assalam o Alaikum, aap ka lab report ready hai..."',
        status: 'auto',
      },
      {
        n: '4.5', icon: '🚨', title: 'Critical Alert — Doctor',
        desc: 'HH/LL result ho toh referring doctor ko automatic WhatsApp alert.',
        page: null, pageLabel: null,
        role: 'Automatic', time: '0 sec',
        detail: 'Doctor ke phone pe: "CRITICAL RESULT ALERT — Patient: Ahmed Khan — WBC: 38.5 (CRITICAL HIGH) — Please review immediately."',
        status: 'auto',
      },
    ],
  },
  {
    id: 'report',
    phase: 'PHASE 5',
    title: 'Reports & Delivery',
    subtitle: 'Final output — patient ko dena',
    icon: '📄',
    color: 'teal',
    steps: [
      {
        n: '5.1', icon: '📄', title: 'PDF Report Print / Download',
        desc: 'Branded PDF — lab logo, QR code, pathologist signature ke saath.',
        page: '/report/SAMPLE-ID', pageLabel: 'Report',
        role: 'Receptionist / Technician', time: '10 sec',
        detail: 'Report page → Print ya Download PDF. Report mein: patient info, test results, reference ranges, flags, pathologist notes, QR code (scan karo — portal pe verify hoga).',
        status: 'ready',
      },
      {
        n: '5.2', icon: '📱', title: 'WhatsApp Re-send (Manual)',
        desc: 'Agar patient ne nahi mila — manually dobara bhejo.',
        page: null, pageLabel: null,
        role: 'Receptionist', time: '10 sec',
        detail: 'Samples → Sample → WhatsApp button. Ya direct link generate karo.',
        status: 'ready',
      },
      {
        n: '5.3', icon: '🌐', title: 'Patient Portal — Online Dekhe',
        desc: 'Patient apne phone se QR scan kare ya portal pe login kare — report dekhe.',
        page: '/portal', pageLabel: 'Patient Portal',
        role: 'Patient', time: 'Self-service',
        detail: 'Patient portal pe MRN ya phone se login → apni reports dekho. QR code scan karo report pe → directly us report pe jaao.',
        status: 'ready',
      },
    ],
  },
  {
    id: 'doctor',
    phase: 'PHASE 6',
    title: 'Doctor Workflow',
    subtitle: 'Referring doctor / In-house doctor',
    icon: '🩺',
    color: 'indigo',
    steps: [
      {
        n: '6.1', icon: '🏥', title: 'Doctor Dashboard',
        desc: 'Doctor apne patients ke sab pending aur ready results dekhta hai.',
        page: '/doctor-dashboard', pageLabel: 'Doctor Dashboard',
        role: 'Doctor', time: 'Anytime',
        detail: 'Doctor role se login karo → Doctor Dashboard → apne referred patients ki list → pending results → verified reports. Critical count bhi dikhta hai.',
        status: 'ready',
      },
      {
        n: '6.2', icon: '💊', title: 'Prescription Likho',
        desc: 'Lab results ke baad doctor prescription write karta hai — digital.',
        page: '/prescriptions', pageLabel: 'Prescriptions',
        role: 'Doctor', time: '2-3 min',
        detail: 'Prescriptions → New → Patient select → Diagnosis → Medicines add karo (naam, dose, frequency, duration) → Save → Print.',
        status: 'ready',
      },
    ],
  },
  {
    id: 'hospital',
    phase: 'PHASE 7',
    title: 'Hospital Modules',
    subtitle: 'OPD · IPD · Wards · Radiology · OT · Pharmacy',
    icon: '🏥',
    color: 'teal',
    steps: [
      {
        n: '7.1', icon: '🏥', title: 'OPD Visit',
        desc: 'Patient outpatient visit register karo — doctor assign, vitals, referral to lab/radiology.',
        page: '/opd', pageLabel: 'OPD',
        role: 'Receptionist / Doctor', time: '2 min',
        detail: 'OPD → New Visit → Patient search → Doctor select → Vitals (BP, temp, weight) → Chief complaint → Refer to: Lab / Radiology / Pharmacy checkboxes → Save. Visit history tab shows previous visits.',
        status: 'ready',
      },
      {
        n: '7.2', icon: '🛏️', title: 'IPD Admission',
        desc: 'Patient admit karo — ward + bed assign, admission type, diagnosis.',
        page: '/ipd', pageLabel: 'IPD / Admissions',
        role: 'Receptionist / Ward Staff', time: '3 min',
        detail: 'IPD → New Admission → Patient search → Ward select → available beds auto-load → Bed assign → Admission type (emergency/planned/transfer) → Doctor → Diagnosis → Admit. Discharge button auto-frees the bed.',
        status: 'ready',
      },
      {
        n: '7.3', icon: '🗂️', title: 'Ward & Bed Management',
        desc: 'Visual bed map — green (available), red (occupied), yellow (maintenance). Patient finder by name.',
        page: '/wards', pageLabel: 'Wards & Beds',
        role: 'Ward In-charge / Admin', time: 'Real-time',
        detail: 'Wards → left panel shows ward list with stats → right panel shows visual bed grid. Color coding: green=available, red=occupied, yellow=maintenance, blue=reserved. PatientFinder: type patient name → bed highlights with yellow ring animation across all wards.',
        status: 'ready',
      },
      {
        n: '7.4', icon: '📡', title: 'Radiology Order & Report',
        desc: 'X-Ray / MRI / CT / Ultrasound orders → report upload → findings + impression.',
        page: '/radiology', pageLabel: 'Radiology',
        role: 'Radiologist / Technician', time: '5 min',
        detail: 'Radiology → New Order → Patient → modality (X-Ray/MRI/CT/US/Echo/Mammography) → body part → priority (routine/urgent/STAT) → Order. Radiologist opens order → Write Report: findings, impression, recommendations → Complete. Status: ordered → in-progress → completed.',
        status: 'ready',
      },
      {
        n: '7.5', icon: '⚕️', title: 'Operation Theater',
        desc: 'Theater schedule, surgery booking, anesthesia notes, post-op record.',
        page: '/ot', pageLabel: 'Operation Theater',
        role: 'Surgeon / OT Coordinator', time: '5 min',
        detail: 'OT → Theater cards show status (available/occupied/cleaning/maintenance). Schedule Surgery → Patient → Theater → Surgeon + Anesthetist → procedure type + ICD code → scheduled time → Save. Quick status dropdown changes surgery state. Post-Op Notes modal for surgeon notes + anesthesia duration.',
        status: 'ready',
      },
      {
        n: '7.6', icon: '💊', title: 'Pharmacy Dispensing',
        desc: 'Dispense medicines, track stock, low-stock alerts, patient-wise dispensing history.',
        page: '/pharmacy-store', pageLabel: 'Pharmacy',
        role: 'Pharmacist', time: '2 min',
        detail: 'Pharmacy → two tabs: Dispenses + Medicines. New Dispense → Patient (optional) → Search medicine → Add to cart → quantity/price auto-fill → live total → Dispense (deducts stock). Medicines tab: stock ± buttons, low stock highlighted in red. Dispense delete restores stock.',
        status: 'ready',
      },
    ],
  },
  {
    id: 'admin',
    phase: 'PHASE 8',
    title: 'Management & Admin',
    subtitle: 'Daily operations aur analytics',
    icon: '📈',
    color: 'pink',
    steps: [
      {
        n: '8.1', icon: '📊', title: 'Dashboard — Roz Dekho',
        desc: "Today's samples, revenue, pending, critical — sab ek nazar mein.",
        page: '/', pageLabel: 'Dashboard',
        role: 'Admin / Manager', time: 'Daily',
        detail: 'Login karte hi dashboard. Today samples, pending verification, completed, revenue, critical alerts — sab live numbers.',
        status: 'ready',
      },
      {
        n: '8.2', icon: '📝', title: 'Daily Closing',
        desc: 'Din ka report — kitne samples, kitna revenue, kaun si tests.',
        page: '/daily-closing', pageLabel: 'Daily Closing',
        role: 'Admin', time: '2 min',
        detail: 'Daily Closing → Date select → Summary: total samples, total revenue, payment methods, top tests. Print ya export karo.',
        status: 'ready',
      },
      {
        n: '8.3', icon: '📦', title: 'Inventory Check',
        desc: 'Reagents, consumables — kaun sa low hai, kab expire ho raha hai.',
        page: '/inventory', pageLabel: 'Inventory',
        role: 'Admin / Technician', time: '5 min',
        detail: 'Inventory → items list → low stock highlighted. Stock add karo ya use record karo. Expiry date alert.',
        status: 'ready',
      },
      {
        n: '8.4', icon: '📈', title: 'MIS Reports',
        desc: 'Weekly/Monthly revenue, test volume trends, staff performance.',
        page: '/reports', pageLabel: 'MIS Reports',
        role: 'Admin', time: '5 min',
        detail: 'MIS Reports → date range → charts: revenue trend, top tests, patient count. Export to CSV.',
        status: 'ready',
      },
      {
        n: '8.5', icon: '🔍', title: 'Audit Log',
        desc: 'Kisi ne kya kiya — complete trail. Security ke liye.',
        page: '/audit-log', pageLabel: 'Audit Log',
        role: 'Admin', time: 'As needed',
        detail: 'Audit Log → har action recorded: login, report verify, setting change, WhatsApp send — user, time, IP sab.',
        status: 'ready',
      },
      {
        n: '8.6', icon: '💾', title: 'Data Export / Import',
        desc: 'Patients, results, invoices — CSV mein export. Old data import karo.',
        page: '/export', pageLabel: 'Data Export',
        role: 'Admin', time: '2 min',
        detail: 'Export: patients list, all results, invoice history → CSV. Import: Excel/CSV se bulk patients ya doctors add karo.',
        status: 'ready',
      },
    ],
  },
]

const MISSING = [
  { icon: '🏠', title: 'Home Sample Collection', desc: 'Patient ghar se request kare, phlebotomist jaaye — tracking system.', priority: 'MEDIUM' },
  { icon: '🏠', title: 'Home Sample Collection', desc: 'Patient ghar se request kare, phlebotomist jaaye — tracking system.', priority: 'MEDIUM' },
  { icon: '📲', title: 'SMS Fallback', desc: 'WhatsApp na ho toh SMS se report link bhejo (Telenor/Jazz API).', priority: 'MEDIUM' },
  { icon: '📋', title: 'Doctor Test Orders', desc: 'Doctor system mein test order kare → sample collection trigger ho.', priority: 'MEDIUM' },
  { icon: '📅', title: 'Appointment Booking', desc: 'Patient online appointment book kare → slot milے.', priority: 'LOW' },
  { icon: '🔗', title: 'OPD → Lab Auto-Link', desc: 'OPD referral se automatic lab sample register ho — manual step remove ho.', priority: 'MEDIUM' },
  { icon: '💳', title: 'Insurance / TPA Billing', desc: 'Insurance company billing, pre-authorization, claim tracking.', priority: 'MEDIUM' },
]

const colorScheme = {
  slate:  { header: 'bg-slate-800',   badge: 'bg-slate-100 text-slate-700',   border: 'border-slate-200', dot: 'bg-slate-500' },
  blue:   { header: 'bg-blue-700',    badge: 'bg-blue-100 text-blue-700',     border: 'border-blue-200',  dot: 'bg-blue-500' },
  purple: { header: 'bg-purple-700',  badge: 'bg-purple-100 text-purple-700', border: 'border-purple-200',dot: 'bg-purple-500' },
  green:  { header: 'bg-green-700',   badge: 'bg-green-100 text-green-700',   border: 'border-green-200', dot: 'bg-green-500' },
  orange: { header: 'bg-orange-600',  badge: 'bg-orange-100 text-orange-700', border: 'border-orange-200',dot: 'bg-orange-500' },
  teal:   { header: 'bg-teal-700',    badge: 'bg-teal-100 text-teal-700',     border: 'border-teal-200',  dot: 'bg-teal-500' },
  indigo: { header: 'bg-indigo-700',  badge: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-200',dot: 'bg-indigo-500' },
  pink:   { header: 'bg-pink-700',    badge: 'bg-pink-100 text-pink-700',     border: 'border-pink-200',  dot: 'bg-pink-500' },
}

export default function SystemFlow() {
  const [expanded, setExpanded] = useState({})
  const [activePhase, setActivePhase] = useState(null)
  const [showMissing, setShowMissing] = useState(false)
  const [viewMode, setViewMode] = useState('phases') // 'phases' | 'timeline'

  const toggle = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }))

  const statusBadge = (status) => {
    const map = {
      ready:    'bg-green-100 text-green-700 border-green-200',
      auto:     'bg-blue-100 text-blue-700 border-blue-200',
      physical: 'bg-slate-100 text-slate-600 border-slate-200',
    }
    const label = { ready: '✅ Ready', auto: '⚡ Automatic', physical: '👐 Manual/Physical' }
    return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${map[status]}`}>{label[status]}</span>
  }

  const totalSteps = PHASES.reduce((a, p) => a + p.steps.length, 0)
  const autoSteps = PHASES.reduce((a, p) => a + p.steps.filter(s => s.status === 'auto').length, 0)
  const readySteps = PHASES.reduce((a, p) => a + p.steps.filter(s => s.status === 'ready').length, 0)

  return (
    <div className="animate-fadeIn max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Complete System Flow</h2>
            <p className="text-sm text-slate-500 mt-1">Patient se report tak — poora process ek jagah</p>
          </div>
          <button
            onClick={() => setShowMissing(!showMissing)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              showMissing ? 'bg-red-600 text-white border-red-600' : 'bg-white border-red-200 text-red-600 hover:bg-red-50'
            }`}
          >
            {showMissing ? '✕ Hide' : '⚠️ Missing Features'} ({MISSING.length})
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { n: PHASES.length,    label: 'Phases', icon: '📋', color: 'bg-slate-50 border-slate-200' },
            { n: totalSteps,       label: 'Total Steps', icon: '🔢', color: 'bg-blue-50 border-blue-200' },
            { n: readySteps,       label: 'Built & Ready', icon: '✅', color: 'bg-green-50 border-green-200' },
            { n: autoSteps,        label: 'Fully Automatic', icon: '⚡', color: 'bg-indigo-50 border-indigo-200' },
          ].map((s, i) => (
            <div key={i} className={`rounded-xl border p-3 text-center ${s.color}`}>
              <div className="text-xl mb-0.5">{s.icon}</div>
              <div className="text-2xl font-extrabold text-slate-800">{s.n}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Missing features panel */}
      {showMissing && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
          <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2">
            <span>⚠️</span> Missing / Future Features
            <span className="text-xs font-normal text-red-500">(abhi available nahi — future mein add ho sakte hain)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MISSING.map((m, i) => (
              <div key={i} className="bg-white rounded-xl border border-red-100 p-3 flex gap-3">
                <span className="text-2xl flex-shrink-0">{m.icon}</span>
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{m.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{m.desc}</div>
                  <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    m.priority.includes('HIGH') ? 'bg-red-100 text-red-700' :
                    m.priority.includes('MEDIUM') ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{m.priority}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick phase nav */}
      <div className="flex gap-2 flex-wrap mb-6">
        {PHASES.map(p => {
          const c = colorScheme[p.color]
          return (
            <button
              key={p.id}
              onClick={() => {
                setActivePhase(activePhase === p.id ? null : p.id)
                document.getElementById(p.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                activePhase === p.id
                  ? `${c.header} text-white border-transparent shadow-md`
                  : `bg-white ${c.border} text-slate-700 hover:shadow-sm`
              }`}
            >
              {p.icon} {p.phase}: {p.title}
            </button>
          )
        })}
      </div>

      {/* Phases */}
      <div className="space-y-5">
        {PHASES.map(phase => {
          const c = colorScheme[phase.color]
          return (
            <div key={phase.id} id={phase.id} className={`rounded-2xl border ${c.border} overflow-hidden shadow-sm`}>
              {/* Phase header */}
              <div className={`${c.header} text-white px-5 py-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{phase.icon}</span>
                    <div>
                      <div className="text-xs font-bold opacity-70 uppercase tracking-wider">{phase.phase}</div>
                      <div className="font-extrabold text-lg leading-tight">{phase.title}</div>
                      <div className="text-xs opacity-80 mt-0.5">{phase.subtitle}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-lg">{phase.steps.length} steps</span>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-lg">
                      {phase.steps.filter(s => s.status === 'auto').length} auto
                    </span>
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div className="divide-y divide-slate-100 bg-white">
                {phase.steps.map((step, i) => (
                  <div key={step.n} className="hover:bg-slate-50 transition-colors">
                    {/* Step header row */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                      onClick={() => toggle(`${phase.id}-${i}`)}
                    >
                      {/* Number bubble */}
                      <div className={`w-8 h-8 rounded-full ${c.header} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow`}>
                        {step.n}
                      </div>

                      {/* Icon + title + desc */}
                      <div className="text-xl flex-shrink-0">{step.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800 text-sm">{step.title}</span>
                          {statusBadge(step.status)}
                          <span className="text-[10px] text-slate-400">{step.role}</span>
                          {step.time && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">⏱ {step.time}</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">{step.desc}</div>
                      </div>

                      {/* Page link */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {step.page && !step.page.includes('SAMPLE-ID') && (
                          <Link
                            to={step.page}
                            onClick={e => e.stopPropagation()}
                            className={`text-[11px] px-2.5 py-1 rounded-lg ${c.badge} font-semibold hover:opacity-80 transition-opacity border ${c.border}`}
                          >
                            → {step.pageLabel}
                          </Link>
                        )}
                        <span className="text-slate-300 text-xs">{expanded[`${phase.id}-${i}`] ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {expanded[`${phase.id}-${i}`] && (
                      <div className="px-4 pb-4 ml-11 animate-fadeIn">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <div className="text-xs text-slate-600 leading-relaxed">
                            <strong className="text-slate-700">Detail:</strong> {step.detail}
                          </div>
                          {step.page && !step.page.includes('SAMPLE-ID') && (
                            <Link
                              to={step.page}
                              className={`inline-block mt-2 px-3 py-1.5 ${c.header} text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-all`}
                            >
                              Open: {step.pageLabel} →
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom summary */}
      <div className="mt-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <h3 className="font-extrabold text-lg mb-4">Client Demo Mein Kya Dikhao</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { step: '1', title: 'Patient Register', action: 'New Patient → form fill → save', time: '1 min', page: '/patients/new' },
            { step: '2', title: 'Sample Register', action: 'New Sample → test select → barcode', time: '30 sec', page: '/samples/new' },
            { step: '3', title: 'Machine Simulation', action: 'Machine Test → Run Demo → live log', time: '30 sec', page: '/machine-test' },
            { step: '4', title: 'Verify & Report', action: 'Verification → Verify → WhatsApp sent', time: '10 sec', page: '/verification' },
            { step: '5', title: 'PDF Report', action: 'Report page → print / download', time: '5 sec', page: null },
            { step: '6', title: 'Dashboard', action: "Today's stats — revenue, samples, pending", time: '1 min', page: '/' },
            { step: '7', title: 'Hospital: OPD Visit', action: 'OPD → New Visit → doctor assign → refer to lab', time: '2 min', page: '/opd' },
            { step: '8', title: 'Hospital: Wards Map', action: 'Wards → visual bed grid → patient search', time: '1 min', page: '/wards' },
          ].map((d, i) => (
            <div key={i} className="flex items-start gap-3 bg-white/10 rounded-xl p-3">
              <div className="w-7 h-7 bg-blue-500 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{d.step}</div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{d.title}</div>
                <div className="text-xs text-slate-300 mt-0.5">{d.action}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">⏱ ~{d.time}</div>
              </div>
              {d.page && (
                <Link to={d.page} className="text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded-lg flex-shrink-0 transition-colors">
                  Open →
                </Link>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-white/20 text-xs text-slate-400">
          Lab demo: ~5 min | Hospital demo: +3 min (OPD + Wards) | Machine Test mein "CRITICAL WBC" demo + Wards visual bed map sabse zyada impact karta hai
        </div>
      </div>
    </div>
  )
}
