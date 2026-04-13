import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useContext, useRef } from 'react'
import { ThemeContext } from '../App'
import api from '../api'
import ScreenRecorder from './ScreenRecorder'

// `module` key maps to TOGGLEABLE_MODULES. Items without module are always shown.
const navSections = [
  {
    title: 'Main', color: 'blue', icon: '🏠',
    items: [
      { path: '/', label: 'Dashboard', icon: '📊' },
      { path: '/samples', label: 'Samples', icon: '🧪' },
      { path: '/verification', label: 'Verification', icon: '✅' },
      { path: '/token-queue', label: 'Token Queue', icon: '🎫', module: 'token_queue' },
      { path: '/prescriptions', label: 'Prescriptions', icon: '📝', module: 'prescriptions' },
      { path: '/doctor-dashboard', label: 'Doctor Dashboard', icon: '🩺', roles: ['doctor'], module: 'doctor_dashboard' },
    ],
  },
  {
    title: 'Hospital', color: 'green', icon: '🏥',
    items: [
      { path: '/opd', label: 'OPD', icon: '🏥', module: 'opd' },
      { path: '/ipd', label: 'IPD / Admissions', icon: '🛏️', module: 'ipd' },
      { path: '/wards', label: 'Wards & Beds', icon: '🗂️', module: 'wards' },
      { path: '/radiology', label: 'Radiology', icon: '📡', module: 'radiology' },
      { path: '/ot', label: 'Operation Theater', icon: '⚕️', module: 'ot' },
      { path: '/pharmacy-store', label: 'Pharmacy', icon: '💊', module: 'pharmacy' },
    ],
  },
  {
    title: 'Registration', color: 'purple', icon: '📋',
    items: [
      { path: '/appointments', label: 'Appointments', icon: '📅', module: 'appointments' },
      { path: '/patients/new', label: 'New Patient', icon: '➕' },
      { path: '/samples/new', label: 'New Sample', icon: '🏷️' },
      { path: '/patients', label: 'Patient List', icon: '👥' },
      { path: '/doctors', label: 'Doctors', icon: '🩺' },
      { path: '/doctor-schedule', label: 'Doctor Schedule', icon: '📅' },
      { path: '/result-trend', label: 'Result Trend', icon: '📈' },
    ],
  },
  {
    title: 'Finance', color: 'yellow', icon: '💰',
    items: [
      { path: '/billing', label: 'Billing', icon: '💰' },
      { path: '/daily-closing', label: 'Daily Closing', icon: '📝' },
      { path: '/reports', label: 'MIS Reports', icon: '📈' },
      { path: '/export', label: 'Export Data', icon: '📥', module: 'export' },
      { path: '/referral', label: 'Referral Commission', icon: '💵', module: 'referral' },
      { path: '/insurance-claims', label: 'Insurance Claims', icon: '🏥', module: 'insurance' },
      { path: '/credit-accounts', label: 'Credit Accounts', icon: '📒', module: 'credit' },
      { path: '/patients/statement', label: 'Patient Statement', icon: '🧾' },
      { path: '/hr', label: 'HR & Payroll', icon: '👥', module: 'hr' },
      { path: '/attendance', label: 'Attendance', icon: '👆' },
    ],
  },
  {
    title: 'Config', color: 'orange', icon: '⚙️', roles: ['admin'],
    items: [
      { path: '/users', label: 'Users', icon: '🔑' },
      { path: '/tests', label: 'Test Catalog', icon: '🔬' },
      { path: '/packages', label: 'Test Packages', icon: '📦' },
      { path: '/categories', label: 'Categories', icon: '📂' },
      { path: '/branches', label: 'Branches', icon: '🏢' },
      { path: '/inventory', label: 'Inventory', icon: '📦' },
      { path: '/report-templates', label: 'Report Templates', icon: '📋' },
      { path: '/import', label: 'Import Data', icon: '📤' },
      { path: '/settings', label: 'Settings', icon: '⚙️' },
      { path: '/shifts', label: 'Shift Management', icon: '🕐', roles: ['admin'] },
    ],
  },
  {
    title: 'System', color: 'slate', icon: '🔧', roles: ['admin'],
    items: [
      { path: '/machine-test', label: 'Machine Test', icon: '🔌' },
      { path: '/system-flow', label: 'System Flow', icon: '🗺️' },
      { path: '/api-docs', label: 'API Docs', icon: '🔗' },
      { path: '/audit-log', label: 'Audit Log', icon: '🔍', module: 'audit_log' },
      { path: '/guide', label: 'User Guide', icon: '📖' },
      { path: '/qa-checklist', label: 'QA Checklist', icon: '✅', roles: ['admin'] },
    ],
  },
]

