import { useState } from 'react'
import { PaymentFields } from '../../components/PaymentFields'
import { Alert, Button, Field, Input } from '../../components/ui'
import { useSettings } from '../../lib/hooks'
import { callFunction, uploadReceipt } from '../../lib/supabase'

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  return Array.from(crypto.getRandomValues(new Uint32Array(10)), (n) => chars[n % chars.length]).join('')
}

// Creates a member (activated immediately, payment taken at the desk) or an admin account.
export function AccountForm({ role, onCreated }) {
  const settings = useSettings()
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [counter, setCounter] = useState(true)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    if (role === 'member' && !counter && !file) return setError('Upload the GCash receipt, or tick "Pay over the counter".')
    setBusy(true)
    try {
      const receiptPath = role === 'member' && !counter ? await uploadReceipt(file) : null
      await callFunction('create-user', {
        role,
        ...form,
        payment_method: counter ? 'counter' : 'gcash',
        receipt_path: receiptPath,
      })
      onCreated?.({ ...form })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Field label="Full name">
        <Input required value={form.full_name} onChange={set('full_name')} />
      </Field>
      <Field label="Email">
        <Input type="email" required value={form.email} onChange={set('email')} />
      </Field>
      <Field label="Password" hint="Share this with them — they can use it to log in on their phone.">
        <div className="flex items-end gap-4">
          <Input required value={form.password} onChange={set('password')} className="font-mono" />
          <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))}>
            Generate
          </Button>
        </div>
      </Field>

      {role === 'member' && (
        <PaymentFields
          amount={settings?.monthly_fee}
          amountLabel={`Monthly · ${settings?.membership_days ?? 30} days`}
          counter={counter}
          onCounterChange={setCounter}
          file={file}
          onFileChange={setFile}
          counterDescription="Cash collected at the desk. The membership activates immediately."
        />
      )}

      {error && <Alert>{error}</Alert>}
      <Button type="submit" size="lg" loading={busy} className="mt-8! w-full">
        {role === 'member' ? 'Register member' : 'Create admin'}
      </Button>
    </form>
  )
}
