// MikuAI — /progress (protected)
import { getCurrentUser } from '@/lib/auth/session'
import { ProgressView } from '@/components/analytics/progress-view'

export const metadata = { title: 'Analitik' }
export const dynamic = 'force-dynamic'

export default async function ProgressPage() {
  const user = await getCurrentUser()
  return <ProgressView user={user!} />
}