// Bottom tab bar items — most-used pages for mobile quick access
const BOTTOM_TABS = [
  { path: '/',             label: 'Home',     icon: '📊' },
  { path: '/patients',     label: 'Patients', icon: '👥' },
  { path: '/samples/new',  label: 'Sample',   icon: '🏷️' },
  { path: '/billing',      label: 'Billing',  icon: '💰' },
  { path: '/attendance',   label: 'Attend',   icon: '👆' },
]

const sectionAccent = {
  blue:   { dot: 'bg-blue-400',   text: 'text-blue-300',   hover: 'hover:bg-blue-600/20',   activeBg: 'bg-blue-500/20', border: 'border-blue-500'   },
  green:  { dot: 'bg-green-400',  text: 'text-green-300',  hover: 'hover:bg-green-600/20',  activeBg: 'bg-green-500/20', border: 'border-green-500'  },
  purple: { dot: 'bg-purple-400', text: 'text-purple-300', hover: 'hover:bg-purple-600/20', activeBg: 'bg-purple-500/20', border: 'border-purple-500' },
  yellow: { dot: 'bg-yellow-400', text: 'text-yellow-300', hover: 'hover:bg-yellow-600/20', activeBg: 'bg-yellow-500/20', border: 'border-yellow-500' },
  orange: { dot: 'bg-orange-400', text: 'text-orange-300', hover: 'hover:bg-orange-600/20', activeBg: 'bg-orange-500/20', border: 'border-orange-500' },
  slate:  { dot: 'bg-slate-400',  text: 'text-slate-300',  hover: 'hover:bg-slate-600/20',  activeBg: 'bg-slate-500/20', border: 'border-slate-500'  },
}

// ─── Shared hooks ───────────────────────────────────────────────────────────

function useLayoutData() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const { darkMode, setDarkMode } = useContext(ThemeContext)
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [licenseBanner, setLicenseBanner] = useState(null)
  const [modules, setModules] = useState({})
  const [labName, setLabName] = useState(localStorage.getItem('labName') || 'LIS System')
  const [logoUrl, setLogoUrl] = useState(null)

  useEffect(() => {
    const fetchNotifs = () => api.get('/notifications').then(r => setNotifications(r.data)).catch(() => {})
    fetchNotifs()
    const iv = setInterval(fetchNotifs, 30000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    api.get('/license').then(r => { if (r.data.banner) setLicenseBanner(r.data.banner) }).catch(() => {})
    api.get('/settings/modules').then(r => setModules(r.data)).catch(() => {})
    api.get('/settings').then(r => {
      if (r.data.lab_name) { setLabName(r.data.lab_name); localStorage.setItem('labName', r.data.lab_name) }
    }).catch(() => {})
    fetch('/api/settings/logo?t=' + Date.now()).then(r => { if (r.ok) setLogoUrl('/api/settings/logo') }).catch(() => {})
  }, [])

  const handleLogout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login') }

  const isItemVisible = (item) => {
    if (item.roles && !item.roles.includes(user.role)) return false
    if (item.module && Object.keys(modules).length > 0 && modules[item.module] === false) return false
    return true
  }

  const visibleSections = navSections
    .filter(s => !s.roles || s.roles.includes(user.role))
    .map(s => ({ ...s, items: s.items.filter(isItemVisible) }))
    .filter(s => s.items.length > 0)

  return { user, darkMode, setDarkMode, notifications, showNotifs, setShowNotifs,
           licenseBanner, visibleSections, location, handleLogout, labName, logoUrl }
}

// ─── Notifications dropdown ──────────────────────────────────────────────────

