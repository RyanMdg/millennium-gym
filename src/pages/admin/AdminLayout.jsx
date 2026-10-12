import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  PiClipboardTextLight,
  PiClockCounterClockwiseLight,
  PiGearSixLight,
  PiListLight,
  PiQrCodeLight,
  PiScanLight,
  PiShieldCheckLight,
  PiSignOutLight,
  PiSquaresFourLight,
  PiUsersLight,
  PiXLight,
} from 'react-icons/pi'
import { Logo } from '../../components/Logo'
import { cx } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useRealtime } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'

const NAV = [
  ['/admin', 'Dashboard', PiSquaresFourLight],
  ['/admin/approvals', 'Approvals', PiClipboardTextLight],
  ['/admin/checkins', 'Check-ins', PiScanLight],
  ['/admin/members', 'Members', PiUsersLight],
  ['/admin/activity', 'Activity log', PiClockCounterClockwiseLight],
  ['/admin/users', 'Admins', PiShieldCheckLight],
  ['/admin/settings', 'Settings', PiGearSixLight],
]

function usePendingCount() {
  const [count, setCount] = useState(0)
  const load = useCallback(async () => {
    const { count } = await supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    setCount(count ?? 0)
  }, [])
  useEffect(() => {
    load()
  }, [load])
  useRealtime(['payments'], load)
  return count
}

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const pending = usePendingCount()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3 py-6">
      {NAV.map(([to, label, Icon]) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/admin'}
          className={({ isActive }) =>
            cx(
              'relative flex items-center gap-3 px-3 py-2.5 text-sm transition-colors',
              isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-200',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute inset-y-2 left-0 w-px bg-brand-500" />}
              <Icon className={cx('size-[18px]', isActive && 'text-brand-400')} />
              <span className="flex-1">{label}</span>
              {label === 'Approvals' && pending > 0 && (
                <span className="text-xs tabular-nums text-brand-400">{pending}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
      <a
        href="/kiosk"
        target="_blank"
        rel="noreferrer"
        className="mt-6 flex items-center gap-3 border-t border-white/7 px-3 pb-2.5 pt-6 text-sm text-zinc-300 transition-colors hover:text-white"
      >
        <PiQrCodeLight className="size-[18px] text-brand-400" /> Open kiosk QR
      </a>
    </nav>
  )

  const footer = (
    <div className="border-t border-white/7 px-3 py-5">
      <div className="px-3 pb-3">
        <p className="truncate text-sm text-white">{profile.full_name}</p>
        <p className="truncate text-xs text-zinc-600">{profile.email}</p>
      </div>
      <button onClick={signOut} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-zinc-500 transition-colors hover:text-white">
        <PiSignOutLight className="size-[18px]" /> Sign out
      </button>
    </div>
  )

  return (
    <div className="min-h-dvh bg-ink-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-white/7 bg-ink-950 lg:flex">
        <div className="px-6 pb-2 pt-8">
          <Logo size="sm" />
        </div>
        {nav}
        {footer}
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/7 bg-ink-950 px-5 py-4 lg:hidden">
        <Logo size="sm" subtitle={false} />
        <button onClick={() => setOpen(true)} className="relative p-1 text-zinc-300" aria-label="Open menu">
          <PiListLight className="size-6" />
          {pending > 0 && <span className="absolute right-0 top-0 size-2 rounded-full bg-brand-500" />}
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/80" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-white/7 bg-ink-950">
            <div className="flex items-center justify-between px-6 pb-2 pt-6">
              <Logo size="sm" />
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white" aria-label="Close menu">
                <PiXLight className="size-5" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
