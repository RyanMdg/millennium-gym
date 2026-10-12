import { useEffect, useState } from 'react'
import { PiArrowUpRightLight, PiImageBrokenLight } from 'react-icons/pi'
import { supabase } from '../lib/supabase'
import { Modal, Spinner } from './ui'

export function ReceiptThumb({ path, className = 'size-16' }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    supabase.storage
      .from('receipts')
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setFailed(true)
        else setUrl(data.signedUrl)
      })
    return () => {
      alive = false
    }
  }, [path])

  return (
    <>
      <button
        type="button"
        onClick={() => url && setOpen(true)}
        className={`${className} grid shrink-0 place-items-center overflow-hidden border border-white/10 transition-colors hover:border-white/40`}
        aria-label="View receipt"
      >
        {failed ? (
          <PiImageBrokenLight className="size-5 text-zinc-600" />
        ) : url ? (
          <img src={url} alt="GCash receipt" className="size-full object-cover" />
        ) : (
          <Spinner className="size-4" />
        )}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="GCash receipt" wide>
        <img src={url} alt="GCash receipt" className="mx-auto max-h-[70dvh] object-contain" />
        <a href={url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
          Open full size <PiArrowUpRightLight className="size-3.5" />
        </a>
      </Modal>
    </>
  )
}
