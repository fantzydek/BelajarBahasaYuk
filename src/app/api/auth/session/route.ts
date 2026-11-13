// MikuAI — GET /api/auth/session — current user (null when signed out)
import { getCurrentUser } from '@/lib/auth/session'
import { errorResponse } from '@/lib/auth/guard'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getCurrentUser()
    return Response.json({ user })
  } catch (err) {
    return errorResponse(err)
  }
}
