// MikuAI — Shared auth layout pieces.
import Link from 'next/link'
import { Logo } from '@/components/logo'

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10 overflow-hidden">
      <div className="hero-glow -top-80 left-1/2 -translate-x-1/2" aria-hidden />
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-7 text-center">
          <div className="inline-block"><Logo /></div>
        </div>
        <div className="rounded-2xl border border-border bg-card/90 p-6 sm:p-7 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)] animate-fade-up">
          <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
            {title}
          </h1>
          <p className="mt-1 mb-5 text-[13.5px] text-silver">{subtitle}</p>
          {children}
        </div>
        {footer && <div className="mt-4 text-center text-[13px] text-silver">{footer}</div>}
        <p className="mt-8 text-center text-[11.5px] text-silver/60">
          <Link href="/" className="hover:text-silver transition-colors">← Kembali ke beranda</Link>
        </p>
      </div>
    </div>
  )
}
