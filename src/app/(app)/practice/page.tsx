// MikuAI — /practice (protected)
import { getCurrentUser } from '@/lib/auth/session'
import { PracticeView } from '@/components/practice/practice-view'

export const metadata = { title: 'Latihan & Ujian' }
export const dynamic = 'force-dynamic'

export default async function PracticePage() {
  const user = await getCurrentUser()
  return <PracticeView user={user!} />
}
