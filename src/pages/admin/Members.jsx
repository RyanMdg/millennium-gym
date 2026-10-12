import { useCallback, useEffect, useMemo, useState } from 'react'
import { PiMagnifyingGlassLight, PiUserPlusLight } from 'react-icons/pi'
import { Alert, Button, Card, EmptyState, Modal, PageHeader, SearchInput, Spinner, StateBadge, Tabs } from '../../components/ui'
import { daysLeft, fmtDate, memberState, peso } from '../../lib/format'
import { useSettings } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { AccountForm } from './AccountForm'

const FILTERS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['expiring', 'Expiring'],
  ['expired', 'Expired'],
  ['pending', 'Pending'],
]

const matches = (m, f) =>
  f === 'all' ||
  m.state === f ||
  (f === 'active' && m.state === 'expiring') ||
  (f === 'pending' && m.state === 'rejected')

export default function Members() {
  const settings = useSettings()
  const [members, setMembers] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [renewing, setRenewing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'member').order('full_name')
    if (error) setError(error.message)
    setMembers(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const withState = useMemo(() => (members ?? []).map((m) => ({ ...m, state: memberState(m) })), [members])

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase()
    return withState.filter(
      (m) => matches(m, filter) && (!term || m.full_name.toLowerCase().includes(term) || m.email.toLowerCase().includes(term)),
    )
  }, [withState, filter, search])

  async function renewAtCounter() {
    setBusy(true)
    setError('')
    const { data, error } = await supabase.rpc('admin_counter_renewal', { p_user_id: renewing.id })
    setBusy(false)
    if (error) return setError(error.message)
    setNotice(`${renewing.full_name} renewed until ${fmtDate(data)}.`)
    setRenewing(null)
    load()
  }

  async function toggleDisabled(m) {
    setError('')
    const disable = m.status !== 'disabled'
    if (disable && !confirm(`Disable ${m.full_name}? They won't be able to check in.`)) return
    const { error } = await supabase.rpc('admin_set_disabled', { p_user_id: m.id, p_disabled: disable })
    if (error) return setError(error.message)
    load()
  }

  const renewFrom = renewing && new Date(Math.max(Date.now(), new Date(renewing.expires_at ?? 0).getTime()))
  const renewTo = renewFrom && new Date(renewFrom.getTime() + (settings?.membership_days ?? 30) * 86_400_000)

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle={members ? `${withState.filter((m) => m.state === 'active' || m.state === 'expiring').length} active of ${members.length}` : ''}
        action={
          <Button onClick={() => setAdding(true)}>
            <PiUserPlusLight className="size-4" /> Register member
          </Button>
        }
      />

      <Tabs
        value={filter}
        onChange={setFilter}
        options={FILTERS.map(([k, l]) => [k, l, withState.filter((m) => matches(m, k)).length])}
      />
      <SearchInput
        icon={PiMagnifyingGlassLight}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name or email"
        className="mb-6 mt-5 max-w-xs"
      />

      {error && <Alert className="mb-6">{error}</Alert>}
      {notice && <Alert tone="success" className="mb-6">{notice}</Alert>}

      <Card>
        {members === null ? (
          <div className="py-16 text-center"><Spinner className="mx-auto" /></div>
        ) : shown.length === 0 ? (
          <EmptyState title="No members found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/7 text-left text-[11px] uppercase tracking-[0.16em] text-zinc-600">
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Expires</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/7">
                {shown.map((m) => (
                  <tr key={m.id} className="hover:bg-white/2">
                    <td className="px-5 py-3">
                      <div className="text-white">{m.full_name}</div>
                      <div className="text-xs text-zinc-500">{m.email}</div>
                    </td>
                    <td className="px-5 py-3"><StateBadge state={m.state} /></td>
                    <td className="whitespace-nowrap px-5 py-3 text-zinc-400">
                      {m.expires_at ? fmtDate(m.expires_at) : '—'}
                      {m.state === 'expiring' && <span className="ml-1 text-amber-400">({daysLeft(m.expires_at)}d)</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {m.state !== 'disabled' && m.state !== 'pending' && (
                          <Button size="sm" variant="secondary" onClick={() => setRenewing(m)}>Renew</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => toggleDisabled(m)}>
                          {m.status === 'disabled' ? 'Enable' : 'Disable'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-4 text-xs text-zinc-600">Pending members are approved from the Approvals page once their payment is verified.</p>

      <Modal open={adding} onClose={() => setAdding(false)} title="Register member">
        <AccountForm
          role="member"
          onCreated={(f) => {
            setAdding(false)
            setNotice(`${f.full_name} is registered and active. Login: ${f.email}`)
            load()
          }}
        />
      </Modal>

      <Modal
        open={!!renewing}
        onClose={() => setRenewing(null)}
        title="Renew at counter"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenewing(null)}>Cancel</Button>
            <Button variant="light" loading={busy} onClick={renewAtCounter}>Cash received · Renew</Button>
          </>
        }
      >
        {renewing && (
          <div className="space-y-2 text-sm text-zinc-400">
            <p>
              Collect <span className="text-white">{peso(settings?.monthly_fee)}</span> from{' '}
              <span className="text-white">{renewing.full_name}</span>.
            </p>
            <p>
              New expiry: <span className="text-white">{fmtDate(renewTo)}</span>
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
