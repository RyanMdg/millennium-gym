import { useEffect, useState } from 'react'
import { Alert, Button, Card, Field, Input, PageHeader } from '../../components/ui'
import { setSettingsCache, useSettings } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'

export default function Settings() {
  const settings = useSettings()
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (settings && !form) setForm(settings)
  }, [settings, form])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.rpc('admin_update_settings', {
      p_guest_fee: Number(form.guest_fee),
      p_monthly_fee: Number(form.monthly_fee),
      p_membership_days: Number(form.membership_days),
      p_gcash_name: form.gcash_name,
      p_gcash_number: form.gcash_number,
    })
    setBusy(false)
    if (error) return setMessage(['error', error.message])
    const { data } = await supabase.from('settings').select('*').eq('id', 1).single()
    if (data) setSettingsCache(data)
    setMessage(['success', 'Settings saved.'])
  }

  if (!form) return null

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" subtitle="Prices and payment details shown to members and guests." />
      <form onSubmit={save} className="space-y-8">
        <Card title="Pricing">
          <div className="grid gap-6 p-5 sm:grid-cols-3">
            <Field label="Guest fee (₱)">
              <Input type="number" min="0" step="0.01" required value={form.guest_fee} onChange={set('guest_fee')} />
            </Field>
            <Field label="Monthly fee (₱)">
              <Input type="number" min="0" step="0.01" required value={form.monthly_fee} onChange={set('monthly_fee')} />
            </Field>
            <Field label="Membership days">
              <Input type="number" min="1" required value={form.membership_days} onChange={set('membership_days')} />
            </Field>
          </div>
        </Card>
        <Card title="GCash">
          <div className="grid gap-6 p-5 sm:grid-cols-2">
            <Field label="Account name">
              <Input value={form.gcash_name} onChange={set('gcash_name')} placeholder="Millennium Gym" />
            </Field>
            <Field label="GCash number">
              <Input value={form.gcash_number} onChange={set('gcash_number')} placeholder="09XX XXX XXXX" />
            </Field>
          </div>
        </Card>
        {message && <Alert tone={message[0]}>{message[1]}</Alert>}
        <Button type="submit" loading={busy}>Save settings</Button>
      </form>
    </div>
  )
}
