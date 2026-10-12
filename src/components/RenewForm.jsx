import { useState } from 'react'
import { supabase, uploadReceipt } from '../lib/supabase'
import { useSettings } from '../lib/hooks'
import { PaymentFields } from './PaymentFields'
import { Alert, Button } from './ui'

export function RenewForm({ onDone, submitLabel = 'Submit payment' }) {
  const settings = useSettings()
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
      const { error } = await supabase.rpc('submit_payment', {
        p_method: counter ? 'counter' : 'gcash',
        p_receipt_path: receiptPath,
      })
      if (error) throw error
      onDone?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <PaymentFields
        amount={settings?.monthly_fee}
        amountLabel={`Monthly · ${settings?.membership_days ?? 30} days`}
        counter={counter}
        onCounterChange={setCounter}
        file={file}
        onFileChange={setFile}
      />
      {error && <Alert>{error}</Alert>}
      <Button type="submit" size="lg" loading={busy} className="w-full">
        {submitLabel}
      </Button>
    </form>
  )
}
