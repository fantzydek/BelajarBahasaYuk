// MikuAI — /tutor (protected)
import { getCurrentUser } from '@/lib/auth/session'
import { TutorView } from '@/components/tutor/tutor-view'

export const metadata = { title: 'AI Tutor' }
export const dynamic = 'force-dynamic'

export default async function TutorPage() {
  const user = await getCurrentUser()
  return <TutorView user={user!} />
}
