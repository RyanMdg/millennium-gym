import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { PiArrowLeftLight, PiCornersOutLight } from 'react-icons/pi'
import { Logo } from '../components/Logo'
import { Badge, Spinner, eyebrow } from '../components/ui'
import { fmtTime, manilaDayStart } from '../lib/format'
import { useNow, useRealtime } from '../lib/hooks'
import { supabase } from '../lib/supabase'

const ROTATE_SECONDS = 60

export default function Kiosk() {
  const now = useNow(1000)
  const [token, setToken] = useState(null)
  const [issuedAt, setIssuedAt] = useState(0)
  const [error, setError] = useState('')
  const [feed, setFeed] = useState([])

  const rotate = useCallback(async () => {
    const { data, error } = await supabase.rpc('kiosk_rotate')
    if (error) return setError(error.message)
    setError('')
    setToken(data)
    setIssuedAt(Date.now())
  }, [])

  useEffect(() => {
    rotate()
    const id = setInterval(rotate, ROTATE_SECONDS * 1000)
    return () => clearInterval(id)
  }, [rotate])

  const loadFeed = useCallback(async () => {
    const { data } = await supabase
      .from('checkins')
      .select('id, kind, status, guest_name, created_at, member:profiles(full_name)')
      .gte('created_at', manilaDayStart().toISOString())
      .order('created_at', { ascending: false })
      .limit(8)
    setFeed(data ?? [])
  }, [])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])
  useRealtime(['checkins'], loadFeed)

  // Keep the tablet screen awake.
  useEffect(() => {
    let lock
    const request = () => navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    request()
    const onVisible = () => document.visibilityState === 'visible' && request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release()
    }
  }, [])

  const secondsLeft = Math.max(0, ROTATE_SECONDS - Math.floor((now - issuedAt) / 1000))
  const url = token ? `${window.location.origin}/checkin?t=${token}` : ''

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950">
      <header className="flex items-center justify-between px-8 py-6">
        <Logo size="md" />
        <div className="flex items-center gap-4">
          <span className="font-mono text-2xl tabular-nums text-zinc-300">
            {new Date(now).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })}
          </span>
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            className="p-2 text-zinc-600 transition-colors hover:text-white"
            aria-label="Full screen"
          >
            <PiCornersOutLight className="size-5" />
          </button>
          <Link to="/admin" className="p-2 text-zinc-600 transition-colors hover:text-white" aria-label="Exit kiosk">
            <PiArrowLeftLight className="size-5" />
          </Link>
        </div>
      </header>

      <main className="grid flex-1 items-center gap-12 px-8 pb-10 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col items-center text-center">
          <h1 className="font-condensed text-5xl font-medium uppercase tracking-wide text-white">
            Scan to <span className="text-brand-500">check in</span>
          </h1>
          <p className="mt-3 text-zinc-500">Members and guests. Open your phone camera.</p>

          <div className="mt-10 bg-white p-5">
            {token ? (
              <QRCodeSVG
                value={url}
                size={320}
                level="M"
                marginSize={0}
                imageSettings={{ src: '/favicon.svg', height: 52, width: 42, excavate: true }}
                className="size-[min(62vw,46dvh,380px)]"
              />
            ) : (
              <div className="grid size-[min(62vw,46dvh,380px)] place-items-center">
                {error ? <p className="px-6 text-sm text-brand-600">{error}</p> : <Spinner className="size-10" />}
              </div>
            )}
          </div>

          <div className="mt-6 h-px w-[min(62vw,46dvh,380px)] bg-white/10">
            <div
              className="h-full bg-brand-500 transition-[width] duration-1000 ease-linear"
              style={{ width: `${(secondsLeft / ROTATE_SECONDS) * 100}%` }}
            />
          </div>
          <p className="mt-3 text-xs tabular-nums text-zinc-600">New code in {secondsLeft}s</p>

          <ol className="mt-12 flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm text-zinc-400">
            {['Scan the code', 'Pick Member or Guest', 'Show your screen at the desk'].map((step, i) => (
              <li key={step} className="flex items-baseline gap-2.5">
                <span className="font-condensed text-lg text-brand-500">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <aside className="self-stretch border-white/7 lg:border-l lg:pl-10">
          <h2 className={eyebrow}>Just checked in</h2>
          {feed.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-600">No check-ins yet today.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/7">
              {feed.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{c.kind === 'member' ? c.member?.full_name : c.guest_name}</p>
                    <p className="text-xs text-zinc-500">{fmtTime(c.created_at)}</p>
                  </div>
                  {c.kind === 'member' ? (
                    <Badge tone="green">Member</Badge>
                  ) : c.status === 'pending' ? (
                    <Badge tone="amber">Guest · verify</Badge>
                  ) : c.status === 'approved' ? (
                    <Badge tone="blue">Guest</Badge>
                  ) : (
                    <Badge tone="red">Rejected</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>
    </div>
  )
}
