'use client'

// MikuAI — Reset password form (token from email link / sandbox preview).
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiPost } from '@/lib/client/api'

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [token, setToken] = useState(searchParams.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (token.trim().length < 10) errs.token = 'Token reset tidak valid.'
    if (password.length < 8) errs.password = 'Kata sandi minimal 8 karakter.'
    else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) errs.password = 'Wajib mengandung huruf dan angka.'
    if (confirm !== password) errs.confirm = 'Konfirmasi tidak cocok.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    try {
      await apiPost('/api/auth/password-reset/confirm', { token: token.trim(), password })
      setDone(true)
      setTimeout(() => router.push('/login'), 1800)
    } catch {
      setErrors({ token: 'Token tidak valid atau sudah kedaluwarsa. Minta tautan baru.' })
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthCard title="Kata sandi diperbarui" subtitle="Kata sandi Anda berhasil diubah. Mengalihkan ke halaman masuk…">
        <Link href="/login" className="inline-block text-primary hover:underline">Masuk sekarang →</Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Atur ulang kata sandi"
      subtitle="Buat kata sandi baru menggunakan token dari tautan reset."
      footer={<Link href="/login" className="text-primary hover:underline">Kembali ke masuk</Link>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="token">Token reset</Label>
          <Input
            id="token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Tempel token dari email/tautan"
            aria-invalid={Boolean(errors.token)}
            required
          />
          {errors.token && <p className="text-[12px] text-destructive">{errors.token}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Kata sandi baru</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
            required
          />
          {errors.password && <p className="text-[12px] text-destructive">{errors.password}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Ulangi kata sandi baru</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={Boolean(errors.confirm)}
            required
          />
          {errors.confirm && <p className="text-[12px] text-destructive">{errors.confirm}</p>}
        </div>
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 h-10.5" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={16} /> : null}
          {loading ? 'Menyimpan…' : 'Simpan Kata Sandi Baru'}
        </Button>
      </form>
    </AuthCard>
  )
}
