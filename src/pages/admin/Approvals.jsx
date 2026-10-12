import { useCallback, useEffect, useState } from 'react'
import { ReceiptThumb } from '../../components/ReceiptThumb'
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, Tabs } from '../../components/ui'
import { fmtDate, fmtDateTime, methodLabel, peso, timeAgo } from '../../lib/format'
import { useRealtime } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { KIND_LABEL, payerName } from './payments'

const KIND_TONE = { membership: 'blue', renewal: 'green', guest: 'amber' }

export default function Approvals() {
  const [items, setItems] = useState(null)
  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('payments')
      .select(
        '*, member:profiles!payments_user_id_fkey(full_name, email, expires_at), visit:checkins!payments_checkin_id_fkey(guest_name, guest_phone)',
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    setItems(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useRealtime(['payments'], load)

  async function review(payment, approve, reviewNote = null) {
    setError('')
    setBusyId(payment.id)
    const { error } = await supabase.rpc('admin_review_payment', { p_id: payment.id, p_approve: approve, p_note: reviewNote })
    setBusyId(null)
    if (error) return setError(error.message)
    setItems((list) => list.filter((p) => p.id !== payment.id))
  }

  const count = (k) => (items ?? []).filter((p) => k === 'all' || p.kind === k).length
  const shown = (items ?? []).filter((p) => filter === 'all' || p.kind === filter)

  return (
    <div>
      <PageHeader title="Approvals" subtitle="Verify payments to activate members and let guests in." />

      <div className="mb-6">
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            ['all', 'All', count('all')],
            ['guest', 'Guests', count('guest')],
            ['membership', 'New members', count('membership')],
            ['renewal', 'Renewals', count('renewal')],
          ]}
        />
      </div>

      {error && <Alert className="mb-6">{error}</Alert>}

      {items === null ? (
        <div className="py-16 text-center"><Spinner className="mx-auto" /></div>
      ) : shown.length === 0 ? (
        <Card><EmptyState title="Nothing to approve">New payments show up here instantly.</EmptyState></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex gap-4">
                {p.method === 'gcash' && p.receipt_path ? (
                  <ReceiptThumb path={p.receipt_path} className="size-20" />
                ) : (
                  <div className="grid size-20 shrink-0 place-items-center border border-dashed border-white/15 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    Cash
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={KIND_TONE[p.kind]}>{KIND_LABEL[p.kind]}</Badge>
                    <span className="text-xs text-zinc-600" title={fmtDateTime(p.created_at)}>{timeAgo(p.created_at)}</span>
                  </div>
                  <p className="mt-2 truncate text-lg text-white">{payerName(p)}</p>
                  <p className="truncate text-sm text-zinc-500">
                    {p.kind === 'guest' ? p.visit?.guest_phone || 'No phone' : p.member?.email}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="text-white">{peso(p.amount)}</span>
                    <span className="text-zinc-500"> · {methodLabel(p.method)}</span>
                    {p.kind === 'renewal' && p.member?.expires_at && (
                      <span className="text-zinc-500"> · current until {fmtDate(p.member.expires_at)}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <Button variant="light" className="flex-1" loading={busyId === p.id} onClick={() => review(p, true)}>
                  {p.method === 'counter' ? 'Cash received' : 'Approve'}
                </Button>
                <Button
                  variant="danger"
                  disabled={busyId === p.id}
                  onClick={() => {
                    setNote('')
                    setRejecting(p)
                  }}
                >
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject payment"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button
              loading={busyId === rejecting?.id}
              onClick={async () => {
                await review(rejecting, false, note)
                setRejecting(null)
              }}
            >
              Reject
            </Button>
          </>
        }
      >
        {rejecting && (
          <div className="space-y-6">
            <p className="text-sm text-zinc-400">
              Reject {KIND_LABEL[rejecting.kind].toLowerCase()} payment from{' '}
              <span className="font-semibold text-white">{payerName(rejecting)}</span>?
            </p>
            <Field label="Reason (shown to them)">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Receipt amount doesn't match" />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
