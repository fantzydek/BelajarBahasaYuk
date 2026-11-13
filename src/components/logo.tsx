// MikuAI — Logo mark + wordmark.
import Link from 'next/link'

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-[0_4px_18px_-4px_rgba(38,123,255,0.6)]"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden
    >
      M
    </span>
  )
}

export function Logo({ href = '/', size = 34 }: { href?: string; size?: number }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 group" aria-label="MikuAI — beranda">
      <LogoMark size={size} />
      <span className="leading-tight">
        <span
          className="block font-semibold tracking-tight text-[17px] text-foreground group-hover:text-primary transition-colors"
          style={{ fontFamily: 'var(--font-display), sans-serif' }}
        >
          MikuAI
        </span>
        <span className="block text-[10px] text-silver/80 -mt-0.5 tracking-wide">
          Learn Languages. Understand the World.
        </span>
      </span>
    </Link>
  )
}
