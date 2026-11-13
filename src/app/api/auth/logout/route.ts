// MikuAI — POST /api/auth/logout
import { errorResponse } from '@/lib/auth/guard'
import { logout } from '@/lib/data/profile'

export const runtime = 'nodejs'

export async function POST() {
  try {
    await logout()
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
