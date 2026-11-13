// MikuAI — GET /api/admin/stats — platform + AI usage statistics (admin only)
import { requireAdmin, errorResponse } from '@/lib/auth/guard'
import { adminStats } from '@/lib/data/admin'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireAdmin()
    const stats = await adminStats()
    return Response.json({ stats })
  } catch (err) {
    return errorResponse(err)
  }
}
