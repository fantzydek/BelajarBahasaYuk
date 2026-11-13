// MikuAI — /login (public)
import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = { title: 'Masuk' }

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Skeleton className="h-[420px] w-[420px] max-w-full rounded-2xl" /></div>}>
      <LoginForm />
    </Suspense>
  )
}
