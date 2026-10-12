/* eslint-disable react-refresh/only-export-components */
import { useEffect } from 'react'
import { PiCircleNotchLight, PiXLight } from 'react-icons/pi'
import { STATE_BADGE } from '../lib/format'

export const cx = (...classes) => classes.filter(Boolean).join(' ')

// Small uppercase label used throughout (field labels, section titles, captions).
export const eyebrow = 'text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500'

const BUTTON_VARIANTS = {
  primary: 'bg-brand-500 text-white hover:bg-brand-400',
  light: 'bg-white text-ink-950 hover:bg-zinc-200',
  secondary: 'border border-white/20 text-zinc-100 hover:border-white/50',
  danger: 'border border-brand-500/50 text-brand-300 hover:border-brand-400 hover:text-brand-200',
  ghost: 'text-zinc-400 hover:text-white',
}
const BUTTON_SIZES = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-5 text-sm', lg: 'h-12 px-7 text-[15px]' }

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }) {
  return (
    <button
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 font-condensed font-medium uppercase tracking-[0.14em] transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        'disabled:cursor-not-allowed disabled:opacity-40',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && <PiCircleNotchLight className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export const inputClass =
  'w-full h-11 rounded-none border-0 border-b border-white/15 bg-transparent px-0 text-base text-white placeholder:text-zinc-600 transition-colors focus:border-brand-500 focus:outline-none focus:ring-0 sm:text-[15px]'

export function Input({ className, ...props }) {
  return <input className={cx(inputClass, className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cx(inputClass, 'cursor-pointer pr-6', className)} {...props}>
      {children}
    </select>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className={cx(eyebrow, 'block')}>{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-zinc-600">{hint}</span>}
    </label>
  )
}

export function Checkbox({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-brand-500"
      />
      <span>
        <span className="block text-sm text-zinc-100">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-zinc-500">{description}</span>}
      </span>
    </label>
  )
}

export function Card({ title, action, className, children }) {
  return (
    <section className={cx('border border-white/7', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/7 px-5 py-3.5">
          <h2 className={eyebrow}>{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

const TEXT_TONES = {
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-brand-400',
  blue: 'text-sky-300',
  gray: 'text-zinc-500',
}

// Status label: colored text with a small dot, no pill.
export function Badge({ tone = 'gray', children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.14em]',
        TEXT_TONES[tone],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

export function StateBadge({ state }) {
  const [label, tone] = STATE_BADGE[state] ?? ['—', 'gray']
  return <Badge tone={tone}>{label}</Badge>
}

const ALERT_TONES = {
  error: 'border-brand-500 text-brand-300',
  warn: 'border-amber-500 text-amber-300',
  success: 'border-emerald-500 text-emerald-300',
  info: 'border-zinc-600 text-zinc-300',
}

export function Alert({ tone = 'error', children, className }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('border-l-2 py-0.5 pl-3 text-sm', ALERT_TONES[tone], className)}>
      {children}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/85" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'relative max-h-[92dvh] w-full overflow-y-auto border border-white/10 bg-ink-900',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <header className="flex items-center justify-between gap-4 px-6 pt-5">
          <h3 className="font-condensed text-xl font-medium uppercase tracking-wide text-white">{title}</h3>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="text-zinc-500 transition-colors hover:text-white">
              <PiXLight className="size-5" />
            </button>
          )}
        </header>
        <div className="px-6 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-white/7 px-6 py-4">{footer}</footer>}
      </div>
    </div>
  )
}

export function Spinner({ className = 'size-6' }) {
  return <PiCircleNotchLight className={cx('animate-spin text-zinc-500', className)} />
}

export function FullScreenSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ink-950">
      <Spinner className="size-8" />
    </div>
  )
}

export function EmptyState({ title, children }) {
  return (
    <div className="px-5 py-14 text-center">
      <p className="text-sm text-zinc-400">{title}</p>
      {children && <p className="mt-1 text-xs text-zinc-600">{children}</p>}
    </div>
  )
}

export function Tabs({ value, onChange, options }) {
  return (
    <div className="flex gap-6 overflow-x-auto border-b border-white/7">
      {options.map(([key, label, count]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cx(
            '-mb-px whitespace-nowrap border-b pb-3 text-xs font-medium uppercase tracking-[0.14em] transition-colors',
            value === key ? 'border-brand-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-200',
          )}
        >
          {label}
          {count != null && <span className="ml-1.5 tabular-nums text-zinc-600">{count}</span>}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-condensed text-3xl font-medium uppercase tracking-wide text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// Search field with a leading icon, used on list pages.
export function SearchInput({ icon: Icon, className, ...props }) {
  return (
    <div className={cx('relative', className)}>
      <Icon className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
      <Input className="h-9 pl-6" {...props} />
    </div>
  )
}
