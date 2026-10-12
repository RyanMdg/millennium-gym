import { useEffect, useState } from 'react'
import { PiUploadSimpleLight } from 'react-icons/pi'
import { useSettings } from '../lib/hooks'
import { peso } from '../lib/format'
import { Checkbox, cx, eyebrow } from './ui'

// Amount + "pay over the counter" toggle. The GCash upload is hidden when paying at the counter.
export function PaymentFields({ amount, amountLabel, counter, onCounterChange, file, onFileChange, counterDescription }) {
  const settings = useSettings()
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between border-y border-white/10 py-4">
        <span className={eyebrow}>{amountLabel}</span>
        <span className="font-condensed text-3xl text-white">{peso(amount)}</span>
      </div>

      <Checkbox
        checked={counter}
        onChange={onCounterChange}
        label="Pay over the counter"
        description={counterDescription ?? 'Pay in cash at the front desk instead of GCash.'}
      />

      {!counter && (
        <div className="space-y-4">
          {settings?.gcash_number ? (
            <div>
              <p className={eyebrow}>Send via GCash to</p>
              {settings.gcash_name && <p className="mt-1.5 text-white">{settings.gcash_name}</p>}
              <p className="font-mono text-lg tracking-wider text-brand-300">{settings.gcash_number}</p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Send your payment via GCash, then upload the receipt screenshot.</p>
          )}

          <label
            className={cx(
              'flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-4 py-7 text-center transition-colors',
              file ? 'border-white/30' : 'border-white/15 hover:border-white/40',
            )}
          >
            {preview ? (
              <img src={preview} alt="Receipt preview" className="max-h-48 object-contain" />
            ) : (
              <PiUploadSimpleLight className="size-6 text-zinc-500" />
            )}
            <span className="text-sm text-zinc-200">{file ? 'Change receipt' : 'Upload GCash receipt'}</span>
            <span className="text-xs text-zinc-600">Screenshot or photo · max 5 MB</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      )}
    </div>
  )
}
