// MikuAI — /admin (protected, admin role enforced server-side)
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/session'
import { AdminView } from '@/components/admin/admin-view'

export const metadata = { title: 'Admin Panel' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const user = await getCurrentUser()

  // Server-side authorization — the client view is rendered only for admins.
  if (!user || user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-destructive/40 bg-card/80 p-8 text-center animate-fade-up">
        <ShieldAlert className="mx-auto mb-3 text-destructive" size={32} />
        <h1 className="text-[17px] font-semibold" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
          Akses ditolak
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-silver">
          Halaman ini hanya untuk administrator. Peran akun Anda: <strong className="text-foreground">{user?.role ?? 'tamu'}</strong>.
          Role dapat diubah oleh admin lain melalui panel administrasi.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-primary hover:underline">
          ← Kembali ke dashboard
        </Link>
      </div>
    )
  }

  return <AdminView admin={user} />
}
