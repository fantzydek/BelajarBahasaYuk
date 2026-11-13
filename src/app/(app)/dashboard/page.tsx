// MikuAI — /dashboard (protected)
import { getCurrentUser } from '@/lib/auth/session'
import { DashboardView } from '@/components/dashboard/dashboard-view'

export const metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  return <DashboardView user={user!} />
}
