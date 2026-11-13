// MikuAI — Application shell: dark sidebar + topbar + content area.
// Client component; receives the server-resolved user.
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, MessageSquareText, Languages, GraduationCap, BookMarked,
  ClipboardList, History as HistoryIcon, LineChart, Settings, ShieldCheck,
  LogOut, Menu, X, Sparkles, type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Logo, LogoMark } from '@/components/logo'
import { languageFlag } from '@/lib/languages'
import { apiPost } from '@/lib/client/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SessionUser } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  group: string
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Belajar' },
  { href: '/tutor', label: 'AI Tutor', icon: MessageSquareText, group: 'Belajar' },
  { href: '/translator', label: 'Translator', icon: Languages, group: 'Belajar' },
  { href: '/academy', label: 'Academy', icon: GraduationCap, group: 'Belajar' },
  { href: '/vocabulary', label: 'Vocabulary', icon: BookMarked, group: 'Belajar' },
  { href: '/practice', label: 'Latihan & Ujian', icon: ClipboardList, group: 'Belajar' },
  { href: '/history', label: 'Riwayat', icon: HistoryIcon, group: 'Wawasan' },
  { href: '/progress', label: 'Analitik', icon: LineChart, group: 'Wawasan' },
  { href: '/settings', label: 'Pengaturan', icon: Settings, group: 'Akun' },
  { href: '/admin', label: 'Admin Panel', icon: ShieldCheck, group: 'Akun', adminOnly: true },
]

const GROUPS = ['Belajar', 'Wawasan', 'Akun']

function NavContent({ user, onNavigate }: { user: SessionUser; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-4">
        <Logo href="/dashboard" />
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-4 space-y-5" aria-label="Navigasi utama">
        {GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((i) => i.group === group && (!i.adminOnly || user.role === 'admin'))
          if (!items.length) return null
          return (
            <div key={group}>
              <p className="px-2.5 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-silver/50">
                {group}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-all duration-200',
                          active
                            ? 'bg-primary/12 text-white shadow-[inset_2px_0_0_0_var(--primary)]'
                            : 'text-silver hover:text-white hover:bg-sidebar-accent',
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon
                          size={16.5}
                          className={cn('transition-colors', active ? 'text-primary' : 'text-silver/70 group-hover:text-primary')}
                        />
                        {item.label}
                        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Active language + user card */}
      <div className="px-3 pb-4 space-y-2">
        <div className="rounded-xl border border-sidebar-border bg-secondary/50 px-3 py-2.5">
          <p className="text-[10.5px] uppercase tracking-wider text-silver/60">Sedang fokus</p>
          <p className="text-[13px] font-medium text-foreground mt-0.5">
            {languageFlag(user.targetLanguage)} {user.targetLanguage} · <span className="text-silver capitalize">{user.level}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-sidebar-border bg-secondary/50 px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[12px] font-bold">
            {(user.displayName ?? user.email).slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-foreground">{user.displayName ?? 'Pembelajar'}</p>
            <p className="truncate text-[11px] text-silver/70">{user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}

function SignOutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-silver hover:text-destructive hover:bg-destructive/10"
      disabled={loading}
      aria-label="Keluar dari akun"
      onClick={async () => {
        setLoading(true)
        try {
          await apiPost('/api/auth/logout')
          toast.success('Sampai jumpa! Anda telah keluar.')
          router.push('/login')
          router.refresh()
        } finally {
          setLoading(false)
        }
      }}
    >
      <LogOut size={15} />
    </Button>
  )
}

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const current = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <NavContent user={user} />
      </aside>

      {/* Mobile sidebar (sheet) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Tutup menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[270px] bg-sidebar border-r border-sidebar-border animate-fade-up">
            <button
              className="absolute right-3 top-5 rounded-lg p-1.5 text-silver hover:text-white hover:bg-secondary"
              onClick={() => setMobileOpen(false)}
              aria-label="Tutup"
            >
              <X size={18} />
            </button>
            <NavContent user={user} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/85 backdrop-blur px-4 lg:px-6">
          <button
            className="lg:hidden rounded-lg p-2 text-silver hover:text-white hover:bg-secondary"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
          >
            <Menu size={18} />
          </button>
          <div className="lg:hidden"><LogoMark size={28} /></div>
          <h1 className="text-[15px] font-semibold text-foreground/95 hidden sm:block" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
            {current?.label ?? 'MikuAI'}
          </h1>
          <div className="ml-auto flex items-center gap-2.5">
            {user.role === 'admin' && (
              <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 hidden md:inline-flex">
                <ShieldCheck size={12} className="mr-1" /> Admin
              </Badge>
            )}
            <span className="hidden md:flex items-center gap-1.5 text-[12px] text-silver">
              <Sparkles size={13} className="text-primary" /> Ditenagai xAI Grok
            </span>
          </div>
        </header>
        <main className="flex-1 px-4 lg:px-6 py-5 lg:py-7">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
