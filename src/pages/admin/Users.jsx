import { useCallback, useEffect, useState } from 'react'
import { PiUserPlusLight } from 'react-icons/pi'
import { Alert, Badge, Button, Card, EmptyState, Modal, PageHeader, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { fmtDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { AccountForm } from './AccountForm'

export default function AdminUsers() {
  const { profile: me } = useAuth()
  const [admins, setAdmins] = useState(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'admin').order('created_at')
    setAdmins(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggle(a) {
    setError('')
    const disable = a.status !== 'disabled'
    if (disable && !confirm(`Disable ${a.full_name}? They'll lose admin access immediately.`)) return
    const { error } = await supabase.rpc('admin_set_disabled', { p_user_id: a.id, p_disabled: disable })
    if (error) return setError(error.message)
    load()
  }

  return (
    <div>
      <PageHeader
        title="Admins"
        subtitle="Staff accounts that can approve payments and manage members."
        action={
          <Button onClick={() => setAdding(true)}>
            <PiUserPlusLight className="size-4" /> New admin
          </Button>
        }
      />
      {error && <Alert className="mb-6">{error}</Alert>}
      {notice && <Alert tone="success" className="mb-6">{notice}</Alert>}

      <Card>
        {admins === null ? (
          <div className="py-16 text-center"><Spinner className="mx-auto" /></div>
        ) : admins.length === 0 ? (
          <EmptyState title="No admins" />
        ) : (
          <ul className="divide-y divide-white/7">
            {admins.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-3 text-white">
                    <span className="truncate">{a.full_name}</span>
                    {a.id === me.id && <Badge tone="blue">You</Badge>}
                    {a.status === 'disabled' && <Badge tone="gray">Disabled</Badge>}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-600">{a.email} · added {fmtDate(a.created_at)}</p>
                </div>
                {a.id !== me.id && (
                  <Button size="sm" variant={a.status === 'disabled' ? 'secondary' : 'ghost'} onClick={() => toggle(a)}>
                    {a.status === 'disabled' ? 'Enable' : 'Disable'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="New admin">
        <AccountForm
          role="admin"
          onCreated={(f) => {
            setAdding(false)
            setNotice(`Admin account created for ${f.full_name} (${f.email}).`)
            load()
          }}
        />
      </Modal>
    </div>
  )
}
