// MikuAI — /reset-password (public)
import { Suspense } from 'react'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = { title: 'Reset Kata Sandi' }

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Skeleton className="h-[460px] w-[420px] max-w-full rounded-2xl" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
