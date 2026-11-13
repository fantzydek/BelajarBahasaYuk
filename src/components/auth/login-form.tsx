'use client'

// MikuAI — Login page.
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiPost, ApiClientError } from '@/lib/client/api'
import type { SessionUser } from '@/lib/types'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  function validate(): boolean {
    const errors: typeof fieldErrors = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Format email tidak valid.'
    if (password.length < 1) errors.password = 'Kata sandi wajib diisi.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await apiPost<{ user: SessionUser }>('/api/auth/login', { email, password })
      router.push(next)
      router.refresh()
    } catch (err) {
      if (err instanceof ApiClientError && err.status !== 401) {
        setFieldErrors({ password: err.message })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title="Selamat datang kembali"
      subtitle="Masuk untuk melanjutkan perjalanan belajar bahasa Anda."
      footer={
        <>
          Belum punya akun?{' '}
          <Link href="/register" className="text-primary hover:underline">Daftar gratis</Link>
        </>
      }
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
            aria-invalid={Boolean(fieldErrors.email)}
            required
          />
          {fieldErrors.email && <p className="text-[12px] text-destructive">{fieldErrors.email}</p>}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Kata sandi</Label>
            <Link href="/forgot-password" className="text-[12px] text-primary hover:underline">
              Lupa kata sandi?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
              aria-invalid={Boolean(fieldErrors.password)}
              required
            />
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-silver/70 hover:text-silver"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {fieldErrors.password && <p className="text-[12px] text-destructive">{fieldErrors.password}</p>}
        </div>
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 h-10.5" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={16} /> : null}
          {loading ? 'Memproses…' : 'Masuk'}
        </Button>
      </form>
    </AuthCard>
  )
}
