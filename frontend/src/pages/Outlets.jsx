import { useState, useEffect, useCallback } from 'react'
import { Building2, MapPin, Phone, Star, MessageCircle, Plus, Loader2, X, Pencil, Trash2 } from 'lucide-react'
import Header from '../components/Header'
import { getRestaurants, createRestaurant, updateRestaurant, deleteRestaurant } from '../api/client'
import { useNotifications } from '../context/NotificationsContext'

function OutletCard({ outlet, onEdit, onDelete }) {
  const rating = outlet.avg_rating
  const sentiment_color = rating >= 4 ? 'text-emerald-400' : rating >= 3 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="card-hover p-5 animate-slide-up group relative flex flex-col justify-between h-[250px]">
      {/* Edit / Delete actions — shown on hover so the card stays clean at rest */}
      <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(outlet)}
          className="w-7 h-7 rounded-lg bg-dark-600 border border-dark-400 flex items-center justify-center text-slate-400 hover:text-brand-400 hover:border-brand-500/40 transition-colors"
          title="Edit outlet"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => onDelete(outlet)}
          className="w-7 h-7 rounded-lg bg-dark-600 border border-dark-400 flex items-center justify-center text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-colors"
          title="Remove outlet"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between pr-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-brand rounded-xl flex items-center justify-center shadow-glow-brand flex-shrink-0">
              <Building2 size={18} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-100 text-sm truncate max-w-[150px]">{outlet.name}</p>
              <p className="text-xs text-slate-500 font-mono">{outlet.branch_code}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Star size={13} className={`fill-current ${sentiment_color}`} />
          <span className={`text-sm font-bold ${sentiment_color}`}>{rating?.toFixed(1) || '—'}</span>
        </div>

        {/* Info */}
        <div className="space-y-1">
          {outlet.city ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin size={11} className="flex-shrink-0" />
              <span className="truncate">{outlet.address || outlet.city}</span>
            </div>
          ) : (
            <div className="h-4" /> // placeholder for alignment
          )}
          {outlet.phone ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Phone size={11} className="flex-shrink-0" />
              <span className="truncate">{outlet.phone}</span>
            </div>
          ) : (
            <div className="h-4" /> // placeholder for alignment
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between pt-3 border-t border-dark-500 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <MessageCircle size={11} />
          <span>{outlet.total_reviews || 0} reviews</span>
        </div>
        <div className="flex gap-2">
          {outlet.google_place_id && (
            <span className="badge bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">G</span>
          )}
          {outlet.zomato_url && (
            <span className="badge bg-red-500/10 text-red-400 border-red-500/20 text-xs">Z</span>
          )}
          {outlet.tripadvisor_url && (
            <span className="badge bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">TA</span>
          )}
        </div>
      </div>
    </div>
  )
}

const EMPTY_FORM = {
  name: '', branch_code: '', city: '', address: '',
  google_place_id: '', zomato_url: '', tripadvisor_url: '',phone: '',
}

const FIELDS = [
  { key: 'name', label: 'Restaurant Name *', placeholder: 'First Fiddle - Connaught Place' },
  { key: 'branch_code', label: 'Branch Code *', placeholder: 'FF-CP-01' },
  { key: 'city', label: 'City *', placeholder: 'New Delhi' },
  { key: 'address', label: 'Address', placeholder: '12, Janpath, Connaught Place' },
  { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
  { key: 'google_place_id', label: 'Google Place ID *', placeholder: 'ChIJ...' },
  { key: 'zomato_url', label: 'Zomato URL', placeholder: 'https://www.zomato.com/...' },
  { key: 'tripadvisor_url', label: 'TripAdvisor URL', placeholder: 'https://www.tripadvisor.in/...' },
]

// Shared modal for both adding a new outlet and editing an existing one —
// same form, just pre-filled and pointed at update instead of create when
// an `outlet` is passed in.
function OutletFormModal({ outlet, onClose, onSaved }) {
  const isEdit = Boolean(outlet)
  const { addNotification } = useNotifications()
  const [form, setForm] = useState(() =>
    isEdit
      ? { ...EMPTY_FORM, ...Object.fromEntries(Object.keys(EMPTY_FORM).map(k => [k, outlet[k] || ''])) }
      : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateRestaurant(outlet.id, form)
        addNotification({ type: 'success', title: '✅ Outlet updated', sub: `${form.name} was saved.` })
      } else {
        await createRestaurant(form)
        addNotification({ type: 'success', title: '✅ Outlet added', sub: `${form.name} was created.` })
      }
      onSaved()
      onClose()
    } catch (err) {
      const detail = err.response?.data?.detail || `Failed to ${isEdit ? 'update' : 'create'} outlet`
      setError(detail)
      addNotification({ type: 'alert', title: `❌ ${isEdit ? 'Update' : 'Creation'} failed`, sub: detail })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-dark-500">
          <p className="font-display font-semibold text-slate-100">
            {isEdit ? 'Edit Outlet' : 'Add New Outlet'}
          </p>
          <button onClick={onClose} className="btn-ghost p-2"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-slate-400 mb-1 block">{label}</label>
              <input
                className="w-full bg-dark-600 border border-dark-400 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-brand-500 transition-colors placeholder-slate-600"
                placeholder={placeholder}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required={['name', 'branch_code', 'city', 'google_place_id'].includes(key)}
              />
            </div>
          ))}
          {error && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Loader2 size={14} className="animate-spin" /> : (isEdit ? <Pencil size={14} /> : <Plus size={14} />)}
              {isEdit ? 'Save Changes' : 'Add Outlet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Outlets() {
  const { addNotification } = useNotifications()
  const [outlets, setOutlets]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingOutlet, setEditingOutlet] = useState(null) // null = add mode, outlet = edit mode
  const [deletingId, setDeletingId] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getRestaurants()
      setOutlets(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  const handleEdit = (outlet) => {
    setEditingOutlet(outlet)
    setShowModal(true)
  }

  const handleAdd = () => {
    setEditingOutlet(null)
    setShowModal(true)
  }

  const handleDelete = async (outlet) => {
    if (!window.confirm(`Remove "${outlet.name}"? This deactivates the outlet — its review history is kept, but it won't appear in outlet lists or dashboards anymore.`)) {
      return
    }
    setDeletingId(outlet.id)
    try {
      await deleteRestaurant(outlet.id)
      addNotification({ type: 'info', title: 'Outlet removed', sub: `${outlet.name} has been deactivated.` })
      setRefreshKey(k => k + 1)
    } catch (e) {
      addNotification({
        type: 'alert',
        title: '❌ Removal failed',
        sub: e.response?.data?.detail || 'Could not remove this outlet.',
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Outlets"
        subtitle={`${outlets.length} First Fiddle branches registered`}
        onRefresh={() => setRefreshKey(k => k + 1)}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex justify-end mb-5">
          <button onClick={handleAdd} className="btn-primary">
            <Plus size={16} /> Add Outlet
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-44 rounded-2xl" />
            ))}
          </div>
        ) : outlets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
            <Building2 size={40} className="opacity-20" />
            <p>No outlets yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {outlets.map(outlet => (
              <div key={outlet.id} className={deletingId === outlet.id ? 'opacity-40 pointer-events-none' : ''}>
                <OutletCard outlet={outlet} onEdit={handleEdit} onDelete={handleDelete} />
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <OutletFormModal
          outlet={editingOutlet}
          onClose={() => { setShowModal(false); setEditingOutlet(null) }}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  )
}