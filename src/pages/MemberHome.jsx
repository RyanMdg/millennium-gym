import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PiSignOutLight } from 'react-icons/pi'
import { Logo } from '../components/Logo'
import { RenewForm } from '../components/RenewForm'
import { Alert, Button, Modal, StateBadge, eyebrow } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { daysLeft, fmtDate, fmtDateTime, memberState, methodLabel, peso } from '../lib/format'
import { supabase } from '../lib/supabase'

export default function MemberHome() {
  const { profile, signOut, refreshProfile } = useAuth()
  const [pending, setPending] = useState(null)
  const [lastRejected, setLastRejected] = useState(null)
  const [visits, setVisits] = useState([])
  const [renewOpen, setRenewOpen] = useState(false)

  const load = useCallback(async () => {
    const [payments, checkins] = await Promise.all([
      supabase.from('payments').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('checkins').select('id, created_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(10),
    ])
    const list = payments.data ?? []
    setPending(list.find((p) => p.status === 'pending') ?? null)
    setLastRejected(list[0]?.status === 'rejected' ? list[0] : null)
    setVisits(checkins.data ?? [])
  }, [profile.id])

  useEffect(() => {
    load()
  }, [load])

  const state = memberState(profile)
  const canPay = !pending && state !== 'disabled'
  const isMember = state === 'active' || state === 'expiring' || state === 'expired'
  const left = profile.expires_at ? daysLeft(profile.expires_at) : 0

  return (
    <div className="min-h-dvh bg-ink-950">
      <div className="mx-auto max-w-sm px-6 pb-12 pt-8">
        <div className="mb-14 flex items-center justify-between">
          <Link to="/">
            <Logo size="sm" />
          </Link>
          <button onClick={signOut} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-white">
            <PiSignOutLight className="size-4" /> Sign out
          </button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={eyebrow}>Member</p>
            <h1 className="mt-1 font-condensed text-3xl font-medium uppercase tracking-wide text-white">{profile.full_name}</h1>
          </div>
          <StateBadge state={state} />
        </div>

        <div className="mt-8 border-y border-white/10 py-6">
          {state === 'active' || state === 'expiring' ? (
            <>
              <p className={eyebrow}>Active until</p>
              <p className="mt-1 font-condensed text-4xl text-white">{fmtDate(profile.expires_at)}</p>
              <p className={state === 'expiring' ? 'mt-1 text-sm text-amber-400' : 'mt-1 text-sm text-zinc-500'}>
                {left} day{left === 1 ? '' : 's'} left
              </p>
            </>
          ) : state === 'expired' ? (
            <>
              <p className={eyebrow}>Expired</p>
              <p className="mt-1 font-condensed text-4xl text-brand-400">{fmtDate(profile.expires_at)}</p>
              <p className="mt-1 text-sm text-zinc-500">Renew to keep checking in.</p>
            </>
          ) : state === 'pending' ? (
            <p className="text-zinc-400">Your registration is waiting for the front desk to verify your payment.</p>
          ) : state === 'rejected' ? (
            <p className="text-zinc-400">Your registration payment couldn’t be verified. Please submit it again.</p>
          ) : (
            <p className="text-zinc-400">Your account is disabled. Please see the front desk.</p>
          )}
        </div>

        {pending && (
          <Alert tone="warn" className="mt-6">
            {methodLabel(pending.method)} payment of {peso(pending.amount)} is being verified
            {pending.method === 'counter' ? '. Pay at the front desk.' : '.'}
          </Alert>
        )}
        {!pending && lastRejected?.note && <Alert className="mt-6">Last payment rejected: “{lastRejected.note}”</Alert>}

        {canPay && (
          <Button className="mt-6 w-full" variant={state === 'active' ? 'secondary' : 'primary'} onClick={() => setRenewOpen(true)}>
            {isMember ? 'Renew membership' : 'Submit payment'}
          </Button>
        )}

        <p className="mt-10 text-sm leading-relaxed text-zinc-500">
          <span className="text-zinc-200">To check in,</span> scan the QR on the front-desk screen. You’re already logged
          in, so you’ll be checked in right away.
        </p>

        <section className="mt-12">
          <h2 className={eyebrow}>Recent visits</h2>
          {visits.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">No visits yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/7 border-t border-white/7">
              {visits.map((v) => (
                <li key={v.id} className="py-3 text-sm text-zinc-300">
                  {fmtDateTime(v.created_at)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Modal open={renewOpen} onClose={() => setRenewOpen(false)} title={isMember ? 'Renew membership' : 'Submit payment'}>
        <RenewForm
          onDone={async () => {
            setRenewOpen(false)
            await refreshProfile()
            load()
          }}
        />
      </Modal>
    </div>
  )
}
