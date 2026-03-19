export default function UserGuide() {
  const steps = [
    {
      title: 'Step 1: Initial Setup',
      icon: '⚙️',
      tasks: [
        { role: 'Admin', action: 'Go to Settings → set lab name, phone, address, email' },
        { role: 'Admin', action: 'Go to Categories → click "Load Default Values"' },
        { role: 'Admin', action: 'Go to Test Catalog → add all tests your lab offers with prices' },
        { role: 'Admin', action: 'Go to Users → create staff accounts (receptionist, technician, doctor)' },
        { role: 'Admin', action: 'Go to Doctors → add referring doctors' },
        { role: 'Admin', action: '(Optional) Go to Data Import → import existing patient data from CSV' },
        { role: 'Admin', action: '(Optional) Go to Settings → upload pathologist digital signature' },
      ],
    },
    {
      title: 'Step 2: Daily Workflow — Patient Arrives',
      icon: '🏥',
      tasks: [
        { role: 'Receptionist', action: 'Token Queue → generate token for walk-in patient' },
        { role: 'Receptionist', action: 'New Patient → register patient (if first visit)' },
        { role: 'Receptionist', action: 'New Sample → assign sample ID (barcode), select patient & test panel' },
        { role: 'Receptionist', action: 'Billing → create invoice, collect payment, print receipt' },
      ],
    },
    {
      title: 'Step 3: Blood Collection',
      icon: '💉',
      tasks: [
        { role: 'Phlebotomist', action: 'Collect blood sample from patient' },
        { role: 'Phlebotomist', action: 'Stick barcode label on tube (print from Report page)' },
        { role: 'Phlebotomist', action: 'Samples page → change status to "Collected"' },
        { role: 'Lab Staff', action: 'When tube reaches lab → change status to "Received"' },
      ],
    },
    {
      title: 'Step 4: Machine Processing',
      icon: '🔬',
      tasks: [
        { role: 'Technician', action: 'Load sample into analyzer machine (Sysmex/Mindray/etc.)' },
        { role: 'System', action: 'Machine sends results automatically via serial/TCP connection' },
        { role: 'System', action: 'HL7/ASTM parser extracts results → saves to database' },
        { role: 'System', action: 'Sample status auto-updates to "Completed"' },
        { role: 'Technician', action: 'If machine offline → Samples → "Enter Results" manually' },
      ],
    },
    {
      title: 'Step 5: Verification',
      icon: '✅',
      tasks: [
        { role: 'Technician', action: 'Verification page → review results, check for errors' },
        { role: 'Technician', action: 'Click "Approve & Verify" to finalize results' },
        { role: 'Pathologist', action: 'Review critical/abnormal results if needed' },
      ],
    },
    {
      title: 'Step 6: Report Delivery',
      icon: '📄',
      tasks: [
        { role: 'Receptionist', action: 'Report page → Download PDF or Print report' },
        { role: 'Receptionist', action: 'Send via WhatsApp → click "Send WhatsApp" on report page' },
        { role: 'System', action: 'Patient gets SMS: "Your report is ready"' },
        { role: 'Patient', action: 'Patient Portal → login with MRN + Phone to view reports online' },
      ],
    },
    {
      title: 'Step 7: End of Day',
      icon: '📝',
      tasks: [
        { role: 'Receptionist', action: 'Daily Closing → review total collection, payment breakdown' },
        { role: 'Receptionist', action: 'Print daily closing report → sign cash handover' },
        { role: 'Admin', action: 'MIS Reports → check daily/weekly/monthly analytics' },
        { role: 'Admin', action: 'Settings → Download database backup' },
      ],
    },
  ]

  const roleColors = {
    Admin: 'bg-red-100 text-red-700',
    Receptionist: 'bg-purple-100 text-purple-700',
    Technician: 'bg-blue-100 text-blue-700',
    Phlebotomist: 'bg-orange-100 text-orange-700',
    Pathologist: 'bg-green-100 text-green-700',
    System: 'bg-slate-100 text-slate-700',
    Patient: 'bg-cyan-100 text-cyan-700',
    'Lab Staff': 'bg-amber-100 text-amber-700',
  }

  return (
    <div className="animate-fadeIn max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">User Guide</h2>
        <p className="text-sm text-slate-500 mt-1">Complete workflow documentation — from setup to daily operations</p>
      </div>

      {/* Quick Role Reference */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8">
        <h3 className="font-semibold text-slate-700 mb-4">Who Does What?</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { role: 'Admin', desc: 'System setup, users, settings, reports', icon: '🔑' },
            { role: 'Receptionist', desc: 'Register patients, samples, billing', icon: '💻' },
            { role: 'Technician', desc: 'Run machines, enter/verify results', icon: '🔬' },
            { role: 'Pathologist', desc: 'Review critical results, sign reports', icon: '👨‍⚕️' },
          ].map((r, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl text-center">
              <div className="text-2xl mb-1">{r.icon}</div>
              <div className="font-bold text-sm text-slate-800">{r.role}</div>
              <div className="text-xs text-slate-500 mt-1">{r.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow Steps */}
      <div className="space-y-6 animate-stagger">
        {steps.map((step, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border overflow-hidden card-animate">
            <div className="p-4 bg-gradient-to-r from-slate-50 to-white border-b flex items-center gap-3">
              <span className="text-2xl">{step.icon}</span>
              <h3 className="font-bold text-slate-800">{step.title}</h3>
            </div>
            <div className="p-4">
              {step.tasks.map((task, j) => (
                <div key={j} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${roleColors[task.role] || 'bg-slate-100'}`}>
                    {task.role}
                  </span>
                  <span className="text-sm text-slate-700">{task.action}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Machine Connection Guide */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mt-8">
        <h3 className="font-bold text-slate-800 text-lg mb-4">🔌 How to Connect Blood Analyzer Machines</h3>
        <div className="space-y-4 text-sm">
          <div className="p-4 bg-blue-50 rounded-xl">
            <p className="font-semibold text-blue-800 mb-2">Serial Port (RS-232) — Most Common</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Buy RS-232 to USB cable (Rs. 500)</li>
              <li>Connect cable from machine to computer</li>
              <li>Check COM port in Device Manager (e.g., COM3)</li>
              <li>Set in .env file: SERIAL_PORT=COM3</li>
              <li>Run: py -m backend.start_listener</li>
            </ol>
          </div>
          <div className="p-4 bg-green-50 rounded-xl">
            <p className="font-semibold text-green-800 mb-2">TCP/IP Network — Newer Machines</p>
            <ol className="list-decimal list-inside space-y-1 text-green-700">
              <li>Connect machine to same network (LAN cable)</li>
              <li>Set machine IP and port in its settings (e.g., port 9100)</li>
              <li>Our TCP listener auto-receives on port 2575</li>
              <li>Machine sends results → system catches automatically</li>
            </ol>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="font-semibold text-slate-800 mb-2">Supported Machines</p>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <span>Sysmex XN-1000/2000 (HL7)</span>
              <span>Mindray BC-5000/6000 (ASTM)</span>
              <span>Roche Cobas (HL7)</span>
              <span>Abbott Architect (HL7)</span>
              <span>Beckman AU480 (HL7)</span>
              <span>Erba XL-200 (ASTM)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
