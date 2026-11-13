// MikuAI — GET /api/admin/users — user management list (admin only)
import { requireAdmin, errorResponse } from '@/lib/auth/guard'
import { adminUsers } from '@/lib/data/admin'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireAdmin()
    const users = await adminUsers()
    return Response.json({ users })
  } catch (err) {
    return errorResponse(err)
  }
}
