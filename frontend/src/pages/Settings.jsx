import { useState, useEffect } from 'react'
import api from '../api'

export default function Settings() {
  const [settings, setSettings] = useState({
    lab_name: 'City Diagnostic Laboratory',
    lab_phone: '+92-300-1234567',
    lab_address: 'Main Boulevard, Lahore, Pakistan',
    lab_email: 'info@citydiagnostics.pk',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    api.get('/settings').then(r => setSettings(r.data)).catch(() => {})
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSuccess('')
    try {
      await api.put('/settings', settings)
      setSuccess('Settings saved successfully!')
    } catch (err) {
      setSuccess('')
      alert(err.response?.data?.detail || 'Failed to save settings')
    }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Lab Settings</h2>

      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Lab Information */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Lab Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lab Name</label>
              <input value={settings.lab_name} onChange={(e) => setSettings({...settings, lab_name: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input value={settings.lab_phone} onChange={(e) => setSettings({...settings, lab_phone: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input value={settings.lab_email} onChange={(e) => setSettings({...settings, lab_email: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <textarea value={settings.lab_address} onChange={(e) => setSettings({...settings, lab_address: e.target.value})}
                rows="2" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
        </div>

        {/* Report Header Preview */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Report Header Preview</h3>
          <div className="border border-slate-200 rounded-lg p-6 text-center bg-slate-50">
            <h2 className="text-xl font-bold text-blue-800">{settings.lab_name}</h2>
            <p className="text-sm text-slate-500">{settings.lab_address}</p>
            <p className="text-sm text-slate-500">Phone: {settings.lab_phone} | Email: {settings.lab_email}</p>
          </div>
        </div>

        {/* Machine Configuration */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Machine Configuration</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <div className="font-medium text-sm">Sysmex XN-1000</div>
                <div className="text-xs text-slate-500">COM3 | 9600 baud | HL7</div>
              </div>
              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Connected</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <div className="font-medium text-sm">Mindray BS-230</div>
                <div className="text-xs text-slate-500">COM4 | 9600 baud | ASTM</div>
              </div>
              <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Disconnected</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">Machine connections are configured in the .env file on the server</p>
        </div>

        <button type="submit" disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      {/* Signature Upload */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mt-6">
        <h3 className="font-semibold text-slate-700 mb-4">Digital Signature (for reports)</h3>
        <p className="text-sm text-slate-500 mb-4">
          Upload your signature image (PNG with transparent background works best). This will appear on all PDF reports.
        </p>
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files[0]
              if (!file) return
              const formData = new FormData()
              formData.append('file', file)
              try {
                await api.post('/signature/upload', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                })
                setSuccess('Signature uploaded successfully!')
              } catch (err) {
                setSuccess('Upload failed: ' + (err.response?.data?.detail || 'Unknown error'))
              }
            }}
            className="text-sm"
          />
          <div className="border border-slate-200 rounded-lg p-2 w-40 h-16 flex items-center justify-center bg-slate-50">
            <img
              src="/api/signature/0"
              alt=""
              className="max-w-full max-h-full"
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <span className="text-xs text-slate-400">Preview</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">Recommended: 300x100px PNG with transparent background</p>
      </div>

      {/* Backup */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mt-6">
        <h3 className="font-semibold text-slate-700 mb-4">Database Backup</h3>
        <p className="text-sm text-slate-500 mb-4">Download a backup of the entire database.</p>
        <button
          onClick={async () => {
            try {
              const res = await api.get('/backup', { responseType: 'blob' })
              const url = window.URL.createObjectURL(new Blob([res.data]))
              const link = document.createElement('a')
              link.href = url
              link.setAttribute('download', `lis_backup_${new Date().toISOString().slice(0,10)}.db`)
              document.body.appendChild(link)
              link.click()
              link.remove()
            } catch (err) { alert('Backup failed') }
          }}
          className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 text-sm"
        >
          Download Backup
        </button>
      </div>
    </div>
  )
}
