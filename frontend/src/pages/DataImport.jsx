import { useState } from 'react'
import api from '../api'

export default function DataImport() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')

  const handleUpload = async (type, file) => {
    if (!file) return
    setLoading(type); setError(''); setResult(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const r = await api.post(`/import/${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(r.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Import failed')
    } finally { setLoading('') }
  }

  return (
    <div className="animate-fadeIn max-w-4xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Data Import</h2>
      <p className="text-sm text-slate-500 mb-6">Import existing patient and doctor data from CSV/Excel files</p>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm animate-slideDown">{error}</div>}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 animate-slideDown">
          <p className="font-semibold text-green-800">{result.message}</p>
          <div className="flex gap-6 mt-2 text-sm">
            <span className="text-green-700">Imported: {result.imported}</span>
            <span className="text-yellow-700">Skipped (duplicates): {result.skipped}</span>
          </div>
          {result.errors?.length > 0 && (
            <div className="mt-2 text-xs text-red-600">
              <p className="font-medium">Errors:</p>
              {result.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Patient Import */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="text-3xl mb-3">👥</div>
          <h3 className="font-bold text-slate-800 text-lg mb-2">Import Patients</h3>
          <p className="text-sm text-slate-500 mb-4">Upload a CSV file with patient records</p>

          <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs">
            <p className="font-semibold text-slate-700 mb-1">Required CSV columns:</p>
            <code className="text-blue-600">mrn, first_name, last_name, gender, dob, phone, address</code>
            <p className="mt-2 text-slate-500">Or: MRN, Name, Gender, DOB, Phone, Address</p>
            <p className="mt-1 text-slate-500">DOB formats: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY</p>
            <p className="mt-1 text-slate-500">Duplicates (same MRN) are automatically skipped</p>
          </div>

          <input
            type="file"
            accept=".csv,.txt"
            onChange={e => handleUpload('patients', e.target.files[0])}
            disabled={loading === 'patients'}
            className="w-full text-sm"
          />
          {loading === 'patients' && <p className="text-sm text-blue-600 mt-2 animate-pulse">Importing...</p>}

          {/* Download sample CSV */}
          <button
            onClick={() => {
              const csv = "mrn,first_name,last_name,gender,dob,phone,address\nPAT001,Ahmed,Khan,M,1985-03-15,0300-1234567,Lahore\nPAT002,Fatima,Zahra,F,1990-07-20,0321-9876543,Karachi"
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = 'sample_patients.csv'; a.click()
            }}
            className="mt-3 text-xs text-blue-600 hover:underline"
          >
            Download sample CSV template
          </button>
        </div>

        {/* Doctor Import */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="text-3xl mb-3">🩺</div>
          <h3 className="font-bold text-slate-800 text-lg mb-2">Import Doctors</h3>
          <p className="text-sm text-slate-500 mb-4">Upload a CSV file with doctor records</p>

          <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs">
            <p className="font-semibold text-slate-700 mb-1">Required CSV columns:</p>
            <code className="text-blue-600">name, specialization, phone, email</code>
            <p className="mt-2 text-slate-500">Duplicates (same name) are automatically skipped</p>
          </div>

          <input
            type="file"
            accept=".csv,.txt"
            onChange={e => handleUpload('doctors', e.target.files[0])}
            disabled={loading === 'doctors'}
            className="w-full text-sm"
          />
          {loading === 'doctors' && <p className="text-sm text-blue-600 mt-2 animate-pulse">Importing...</p>}

          <button
            onClick={() => {
              const csv = "name,specialization,phone,email\nDr. Ahmed Ali,Pathologist,0300-5551234,dr.ahmed@lab.pk\nDr. Ayesha Malik,General Physician,0321-5559876,dr.ayesha@hospital.pk"
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = 'sample_doctors.csv'; a.click()
            }}
            className="mt-3 text-xs text-blue-600 hover:underline"
          >
            Download sample CSV template
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-6 text-sm text-amber-800">
        <p className="font-semibold mb-2">Tips for importing from existing software:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li><strong>From Excel:</strong> Save as CSV (File → Save As → CSV UTF-8)</li>
          <li><strong>From old LIS:</strong> Export patient list to CSV, match column names</li>
          <li><strong>Column names are flexible:</strong> MRN or mrn, Name or first_name, Phone or phone</li>
          <li><strong>Safe to re-run:</strong> Duplicate MRNs are skipped, no data is overwritten</li>
          <li><strong>Large files:</strong> Files with 10,000+ records are supported</li>
        </ul>
      </div>
    </div>
  )
}
