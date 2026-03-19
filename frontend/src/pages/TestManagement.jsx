import { useState, useEffect } from 'react'
import api from '../api'

export default function TestManagement() {
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    test_code: '', test_name: '', category: '', price: '',
    unit: '', ref_low_male: '', ref_high_male: '',
    ref_low_female: '', ref_high_female: '', sample_type: 'Blood',
  })

  const [categories, setCategories] = useState([])
  const [sampleTypes, setSampleTypes] = useState([])

  const defaultCategories = ['Hematology', 'Biochemistry', 'Liver Function', 'Renal Function',
    'Lipid Profile', 'Thyroid', 'Diabetes', 'Serology', 'Immunology',
    'Urine Analysis', 'Coagulation', 'Hormones', 'Vitamins', 'Tumor Markers',
    'Cardiac Markers', 'Electrolytes']
  const defaultSampleTypes = ['Blood', 'Serum', 'Plasma', 'Urine', 'Stool', 'Swab', 'CSF']

  useEffect(() => {
    fetchTests()
    api.get('/categories/test_category').then(r => setCategories(r.data.map(c => c.name)))
      .catch(() => setCategories(defaultCategories))
    api.get('/categories/sample_type').then(r => setSampleTypes(r.data.map(c => c.name)))
      .catch(() => setSampleTypes(defaultSampleTypes))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchTests = async () => {
    try {
      const res = await api.get('/tests')
      setTests(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      const data = {
        ...form,
        price: parseFloat(form.price) || 0,
        ref_low_male: form.ref_low_male ? parseFloat(form.ref_low_male) : null,
        ref_high_male: form.ref_high_male ? parseFloat(form.ref_high_male) : null,
        ref_low_female: form.ref_low_female ? parseFloat(form.ref_low_female) : null,
        ref_high_female: form.ref_high_female ? parseFloat(form.ref_high_female) : null,
      }

      if (editingId) {
        await api.put(`/tests/${editingId}`, data)
        setSuccess('Test updated successfully')
      } else {
        await api.post('/tests', data)
        setSuccess('Test added successfully')
      }

      resetForm()
      fetchTests()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save test')
    }
  }

  const handleEdit = (test) => {
    setForm({
      test_code: test.test_code,
      test_name: test.test_name,
      category: test.category || '',
      price: test.price?.toString() || '',
      unit: test.unit || '',
      ref_low_male: test.ref_low_male?.toString() || '',
      ref_high_male: test.ref_high_male?.toString() || '',
      ref_low_female: test.ref_low_female?.toString() || '',
      ref_high_female: test.ref_high_female?.toString() || '',
      sample_type: test.sample_type || 'Blood',
    })
    setEditingId(test.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this test?')) return
    try {
      await api.delete(`/tests/${id}`)
      fetchTests()
      setSuccess('Test deleted')
    } catch (err) {
      setError(err.response?.data?.detail || 'Delete failed')
    }
  }

  const resetForm = () => {
    setForm({ test_code: '', test_name: '', category: '', price: '', unit: '',
      ref_low_male: '', ref_high_male: '', ref_low_female: '', ref_high_female: '', sample_type: 'Blood' })
    setEditingId(null)
    setShowForm(false)
  }

  const filteredTests = tests.filter(t =>
    t.test_name.toLowerCase().includes(search.toLowerCase()) ||
    t.test_code.toLowerCase().includes(search.toLowerCase()) ||
    (t.category || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Test Management</h2>
          <p className="text-sm text-slate-500">{tests.length} tests configured</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          {showForm ? 'Cancel' : '+ Add New Test'}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
          <h3 className="font-semibold text-slate-700 mb-4">{editingId ? 'Edit Test' : 'Add New Test'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Test Code *</label>
              <input value={form.test_code} onChange={(e) => setForm({...form, test_code: e.target.value.toUpperCase()})}
                required placeholder="e.g., CBC, HGB, ALT"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Test Name *</label>
              <input value={form.test_name} onChange={(e) => setForm({...form, test_name: e.target.value})}
                required placeholder="e.g., Complete Blood Count"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Select Category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price (PKR) *</label>
              <input type="number" value={form.price} onChange={(e) => setForm({...form, price: e.target.value})}
                required min="0" placeholder="e.g., 800"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
              <input value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})}
                placeholder="e.g., g/dL, mg/dL, 10*3/uL"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sample Type</label>
              <select value={form.sample_type} onChange={(e) => setForm({...form, sample_type: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                {sampleTypes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Reference Ranges */}
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <h4 className="text-sm font-medium text-slate-700 mb-3">Reference Ranges</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Male Low</label>
                <input type="number" step="0.01" value={form.ref_low_male}
                  onChange={(e) => setForm({...form, ref_low_male: e.target.value})}
                  placeholder="e.g., 13.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Male High</label>
                <input type="number" step="0.01" value={form.ref_high_male}
                  onChange={(e) => setForm({...form, ref_high_male: e.target.value})}
                  placeholder="e.g., 17.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Female Low</label>
                <input type="number" step="0.01" value={form.ref_low_female}
                  onChange={(e) => setForm({...form, ref_low_female: e.target.value})}
                  placeholder="e.g., 12.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Female High</label>
                <input type="number" step="0.01" value={form.ref_high_female}
                  onChange={(e) => setForm({...form, ref_high_female: e.target.value})}
                  placeholder="e.g., 16.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {editingId ? 'Update Test' : 'Add Test'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel Edit</button>
            )}
          </div>
        </form>
      )}

      {/* Search */}
      <div className="mb-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tests by name, code, or category..."
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      {/* Tests Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Code</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Test Name</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Category</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Price (PKR)</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Unit</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Ref Range (M)</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Ref Range (F)</th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTests.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-medium text-blue-600">{t.test_code}</td>
                <td className="px-4 py-3">{t.test_name}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{t.category || '-'}</span>
                </td>
                <td className="px-4 py-3 font-medium text-green-700">Rs. {t.price}</td>
                <td className="px-4 py-3 text-slate-500">{t.unit || '-'}</td>
                <td className="px-4 py-3 text-slate-500">
                  {t.ref_low_male != null ? `${t.ref_low_male} - ${t.ref_high_male}` : '-'}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {t.ref_low_female != null ? `${t.ref_low_female} - ${t.ref_high_female}` : '-'}
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button onClick={() => handleEdit(t)} className="text-blue-600 hover:underline text-xs">Edit</button>
                  <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {!loading && filteredTests.length === 0 && (
              <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">No tests found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
