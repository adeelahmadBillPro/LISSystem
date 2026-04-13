import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

const SAMPLE_HL7 = `MSH|^~\\&|ANALYZER|LAB|LIS|HOSPITAL|20240115120000||ORU^R01|MSG001|P|2.3
PID|1||PAT001^^^MRN||Khan^Ahmed^||19850315|M|||123 Main St^Lahore||(0300)1234567
OBR|1|SAM001||CBC^Complete Blood Count|||20240115100000
OBX|1|NM|WBC^White Blood Cells||7.5|10*3/uL|4.0-10.0|N|||F
OBX|2|NM|RBC^Red Blood Cells||5.2|10*6/uL|4.5-5.5|N|||F
OBX|3|NM|HGB^Hemoglobin||14.5|g/dL|13.0-17.0|N|||F
OBX|4|NM|PLT^Platelets||350|10*3/uL|150-400|N|||F`

const SAMPLE_ASTM = `H|\\^&|||ANALYZER|||||LIS||P|1
P|1|||PAT002||Zahra^Fatima||19900520|F
O|1|SAM002|||^^^CBC^Complete Blood Count
R|1|^^^WBC^White Blood Cells||12.5|10*3/uL|4.0-10.0|H||F
R|2|^^^HGB^Hemoglobin||9.5|g/dL|12.0-16.0|L||F
R|3|^^^PLT^Platelets||180|10*3/uL|150-400|N||F
L|1|N`

// Demo scenarios for client presentation
const DEMO_SCENARIOS = [
  {
    id: 'cbc_normal',
    label: 'Normal CBC',
    icon: '✅',
    color: 'green',
    desc: 'Normal CBC — sab values normal range mein',
    patient: { first_name: 'Ahmed', last_name: 'Khan', gender: 'M', phone: '03001234567' },
    panel: 'CBC',
    results: [
      { test_code: 'WBC', test_name: 'White Blood Cells', value: '7.5', unit: '10³/µL', ref_low: 4.0, ref_high: 10.0, flag: 'N' },
      { test_code: 'RBC', test_name: 'Red Blood Cells',   value: '5.1', unit: '10⁶/µL', ref_low: 4.5, ref_high: 5.5, flag: 'N' },
      { test_code: 'HGB', test_name: 'Hemoglobin',        value: '14.8', unit: 'g/dL',  ref_low: 13.0, ref_high: 17.0, flag: 'N' },
      { test_code: 'HCT', test_name: 'Hematocrit',        value: '44',   unit: '%',     ref_low: 40.0, ref_high: 52.0, flag: 'N' },
      { test_code: 'PLT', test_name: 'Platelets',          value: '280',  unit: '10³/µL', ref_low: 150, ref_high: 400, flag: 'N' },
    ],
  },
  {
    id: 'cbc_anemia',
    label: 'Anemia (LOW)',
    icon: '⚠️',
    color: 'blue',
    desc: 'HGB low — anemia. LOW flag auto lagega.',
    patient: { first_name: 'Fatima', last_name: 'Malik', gender: 'F', phone: '03111234567' },
    panel: 'CBC',
    results: [
      { test_code: 'WBC', test_name: 'White Blood Cells', value: '6.2',  unit: '10³/µL', ref_low: 4.0, ref_high: 10.0, flag: 'N' },
      { test_code: 'RBC', test_name: 'Red Blood Cells',   value: '3.1',  unit: '10⁶/µL', ref_low: 3.8, ref_high: 5.0,  flag: 'L' },
      { test_code: 'HGB', test_name: 'Hemoglobin',        value: '8.5',  unit: 'g/dL',   ref_low: 12.0, ref_high: 16.0, flag: 'L' },
      { test_code: 'PLT', test_name: 'Platelets',          value: '210',  unit: '10³/µL', ref_low: 150, ref_high: 400,  flag: 'N' },
    ],
  },
  {
    id: 'cbc_critical',
    label: 'CRITICAL WBC ⚠',
    icon: '🚨',
    color: 'red',
    desc: 'WBC critically HIGH — doctor ko WhatsApp alert jayega!',
    patient: { first_name: 'Tariq', last_name: 'Ahmed', gender: 'M', phone: '03211234567' },
    panel: 'CBC',
    results: [
      { test_code: 'WBC', test_name: 'White Blood Cells', value: '38.5', unit: '10³/µL', ref_low: 4.0, ref_high: 10.0, flag: 'HH' },
      { test_code: 'RBC', test_name: 'Red Blood Cells',   value: '4.8',  unit: '10⁶/µL', ref_low: 4.5, ref_high: 5.5,  flag: 'N' },
      { test_code: 'HGB', test_name: 'Hemoglobin',        value: '13.2', unit: 'g/dL',   ref_low: 13.0, ref_high: 17.0, flag: 'N' },
      { test_code: 'PLT', test_name: 'Platelets',          value: '95',   unit: '10³/µL', ref_low: 150, ref_high: 400,  flag: 'LL' },
    ],
  },
  {
    id: 'lft',
    label: 'LFT (Liver)',
    icon: '🫀',
    color: 'orange',
    desc: 'Liver Function Test — ALT HIGH.',
    patient: { first_name: 'Zainab', last_name: 'Hussain', gender: 'F', phone: '03331234567' },
    panel: 'LFT',
    results: [
      { test_code: 'ALT',  test_name: 'ALT (SGPT)',   value: '95',  unit: 'U/L', ref_low: 7,  ref_high: 40,  flag: 'H' },
      { test_code: 'AST',  test_name: 'AST (SGOT)',   value: '78',  unit: 'U/L', ref_low: 10, ref_high: 40,  flag: 'H' },
      { test_code: 'TBIL', test_name: 'Total Bilirubin', value: '1.1', unit: 'mg/dL', ref_low: 0.2, ref_high: 1.2, flag: 'N' },
      { test_code: 'ALP',  test_name: 'Alkaline Phosphatase', value: '210', unit: 'U/L', ref_low: 44, ref_high: 147, flag: 'H' },
    ],
  },
  {
    id: 'rft',
    label: 'RFT (Kidney)',
    icon: '🫘',
    color: 'purple',
    desc: 'Renal Function Test — Creatinine HIGH.',
    patient: { first_name: 'Imran', last_name: 'Sheikh', gender: 'M', phone: '03451234567' },
    panel: 'RFT',
    results: [
      { test_code: 'CREA', test_name: 'Creatinine',  value: '2.8', unit: 'mg/dL', ref_low: 0.7, ref_high: 1.3, flag: 'H' },
      { test_code: 'UREA', test_name: 'Blood Urea',  value: '75',  unit: 'mg/dL', ref_low: 15,  ref_high: 45,  flag: 'H' },
      { test_code: 'UA',   test_name: 'Uric Acid',   value: '5.2', unit: 'mg/dL', ref_low: 3.5, ref_high: 7.2, flag: 'N' },
    ],
  },
]

