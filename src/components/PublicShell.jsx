import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import { cx } from './ui'

export function PublicShell({ children, wide, footer }) {
  return (
    <div className="min-h-dvh bg-ink-950">
      <div className={cx('mx-auto flex min-h-dvh flex-col justify-center px-6 py-10', wide ? 'max-w-3xl' : 'max-w-sm')}>
        <Link to="/" className="mb-14 flex justify-center">
          <Logo size="md" />
        </Link>
        {children}
        {footer && <div className="mt-10 text-center text-sm text-zinc-500">{footer}</div>}
      </div>
    </div>
  )
}

export function Panel({ children, className }) {
  return <div className={className}>{children}</div>
}

export function Heading({ title, subtitle }) {
  return (
    <div className="mb-8">
      <h1 className="font-condensed text-3xl font-medium uppercase tracking-wide text-white">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>}
    </div>
  )
}
