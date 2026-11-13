// MikuAI — /vocabulary (protected)
import { getCurrentUser } from '@/lib/auth/session'
import { VocabularyView } from '@/components/vocabulary/vocabulary-view'

export const metadata = { title: 'Vocabulary' }
export const dynamic = 'force-dynamic'

export default async function VocabularyPage() {
  const user = await getCurrentUser()
  return <VocabularyView user={user!} />
}