const colorMap = {
  green: { bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', btn: 'bg-green-600 hover:bg-green-700' },
  blue:  { bg: 'bg-blue-50 border-blue-200',   badge: 'bg-blue-100 text-blue-700',   btn: 'bg-blue-600 hover:bg-blue-700' },
  red:   { bg: 'bg-red-50 border-red-200',     badge: 'bg-red-100 text-red-700',     btn: 'bg-red-600 hover:bg-red-700' },
  orange:{ bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700', btn: 'bg-orange-600 hover:bg-orange-700' },
  purple:{ bg: 'bg-purple-50 border-purple-200', badge: 'bg-purple-100 text-purple-700', btn: 'bg-purple-600 hover:bg-purple-700' },
}

export default function MachineTest() {
  const [rawMessage, setRawMessage] = useState('')
  const [parseResult, setParseResult] = useState(null)
  const [parseError, setParseError] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saveResult, setSaveResult] = useState(null)

  // Demo simulation state
  const [demoLog, setDemoLog] = useState([])
  const [demoRunning, setDemoRunning] = useState(false)
  const [demoSampleId, setDemoSampleId] = useState(null)
  const [demoScenario, setDemoScenario] = useState(null)
  const [demoComplete, setDemoComplete] = useState(false)

  const log = (icon, msg, type = 'info') => {
    setDemoLog(prev => [...prev, { icon, msg, type, time: new Date().toLocaleTimeString() }])
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms))

  const runDemo = async (scenario) => {
    setDemoLog([])
    setDemoRunning(true)
    setDemoComplete(false)
    setDemoSampleId(null)
    setDemoScenario(scenario)

    try {
      // Step 1: Create patient
      log('👤', 'Patient register ho raha hai...', 'info')
      await sleep(600)
      const mrn = `DEMO-${Date.now().toString().slice(-6)}`
      const sampleId = `S-${Date.now().toString().slice(-6)}`

      let patientId
      try {
        const patRes = await api.post('/patients', {
          mrn,
          first_name: scenario.patient.first_name,
          last_name: scenario.patient.last_name,
          gender: scenario.patient.gender,
          phone: scenario.patient.phone,
          dob: '1990-01-01',
        })
        patientId = patRes.data.id
        log('✅', `Patient registered: ${scenario.patient.first_name} ${scenario.patient.last_name} (MRN: ${mrn})`, 'success')
      } catch {
        // May already exist — search for it
        const pats = await api.get('/patients', { params: { search: scenario.patient.first_name } })
        patientId = pats.data[0]?.id
        log('ℹ️', `Patient already exists — using existing record`, 'info')
      }
      await sleep(500)

      // Step 2: Register sample
      log('🧪', `Sample register ho raha hai: ${sampleId}`, 'info')
      await sleep(600)
      await api.post('/samples', {
        sample_id: sampleId,
        patient_id: patientId,
        test_panel: scenario.panel,
        status: 'processing',
        notes: 'Demo simulation sample',
      })
      log('✅', `Sample registered: ${sampleId} — ${scenario.panel}`, 'success')
      await sleep(500)

      // Step 3: Machine sends results
      log('🔬', `Machine (Sysmex) results analyze kar rahi hai...`, 'info')
      await sleep(1000)
      log('📡', `HL7 message receive ho raha hai COM3 se...`, 'info')
      await sleep(800)

      const payload = {
        sample_id: sampleId,
        machine_id: 'SYSMEX-XN1000',
        patient_id: mrn,
        results: scenario.results.map(r => ({ ...r, sample_id: sampleId })),
      }
      await api.post('/results', payload)

      const criticalCount = scenario.results.filter(r => r.flag === 'HH' || r.flag === 'LL').length
      const highLow = scenario.results.filter(r => r.flag === 'H' || r.flag === 'L').length

      log('✅', `${scenario.results.length} results auto-received from machine`, 'success')
      if (highLow > 0) log('⚠️', `${highLow} abnormal value(s) flagged automatically`, 'warning')
      if (criticalCount > 0) log('🚨', `${criticalCount} CRITICAL value(s) detected — HH/LL flag!`, 'critical')
      await sleep(600)

      // Step 4: Verify
      log('✅', 'Technician verify kar raha hai...', 'info')
      await sleep(800)
      const verifyRes = await api.put(`/samples/${sampleId}/verify`)
      log('✅', 'Sample verified! Report ready ho gaya.', 'success')

      if (verifyRes.data?.whatsapp_sent) {
        log('📱', `WhatsApp report patient ko send ho gaya: ${scenario.patient.phone}`, 'success')
      }
      if (verifyRes.data?.doctor_alert_sent) {
        log('🚨', `Doctor ko critical alert WhatsApp pe gaya!`, 'critical')
      }
      await sleep(500)

      // Done
      log('🎉', `Demo complete! Sample ID: ${sampleId}`, 'success')
      setDemoSampleId(sampleId)
      setDemoComplete(true)

    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map(d => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(' | ')
        : (detail || err.message)
      log('❌', `Error: ${msg}`, 'error')
    } finally {
      setDemoRunning(false)
    }
  }

  // Manual parse
  const parseMessage = async () => {
    if (!rawMessage.trim()) { setParseError('Paste a message first'); return }
    setParseError(''); setParseResult(null); setParsing(true)
    try {
      const r = await api.post('/machine/test-parse', { raw_message: rawMessage })
      setParseResult(r.data)
    } catch (err) {
      setParseError(err.response?.data?.detail || 'Parse failed')
    } finally { setParsing(false) }
  }

  const saveToDatabase = async () => {
    if (!parseResult) return
    try {
      const payload = {
        sample_id: parseResult.sample?.sample_id,
        machine_id: 'MANUAL_TEST',
        patient_id: parseResult.patient?.patient_id,
        results: parseResult.results?.map(r => ({
          sample_id: parseResult.sample?.sample_id,
          test_code: r.test_code, test_name: r.test_name,
          value: r.value, unit: r.unit,
          ref_low: r.ref_low, ref_high: r.ref_high, flag: r.flag,
        })) || [],
      }
      const r = await api.post('/results', payload)
      setSaveResult(r.data)
    } catch (err) {
      setParseError(err.response?.data?.detail || 'Save failed — sample may not exist')
    }
  }

  const getFlagColor = (flag) => {
    if (flag === 'HH') return 'text-red-700 font-bold bg-red-50 px-1 rounded'
    if (flag === 'H')  return 'text-red-600 font-bold'
    if (flag === 'LL') return 'text-blue-700 font-bold bg-blue-50 px-1 rounded'
    if (flag === 'L')  return 'text-blue-600 font-bold'
    return 'text-green-600'
  }

  const logColors = {
    info:     'text-slate-600',
    success:  'text-green-700',
    warning:  'text-orange-600',
    critical: 'text-red-700 font-bold',
    error:    'text-red-600',
  }

  return (
    <div className="animate-fadeIn space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Machine Integration</h2>
        <p className="text-sm text-slate-500 mt-1">Test karo — bina real machine ke puri workflow simulate karo</p>
      </div>

      {/* How it works banner */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-bold text-slate-700 mb-4 text-sm">Real Machine mein kya hota hai</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { icon: '🔬', label: 'Machine test karta hai', sub: 'Sysmex, Mindray etc' },
            { icon: '🔌', label: 'Cable connect', sub: 'RS-232 ya LAN' },
            { icon: '📡', label: 'HL7/ASTM data bhejta hai', sub: 'Auto detect' },
            { icon: '💻', label: 'System receive karta hai', sub: 'COM port listener' },
            { icon: '🏷️', label: 'Auto flag lagta hai', sub: 'H/L/HH/LL' },
            { icon: '📱', label: 'WhatsApp report', sub: 'Patient ko auto' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-shrink-0">
              <div className="text-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 min-w-[100px]">
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="text-xs font-semibold text-slate-700">{s.label}</div>
                <div className="text-[10px] text-slate-400">{s.sub}</div>
              </div>
              {i < 5 && <span className="text-slate-300 text-xl font-light flex-shrink-0">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── DEMO SIMULATOR ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800">Demo Simulator</h3>
            <p className="text-xs text-slate-500 mt-0.5">Client ko dikhao — ek click mein poori workflow live chalti hai</p>
          </div>
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Client Demo</span>
        </div>

        {/* Scenario cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          {DEMO_SCENARIOS.map(s => {
            const c = colorMap[s.color]
            return (
              <div key={s.id} className={`border rounded-xl p-4 ${c.bg} transition-all hover:shadow-md`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-xl">{s.icon}</span>
                    <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{s.label}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mb-3">{s.desc}</p>
                <div className="text-xs text-slate-500 mb-3 space-y-0.5">
                  <div>Patient: <strong>{s.patient.first_name} {s.patient.last_name}</strong></div>
                  <div>Panel: <strong>{s.panel}</strong> · {s.results.length} tests</div>
                  <div>Tests: {s.results.map(r => r.test_code).join(', ')}</div>
                </div>
                <button
                  onClick={() => runDemo(s)}
                  disabled={demoRunning}
                  className={`w-full py-2 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-40 ${c.btn}`}
                >
                  {demoRunning && demoScenario?.id === s.id ? '⏳ Running...' : '▶ Run This Demo'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Live log */}
        {demoLog.length > 0 && (
          <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${demoRunning ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-slate-400 text-[11px] uppercase tracking-wider">
                {demoRunning ? 'Live — machine se data aa raha hai...' : 'Complete'}
              </span>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {demoLog.map((l, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-slate-600 text-[10px] flex-shrink-0 mt-0.5">{l.time}</span>
                  <span className="text-base flex-shrink-0">{l.icon}</span>
                  <span className={`${
                    l.type === 'success' ? 'text-green-400' :
                    l.type === 'critical' ? 'text-red-400 font-bold' :
                    l.type === 'warning' ? 'text-yellow-400' :
                    l.type === 'error' ? 'text-red-400' : 'text-slate-300'
                  }`}>{l.msg}</span>
                </div>
              ))}
            </div>

            {demoComplete && demoSampleId && (
              <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap gap-2">
                <Link
                  to={`/results/${demoSampleId}`}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-500"
                >
                  📊 Results Dekhein
                </Link>
                <Link
                  to={`/report/${demoSampleId}`}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-500"
                >
                  📄 PDF Report Dekhein
                </Link>
                <Link
                  to={`/verification`}
                  className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-medium hover:bg-slate-600"
                >
                  ✅ Verification Page
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MANUAL HL7/ASTM PARSER ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-bold text-slate-800 mb-1">Manual HL7 / ASTM Parser</h3>
        <p className="text-xs text-slate-500 mb-4">Real machine ka raw message paste karo aur parse karo</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setRawMessage(SAMPLE_HL7)} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200">Load HL7 Sample</button>
              <button onClick={() => setRawMessage(SAMPLE_ASTM)} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200">Load ASTM Sample</button>
              <button onClick={() => setRawMessage('')} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200">Clear</button>
            </div>
            <textarea
              value={rawMessage} onChange={e => setRawMessage(e.target.value)}
              rows={12} placeholder="Paste HL7 or ASTM message here..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-slate-50"
            />
            <button onClick={parseMessage} disabled={parsing}
              className="w-full mt-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all">
              {parsing ? 'Parsing...' : '🔍 Parse Message'}
            </button>
          </div>

          <div>
            {parseError && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-3 text-sm">{parseError}</div>}
            {saveResult && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-3 text-sm">✅ {saveResult.message}</div>}

            {parseResult ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg font-mono">{parseResult.message_type}</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg">Protocol detected</span>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl text-sm">
                  <div className="text-xs text-blue-500 mb-1 font-semibold">Patient</div>
                  <div><strong>{parseResult.patient?.name || 'Unknown'}</strong> · {parseResult.patient?.patient_id} · {parseResult.patient?.gender}</div>
                </div>
                <div className="p-3 bg-green-50 rounded-xl text-sm">
                  <div className="text-xs text-green-600 mb-1 font-semibold">Sample</div>
                  <div><strong>{parseResult.sample?.sample_id}</strong> · {parseResult.sample?.test_name || parseResult.sample?.test_code}</div>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800 text-white">
                      <tr>
                        <th className="text-left px-3 py-2">Test</th>
                        <th className="text-left px-3 py-2">Value</th>
                        <th className="text-left px-3 py-2">Unit</th>
                        <th className="text-left px-3 py-2">Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parseResult.results?.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium">{r.test_name}</td>
                          <td className={`px-3 py-2 ${getFlagColor(r.flag)}`}>{r.value}</td>
                          <td className="px-3 py-2 text-slate-500">{r.unit}</td>
                          <td className={`px-3 py-2 ${getFlagColor(r.flag)}`}>{r.flag}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={saveToDatabase} className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700">
                  💾 Save to Database
                </button>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center py-16 text-slate-400">
                <div>
                  <div className="text-4xl mb-3">🔬</div>
                  <p className="text-sm">Sample load karo ya paste karo phir Parse karo</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Supported machines */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-bold text-slate-800 mb-4">Supported Machines</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { name: 'Sysmex XN-1000/2000', protocol: 'HL7', conn: 'RS-232 / TCP' },
            { name: 'Mindray BC-5000/6000', protocol: 'ASTM', conn: 'RS-232' },
            { name: 'Roche Cobas e411/c311', protocol: 'HL7', conn: 'TCP/IP' },
            { name: 'Abbott Architect', protocol: 'HL7', conn: 'RS-232 / TCP' },
            { name: 'Beckman AU480/680', protocol: 'HL7', conn: 'RS-232' },
            { name: 'Erba XL-200', protocol: 'ASTM', conn: 'RS-232' },
            { name: 'Horiba Yumizen', protocol: 'HL7', conn: 'RS-232' },
            { name: 'Siemens Atellica', protocol: 'HL7', conn: 'TCP/IP' },
            { name: 'Any HL7 v2.x', protocol: 'HL7', conn: 'Any' },
            { name: 'Any ASTM E1381', protocol: 'ASTM', conn: 'Any' },
          ].map((m, i) => (
            <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-blue-200 transition-all">
              <div className="font-semibold text-slate-800 text-xs mb-1.5">{m.name}</div>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">{m.protocol}</span>
                <span className="text-[10px] text-slate-400">{m.conn}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
