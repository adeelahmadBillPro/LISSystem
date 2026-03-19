import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useContext } from 'react'
import { ThemeContext } from '../App'

const navSections = [
  {
    title: 'Main',
    items: [
      { path: '/', label: 'Dashboard', icon: '📊' },
      { path: '/samples', label: 'Samples', icon: '🧪' },
      { path: '/verification', label: 'Verification', icon: '✅' },
      { path: '/token-queue', label: 'Token Queue', icon: '🎫' },
    ],
  },
  {
    title: 'Registration',
    items: [
      { path: '/patients/new', label: 'New Patient', icon: '➕' },
      { path: '/samples/new', label: 'New Sample', icon: '🏷️' },
      { path: '/patients', label: 'Patient List', icon: '👥' },
      { path: '/doctors', label: 'Doctors', icon: '🩺' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { path: '/billing', label: 'Billing', icon: '💰' },
      { path: '/daily-closing', label: 'Daily Closing', icon: '📝' },
      { path: '/reports', label: 'MIS Reports', icon: '📈' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { path: '/users', label: 'Users', icon: '🔑' },
      { path: '/tests', label: 'Test Catalog', icon: '🔬' },
      { path: '/packages', label: 'Test Packages', icon: '📦' },
      { path: '/categories', label: 'Categories', icon: '📂' },
      { path: '/branches', label: 'Branches', icon: '🏢' },
      { path: '/inventory', label: 'Inventory', icon: '📦' },
      { path: '/report-templates', label: 'Report Templates', icon: '📋' },
      { path: '/audit-log', label: 'Audit Log', icon: '📋' },
      { path: '/settings', label: 'Settings', icon: '⚙️' },
    ],
    roles: ['admin'],
  },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { darkMode, setDarkMode } = useContext(ThemeContext)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const visibleSections = navSections.filter(
    (s) => !s.roles || s.roles.includes(user.role)
  )

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-slate-900 text-slate-100' : ''}`}>
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-14'} ${darkMode ? 'bg-slate-950' : 'bg-gradient-to-b from-slate-800 to-slate-900'} text-white flex flex-col min-h-screen transition-all duration-300 ease-in-out flex-shrink-0`}>
        <div className="p-3 border-b border-slate-700 flex items-center justify-between">
          {sidebarOpen && (
            <div className="animate-fadeIn">
              <h1 className="text-base font-bold">LIS System</h1>
              <p className="text-[10px] text-slate-400">Lab Information System</p>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-slate-700 rounded transition-colors text-xs">
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="flex-1 p-1.5 overflow-y-auto">
          {visibleSections.map((section) => (
            <div key={section.title} className="mb-2">
              {sidebarOpen && (
                <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider px-2 mb-0.5">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => (
                <Link
                  key={item.path} to={item.path} title={item.label}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all duration-200 mb-0.5 ${
                    location.pathname === item.path
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.02]'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:translate-x-0.5'
                  }`}
                >
                  <span className="text-sm flex-shrink-0">{item.icon}</span>
                  {sidebarOpen && <span>{item.label}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-2 border-t border-slate-700 space-y-1.5">
          {/* Dark Mode Toggle */}
          <button onClick={() => setDarkMode(!darkMode)}
            className="w-full px-2 py-1.5 text-xs bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-all flex items-center gap-2 justify-center">
            <span>{darkMode ? '☀️' : '🌙'}</span>
            {sidebarOpen && (darkMode ? 'Light Mode' : 'Dark Mode')}
          </button>

          {sidebarOpen && (
            <div className="text-xs text-slate-400 px-1 animate-fadeIn">
              <div className="font-medium text-slate-300">{user.full_name || 'User'}</div>
              <span className="text-[10px] px-1 py-0.5 bg-slate-700 rounded text-slate-400">{user.role || ''}</span>
            </div>
          )}
          <button onClick={handleLogout}
            className="w-full px-2 py-1.5 text-xs bg-slate-700/50 hover:bg-red-600/80 rounded-lg transition-all flex items-center gap-2 justify-center">
            <span>🚪</span> {sidebarOpen && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 p-4 md:p-8 overflow-auto ${darkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="animate-fadeIn">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
