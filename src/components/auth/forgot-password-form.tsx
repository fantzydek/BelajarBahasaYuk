'use client'

// MikuAI — Forgot password form.
// Supabase mode: reset email is sent. Local sandbox mode: the token is shown
// directly so the flow can be completed without a mail service.
import { useState } from 'react'
import Link from 'next/link'
import { Loader2, MailCheck } from 'lucide-react'
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiPost } from '@/lib/client/api'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [localToken, setLocalToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Format email tidak valid.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await apiPost<{ ok: boolean; token?: string }>('/api/auth/password-reset', { email })
      setSent(true)
      setLocalToken(res.token ?? null)
    } catch {
      setError('Gagal memproses permintaan reset. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthCard title="Periksa email Anda" subtitle="Jika email terdaftar, tautan reset kata sandi telah dikirim.">
        <div className="space-y-4 text-[13.5px] text-silver">
          <p className="flex items-center gap-2 text-foreground">
            <MailCheck size={16} className="text-primary" /> Instruksi reset telah dikirim ke <strong>{email}</strong>.
          </p>
          {localToken && (
            <div className="rounded-xl border border-primary/30 bg-primary/8 p-4">
              <p className="text-[12.5px] leading-relaxed text-silver">
                Mode pratinjau lokal tidak memiliki layanan email, jadi tautan reset tersedia langsung di sini:
              </p>
              <Link
                href={`/reset-password?token=${localToken}`}
                className="mt-2 inline-block text-primary hover:underline font-medium"
              >
                Buka halaman reset kata sandi →
              </Link>
            </div>
          )}
          <Link href="/login" className="inline-block text-primary hover:underline">← Kembali ke halaman masuk</Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Lupa kata sandi"
      subtitle="Masukkan email akun Anda dan kami akan mengirim tautan untuk mengatur ulang kata sandi."
      footer={<Link href="/login" className="text-primary hover:underline">Kembali ke masuk</Link>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(error)}
            required
          />
          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 h-10.5" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={16} /> : null}
          {loading ? 'Mengirim…' : 'Kirim Tautan Reset'}
        </Button>
      </form>
    </AuthCard>
  )
}
