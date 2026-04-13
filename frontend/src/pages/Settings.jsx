import { useState, useEffect } from 'react'
import api from '../api'

export default function Settings() {
  const [settings, setSettings] = useState({
    lab_name: 'City Diagnostic Laboratory',
    lab_phone: '+92-300-1234567',
    lab_address: 'Main Boulevard, Lahore, Pakistan',
    lab_email: 'info@citydiagnostics.pk',
    wa_api_key: '',
    nav_layout: localStorage.getItem('navLayout') || 'sidebar',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [waTesting, setWaTesting] = useState(false)
  const [waTestResult, setWaTestResult] = useState(null)
  const [showKey, setShowKey] = useState(false)
  const [waSessions, setWaSessions] = useState([])
  const [waLoading, setWaLoading] = useState(false)
  const [qrData, setQrData] = useState(null)
  const [qrSessionId, setQrSessionId] = useState(null)
  const [qrStatus, setQrStatus] = useState(null)
  const qrPollRef = useState(null)
  const [license, setLicense] = useState(null)
  const [backingUp, setBackingUp] = useState(false)
  const [backupMsg, setBackupMsg] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [restoreMsg, setRestoreMsg] = useState('')
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoMsg, setLogoMsg] = useState('')
  const [modules, setModules] = useState({})
  const [moduleSaving, setModuleSaving] = useState(false)
  const [moduleMsg, setModuleMsg] = useState('')

  const WA_BASE = 'http://187.127.138.168'

  useEffect(() => {
    api.get('/settings').then(r => {
      // localStorage nav_layout is the user's explicit choice — keep it over DB value
      const localNav = localStorage.getItem('navLayout')
      setSettings({ ...r.data, nav_layout: localNav || r.data.nav_layout || 'sidebar' })
      if (r.data.wa_api_key) loadWaSessions()
    }).catch(() => {})
    api.get('/license').then(r => setLicense(r.data)).catch(() => {})
    api.get('/settings/modules').then(r => setModules(r.data)).catch(() => {})
    // Check if logo exists
    const base = api.defaults?.baseURL || '/api'
    const logoSrc = `${base}/settings/logo?t=${Date.now()}`
    fetch(logoSrc).then(r => {
      if (r.ok) setLogoUrl(logoSrc)
    }).catch(() => {})
  }, [])

  async function loadWaSessions() {
    if (!settings.wa_api_key) return
    setWaLoading(true)
    try {
      const r = await api.get('/whatsapp/sessions')
      setWaSessions(r.data.sessions || [])
    } catch { }
    setWaLoading(false)
  }

  async function startQrScan(sessionId) {
    if (!settings.wa_api_key) return
    setQrSessionId(sessionId)
    setQrData(null)
    setQrStatus('connecting')

    await api.post('/whatsapp/sessions/start', { session_id: sessionId })

    const poll = setInterval(async () => {
      try {
        const r = await api.get(`/whatsapp/sessions/qr?session_id=${sessionId}`)
        const data = r.data
        if (data.status === 'connected') {
          setQrStatus('connected')
          setQrData(null)
          setQrSessionId(null)
          clearInterval(poll)
          loadWaSessions()
        } else if (data.qr_image) {
          setQrData(data.qr_image)
          setQrStatus('qr_ready')
        } else if (data.status === 'disconnected') {
          setQrStatus('reconnecting')
        }
      } catch { }
    }, 3000)

    qrPollRef[1](poll)
    setTimeout(() => { clearInterval(poll); if (qrStatus !== 'connected') setQrStatus('timeout') }, 120000)
  }

  const handleSaveModules = async () => {
    setModuleSaving(true)
    setModuleMsg('')
    try {
      await api.put('/settings/modules', modules)
      setModuleMsg('Module settings saved. Reload the app to see sidebar changes.')
    } catch {
      setModuleMsg('Failed to save.')
    } finally {
      setModuleSaving(false)
    }
  }

  const handleBackup = async () => {
    setBackingUp(true)
    setBackupMsg('')
    try {
      const res = await api.get('/admin/backup', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers['content-disposition'] || ''
      const match = disposition.match(/filename="(.+)"/)
      a.download = match ? match[1] : `lis_backup_${new Date().toISOString().slice(0,10)}.sql`
      a.click()
      window.URL.revokeObjectURL(url)
      setBackupMsg('Backup downloaded successfully!')
    } catch (err) {
      setBackupMsg('Backup failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setBackingUp(false)
    }
  }

  const handleRestore = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.endsWith('.sql')) {
      setRestoreMsg('Error: Only .sql backup files are accepted')
      e.target.value = ''
      return
    }
    if (!confirm(`Restore database from "${file.name}"? This will overwrite existing data. Are you sure?`)) {
      e.target.value = ''
      return
    }
    setRestoring(true)
    setRestoreMsg('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/backup/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setRestoreMsg(res.data.message || 'Restore completed successfully!')
    } catch (err) {
      setRestoreMsg('Restore failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setRestoring(false)
      e.target.value = ''
    }
  }

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

  const handleNavLayoutChange = async (val) => {
    // Update local state immediately so the selection shows correct
    setSettings(s => ({ ...s, nav_layout: val }))
    localStorage.setItem('navLayout', val)
    // Tell Layout to switch live (no reload needed)
    window.dispatchEvent(new CustomEvent('lis:navLayout', { detail: val }))
    // Persist to DB in background
    try {
      await api.put('/settings', { nav_layout: val })
    } catch {
      // Revert if save failed
      setSettings(s => ({ ...s, nav_layout: s.nav_layout }))
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Lab Settings</h2>

      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

      {/* Navigation Layout */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
        <h3 className="font-semibold text-slate-700 mb-1">Navigation Layout</h3>
        <p className="text-sm text-slate-400 mb-5">Choose how the navigation menu is displayed across the app. Takes effect immediately.</p>
        <div className="grid grid-cols-2 gap-4">
          {/* Sidebar option */}
          <button type="button" onClick={() => handleNavLayoutChange('sidebar')}
            className={`relative rounded-2xl border-2 p-4 text-left transition-all cursor-pointer group ${
              (settings.nav_layout || 'sidebar') === 'sidebar'
                ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
            }`}>
            {(settings.nav_layout || 'sidebar') === 'sidebar' && (
              <span className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px]">✓</span>
            )}
            {/* Mini sidebar preview */}
            <div className="flex gap-1.5 mb-3 h-16 rounded-lg overflow-hidden bg-slate-100">
              <div className="w-6 bg-slate-700 rounded-l-lg flex flex-col gap-0.5 p-0.5">
                <div className="h-1 bg-blue-400 rounded" />
                <div className="h-0.5 bg-slate-500 rounded" />
                <div className="h-0.5 bg-slate-500 rounded" />
                <div className="h-0.5 bg-slate-500 rounded" />
                <div className="mt-0.5 h-1 bg-slate-600 rounded" />
                <div className="h-0.5 bg-slate-500 rounded" />
              </div>
              <div className="flex-1 bg-white rounded-r-lg p-1">
                <div className="h-1.5 bg-slate-200 rounded w-3/4 mb-1" />
                <div className="h-1 bg-slate-100 rounded w-1/2 mb-0.5" />
                <div className="h-1 bg-slate-100 rounded w-2/3" />
              </div>
            </div>
            <div className="font-semibold text-slate-700 text-sm">Sidebar Navigation</div>
            <div className="text-xs text-slate-400 mt-0.5">Vertical left sidebar with collapsible sections. Best for power users with many modules.</div>
          </button>

          {/* Top Nav option */}
          <button type="button" onClick={() => handleNavLayoutChange('topnav')}
            className={`relative rounded-2xl border-2 p-4 text-left transition-all cursor-pointer group ${
              settings.nav_layout === 'topnav'
                ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
            }`}>
            {settings.nav_layout === 'topnav' && (
              <span className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px]">✓</span>
            )}
            {/* Mini top-nav preview */}
            <div className="flex flex-col gap-1 mb-3 h-16 rounded-lg overflow-hidden bg-slate-100">
              <div className="h-4 bg-slate-700 flex items-center gap-0.5 px-1">
                <div className="w-2 h-1 bg-blue-400 rounded" />
                <div className="w-2 h-1 bg-slate-500 rounded" />
                <div className="w-2 h-1 bg-slate-500 rounded" />
                <div className="w-2 h-1 bg-slate-500 rounded" />
                <div className="ml-auto w-1.5 h-1.5 bg-slate-400 rounded-full" />
              </div>
              <div className="flex-1 bg-white p-1">
                <div className="h-1.5 bg-slate-200 rounded w-3/4 mb-1" />
                <div className="h-1 bg-slate-100 rounded w-1/2" />
              </div>
            </div>
            <div className="font-semibold text-slate-700 text-sm">Top Header Navigation</div>
            <div className="text-xs text-slate-400 mt-0.5">Horizontal top bar with dropdown menus. Gives more content space. Great for wide screens.</div>
          </button>
        </div>
      </div>

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
          <div className="border border-slate-200 rounded-lg p-6 bg-slate-50">
            <div className="flex items-center gap-4 mb-3">
              {logoUrl && (
                <img src={logoUrl} alt="Lab Logo" className="h-14 w-auto object-contain rounded" />
              )}
              <div className={logoUrl ? '' : 'text-center w-full'}>
                <h2 className="text-xl font-bold text-blue-800">{settings.lab_name}</h2>
                <p className="text-sm text-slate-500">{settings.lab_address}</p>
                <p className="text-sm text-slate-500">Phone: {settings.lab_phone} | Email: {settings.lab_email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Logo Upload */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-700">Lab Logo (for Reports)</h3>
              <p className="text-sm text-slate-500 mt-1">
                Upload your lab logo — it will appear on PDF reports and the report header preview above.
              </p>
            </div>
            <span className="text-2xl">🖼️</span>
          </div>

          {logoMsg && (
            <div className={`px-3 py-2 rounded-lg text-sm mb-3 ${
              logoMsg.includes('failed') || logoMsg.includes('error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
            }`}>{logoMsg}</div>
          )}

          <div className="flex items-center gap-4">
            {/* Current logo preview */}
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 w-40 h-20 flex items-center justify-center bg-slate-50 flex-shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400 text-center">No logo uploaded</span>
              )}
            </div>

            <div className="space-y-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 block mb-1">Upload New Logo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  disabled={logoUploading}
                  onChange={async (e) => {
                    const file = e.target.files[0]
                    if (!file) return
                    setLogoUploading(true)
                    setLogoMsg('')
                    const formData = new FormData()
                    formData.append('file', file)
                    try {
                      await api.post('/settings/logo', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                      })
                      const newSrc = `/api/settings/logo?t=${Date.now()}`
                      setLogoUrl(newSrc)
                      setLogoMsg('Logo uploaded successfully! It will appear on all new reports.')
                    } catch (err) {
                      setLogoMsg('Upload failed: ' + (err.response?.data?.detail || err.message))
                    } finally {
                      setLogoUploading(false)
                      e.target.value = ''
                    }
                  }}
                  className="text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </label>
              {logoUrl && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.delete('/settings/logo')
                      setLogoUrl(null)
                      setLogoMsg('Logo removed.')
                    } catch { setLogoMsg('Failed to remove logo.') }
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove logo
                </button>
              )}
              <p className="text-xs text-slate-400">Recommended: PNG with transparent background, min 200×80px</p>
            </div>
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

        {/* WhatsApp Integration */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">💬</span>
            <h3 className="font-semibold text-slate-700">WhatsApp Integration (WA Connect Pro)</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Paste your API key from <strong>WA Connect Pro</strong> dashboard → Settings → API Key.
            Reports will be sent automatically to patients via WhatsApp.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
              <div className="flex gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={settings.wa_api_key}
                  onChange={(e) => setSettings({...settings, wa_api_key: e.target.value})}
                  placeholder="wcp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Test Button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={waTesting || !settings.wa_api_key}
                onClick={async () => {
                  setWaTesting(true)
                  setWaTestResult(null)
                  try {
                    const res = await api.post('/whatsapp/test', { api_key: settings.wa_api_key })
                    setWaTestResult({ ok: true, msg: res.data.message || 'Connected successfully!' })
                  } catch (err) {
                    setWaTestResult({ ok: false, msg: err.response?.data?.detail || 'Connection failed' })
                  } finally {
                    setWaTesting(false)
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                {waTesting ? 'Testing...' : '🔗 Test Connection'}
              </button>
              {waTestResult && (
                <span className={`text-sm font-medium ${waTestResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {waTestResult.ok ? '✅' : '❌'} {waTestResult.msg}
                </span>
              )}
            </div>

            {settings.wa_api_key && (
              <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                ✅ API key configured — reports will be sent via WhatsApp automatically
              </p>
            )}
          </div>
        </div>

        {/* WhatsApp Sessions */}
        {settings.wa_api_key && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700">📱 WhatsApp Numbers</h3>
              <button type="button" onClick={() => loadWaSessions()}
                className="text-xs text-blue-600 hover:underline">
                {waLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {/* QR Scanner */}
            {qrSessionId && (
              <div className="mb-4 border-2 border-green-400 rounded-xl p-4 text-center">
                {qrStatus === 'connecting' && (
                  <p className="text-slate-500 py-4">Connecting... please wait</p>
                )}
                {qrStatus === 'reconnecting' && (
                  <p className="text-slate-500 py-4">⏳ Scanned! Reconnecting in background...</p>
                )}
                {qrData && qrStatus === 'qr_ready' && (
                  <>
                    <p className="text-sm font-medium text-slate-700 mb-3">
                      Open WhatsApp → Settings → Linked Devices → Link a Device
                    </p>
                    <img src={qrData} alt="QR Code" className="w-56 h-56 mx-auto rounded-lg border" />
                    <p className="text-xs text-slate-400 mt-2">QR refreshes automatically</p>
                  </>
                )}
                {qrStatus === 'connected' && (
                  <p className="text-green-600 font-semibold py-4">✅ Connected successfully!</p>
                )}
                {qrStatus === 'timeout' && (
                  <p className="text-red-500 py-4">QR timed out. Try again.</p>
                )}
                <button type="button" onClick={() => { setQrSessionId(null); setQrData(null) }}
                  className="mt-2 text-xs text-slate-400 hover:text-slate-600">Cancel</button>
              </div>
            )}

            {/* Sessions List */}
            {waSessions.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No sessions found. Go to WA Connect Pro dashboard to add a number.
              </p>
            ) : (
              <div className="space-y-2">
                {waSessions.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{s.session_name}</p>
                      {s.phone_number && (
                        <p className="text-xs text-slate-500">+{s.phone_number}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        s.status === 'connected'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {s.status === 'connected' ? '✅ Connected' : '⚠️ ' + s.status}
                      </span>
                      {s.status !== 'connected' && (
                        <button type="button"
                          onClick={() => startQrScan(s.id)}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
                          Scan QR
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

      {/* License Panel */}
      {license && (
        <div className={`rounded-xl shadow-sm border p-6 mt-6 ${
          license.is_expired ? 'bg-red-50 border-red-200' :
          license.days_left <= 7 ? 'bg-yellow-50 border-yellow-200' :
          'bg-white border-slate-100'
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-700">License & Subscription</h3>
              <p className="text-xs text-slate-500 mt-0.5">Current plan and expiry details</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              license.is_expired ? 'bg-red-600 text-white' :
              license.days_left <= 7 ? 'bg-yellow-500 text-white' :
              license.plan === 'trial' ? 'bg-blue-100 text-blue-700' :
              license.plan === 'lifetime' ? 'bg-purple-100 text-purple-700' :
              'bg-green-100 text-green-700'
            }`}>
              {license.plan_label || license.plan}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white/80 rounded-lg p-3 border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Status</div>
              <div className={`font-bold text-sm ${
                license.is_expired ? 'text-red-600' :
                license.days_left <= 7 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {license.is_expired ? '🔴 Expired' :
                 license.days_left <= 7 ? '⚠️ Expiring Soon' : '✅ Active'}
              </div>
            </div>
            <div className="bg-white/80 rounded-lg p-3 border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Days Left</div>
              <div className={`font-bold text-sm ${license.days_left <= 7 ? 'text-red-600' : 'text-slate-700'}`}>
                {license.is_expired ? 'Expired' : `${license.days_left} days`}
              </div>
            </div>
            <div className="bg-white/80 rounded-lg p-3 border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Expires On</div>
              <div className="font-bold text-sm text-slate-700">
                {license.expires_at ? new Date(license.expires_at).toLocaleDateString('en-PK') : '—'}
              </div>
            </div>
            <div className="bg-white/80 rounded-lg p-3 border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Plan</div>
              <div className="font-bold text-sm text-slate-700 capitalize">{license.plan}</div>
            </div>
          </div>

          {/* Features */}
          {license.features && (
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(license.features).map(([feat, enabled]) => (
                <span key={feat} className={`px-2 py-1 rounded text-xs font-medium ${
                  enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400 line-through'
                }`}>
                  {enabled ? '✓' : '✗'} {feat.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {(license.is_expired || license.days_left <= 7) && (
            <div className={`p-3 rounded-lg text-sm font-medium ${
              license.is_expired ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {license.is_expired
                ? '⛔ System access may be restricted. Contact your LIS provider to renew.'
                : `⚠️ Your license expires in ${license.days_left} days. Renew now to avoid interruption.`}
              <div className="mt-1 text-xs">Contact: +92-300-0000000</div>
            </div>
          )}
        </div>
      )}

      {/* Module Manager */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-700">Module Manager</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Enable or disable modules for this client. Disabled modules are hidden from the sidebar.
              Existing data is never deleted — you can re-enable at any time.
            </p>
          </div>
          <span className="text-2xl">🧩</span>
        </div>

        {moduleMsg && (
          <div className={`px-4 py-2 rounded-lg text-sm mb-4 ${
            moduleMsg.includes('Failed') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
          }`}>{moduleMsg}</div>
        )}

        {[
          { section: 'Hospital Modules', color: 'green', items: [
            { key: 'opd',              label: 'OPD',                   icon: '🏥', desc: 'Out-patient visits & doctor consultations' },
            { key: 'ipd',              label: 'IPD / Admissions',      icon: '🛏️', desc: 'In-patient admissions & discharge' },
            { key: 'wards',            label: 'Wards & Beds',          icon: '🗂️', desc: 'Ward/bed management & occupancy' },
            { key: 'radiology',        label: 'Radiology',             icon: '📡', desc: 'X-ray, MRI, CT scan orders & reports' },
            { key: 'ot',               label: 'Operation Theater',     icon: '⚕️', desc: 'OT scheduling & surgical records' },
            { key: 'pharmacy',         label: 'Pharmacy',              icon: '💊', desc: 'Medicine dispensing & stock' },
          ]},
          { section: 'Finance & HR', color: 'yellow', items: [
            { key: 'hr',               label: 'HR & Payroll',          icon: '👥', desc: 'Staff salaries, advances & payslips' },
            { key: 'referral',         label: 'Referral Commission',   icon: '💵', desc: 'Doctor referral commission tracking' },
            { key: 'insurance',        label: 'Insurance Claims',      icon: '🏥', desc: 'TPA/insurance claim tracking & status updates' },
            { key: 'credit',           label: 'Credit Accounts',       icon: '📒', desc: 'Corporate credit billing & outstanding management' },
            { key: 'export',           label: 'Export Data',           icon: '📥', desc: 'Bulk data export to Excel/CSV' },
          ]},
          { section: 'Clinical Features', color: 'blue', items: [
            { key: 'appointments',     label: 'Appointments',          icon: '📅', desc: 'Patient appointment scheduling & calendar' },
            { key: 'token_queue',      label: 'Token Queue',           icon: '🎫', desc: 'Patient token display & queue management' },
            { key: 'prescriptions',    label: 'Prescriptions',         icon: '📝', desc: 'Doctor prescription writing module' },
            { key: 'doctor_dashboard', label: 'Doctor Dashboard',      icon: '🩺', desc: 'Doctor-specific result & patient view' },
          ]},
          { section: 'System', color: 'slate', items: [
            { key: 'audit_log',        label: 'Audit Log',             icon: '🔍', desc: 'System activity & change history' },
          ]},
        ].map(group => (
          <div key={group.section} className="mb-5">
            <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${
              group.color === 'green' ? 'text-green-600' :
              group.color === 'yellow' ? 'text-yellow-600' :
              group.color === 'blue' ? 'text-blue-600' : 'text-slate-500'
            }`}>{group.section}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {group.items.map(item => {
                const enabled = modules[item.key] !== false
                return (
                  <label key={item.key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    enabled
                      ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 opacity-60'
                  }`}>
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-blue-600"
                      checked={enabled}
                      onChange={e => setModules(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    />
                    <span className="text-lg flex-shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-700">{item.label}</div>
                      <div className="text-xs text-slate-400 truncate">{item.desc}</div>
                    </div>
                    <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                      enabled ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'
                    }`}>{enabled ? 'ON' : 'OFF'}</span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={handleSaveModules}
            disabled={moduleSaving}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            {moduleSaving ? <><span className="animate-spin">⏳</span> Saving...</> : '💾 Save Module Settings'}
          </button>
          <p className="text-xs text-slate-400">Changes take effect after the sidebar refreshes (navigate away or reload)</p>
        </div>
      </div>

      {/* Database Backup */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mt-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-slate-700">Database Backup</h3>
            <p className="text-sm text-slate-500 mt-1">
              Download a complete SQL backup of your lab database. Store safely — contains all patient data.
            </p>
          </div>
          <span className="text-2xl">🗄️</span>
        </div>

        {backupMsg && (
          <div className={`px-4 py-2 rounded-lg text-sm mb-3 ${
            backupMsg.includes('failed') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
          }`}>{backupMsg}</div>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            {backingUp ? (
              <><span className="animate-spin">⏳</span> Generating backup...</>
            ) : (
              <><span>💾</span> Download SQL Backup</>
            )}
          </button>
          <div className="text-xs text-slate-400">
            Recommended: backup daily and store offsite (Google Drive / USB)
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 space-y-1">
          <div><strong>Backup includes:</strong> All patients, samples, results, billing, users, settings</div>
          <div><strong>Format:</strong> PostgreSQL SQL dump (.sql) — restore with: <code className="bg-slate-200 px-1 rounded">psql lis_db &lt; backup.sql</code></div>
          <div><strong>Note:</strong> Requires pg_dump installed on server</div>
        </div>

        {/* Restore Section */}
        <div className="mt-5 pt-5 border-t border-slate-100">
          <h4 className="font-semibold text-slate-700 text-sm mb-1">Restore from Backup</h4>
          <p className="text-xs text-slate-500 mb-3">
            Upload a previously downloaded .sql backup file to restore the database. <strong className="text-amber-600">Warning: this will overwrite existing data.</strong>
          </p>

          {restoreMsg && (
            <div className={`px-4 py-2 rounded-lg text-sm mb-3 ${
              restoreMsg.startsWith('Error') || restoreMsg.startsWith('Restore failed') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
            }`}>{restoreMsg}</div>
          )}

          <label className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${
            restoring ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-700'
          }`}>
            {restoring ? (
              <><span className="animate-spin">⏳</span> Restoring...</>
            ) : (
              <><span>📂</span> Choose .sql File to Restore</>
            )}
            <input
              type="file"
              accept=".sql"
              disabled={restoring}
              onChange={handleRestore}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
