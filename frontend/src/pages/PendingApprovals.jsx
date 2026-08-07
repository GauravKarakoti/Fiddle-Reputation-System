import { useState, useEffect, useCallback } from 'react'
import { ShieldAlert, Check, X, Loader2, UserCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { getPendingUsers, approveUser, rejectUser } from '../api/client'

export default function PendingApprovals() {
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPendingUsers()
      setPending(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Non-admins never see this page's content, even if they navigate here
  // directly by URL — the backend would reject the API calls anyway, but
  // this avoids a confusing empty/broken screen for them.
  if (user?.role !== 'admin') {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <ShieldAlert size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Admin access required to view this page.</p>
        </div>
      </div>
    )
  }

  const handleApprove = async (id) => {
    setActioningId(id)
    try {
      await approveUser(id)
      setPending(prev => prev.filter(u => u.id !== id))
      addNotification({
        type: 'success',
        title: 'Signup approved',
        sub: 'The user can now log in.',
      })
    } catch (e) {
      addNotification({
        type: 'alert',
        title: 'Approval failed',
        sub: e.response?.data?.detail || 'Could not approve this user.',
      })
    } finally {
      setActioningId(null)
    }
  }

  const handleReject = async (id) => {
    if (!window.confirm('Reject this signup request? This will permanently delete the account.')) return
    setActioningId(id)
    try {
      await rejectUser(id)
      setPending(prev => prev.filter(u => u.id !== id))
      addNotification({
        type: 'info',
        title: 'Signup rejected',
        sub: 'The request was removed.',
      })
    } catch (e) {
      addNotification({
        type: 'alert',
        title: 'Rejection failed',
        sub: e.response?.data?.detail || 'Could not reject this user.',
      })
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-brand rounded-xl flex items-center justify-center shadow-glow-brand flex-shrink-0">
          <UserCheck size={18} className="text-white" />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg text-slate-100">Pending Approvals</h1>
          <p className="text-xs text-slate-500">
            {loading ? 'Loading…' : `${pending.length} account${pending.length === 1 ? '' : 's'} awaiting review`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div className="card p-8 text-center">
          <UserCheck size={28} className="text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No pending signups right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map(u => (
            <div key={u.id} className="card p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100 truncate">{u.name}</p>
                <p className="text-xs text-slate-500 truncate">{u.email}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Requested {new Date(u.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleReject(u.id)}
                  disabled={actioningId === u.id}
                  className="btn-ghost border border-red-500/20 text-red-400 hover:bg-red-500/10 px-3 py-2 disabled:opacity-50"
                  title="Reject and delete this signup request"
                >
                  {actioningId === u.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(u.id)}
                  disabled={actioningId === u.id}
                  className="btn-primary px-4 py-2 disabled:opacity-60"
                >
                  {actioningId === u.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}