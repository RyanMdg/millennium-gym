import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PiEnvelopeSimpleThin } from 'react-icons/pi'
import { PasswordInput } from '../components/LoginForm'
import { PaymentFields } from '../components/PaymentFields'
import { Heading, PublicShell } from '../components/PublicShell'
import { Alert, Button, Field, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../lib/hooks'
import { supabase, uploadReceipt } from '../lib/supabase'

export default function Register() {
  const settings = useSettings()
  const { adoptSession } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [counter, setCounter] = useState(false)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    if (!counter && !file) return setError('Upload your GCash receipt, or tick "Pay over the counter".')
    setBusy(true)
    try {
      // Upload first so the receipt path can travel with the sign-up (works even with email confirmation on).
      const receiptPath = counter ? null : await uploadReceipt(file)
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { full_name: form.full_name.trim(), payment_method: counter ? 'counter' : 'gcash', receipt_path: receiptPath },
        },
      })
      if (error) throw error
      if (data.user && data.user.identities?.length === 0) {
        throw new Error('An account with this email already exists. Try logging in instead.')
      }
      if (data.session) {
        await adoptSession(data.session)
        navigate('/me', { replace: true })
      } else {
        setNeedsEmailConfirm(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (needsEmailConfirm) {
    return (
      <PublicShell>
        <div className="text-center">
          <PiEnvelopeSimpleThin className="mx-auto size-16 text-zinc-300" />
          <h1 className="mt-6 font-condensed text-3xl font-medium uppercase tracking-wide text-white">Check your email</h1>
          <p className="mt-3 text-zinc-400">
            Confirm your email address, then log in. The front desk will verify your payment and activate your membership.
          </p>
          <Link to="/login" className="mt-8 inline-block text-sm text-white underline-offset-4 hover:underline">
            Go to login
          </Link>
        </div>
      </PublicShell>
    )
  }

  return (
    <PublicShell
      footer={
        <>
          Already a member?{' '}
          <Link to="/login" className="text-white underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Heading title="Become a member" subtitle="Your membership activates once the front desk verifies your payment." />

        <form onSubmit={submit} className="space-y-6">
          <Field label="Full name">
            <Input required autoComplete="name" value={form.full_name} onChange={set('full_name')} />
          </Field>
          <Field label="Email">
            <Input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Password" hint="At least 8 characters">
            <PasswordInput required autoComplete="new-password" value={form.password} onChange={set('password')} />
          </Field>

          <div className="pt-4">
            <PaymentFields
              amount={settings?.monthly_fee}
              amountLabel={`Monthly · ${settings?.membership_days ?? 30} days`}
              counter={counter}
              onCounterChange={setCounter}
              file={file}
              onFileChange={setFile}
            />
          </div>

          {error && <Alert>{error}</Alert>}
          <Button type="submit" size="lg" loading={busy} className="mt-10! w-full">
            Register
          </Button>
        </form>
    </PublicShell>
  )
}
