import { cx } from './ui'

export function MMark({ className = 'h-8 w-auto' }) {
  return (
    <svg viewBox="0 0 100 80" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mm-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff4a5c" />
          <stop offset=".55" stopColor="#e8192f" />
          <stop offset="1" stopColor="#8e0b1a" />
        </linearGradient>
        <linearGradient id="mm-silver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".5" stopColor="#c9ccd2" />
          <stop offset=".52" stopColor="#8d929b" />
          <stop offset="1" stopColor="#e6e8eb" />
        </linearGradient>
      </defs>
      <path d="M2 78V12L17 2L49 45V67L19 27V70L11 78Z" fill="url(#mm-red)" />
      <path d="M98 78V12L83 2L51 45V67L81 27V78Z" fill="url(#mm-silver)" />
    </svg>
  )
}

const SIZES = {
  sm: { mark: 'h-6', word: 'text-[11px]', sub: 'text-[6.5px]' },
  md: { mark: 'h-10', word: 'text-lg', sub: 'text-[9px]' },
  lg: { mark: 'h-14 sm:h-20', word: 'text-2xl sm:text-4xl', sub: 'text-[10px] sm:text-sm' },
}

export function Logo({ size = 'md', subtitle = true, className }) {
  const s = SIZES[size]
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <MMark className={cx(s.mark, 'w-auto shrink-0')} />
      <div className="leading-none">
        <div className={cx('whitespace-nowrap font-display', s.word)}>
          <span className="text-chrome">MILLENNIUM</span> <span className="text-redmetal">GYM</span>
        </div>
        {subtitle && (
          <div className={cx('mt-1.5 whitespace-nowrap font-display tracking-[0.12em] text-zinc-400', s.sub)}>
            a BodyBlueprint Studio
          </div>
        )}
      </div>
    </div>
  )
}
