// MikuAI — /academy (protected)
import { getCurrentUser } from '@/lib/auth/session'
import { AcademyView } from '@/components/academy/academy-view'

export const metadata = { title: 'Academy' }
export const dynamic = 'force-dynamic'

export default async function AcademyPage() {
  const user = await getCurrentUser()
  return <AcademyView user={user!} />
}
