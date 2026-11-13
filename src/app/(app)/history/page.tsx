// MikuAI — /history (protected)
import { getCurrentUser } from '@/lib/auth/session'
import { HistoryView } from '@/components/history/history-view'

export const metadata = { title: 'Riwayat' }
export const dynamic = 'force-dynamic'

export default async function HistoryPage() {
  const user = await getCurrentUser()
  return <HistoryView user={user!} />
}
