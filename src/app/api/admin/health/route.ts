// MikuAI — GET /api/admin/health — database health overview (admin only)
import { requireAdmin, errorResponse } from '@/lib/auth/guard'
import { adminDbHealth } from '@/lib/data/admin'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireAdmin()
    const health = await adminDbHealth()
    return Response.json({ health })
  } catch (err) {
    return errorResponse(err)
  }
}
