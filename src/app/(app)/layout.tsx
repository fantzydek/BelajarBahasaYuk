// MikuAI — Protected app layout: server-side session check + shell.
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { AppShell } from '@/components/layout/app-shell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return <AppShell user={user}>{children}</AppShell>
}

// Session-based layout — always dynamic.
export const dynamic = 'force-dynamic'
