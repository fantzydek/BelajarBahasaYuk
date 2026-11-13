// MikuAI — GET /api/dashboard — all dashboard data from the database
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { getDashboardStats } from '@/lib/data/analytics'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await requireUser()
    const stats = await getDashboardStats(user)
    return Response.json({ stats, user })
  } catch (err) {
    return errorResponse(err)
  }
}
