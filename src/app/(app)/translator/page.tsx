// MikuAI — /translator (protected)
import { getCurrentUser } from '@/lib/auth/session'
import { TranslatorView } from '@/components/translator/translator-view'

export const metadata = { title: 'Translator' }
export const dynamic = 'force-dynamic'

export default async function TranslatorPage() {
  const user = await getCurrentUser()
  return <TranslatorView user={user!} />
}
