import { useState } from 'react'
import { PiEyeLight, PiEyeSlashLight } from 'react-icons/pi'
import { useAuth } from '../context/AuthContext'
import { Alert, Button, Field, Input } from './ui'

export function PasswordInput(props) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className="pr-9" {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 grid w-8 place-items-end content-center text-zinc-500 transition-colors hover:text-zinc-200"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <PiEyeSlashLight className="size-4" /> : <PiEyeLight className="size-4" />}
      </button>
    </div>
  )
}

export function LoginForm({ onSuccess, submitLabel = 'Log in' }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const profile = await signIn(email, password)
      onSuccess?.(profile)
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'Wrong email or password.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Field label="Email">
        <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password">
        <PasswordInput autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" size="lg" loading={busy} className="mt-10! w-full">
        {submitLabel}
      </Button>
    </form>
  )
}
