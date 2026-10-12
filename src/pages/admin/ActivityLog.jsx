import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Card, EmptyState, PageHeader, Select, Spinner } from '../../components/ui'
import { fmtDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'

const PAGE = 50

const ACTIONS = {
  'auth.sign_in': ['Signed in', 'gray'],
  'member.registered': ['Registered', 'blue'],
  'member.created': ['Member added', 'blue'],
  'payment.submitted': ['Payment sent', 'amber'],
  'membership.approved': ['Membership approved', 'green'],
  'membership.rejected': ['Membership rejected', 'red'],
  'renewal.approved': ['Renewal approved', 'green'],
  'renewal.rejected': ['Renewal rejected', 'red'],
  'renewal.counter': ['Renewed at counter', 'green'],
  'guest.checkin': ['Guest check-in', 'amber'],
  'guest.approved': ['Guest approved', 'green'],
  'guest.rejected': ['Guest rejected', 'red'],
  'admin.created': ['Admin created', 'blue'],
  'account.disabled': ['Account disabled', 'red'],
  'account.enabled': ['Account enabled', 'green'],
  'settings.updated': ['Settings changed', 'gray'],
}

const CATEGORIES = {
  all: ['All activity', null],
  members: ['Members & payments', ['member.', 'membership.', 'renewal.', 'payment.']],
  guests: ['Guests', ['guest.']],
  admin: ['Admin & settings', ['auth.', 'admin.', 'account.', 'settings.']],
}

export default function ActivityLog() {
  const [category, setCategory] = useState('all')
  const [rows, setRows] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchPage = useCallback(
    async (offset) => {
      let q = supabase.from('activity_logs').select('*').order('id', { ascending: false }).range(offset, offset + PAGE - 1)
      const prefixes = CATEGORIES[category][1]
      if (prefixes) q = q.or(prefixes.map((p) => `action.like.${p}*`).join(','))
      const { data } = await q
      setHasMore((data ?? []).length === PAGE)
      return data ?? []
    },
    [category],
  )

  useEffect(() => {
    let alive = true
    setRows(null)
    fetchPage(0).then((data) => alive && setRows(data))
    return () => {
      alive = false
    }
  }, [fetchPage])

  async function loadMore() {
    setLoadingMore(true)
    const more = await fetchPage(rows.length)
    setRows((r) => [...r, ...more])
    setLoadingMore(false)
  }

  return (
    <div>
      <PageHeader
        title="Activity log"
        subtitle="Who did what, and when."
        action={
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-auto">
            {Object.entries(CATEGORIES).map(([key, [label]]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        }
      />

      <Card>
        {rows === null ? (
          <div className="py-16 text-center"><Spinner className="mx-auto" /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <ul className="divide-y divide-white/7">
            {rows.map((r) => {
              const [label, tone] = ACTIONS[r.action] ?? [r.action, 'gray']
              return (
                <li key={r.id} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-6">
                  <span className="w-40 shrink-0 text-xs tabular-nums text-zinc-600">{fmtDateTime(r.created_at)}</span>
                  <span className="w-44 shrink-0"><Badge tone={tone}>{label}</Badge></span>
                  <span className="min-w-0 flex-1 text-sm text-zinc-300">{r.details}</span>
                  <span className="shrink-0 text-xs text-zinc-600">{r.actor_name}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      {hasMore && rows && (
        <div className="mt-6 text-center">
          <Button variant="secondary" loading={loadingMore} onClick={loadMore}>Load more</Button>
        </div>
      )}
    </div>
  )
}
