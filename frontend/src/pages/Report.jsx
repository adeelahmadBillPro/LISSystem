import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'

export default function Report() {
  const { sampleId } = useParams()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchReport()
  }, [sampleId])

  const fetchReport = async () => {
    try {
      const res = await api.get(`/samples/${sampleId}/report`)
      setReport(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      const res = await api.get(`/samples/${sampleId}/report/pdf`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `report_${sampleId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to download PDF')
    }
  }

  const handlePrint = () => window.print()

  const handleWhatsApp = async () => {
    try {
      const phone = prompt('Enter patient WhatsApp number (e.g., 03001234567):')
      if (!phone) return
      const res = await api.post(`/samples/${sampleId}/whatsapp`, { phone })
      if (res.data.whatsapp_link) {
        window.open(res.data.whatsapp_link, '_blank')
      }
    } catch (err) {
      alert('Failed to send WhatsApp')
    }
  }

  const handleEmail = async () => {
    const email = prompt('Enter email address:')
    if (!email) return
    try {
      await api.post(`/samples/${sampleId}/email`, { email })
      alert('Email sent successfully!')
    } catch (err) {
      alert(err.response?.data?.detail || 'Email failed — SMTP not configured')
    }
  }

  const handleBarcode = async () => {
    try {
      const res = await api.get(`/samples/${sampleId}/barcode`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `barcode_${sampleId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) { alert('Failed to generate barcode') }
  }

  const getFlagStyle = (flag) => {
    switch (flag) {
      case 'H': case 'HH': return { color: '#dc2626', fontWeight: 'bold' }
      case 'L': case 'LL': return { color: '#2563eb', fontWeight: 'bold' }
      default: return { color: '#16a34a' }
    }
  }

  const getFlagLabel = (flag) => {
    const labels = { H: 'HIGH', L: 'LOW', HH: 'CRIT HIGH', LL: 'CRIT LOW', N: 'Normal' }
    return labels[flag] || 'Normal'
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Loading report...</div>
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>
  if (!report) return null

  const { patient, sample, doctor, results } = report

  return (
    <div>
      {/* Action buttons (hidden on print) */}
      <div className="flex flex-wrap gap-3 mb-6 print:hidden animate-fadeIn">
        <button onClick={handleDownloadPDF}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-all hover-lift">
          📄 Download PDF
        </button>
        <button onClick={handlePrint}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 text-sm transition-all hover-lift">
          🖨️ Print Report
        </button>
        <button onClick={handleWhatsApp}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm transition-all hover-lift">
          📱 Send WhatsApp
        </button>
        <button onClick={handleEmail}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm transition-all hover-lift">
          📧 Email Report
        </button>
        <button onClick={handleBarcode}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm transition-all hover-lift">
          🏷️ Print Barcode
        </button>
      </div>

      {/* Report Preview */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 max-w-4xl mx-auto print:shadow-none print:border-none">
        {/* Lab Header */}
        <div className="text-center border-b-2 border-blue-800 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-blue-800">City Diagnostic Laboratory</h1>
          <p className="text-sm text-slate-500">Main Boulevard, Lahore, Pakistan</p>
          <p className="text-sm text-slate-500">Phone: +92-300-1234567 | Email: info@citydiagnostics.pk</p>
        </div>

        <h2 className="text-center text-lg font-semibold text-blue-800 mb-4">
          {sample.test_panel || 'Laboratory Report'}
        </h2>

        {/* Patient Details */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div><span className="text-slate-500">Patient Name:</span> <strong>{patient.full_name}</strong></div>
          <div><span className="text-slate-500">Age / Gender:</span> <strong>{patient.age ?? 'N/A'} yrs / {patient.gender === 'M' ? 'Male' : 'Female'}</strong></div>
          <div><span className="text-slate-500">MRN:</span> <strong>{patient.mrn}</strong></div>
          <div><span className="text-slate-500">Sample ID:</span> <strong>{sample.sample_id}</strong></div>
          <div><span className="text-slate-500">Referred By:</span> <strong>{doctor?.name || '-'}</strong></div>
          <div><span className="text-slate-500">Report Date:</span> <strong>{new Date().toLocaleDateString('en-PK')}</strong></div>
        </div>

        {/* Results Table */}
        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="bg-blue-800 text-white">
              <th className="text-left px-4 py-2">Test Name</th>
              <th className="text-left px-4 py-2">Result</th>
              <th className="text-left px-4 py-2">Unit</th>
              <th className="text-left px-4 py-2">Reference Range</th>
              <th className="text-left px-4 py-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={r.id} className={i % 2 === 0 ? 'bg-slate-50' : ''}>
                <td className="px-4 py-2">{r.test_name}</td>
                <td className="px-4 py-2" style={getFlagStyle(r.flag)}>{r.value}</td>
                <td className="px-4 py-2 text-slate-500">{r.unit || '-'}</td>
                <td className="px-4 py-2 text-slate-500">
                  {r.ref_low != null && r.ref_high != null ? `${r.ref_low} - ${r.ref_high}` : '-'}
                </td>
                <td className="px-4 py-2" style={getFlagStyle(r.flag)}>{getFlagLabel(r.flag)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signature */}
        <div className="flex justify-between mt-12 pt-4 border-t text-sm text-slate-500">
          <div>
            <div className="mb-8">_________________________</div>
            <div>Lab Technician</div>
          </div>
          <div className="text-right">
            <div className="mb-8">_________________________</div>
            <div>Pathologist</div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          This report is generated electronically. Please consult your physician for interpretation.
        </p>
      </div>
    </div>
  )
}