function NotifDropdown({ notifications, showNotifs, setShowNotifs, darkMode }) {
  return (
    <div className="relative">
      <button onClick={() => setShowNotifs(!showNotifs)}
        className={`relative p-2 rounded-xl transition-colors ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
        <span className="text-lg">🔔</span>
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center animate-pulse">
            {notifications.length}
          </span>
        )}
      </button>
      {showNotifs && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
          <div className={`absolute right-0 mt-2 w-80 rounded-2xl shadow-2xl border z-50 ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
            <div className={`p-3 border-b font-semibold text-sm flex items-center justify-between ${darkMode ? 'border-slate-600' : 'border-slate-100'}`}>
              <span>🔔 Notifications ({notifications.length})</span>
              <button onClick={() => setShowNotifs(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0
                ? <div className="p-6 text-center text-slate-400 text-sm"><div className="text-2xl mb-2">🔕</div>No new notifications</div>
                : notifications.map((n, i) => (
                  <div key={i} className={`p-3 border-b text-sm last:border-0 ${darkMode ? 'border-slate-700 hover:bg-slate-700' : 'border-slate-50 hover:bg-slate-50'}`}>
                    <div className="flex items-center gap-2">
                      <span>{n.type === 'critical' ? '🚨' : n.type === 'abnormal' ? '⚠️' : n.type === 'pending' ? '⏳' : '📦'}</span>
                      <span className="font-medium">{n.title}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{n.detail}</p>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── License Banner ───────────────────────────────────────────────────────────

function LicenseBanner({ banner }) {
  if (!banner) return null
  return (
    <div className={`px-4 py-2.5 text-sm font-medium flex items-center justify-between print:hidden ${
      banner.type === 'error' || banner.type === 'critical' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-white'
    }`}>
      <span>{banner.type === 'error' ? '⛔' : '⚠️'} {banner.title} — {banner.message}</span>
      <a href="tel:+923000000000" className="ml-4 underline text-xs opacity-80 hover:opacity-100 flex-shrink-0">
        Renew: {banner.contact}
      </a>
    </div>
  )
}

// ─── Mobile Bottom Tab Bar ───────────────────────────────────────────────────

function BottomTabBar({ location, darkMode }) {
  return (
    <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t print:hidden ${
      darkMode ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'
    }`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {BOTTOM_TABS.map(tab => {
        const isActive = location.pathname === tab.path ||
          (tab.path !== '/' && location.pathname.startsWith(tab.path))
        return (
          <Link key={tab.path} to={tab.path}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
              isActive
                ? 'text-blue-500'
                : darkMode ? 'text-slate-500 active:text-slate-300' : 'text-slate-400 active:text-slate-600'
            }`}>
            <span className={`text-xl leading-none transition-transform ${isActive ? 'scale-110' : ''}`}>{tab.icon}</span>
            <span className={`text-[10px] font-medium leading-none ${isActive ? 'text-blue-500' : ''}`}>{tab.label}</span>
            {isActive && <span className="absolute top-0 w-8 h-0.5 bg-blue-500 rounded-full" style={{ position: 'relative' }} />}
          </Link>
        )
      })}
    </nav>
  )
}

// ─── Mobile Drawer Nav ────────────────────────────────────────────────────────

function MobileDrawer({ open, onClose, visibleSections, location, darkMode, user, handleLogout, setDarkMode }) {
  // Close on route change
  useEffect(() => { onClose() }, [location.pathname])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 print:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out print:hidden ${
        open ? 'translate-x-0' : '-translate-x-full'
      } ${darkMode ? 'bg-slate-950' : 'bg-gradient-to-b from-slate-800 via-slate-850 to-slate-900'}`}>

        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-sm font-bold">🧬</div>
            <div>
              <div className="text-xs font-bold text-white leading-tight">{localStorage.getItem('labName') || 'LIS System'}</div>
              <div className="text-[9px] text-slate-400">Lab Info System</div>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/20 transition-colors text-sm">
            ✕
          </button>
        </div>

        {/* User badge */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {(user.full_name || 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{user.full_name || 'User'}</div>
            <span className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded text-slate-400 capitalize">{user.role}</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {visibleSections.map(section => {
            const accent = sectionAccent[section.color] || sectionAccent.slate
            const hasActive = section.items.some(item => item.path === location.pathname)
            return (
              <div key={section.title} className="mb-2">
                <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${
                  hasActive ? accent.text : 'text-slate-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasActive ? accent.dot : 'bg-slate-700'}`} />
                  {section.icon} {section.title}
                </div>
                <div className="space-y-0.5">
                  {section.items.map(item => {
                    const isActive = location.pathname === item.path
                    return (
                      <Link key={item.path} to={item.path}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/25 font-medium'
                            : 'text-slate-300 hover:bg-white/8 hover:text-white active:bg-white/12'
                        }`}>
                        <span className="text-base w-6 text-center flex-shrink-0">{item.icon}</span>
                        <span className="flex-1">{item.label}</span>
                        {isActive && <span className="w-1.5 h-1.5 bg-white/50 rounded-full flex-shrink-0" />}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-white/10 flex gap-2 flex-shrink-0">
          <button onClick={() => setDarkMode(d => !d)}
            className="flex-1 py-2 text-xs bg-white/5 hover:bg-white/10 rounded-xl transition-all flex items-center justify-center gap-1.5 text-slate-300">
            <span>{darkMode ? '☀️' : '🌙'}</span>
            {darkMode ? 'Light' : 'Dark'}
          </button>
          <button onClick={handleLogout}
            className="flex-1 py-2 text-xs bg-red-500/20 hover:bg-red-500/40 rounded-xl transition-all flex items-center justify-center gap-1.5 text-red-300 hover:text-white">
            <span>🚪</span> Logout
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Mobile User Menu (avatar + logout dropdown) ─────────────────────────────

function MobileUserMenu({ user, handleLogout, darkMode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative md:hidden flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-sm font-bold text-white shadow-lg">
        {(user.full_name || 'U')[0].toUpperCase()}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute right-0 mt-2 w-48 rounded-2xl shadow-2xl border z-50 overflow-hidden ${
            darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'
          }`}>
            <div className={`px-3 py-2.5 border-b ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              <div className={`text-sm font-semibold truncate ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                {user.full_name || 'User'}
              </div>
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded capitalize font-medium">
                {user.role}
              </span>
            </div>
            <div className="p-1.5">
              <button
                onClick={() => { setOpen(false); handleLogout() }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors font-medium">
                <span>🚪</span> Logout
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Mobile Top Bar (shared by both layouts) ─────────────────────────────────

function MobileTopBar({ setDrawerOpen, logoUrl, labName, user, notifications, showNotifs, setShowNotifs, darkMode, handleLogout }) {
  return (
    <div className={`md:hidden sticky top-0 z-40 flex items-center gap-2 px-3 py-2.5 border-b print:hidden ${
      darkMode ? 'bg-slate-950 border-slate-700' : 'bg-slate-900 border-slate-700'
    }`}>
      {/* Hamburger — opens full nav drawer */}
      <button onClick={() => setDrawerOpen(true)}
        className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 transition-colors text-lg flex-shrink-0">
        ☰
      </button>

      {/* Lab name */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {logoUrl
          ? <img src={logoUrl} alt="logo" className="h-6 w-6 rounded object-contain flex-shrink-0" />
          : <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">🧬</div>
        }
        <span className="text-sm font-semibold text-white truncate">{labName}</span>
      </div>

      {/* Notifications */}
      <NotifDropdown {...{ notifications, showNotifs, setShowNotifs, darkMode }} />

      {/* User avatar — tap to see name + logout */}
      <MobileUserMenu user={user} handleLogout={handleLogout} darkMode={darkMode} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

function SidebarLayout() {
  const { user, darkMode, setDarkMode, notifications, showNotifs, setShowNotifs,
          licenseBanner, visibleSections, location, handleLogout, labName, logoUrl } = useLayoutData()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [collapsed, setCollapsed] = useState({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false
  )

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    navSections.forEach(section => {
      if (section.items.some(item => item.path === location.pathname)) {
        setCollapsed(prev => ({ ...prev, [section.title]: false }))
      }
    })
  }, [location.pathname])

  const toggleSection = (title) => setCollapsed(prev => ({ ...prev, [title]: !prev[title] }))

  const sidebarW = sidebarOpen ? 232 : 56

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-gray-50'}`}>

      {/* ── Desktop Sidebar — truly fixed so it never scrolls away ── */}
      <aside className={`
        hidden md:flex flex-col
        fixed left-0 top-0 h-screen z-30 overflow-hidden
        ${darkMode ? 'bg-slate-950' : 'bg-gradient-to-b from-slate-800 via-slate-850 to-slate-900'}
        text-white transition-all duration-300 ease-in-out
        shadow-xl shadow-black/20
      `} style={{ width: sidebarW }}>

        {/* Logo */}
        <div className={`flex items-center gap-2.5 px-3 py-3 border-b border-white/10 flex-shrink-0 ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2 min-w-0 animate-fadeIn">
              {logoUrl
                ? <img src={logoUrl} alt="logo" className="h-7 w-7 rounded object-contain flex-shrink-0" />
                : <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">🧬</div>
              }
              <div className="min-w-0">
                <h1 className="text-xs font-bold truncate leading-tight">{labName}</h1>
                <p className="text-[9px] text-slate-400 leading-tight">Lab Info System</p>
              </div>
            </div>
          )}
          {!sidebarOpen && logoUrl && <img src={logoUrl} alt="logo" className="h-6 w-6 rounded object-contain" />}
          {!sidebarOpen && !logoUrl && <span className="text-base">🧬</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-xs flex-shrink-0 text-slate-400 hover:text-white"
            title={sidebarOpen ? 'Collapse' : 'Expand'}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5 scrollbar-thin scrollbar-thumb-slate-700">
          {visibleSections.map(section => {
            const accent = sectionAccent[section.color] || sectionAccent.slate
            const isCollapsed = collapsed[section.title]
            const visibleItems = section.items
            const hasActive = visibleItems.some(item => item.path === location.pathname)

            return (
              <div key={section.title}>
                {sidebarOpen ? (
                  <button onClick={() => toggleSection(section.title)}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded-lg transition-all ${accent.hover}`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${hasActive ? accent.dot : 'bg-slate-600'}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-widest truncate transition-colors ${hasActive ? accent.text : 'text-slate-500'}`}>
                        {section.icon} {section.title}
                      </span>
                    </div>
                    <span className={`text-[9px] flex-shrink-0 opacity-50 ${accent.text}`}>
                      {isCollapsed ? '▶' : '▼'}
                    </span>
                  </button>
                ) : (
                  <div className={`mx-auto my-1.5 w-1.5 h-1.5 rounded-full ${hasActive ? accent.dot : 'bg-slate-700'}`} />
                )}

                {!isCollapsed && visibleItems.map(item => {
                  const isActive = location.pathname === item.path
                  return (
                    <Link key={item.path} to={item.path} title={item.label}
                      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-xs transition-all duration-150 group ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/25'
                          : 'text-slate-300 hover:bg-white/8 hover:text-white'
                      }`}>
                      <span className={`text-sm flex-shrink-0 w-5 text-center transition-transform ${isActive ? '' : 'group-hover:scale-110'}`}>
                        {item.icon}
                      </span>
                      {sidebarOpen && <span className="truncate font-medium">{item.label}</span>}
                      {sidebarOpen && isActive && <span className="ml-auto w-1 h-3.5 bg-white/40 rounded-full flex-shrink-0" />}
                    </Link>
                  )
                })}

                {sidebarOpen && <div className="mx-2 mt-1 mb-0.5 border-t border-white/5" />}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-white/10 space-y-1 flex-shrink-0">
          <button onClick={() => setDarkMode(!darkMode)}
            className="w-full px-2 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-xl transition-all flex items-center gap-2 justify-center">
            <span>{darkMode ? '☀️' : '🌙'}</span>
            {sidebarOpen && (darkMode ? 'Light Mode' : 'Dark Mode')}
          </button>
          {sidebarOpen && (
            <div className="px-2 py-1 animate-fadeIn">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {(user.full_name || 'U')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{user.full_name || 'User'}</div>
                  <span className="text-[9px] px-1.5 py-0.5 bg-white/10 rounded text-slate-400 capitalize">{user.role}</span>
                </div>
              </div>
            </div>
          )}
          <button onClick={handleLogout}
            className="w-full px-2 py-1.5 text-xs bg-white/5 hover:bg-red-500/80 rounded-xl transition-all flex items-center gap-2 justify-center text-slate-300 hover:text-white">
            <span>🚪</span> {sidebarOpen && 'Logout'}
          </button>
        </div>
      </aside>

      {/* ── Mobile Drawer ── */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        visibleSections={visibleSections}
        location={location}
        darkMode={darkMode}
        user={user}
        handleLogout={handleLogout}
        setDarkMode={setDarkMode}
      />

      {/* ── Main — offset by fixed sidebar width on desktop ── */}
      <main className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-gray-50'}`}
        style={{ paddingLeft: isDesktop ? sidebarW : 0 }}>

        {/* Mobile top bar */}
        <MobileTopBar
          setDrawerOpen={setDrawerOpen}
          logoUrl={logoUrl}
          labName={labName}
          user={user}
          notifications={notifications}
          showNotifs={showNotifs}
          setShowNotifs={setShowNotifs}
          darkMode={darkMode}
          handleLogout={handleLogout}
        />

        {/* Desktop top bar */}
        <div className={`hidden md:flex px-4 md:px-6 py-3 border-b justify-end items-center gap-2 sticky top-0 z-20 print:hidden ${
          darkMode ? 'border-slate-700/60 bg-slate-900' : 'border-slate-100 bg-white'
        }`}>
          <NotifDropdown {...{ notifications, showNotifs, setShowNotifs, darkMode }} />
        </div>

        <LicenseBanner banner={licenseBanner} />

        {/* Page content — extra bottom padding on mobile for bottom tab bar */}
        <div className="p-3 sm:p-4 md:p-6 pb-20 md:pb-6 min-w-0"><Outlet /></div>
      </main>

      {/* ── Mobile Bottom Tab Bar ── */}
      <BottomTabBar location={location} darkMode={darkMode} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TOP NAV LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

function TopNavLayout() {
  const { user, darkMode, setDarkMode, notifications, showNotifs, setShowNotifs,
          licenseBanner, visibleSections, location, handleLogout, labName, logoUrl } = useLayoutData()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [hovered, setHovered] = useState(null)
  const leaveTimer = useRef(null)

  useEffect(() => { setDrawerOpen(false); setHovered(null) }, [location.pathname])

  const activeSection = visibleSections.find(s => s.items.some(i => i.path === location.pathname))

  const onEnter = (title) => { clearTimeout(leaveTimer.current); setHovered(title) }
  const onLeave = () => { leaveTimer.current = setTimeout(() => setHovered(null), 120) }

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-gray-50'}`}>

      {/* ── Top Nav Bar ── */}
      <header className={`
        sticky top-0 z-50 flex-shrink-0 print:hidden
        ${darkMode ? 'bg-slate-950 border-b border-slate-800' : 'bg-slate-900 border-b border-slate-700'}
        shadow-md
      `} style={{ overflow: 'visible' }}>

        <div className="flex items-center h-12 px-3 gap-2">

          {/* Mobile hamburger */}
          <button onClick={() => setDrawerOpen(!drawerOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 transition-colors">
            {drawerOpen ? '✕' : '☰'}
          </button>

          {/* Logo + Lab Name */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0 mr-1">
            {logoUrl
              ? <img src={logoUrl} alt="logo" className="h-6 w-6 rounded object-contain" />
              : <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center text-xs font-bold text-white">🧬</div>
            }
            <span className="text-sm font-semibold text-white truncate max-w-[140px]">{labName}</span>
          </Link>

          <div className="hidden md:block w-px h-4 bg-white/10 flex-shrink-0" />

          {/* Section menus — hover to open (desktop only) */}
          <nav className="hidden md:flex items-center flex-1" style={{ overflow: 'visible' }}>
            {visibleSections.map(section => {
              const accent = sectionAccent[section.color] || sectionAccent.slate
              const isOpen = hovered === section.title
              const hasActive = section.items.some(i => i.path === location.pathname)

              return (
                <div key={section.title} className="relative"
                  onMouseEnter={() => onEnter(section.title)}
                  onMouseLeave={onLeave}>
                  <button className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors rounded ${
                    isOpen ? 'bg-white/15 text-white'
                    : hasActive ? 'text-white bg-white/10'
                    : 'text-slate-300 hover:text-white hover:bg-white/8'
                  }`}>
                    <span>{section.icon}</span>
                    <span>{section.title}</span>
                    {hasActive && <span className={`w-1 h-1 rounded-full ${accent.dot} ml-0.5`} />}
                    <span className="text-[7px] opacity-40 ml-0.5">▼</span>
                  </button>

                  {isOpen && (
                    <div onMouseEnter={() => onEnter(section.title)} onMouseLeave={onLeave}
                      className={`absolute left-0 min-w-[190px] rounded-xl shadow-2xl border py-1
                        ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}
                      `}
                      style={{ top: 'calc(100% + 2px)', zIndex: 9999 }}>
                      <div className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border-b mb-1 ${
                        darkMode ? 'border-slate-700 text-slate-500' : 'border-slate-100 text-slate-400'
                      }`}>
                        {section.icon} {section.title}
                      </div>
                      {section.items.map(item => {
                        const isActive = location.pathname === item.path
                        return (
                          <Link key={item.path} to={item.path}
                            className={`flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                              isActive ? 'bg-blue-600 text-white font-medium'
                              : darkMode ? 'text-slate-200 hover:bg-slate-700'
                              : 'text-slate-700 hover:bg-slate-50'
                            }`}>
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                            {isActive && <span className="ml-auto w-1 h-1 bg-blue-200 rounded-full" />}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
            <button onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 transition-colors text-sm">
              {darkMode ? '☀️' : '🌙'}
            </button>
            <NotifDropdown {...{ notifications, showNotifs, setShowNotifs, darkMode }} />
            {/* Desktop: user info + logout */}
            <div className="hidden md:flex items-center gap-1.5 ml-1 pl-2 border-l border-white/10">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                {(user.full_name || 'U')[0].toUpperCase()}
              </div>
              <div className="hidden lg:block">
                <div className="text-xs font-medium text-white truncate max-w-[90px]">{user.full_name || 'User'}</div>
                <div className="text-[9px] text-slate-400 capitalize">{user.role}</div>
              </div>
              <button onClick={handleLogout}
                className="ml-1 px-1.5 py-1 text-xs text-slate-400 hover:text-white hover:bg-red-500/80 rounded transition-colors"
                title="Logout">🚪</button>
            </div>
            {/* Mobile: avatar tap → name + logout dropdown */}
            <MobileUserMenu user={user} handleLogout={handleLogout} darkMode={darkMode} />
          </div>
        </div>

        {/* Breadcrumb — desktop only */}
        {activeSection && (
          <div className={`hidden md:flex px-3 py-0.5 text-[10px] border-t items-center gap-1 ${
            darkMode ? 'border-slate-800 text-slate-600' : 'border-slate-700/20 text-slate-500'
          }`}>
            <span>{activeSection.icon}</span>
            <span>{activeSection.title}</span>
            <span className="opacity-40">›</span>
            <span className="text-slate-400">
              {activeSection.items.find(i => i.path === location.pathname)?.label}
            </span>
          </div>
        )}
      </header>

      {/* ── Mobile Drawer ── */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        visibleSections={visibleSections}
        location={location}
        darkMode={darkMode}
        user={user}
        handleLogout={handleLogout}
        setDarkMode={setDarkMode}
      />

      <LicenseBanner banner={licenseBanner} />

      {/* ── Page Content ── */}
      <main className="flex-1 min-w-0">
        <div className="p-3 sm:p-4 md:p-6 pb-20 md:pb-6 min-w-0"><Outlet /></div>
      </main>

      {/* ── Mobile Bottom Tab Bar ── */}
      <BottomTabBar location={location} darkMode={darkMode} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT LAYOUT — reads nav_layout setting and renders correct mode
// ═══════════════════════════════════════════════════════════════════════════

export default function Layout() {
  const [navLayout, setNavLayout] = useState(localStorage.getItem('navLayout') || 'sidebar')

  useEffect(() => {
    if (!localStorage.getItem('navLayout')) {
      api.get('/settings').then(r => {
        const val = r.data.nav_layout || 'sidebar'
        setNavLayout(val)
        localStorage.setItem('navLayout', val)
      }).catch(() => {})
    }
    const handler = (e) => {
      setNavLayout(e.detail)
      localStorage.setItem('navLayout', e.detail)
    }
    window.addEventListener('lis:navLayout', handler)
    return () => window.removeEventListener('lis:navLayout', handler)
  }, [])

  return (
    <>
      {navLayout === 'topnav' ? <TopNavLayout /> : <SidebarLayout />}
      <ScreenRecorder />
    </>
  )
}
