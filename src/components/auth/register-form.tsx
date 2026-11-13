'use client'

// MikuAI — Register form.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiPost } from '@/lib/client/api'
import type { SessionUser } from '@/lib/types'

export function RegisterForm() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!displayName.trim()) errs.displayName = 'Nama tampilan wajib diisi.'
    if (displayName.trim().length > 60) errs.displayName = 'Nama maksimal 60 karakter.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Format email tidak valid.'
    if (password.length < 8) errs.password = 'Kata sandi minimal 8 karakter.'
    else if (!/[a-zA-Z]/.test(password)) errs.password = 'Kata sandi harus mengandung huruf.'
    else if (!/[0-9]/.test(password)) errs.password = 'Kata sandi harus mengandung angka.'
    if (confirm !== password) errs.confirm = 'Konfirmasi kata sandi tidak cocok.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await apiPost<{ user: SessionUser }>('/api/auth/register', {
        email,
        password,
        displayName: displayName.trim(),
      })
      router.push('/dashboard')
      router.refresh()
    } catch {
      setErrors({ password: 'Registrasi gagal. Periksa kembali data Anda atau coba email lain.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title="Buat akun MikuAI"
      subtitle="Gratis untuk mulai. Semua data belajar Anda tersimpan aman di akun pribadi."
      footer={
        <>
          Sudah punya akun?{' '}
          <Link href="/login" className="text-primary hover:underline">Masuk di sini</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Nama tampilan</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nama Anda"
            maxLength={60}
            aria-invalid={Boolean(errors.displayName)}
            required
          />
          {errors.displayName && <p className="text-[12px] text-destructive">{errors.displayName}</p>}
        </div>
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
            aria-invalid={Boolean(errors.email)}
            required
          />
          {errors.email && <p className="text-[12px] text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Kata sandi</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Minimal 8 karakter, ada huruf & angka"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
            required
          />
          {errors.password && <p className="text-[12px] text-destructive">{errors.password}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Ulangi kata sandi</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Ulangi kata sandi"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={Boolean(errors.confirm)}
            required
          />
          {errors.confirm && <p className="text-[12px] text-destructive">{errors.confirm}</p>}
        </div>
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 h-10.5" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={16} /> : null}
          {loading ? 'Membuat akun…' : 'Buat Akun'}
        </Button>
        <p className="text-[11.5px] leading-relaxed text-silver/70">
          Dengan mendaftar, Anda setuju bahwa data belajar Anda disimpan di platform MikuAI dan hanya dapat diakses oleh akun Anda.
        </p>
      </form>
    </AuthCard>
  )
}
