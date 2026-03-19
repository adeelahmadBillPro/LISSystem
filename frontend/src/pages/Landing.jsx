import { Link } from 'react-router-dom'

export default function Landing() {
  const features = [
    { icon: '🔬', title: 'Machine Integration', desc: 'Connect Sysmex, Mindray, Roche, Abbott analyzers via RS-232 or TCP/IP' },
    { icon: '📊', title: 'Real-time Results', desc: 'Auto-receive and display results with color-coded H/L/N flags' },
    { icon: '📄', title: 'PDF Reports', desc: 'Professional lab reports with QR codes, digital signatures, and custom templates' },
    { icon: '📱', title: 'WhatsApp Delivery', desc: 'Send reports directly to patients via WhatsApp, SMS, or email' },
    { icon: '💰', title: 'Billing & Invoices', desc: 'Complete billing with test packages, discounts, and thermal receipt printing' },
    { icon: '🎫', title: 'Token Queue', desc: 'Walk-in patient queue management with live display board' },
    { icon: '📦', title: 'Inventory', desc: 'Track reagents, consumables with low stock alerts and expiry tracking' },
    { icon: '👥', title: 'Multi-user & Roles', desc: 'Admin, receptionist, technician, doctor — each sees only what they need' },
    { icon: '🏢', title: 'Multi-branch', desc: 'Central database with branch-wise filtering and reporting' },
    { icon: '📈', title: 'MIS Reports', desc: 'Daily closing, staff accountability, revenue analytics' },
    { icon: '🔒', title: 'Secure & Audited', desc: 'JWT auth, XSS prevention, audit logs, database backup' },
    { icon: '🌙', title: 'Modern UI', desc: 'Dark mode, animations, mobile responsive, patient portal' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b bg-white/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧬</span>
            <span className="font-bold text-xl text-slate-800">LIS System</span>
          </div>
          <div className="flex gap-3">
            <Link to="/portal" className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium">Patient Portal</Link>
            <Link to="/login" className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-lg shadow-blue-600/20">
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-white"></div>
        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium mb-6">
              Complete Lab Management Solution
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
              Laboratory<br />Information<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">System</span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 max-w-xl">
              From blood sample to patient report — automate your entire lab workflow.
              Connect analyzers, manage results, deliver reports digitally.
            </p>
            <div className="flex gap-4">
              <Link to="/login"
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium shadow-xl shadow-blue-600/25 hover:shadow-blue-600/40 transition-all text-lg">
                Get Started Free
              </Link>
              <a href="#features"
                className="px-8 py-4 bg-white text-slate-700 rounded-xl font-medium border border-slate-200 hover:border-slate-300 transition-all text-lg">
                See Features
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { num: '50+', label: 'Features' },
            { num: '27', label: 'Pages' },
            { num: '60+', label: 'API Endpoints' },
            { num: '6+', label: 'Machine Protocols' },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-3xl font-bold text-blue-600">{s.num}</div>
              <div className="text-sm text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900">Everything Your Lab Needs</h2>
          <p className="text-slate-500 mt-3 max-w-xl mx-auto">Built for Pakistan's private labs — from single-room setups to multi-branch chains</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="p-6 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300 group">
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">{f.icon}</div>
              <h3 className="font-bold text-slate-800 text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-slate-50 border-y">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">Simple Pricing</h2>
            <p className="text-slate-500 mt-3">No hidden fees, no per-user charges</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { name: 'Starter', price: '50,000', period: 'one-time', features: ['Single branch', 'Up to 3 users', '1 machine connection', 'Email support'], color: 'slate' },
              { name: 'Professional', price: '150,000', period: 'one-time', features: ['Multi-branch', 'Unlimited users', '5 machine connections', 'WhatsApp delivery', 'Priority support'], color: 'blue', popular: true },
              { name: 'Enterprise', price: 'Custom', period: 'contact us', features: ['Cloud hosted', 'Unlimited everything', 'Custom integrations', 'Training included', '24/7 support'], color: 'indigo' },
            ].map((plan, i) => (
              <div key={i} className={`rounded-2xl p-8 ${plan.popular ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20 scale-105' : 'bg-white border'}`}>
                {plan.popular && <div className="text-xs bg-blue-500 text-white px-3 py-1 rounded-full inline-block mb-4">Most Popular</div>}
                <h3 className={`text-xl font-bold ${plan.popular ? '' : 'text-slate-800'}`}>{plan.name}</h3>
                <div className="mt-4">
                  <span className="text-3xl font-bold">Rs. {plan.price}</span>
                  <span className={`text-sm ml-2 ${plan.popular ? 'text-blue-200' : 'text-slate-500'}`}>{plan.period}</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f, j) => (
                    <li key={j} className={`flex items-center gap-2 text-sm ${plan.popular ? 'text-blue-100' : 'text-slate-600'}`}>
                      <span>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/login"
                  className={`block mt-8 py-3 rounded-xl text-center font-medium text-sm transition-all ${
                    plan.popular ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}>
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Ready to Automate Your Lab?</h2>
        <p className="text-slate-500 mb-8 max-w-xl mx-auto">Join labs across Pakistan that are saving hours every day with our LIS system</p>
        <Link to="/login"
          className="inline-block px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium shadow-xl shadow-blue-600/25 text-lg">
          Start Free Trial
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span>🧬</span>
            <span className="font-bold text-slate-800">LIS System</span>
            <span className="text-sm text-slate-400 ml-2">© 2026</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link to="/portal" className="hover:text-slate-700">Patient Portal</Link>
            <Link to="/login" className="hover:text-slate-700">Staff Login</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
