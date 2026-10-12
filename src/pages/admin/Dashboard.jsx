import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PiArrowRightLight } from 'react-icons/pi'
import { Badge, Card, EmptyState, PageHeader, cx, eyebrow } from '../../components/ui'
import {
  daysLeft,
  fmtDate,
  fmtTime,
  manilaDayStart,
  manilaRange,
  manilaToday,
  methodLabel,
  peso,
  plural,
  timeAgo,
} from '../../lib/format'
import { useRealtime } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { KIND_LABEL, payerName } from './payments'

function Stat({ label, value, sub, to, highlight }) {
  const body = (
    <div className="group h-full bg-ink-950 px-5 py-6">
      <div className={eyebrow}>{label}</div>
      <div className={cx('mt-3 font-condensed text-4xl tabular-nums', highlight ? 'text-brand-400' : 'text-white')}>{value}</div>
      {sub && <div className="mt-1.5 text-xs text-zinc-600 transition-colors group-hover:text-zinc-400">{sub}</div>}
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

const TZ = 'Asia/Manila'
const UNITS = [
  ['day', 'Day'],
  ['week', 'Week'],
  ['month', 'Month'],
]

function rangeCaption(unit, [start, end]) {
  const opts = (o) => ({ timeZone: TZ, ...o })
  if (unit === 'month') return start.toLocaleDateString('en-PH', opts({ month: 'long', year: 'numeric' }))
  if (unit === 'week') {
    const last = new Date(end - 1)
    return `${start.toLocaleDateString('en-PH', opts({ month: 'short', day: 'numeric' }))} – ${last.toLocaleDateString('en-PH', opts({ month: 'short', day: 'numeric', year: 'numeric' }))}`
  }
  return start.toLocaleDateString('en-PH', opts({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))
}

function SalesPanel() {
  const [unit, setUnit] = useState('day')
  const [date, setDate] = useState(manilaToday)
  const [rows, setRows] = useState(null)
  const range = manilaRange(unit, date)
  const [from, to] = [range[0].toISOString(), range[1].toISOString()]

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('payments')
      .select('amount, kind')
      .eq('status', 'approved')
      .gte('reviewed_at', from)
      .lt('reviewed_at', to)
    setRows(data ?? [])
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])
  useRealtime(['payments'], load)

  const sum = (list) => list.reduce((total, p) => total + Number(p.amount), 0)
  const guests = sum((rows ?? []).filter((p) => p.kind === 'guest'))
  const memberships = sum((rows ?? []).filter((p) => p.kind !== 'guest'))

  return (
    <Card
      title="Sales"
      action={
        <div className="flex items-center gap-5">
          <div className="flex gap-4">
            {UNITS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setUnit(key)}
                className={cx(
                  'border-b pb-0.5 text-[11px] font-medium uppercase tracking-[0.16em] transition-colors',
                  unit === key ? 'border-brand-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-200',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={date}
            max={manilaToday()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="cursor-pointer border-0 border-b border-white/15 bg-transparent py-0.5 text-xs text-zinc-300 focus:border-brand-500 focus:outline-none"
            aria-label="Pick a date"
          />
        </div>
      }
    >
      <div className="grid sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="px-5 py-6">
          <div className="text-xs text-zinc-500">{rangeCaption(unit, range)}</div>
          <div className="mt-2 font-condensed text-5xl tabular-nums text-white">{rows ? peso(guests + memberships) : '—'}</div>
        </div>
        {[
          ['Guests', rows && peso(guests)],
          ['Memberships', rows && peso(memberships)],
          ['Payments', rows?.length],
        ].map(([label, value]) => (
          <div key={label} className="border-t border-white/7 px-5 py-6 sm:border-l sm:border-t-0">
            <div className={eyebrow}>{label}</div>
            <div className="mt-3 font-condensed text-2xl tabular-nums text-zinc-200">{value ?? '—'}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [pending, setPending] = useState([])
  const [expiring, setExpiring] = useState([])
  const [recent, setRecent] = useState([])

  const load = useCallback(async () => {
    const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString()
    const [s, p, e, r] = await Promise.all([
      supabase.rpc('admin_dashboard'),
      supabase
        .from('payments')
        .select('id, kind, method, amount, created_at, member:profiles!payments_user_id_fkey(full_name), visit:checkins!payments_checkin_id_fkey(guest_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(5),
      supabase
        .from('profiles')
        .select('id, full_name, expires_at')
        .eq('role', 'member')
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .lte('expires_at', weekAhead)
        .order('expires_at')
        .limit(6),
      supabase
        .from('checkins')
        .select('id, kind, status, guest_name, created_at, member:profiles(full_name)')
        .gte('created_at', manilaDayStart().toISOString())
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    setStats(s.data)
    setPending(p.data ?? [])
    setExpiring(e.data ?? [])
    setRecent(r.data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useRealtime(['checkins', 'payments'], load)

  const today = new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={today} />

      <div className="grid gap-px border border-white/7 bg-white/7 sm:grid-cols-3">
        <Stat
          label="Check-ins today"
          value={stats ? stats.members_today + stats.guests_today : '—'}
          sub={stats && `${plural(stats.members_today, 'member')} · ${plural(stats.guests_today, 'guest')}`}
          to="/admin/checkins"
        />
        <Stat
          label="Active members"
          value={stats?.active_members ?? '—'}
          sub={stats && `${stats.expiring_soon} expiring this week`}
          to="/admin/members"
        />
        <Stat
          label="To approve"
          value={stats?.pending ?? '—'}
          sub={stats && plural(stats.pending, 'payment') + ' waiting'}
          to="/admin/approvals"
          highlight={stats?.pending > 0}
        />
      </div>

      <div className="mt-8">
        <SalesPanel />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <Card
            title="Needs approval"
            action={
              <Link to="/admin/approvals" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-white">
                Review all <PiArrowRightLight className="size-3.5" />
              </Link>
            }
          >
            {pending.length === 0 ? (
              <EmptyState title="All caught up" />
            ) : (
              <ul className="divide-y divide-white/7">
                {pending.map((p) => (
                  <li key={p.id}>
                    <Link to="/admin/approvals" className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-white/2">
                      <div className="min-w-0">
                        <p className="truncate text-white">{payerName(p)}</p>
                        <p className="mt-0.5 text-xs text-zinc-600">
                          {KIND_LABEL[p.kind]} · {methodLabel(p.method)} · {peso(p.amount)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-amber-400">{timeAgo(p.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Expiring this week">
            {expiring.length === 0 ? (
              <EmptyState title="No memberships expiring soon" />
            ) : (
              <ul className="divide-y divide-white/7">
                {expiring.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <span className="truncate text-white">{m.full_name}</span>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {fmtDate(m.expires_at)} · <span className="text-amber-400">{daysLeft(m.expires_at)}d</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card
          title="Live check-ins"
          action={
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
            </span>
          }
        >
          {recent.length === 0 ? (
            <EmptyState title="No check-ins yet today" />
          ) : (
            <ul className="divide-y divide-white/7">
              {recent.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-white">{c.kind === 'member' ? c.member?.full_name : c.guest_name}</p>
                    <p className="mt-0.5 text-xs text-zinc-600">{fmtTime(c.created_at)}</p>
                  </div>
                  {c.kind === 'member' ? (
                    <Badge tone="green">Member</Badge>
                  ) : (
                    <Badge tone={c.status === 'approved' ? 'blue' : c.status === 'pending' ? 'amber' : 'red'}>
                      Guest{c.status === 'pending' ? ' · pending' : c.status === 'rejected' ? ' · rejected' : ''}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
