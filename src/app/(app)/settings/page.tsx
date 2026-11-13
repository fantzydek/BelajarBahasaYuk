// MikuAI — /settings (protected)
import { getCurrentUser } from '@/lib/auth/session'
import { SettingsView } from '@/components/settings/settings-view'

export const metadata = { title: 'Pengaturan' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  return <SettingsView user={user!} />
}
