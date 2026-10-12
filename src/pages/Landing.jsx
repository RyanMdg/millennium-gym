import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../lib/hooks'
import { peso } from '../lib/format'

const linkBtn =
  'inline-flex h-12 items-center justify-center px-8 font-condensed text-[15px] font-medium uppercase tracking-[0.14em] transition-colors'

export default function Landing() {
  const { profile } = useAuth()
  const settings = useSettings()

  const facts = [
    ['Open', '24/7'],
    ['Per session', peso(settings?.guest_fee ?? 80)],
    ['Café', 'Inside'],
  ]

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink-950">
      <img src="/img/hero.jpg" alt="" className="absolute inset-0 size-full object-cover object-[35%_center] opacity-35" />
      <div className="absolute inset-0 bg-linear-to-r from-ink-950 via-ink-950/85 to-ink-950/40" />

      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-8 sm:px-10">
        <div className="flex justify-end text-sm">
          {profile?.role === 'admin' ? (
            <Link to="/admin" className="text-zinc-400 transition-colors hover:text-white">Admin</Link>
          ) : profile ? (
            <Link to="/me" className="text-zinc-400 transition-colors hover:text-white">My membership</Link>
          ) : (
            <Link to="/login" className="text-zinc-400 transition-colors hover:text-white">Log in</Link>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center py-12">
          <Logo size="lg" />
          <p className="mt-12 font-condensed text-4xl font-medium uppercase leading-[1.05] tracking-wide text-white sm:text-6xl">
            Train. Refresh.
            <br />
            <span className="text-brand-500">Relax.</span>
          </p>
          <p className="mt-5 max-w-sm text-zinc-400">Legacy reimagined. Check in with your phone, no paper logbook.</p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link to="/register" className={`${linkBtn} bg-brand-500 text-white hover:bg-brand-400`}>
              Become a member
            </Link>
            <Link to={profile ? '/me' : '/login'} className={`${linkBtn} border border-white/25 text-white hover:border-white/60`}>
              Member login
            </Link>
          </div>

          <dl className="mt-16 flex divide-x divide-white/10">
            {facts.map(([label, value]) => (
              <div key={label} className="px-6 first:pl-0">
                <dt className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</dt>
                <dd className="mt-1 font-condensed text-2xl text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-xs text-zinc-600">At the gym? Scan the QR code on the front-desk screen to check in.</p>
      </div>
    </div>
  )
}
