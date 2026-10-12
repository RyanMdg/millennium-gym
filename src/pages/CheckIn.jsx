import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  PiArrowLeftLight,
  PiArrowRightLight,
  PiCheckCircleThin,
  PiClockCountdownThin,
  PiHourglassThin,
  PiProhibitThin,
  PiQrCodeThin,
  PiShieldWarningThin,
  PiXCircleThin,
} from 'react-icons/pi'
import { LoginForm } from '../components/LoginForm'
import { PaymentFields } from '../components/PaymentFields'
import { Heading, PublicShell } from '../components/PublicShell'
import { RenewForm } from '../components/RenewForm'
import { Alert, Button, Field, FullScreenSpinner, Input, Modal, Spinner, cx } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { fmtDate, fmtTime, peso } from '../lib/format'
import { useNow, useSettings } from '../lib/hooks'
import { supabase, uploadReceipt } from '../lib/supabase'

// ---------------------------------------------------------------------------
// Guest visit is kept in localStorage so a refresh doesn't lose the waiting screen.

const VISIT_KEY = 'mg_guest_visit'
const VISIT_TTL = 6 * 3600 * 1000

function readVisit() {
  try {
    const v = JSON.parse(localStorage.getItem(VISIT_KEY))
    return v && Date.now() - v.savedAt < VISIT_TTL ? v : null
  } catch {
    return null
  }
}
function saveVisit(v) {
  try {
    localStorage.setItem(VISIT_KEY, JSON.stringify(v))
  } catch {
    /* private mode — waiting screen still works until refresh */
  }
}
function clearVisit() {
  try {
    localStorage.removeItem(VISIT_KEY)
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------

export default function CheckIn() {
  const [params] = useSearchParams()
  const token = params.get('t')
  const { profile, loading } = useAuth()
  const [mode, setMode] = useState(null)
  const [visit, setVisit] = useState(readVisit)

  if (visit) {
    return (
      <PublicShell>
        <GuestWaiting
          visit={visit}
          onDone={() => {
            clearVisit()
            setVisit(null)
            setMode(null)
          }}
        />
      </PublicShell>
    )
  }

  if (!token) return <NoToken />
  if (loading) return <FullScreenSpinner />

  // Signed-in members skip the chooser: one scan and they're in.
  const memberFlow = mode === 'member' || (profile?.role === 'member' && mode !== 'guest')

  return (
    <PublicShell>
      {memberFlow ? (
        <MemberCheckIn token={token} onBack={() => setMode(null)} onGuest={() => setMode('guest')} />
      ) : mode === 'guest' ? (
        <GuestForm
          token={token}
          onBack={() => setMode(null)}
          onSubmitted={(v) => {
            const saved = { ...v, savedAt: Date.now() }
            saveVisit(saved)
            setVisit(saved)
          }}
        />
      ) : (
        <Chooser onPick={setMode} />
      )}
    </PublicShell>
  )
}

// ---------------------------------------------------------------------------

function BackLink({ onClick }) {
  return (
    <button onClick={onClick} className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-white">
      <PiArrowLeftLight className="size-4" /> Back
    </button>
  )
}

function NoToken() {
  return (
    <PublicShell>
      <div className="text-center">
        <PiQrCodeThin className="mx-auto size-16 text-zinc-300" />
        <h1 className="mt-6 font-condensed text-3xl font-medium uppercase tracking-wide text-white">Scan to check in</h1>
        <p className="mt-3 text-zinc-400">
          Use your phone camera to scan the QR code on the front-desk screen. The code changes every minute, so a
          saved photo won’t work.
        </p>
        <div className="mt-8 flex justify-center gap-6 text-sm">
          <Link to="/me" className="text-white underline-offset-4 hover:underline">My membership</Link>
          <Link to="/register" className="text-zinc-500 transition-colors hover:text-white">Become a member</Link>
        </div>
      </div>
    </PublicShell>
  )
}

function Chooser({ onPick }) {
  const settings = useSettings()
  const options = [
    ['member', 'Member', 'Log in once. After that, one scan and you’re in.'],
    ['guest', 'Guest', `Day pass · ${peso(settings?.guest_fee ?? 80)} per session`],
  ]
  return (
    <div>
      <Heading title="Check in" subtitle="Are you a member or a guest?" />
      <div className="border-t border-white/10">
        {options.map(([key, title, desc]) => (
          <button
            key={key}
            onClick={() => onPick(key)}
            className="group flex w-full items-center justify-between gap-4 border-b border-white/10 py-6 text-left"
          >
            <span>
              <span className="block font-condensed text-3xl uppercase tracking-wide text-white transition-colors group-hover:text-brand-400">
                {title}
              </span>
              <span className="mt-1 block text-sm text-zinc-500">{desc}</span>
            </span>
            <PiArrowRightLight className="size-6 shrink-0 text-zinc-600 transition group-hover:translate-x-1 group-hover:text-brand-400" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

const RESULT_TONES = {
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-brand-400',
  gray: 'text-zinc-500',
}

function ResultScreen({ tone, icon: Icon, title, pulse, children }) {
  return (
    <div className="py-4 text-center">
      <Icon className={cx('mx-auto size-24', RESULT_TONES[tone], pulse && 'animate-pulse')} />
      <h1 className="mt-6 font-condensed text-4xl font-medium uppercase tracking-wide text-white">{title}</h1>
      <div className="mt-3 space-y-1 text-zinc-400">{children}</div>
    </div>
  )
}

// A ticking clock proves to the front desk this is a live screen, not a screenshot.
function LiveClock() {
  const now = useNow(1000)
  return (
    <div className="mt-10 border-t border-white/10 pt-6">
      <div className="font-mono text-3xl tabular-nums text-white">
        {new Date(now).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function MemberCheckIn({ token, onBack, onGuest }) {
  const { session, profile, signOut } = useAuth()
  const settings = useSettings()
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(true)
  const [renewing, setRenewing] = useState(false)
  const [renewSent, setRenewSent] = useState(false)
  const ran = useRef(false)

  const run = useCallback(async () => {
    setError('')
    const { data, error } = await supabase.rpc('member_check_in', { p_token: token })
    if (error) setError(error.message)
    else setResult(data)
  }, [token])

  useEffect(() => {
    if (session && !ran.current) {
      ran.current = true
      run()
    }
  }, [session, run])

  async function switchAccount() {
    await signOut()
    ran.current = false
    setResult(null)
  }

  if (!session) {
    return (
      <div>
        <BackLink onClick={onBack} />
        <Heading title="Member check-in" subtitle="You’ll stay logged in on this phone, so next time it’s just one scan." />
        <LoginForm submitLabel="Log in & check in" />
        <p className="mt-8 text-center text-sm text-zinc-500">
          Not a member? <Link to="/register" className="text-white underline-offset-4 hover:underline">Register</Link>
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert>{error}</Alert>
        <Button onClick={run} className="w-full">Try again</Button>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="py-16 text-center">
        <Spinner className="mx-auto size-10" />
        <p className="mt-4 text-zinc-400">Checking you in…</p>
      </div>
    )
  }

  const name = result.full_name?.split(' ')[0] ?? profile?.full_name
  let screen

  switch (result.result) {
    case 'ok':
    case 'already':
      screen = (
        <ResultScreen tone="green" icon={PiCheckCircleThin} title={result.result === 'ok' ? "You're in!" : 'Already in'}>
          <p className="text-lg text-white">Welcome, {name}.</p>
          <p>
            {result.result === 'ok' ? 'Checked in' : 'You checked in'} at {fmtTime(result.checked_in_at)}
          </p>
          <p className="text-sm text-zinc-400">Membership active until {fmtDate(result.expires_at)}</p>
          <LiveClock />
        </ResultScreen>
      )
      break
    case 'expired':
      screen = (
        <>
          <ResultScreen tone="red" icon={PiClockCountdownThin} title="Membership expired">
            <p>{result.expires_at ? `Expired on ${fmtDate(result.expires_at)}.` : 'No active membership.'}</p>
            <Button className="mt-8" onClick={() => setModalOpen(true)}>
              Renew membership
            </Button>
          </ResultScreen>
          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Membership expired">
            {result.renewal_pending || renewSent ? (
              <Alert tone="success">
                Your payment is being verified by the front desk. You can check in as soon as it’s approved.
              </Alert>
            ) : renewing ? (
              <RenewForm onDone={() => setRenewSent(true)} submitLabel="Submit renewal" />
            ) : (
              <div className="space-y-6">
                <p className="text-zinc-400">
                  Hi {name}, your membership {result.expires_at ? `expired on ${fmtDate(result.expires_at)}` : 'is not active'}.
                  Pay the monthly fee of <span className="font-semibold text-white">{peso(settings?.monthly_fee)}</span> to
                  keep training.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button className="flex-1" onClick={() => setRenewing(true)}>Pay monthly fee</Button>
                  <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>Close</Button>
                </div>
              </div>
            )}
          </Modal>
        </>
      )
      break
    case 'pending':
      screen = (
        <ResultScreen tone="amber" icon={PiHourglassThin} title="Awaiting approval">
          <p>Hi {name}, the front desk hasn’t verified your registration payment yet.</p>
          <p className="text-sm text-zinc-400">Please see the front desk.</p>
        </ResultScreen>
      )
      break
    case 'rejected':
      screen = (
        <ResultScreen tone="red" icon={PiXCircleThin} title="Not approved">
          <p>Your registration payment couldn’t be verified.</p>
          <Link to="/me" className="mt-4 inline-block text-white underline-offset-4 hover:underline">Resubmit payment</Link>
        </ResultScreen>
      )
      break
    case 'disabled':
      screen = (
        <ResultScreen tone="gray" icon={PiProhibitThin} title="Account disabled">
          <p>Please see the front desk.</p>
        </ResultScreen>
      )
      break
    case 'invalid_token':
      screen = (
        <ResultScreen tone="amber" icon={PiQrCodeThin} title="QR expired">
          <p>This code is no longer valid. Scan the QR on the front-desk screen again.</p>
        </ResultScreen>
      )
      break
    case 'admin':
      screen = (
        <ResultScreen tone="gray" icon={PiShieldWarningThin} title="Admin account">
          <p>You’re logged in as staff. Log in with a member account to check in.</p>
          <Link to="/admin" className="mt-4 inline-block text-white underline-offset-4 hover:underline">Go to admin</Link>
        </ResultScreen>
      )
      break
    default:
      screen = <Alert>Something went wrong. Please try again.</Alert>
  }

  return (
    <div>
      {screen}
      <div className="mt-12 flex justify-center gap-6 text-sm text-zinc-600">
        <button onClick={switchAccount} className="transition-colors hover:text-white">Not {name}? Switch account</button>
        <button onClick={onGuest} className="transition-colors hover:text-white">Check in a guest</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function GuestForm({ token, onBack, onSubmitted }) {
  const settings = useSettings()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [counter, setCounter] = useState(false)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!counter && !file) return setError('Upload your GCash receipt, or tick "Pay over the counter".')
    setBusy(true)
    try {
      const receiptPath = counter ? null : await uploadReceipt(file)
      const { data, error } = await supabase.rpc('guest_check_in', {
        p_token: token,
        p_name: name,
        p_phone: phone,
        p_method: counter ? 'counter' : 'gcash',
        p_receipt_path: receiptPath,
      })
      if (error) throw error
      onSubmitted({ id: data.id, code: data.code })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <Heading title="Guest check-in" subtitle="Pay for today’s session and the front desk will let you in." />
      <form onSubmit={submit} className="space-y-6">
        <Field label="Full name">
          <Input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Mobile number (optional)">
          <Input type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09XX XXX XXXX" />
        </Field>
        <PaymentFields
          amount={settings?.guest_fee}
          amountLabel="Guest · 1 session"
          counter={counter}
          onCounterChange={setCounter}
          file={file}
          onFileChange={setFile}
        />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" size="lg" loading={busy} className="mt-10! w-full">
          Check in
        </Button>
      </form>
    </div>
  )
}

function GuestWaiting({ visit, onDone }) {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    let alive = true
    let timer
    const poll = async () => {
      const { data, error } = await supabase.rpc('guest_visit_status', { p_id: visit.id, p_code: visit.code })
      if (!alive) return
      if (error) {
        timer = setTimeout(poll, 6000)
        return
      }
      setInfo(data ?? { status: 'missing' })
      if (data?.status === 'pending') timer = setTimeout(poll, 4000)
    }
    poll()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [visit])

  if (!info) {
    return (
      <div className="py-16 text-center">
        <Spinner className="mx-auto size-10" />
      </div>
    )
  }

  const name = info.guest_name?.split(' ')[0]
  let screen
  if (info.status === 'approved') {
    screen = (
      <ResultScreen tone="green" icon={PiCheckCircleThin} title="You're in!">
        <p className="text-lg text-white">Enjoy your workout, {name}.</p>
        <p className="text-sm text-zinc-400">Guest pass · {fmtDate(info.created_at)}</p>
        <LiveClock />
      </ResultScreen>
    )
  } else if (info.status === 'pending') {
    screen = (
      <ResultScreen tone="amber" icon={PiHourglassThin} title="Almost in" pulse>
        {info.method === 'counter' ? (
          <p>
            Please pay <span className="font-semibold text-white">{peso(info.amount)}</span> at the front desk.
          </p>
        ) : (
          <p>The front desk is checking your GCash payment.</p>
        )}
        <p className="text-sm text-zinc-400">This screen updates by itself once you’re approved.</p>
      </ResultScreen>
    )
  } else if (info.status === 'rejected') {
    screen = (
      <ResultScreen tone="red" icon={PiXCircleThin} title="Payment not verified">
        {info.note && <p className="text-white">“{info.note}”</p>}
        <p>Please talk to the front desk.</p>
      </ResultScreen>
    )
  } else {
    screen = (
      <ResultScreen tone="gray" icon={PiQrCodeThin} title="Visit not found">
        <p>Scan the front-desk QR to start again.</p>
      </ResultScreen>
    )
  }

  return (
    <div>
      {screen}
      {info.status !== 'pending' && (
        <div className="mt-10 text-center">
          <Button variant="secondary" onClick={onDone}>Done</Button>
        </div>
      )}
    </div>
  )
}
