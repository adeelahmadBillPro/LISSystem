import { useState } from 'react'
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

export default function MachineTest() {
  const [rawMessage, setRawMessage] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saveResult, setSaveResult] = useState(null)

  const parseMessage = async () => {
    if (!rawMessage.trim()) { setError('Paste a message first'); return }
    setError(''); setResult(null); setLoading(true)
    try {
      const r = await api.post('/machine/test-parse', { raw_message: rawMessage })
      setResult(r.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Parse failed')
    } finally { setLoading(false) }
  }

  const saveToDatabase = async () => {
    if (!result) return
    try {
      const payload = {
        sample_id: result.sample?.sample_id,
        machine_id: 'MANUAL_TEST',
        patient_id: result.patient?.patient_id,
        results: result.results?.map(r => ({
          sample_id: result.sample?.sample_id,
          test_code: r.test_code,
          test_name: r.test_name,
          value: r.value,
          unit: r.unit,
          ref_low: r.ref_low,
          ref_high: r.ref_high,
          flag: r.flag,
        })) || [],
      }
      const r = await api.post('/results', payload)
      setSaveResult(r.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Save failed — sample may not exist in system')
    }
  }

  const getFlagColor = (flag) => {
    if (flag === 'H' || flag === 'HH') return 'text-red-600 font-bold'
    if (flag === 'L' || flag === 'LL') return 'text-blue-600 font-bold'
    return 'text-green-600'
  }

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Machine Communication Tester</h2>
        <p className="text-sm text-slate-500 mt-1">Test HL7/ASTM message parsing without connecting a real machine</p>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
        <h3 className="font-bold text-slate-800 mb-3">How Machine Integration Works</h3>
        <div className="flex items-center gap-4 text-sm overflow-x-auto pb-2">
          {[
            { icon: '🔬', label: 'Machine runs test', color: 'bg-blue-100 text-blue-800' },
            { icon: '📡', label: 'Sends data via cable', color: 'bg-purple-100 text-purple-800' },
            { icon: '🔍', label: 'Auto-detect HL7/ASTM', color: 'bg-amber-100 text-amber-800' },
            { icon: '📋', label: 'Parse results', color: 'bg-green-100 text-green-800' },
            { icon: '💾', label: 'Save to database', color: 'bg-emerald-100 text-emerald-800' },
            { icon: '📊', label: 'Show on screen', color: 'bg-cyan-100 text-cyan-800' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2 flex-shrink-0">
              <div className={`px-3 py-2 rounded-xl ${step.color} text-center`}>
                <div className="text-xl">{step.icon}</div>
                <div className="text-xs font-medium mt-1">{step.label}</div>
              </div>
              {i < 5 && <span className="text-slate-300 text-lg">→</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-slate-700">Raw Machine Message</h3>
            <div className="flex gap-2">
              <button onClick={() => setRawMessage(SAMPLE_HL7)}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                Load HL7 Sample
              </button>
              <button onClick={() => setRawMessage(SAMPLE_ASTM)}
                className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200">
                Load ASTM Sample
              </button>
            </div>
          </div>
          <textarea
            value={rawMessage}
            onChange={e => setRawMessage(e.target.value)}
            rows={12}
            placeholder="Paste HL7 or ASTM message here..."
            className="w-full px-3 py-2 border rounded-lg font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <button onClick={parseMessage} disabled={loading}
            className="w-full mt-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all">
            {loading ? 'Parsing...' : 'Parse Message'}
          </button>
        </div>

        {/* Output */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h3 className="font-semibold text-slate-700 mb-3">Parsed Results</h3>

          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
          {saveResult && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">{saveResult.message}</div>}

          {result ? (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500 mb-1">Protocol Detected</div>
                <div className="font-bold">{result.message_type}</div>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-xs text-blue-500 mb-1">Patient</div>
                <div className="text-sm">
                  <strong>{result.patient?.name || 'Unknown'}</strong> | ID: {result.patient?.patient_id || '-'} | {result.patient?.gender || '-'}
                </div>
              </div>

              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-xs text-green-500 mb-1">Sample</div>
                <div className="text-sm">
                  <strong>{result.sample?.sample_id || '-'}</strong> | Test: {result.sample?.test_name || result.sample?.test_code || '-'}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-2">Results ({result.results?.length || 0})</div>
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-2 py-1">Test</th>
                      <th className="text-left px-2 py-1">Value</th>
                      <th className="text-left px-2 py-1">Unit</th>
                      <th className="text-left px-2 py-1">Range</th>
                      <th className="text-left px-2 py-1">Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results?.map((r, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="px-2 py-1.5">{r.test_name}</td>
                        <td className={`px-2 py-1.5 ${getFlagColor(r.flag)}`}>{r.value}</td>
                        <td className="px-2 py-1.5 text-slate-500">{r.unit}</td>
                        <td className="px-2 py-1.5 text-slate-500">{r.reference_range || '-'}</td>
                        <td className={`px-2 py-1.5 ${getFlagColor(r.flag)}`}>
                          {r.flag === 'H' ? 'HIGH' : r.flag === 'L' ? 'LOW' : 'Normal'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button onClick={saveToDatabase}
                className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                Save to Database
              </button>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <div className="text-3xl mb-2">🔬</div>
              <p>Paste a message and click "Parse" to see results</p>
              <p className="text-xs mt-1">Or click "Load HL7 Sample" / "Load ASTM Sample" to try</p>
            </div>
          )}
        </div>
      </div>

      {/* Supported Machines */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mt-6">
        <h3 className="font-bold text-slate-800 mb-4">Supported Machines</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { name: 'Sysmex XN-1000/2000', protocol: 'HL7', conn: 'RS-232 / TCP', status: 'ready' },
            { name: 'Mindray BC-5000/6000', protocol: 'ASTM', conn: 'RS-232', status: 'ready' },
            { name: 'Roche Cobas e411/c311', protocol: 'HL7', conn: 'TCP/IP', status: 'ready' },
            { name: 'Abbott Architect', protocol: 'HL7', conn: 'RS-232 / TCP', status: 'ready' },
            { name: 'Beckman AU480/680', protocol: 'HL7', conn: 'RS-232', status: 'ready' },
            { name: 'Erba XL-200', protocol: 'ASTM', conn: 'RS-232', status: 'ready' },
            { name: 'Horiba Yumizen', protocol: 'HL7', conn: 'RS-232', status: 'ready' },
            { name: 'Siemens Atellica', protocol: 'HL7', conn: 'TCP/IP', status: 'ready' },
            { name: 'Any HL7 v2.x machine', protocol: 'HL7', conn: 'Any', status: 'ready' },
            { name: 'Any ASTM E1381 machine', protocol: 'ASTM', conn: 'Any', status: 'ready' },
          ].map((m, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl text-sm">
              <div className="font-medium text-slate-800">{m.name}</div>
              <div className="flex gap-2 mt-1">
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{m.protocol}</span>
                <span className="text-xs text-slate-500">{m.conn}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
