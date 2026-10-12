import { useCallback, useEffect, useMemo, useState } from 'react'
import { PiDownloadSimpleLight, PiMagnifyingGlassLight } from 'react-icons/pi'
import { Badge, Button, Card, EmptyState, PageHeader, SearchInput, Select, Spinner, Tabs } from '../../components/ui'
import { fmtDate, fmtTime, manilaDayStart, methodLabel, peso } from '../../lib/format'
import { useRealtime } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'

const RANGES = {
  today: ['Today', () => [manilaDayStart(0), null]],
  yesterday: ['Yesterday', () => [manilaDayStart(-1), manilaDayStart(0)]],
  week: ['Last 7 days', () => [manilaDayStart(-6), null]],
  month: ['Last 30 days', () => [manilaDayStart(-29), null]],
}

const STATUS_TONE = { approved: 'green', pending: 'amber', rejected: 'red' }

const nameOf = (c) => (c.kind === 'member' ? c.member?.full_name : c.guest_name) ?? '—'

export default function CheckIns() {
  const [tab, setTab] = useState('member')
  const [range, setRange] = useState('today')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState(null)

  const load = useCallback(async () => {
    const [from, to] = RANGES[range][1]()
    let q = supabase
      .from('checkins')
      .select('id, kind, status, guest_name, guest_phone, created_at, member:profiles(full_name, email), payments(method, amount)')
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: false })
      .limit(2000)
    if (to) q = q.lt('created_at', to.toISOString())
    const { data } = await q
    setRows(data ?? [])
  }, [range])

  useEffect(() => {
    setRows(null)
    load()
  }, [load])
  useRealtime(['checkins'], load)

  const counts = useMemo(() => {
    const list = rows ?? []
    return { member: list.filter((r) => r.kind === 'member').length, guest: list.filter((r) => r.kind === 'guest').length, all: list.length }
  }, [rows])

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (rows ?? []).filter((r) => (tab === 'all' || r.kind === tab) && (!term || nameOf(r).toLowerCase().includes(term)))
  }, [rows, tab, search])

  function exportCsv() {
    const header = ['Date', 'Time', 'Name', 'Type', 'Status', 'Payment', 'Amount', 'Contact']
    const lines = shown.map((r) => [
      fmtDate(r.created_at),
      fmtTime(r.created_at),
      nameOf(r),
      r.kind,
      r.status,
      r.payments?.[0] ? methodLabel(r.payments[0].method) : '',
      r.payments?.[0]?.amount ?? '',
      r.kind === 'member' ? r.member?.email ?? '' : r.guest_phone ?? '',
    ])
    const csv = [header, ...lines].map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `checkins-${range}-${tab}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <PageHeader
        title="Check-ins"
        subtitle="Every scan at the front desk, replacing the paper logbook."
        action={
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!shown.length}>
            <PiDownloadSimpleLight className="size-4" /> Export CSV
          </Button>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          ['member', 'Members', counts.member],
          ['guest', 'Guests', counts.guest],
          ['all', 'All', counts.all],
        ]}
      />
      <div className="mb-6 mt-5 flex flex-wrap items-center gap-6">
        <Select value={range} onChange={(e) => setRange(e.target.value)} className="h-9 w-auto">
          {Object.entries(RANGES).map(([key, [label]]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </Select>
        <SearchInput
          icon={PiMagnifyingGlassLight}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name"
          className="min-w-48 flex-1 sm:max-w-xs"
        />
      </div>

      <Card>
        {rows === null ? (
          <div className="py-16 text-center"><Spinner className="mx-auto" /></div>
        ) : shown.length === 0 ? (
          <EmptyState title="No check-ins" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/7 text-left text-[11px] uppercase tracking-[0.16em] text-zinc-600">
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  {tab === 'all' && <th className="px-5 py-3 font-medium">Type</th>}
                  {tab !== 'member' && <th className="px-5 py-3 font-medium">Payment</th>}
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/7">
                {shown.map((r) => (
                  <tr key={r.id} className="hover:bg-white/2">
                    <td className="whitespace-nowrap px-5 py-3 text-zinc-400">
                      {range !== 'today' && <span className="text-zinc-500">{fmtDate(r.created_at)} · </span>}
                      {fmtTime(r.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-white">{nameOf(r)}</div>
                      <div className="text-xs text-zinc-500">{r.kind === 'member' ? r.member?.email : r.guest_phone}</div>
                    </td>
                    {tab === 'all' && (
                      <td className="px-5 py-3">
                        <Badge tone={r.kind === 'member' ? 'green' : 'blue'}>{r.kind}</Badge>
                      </td>
                    )}
                    {tab !== 'member' && (
                      <td className="whitespace-nowrap px-5 py-3 text-zinc-400">
                        {r.payments?.[0] ? `${methodLabel(r.payments[0].method)} · ${peso(r.payments[0].amount)}` : '—'}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONE[r.status]}>{r.kind === 'member' ? 'In' : r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
