// MikuAI — GET /api/admin/logs — AI usage + error monitoring (admin only)
import { NextRequest } from 'next/server'
import { requireAdmin, errorResponse } from '@/lib/auth/guard'
import { adminAiLogs } from '@/lib/data/admin'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const url = new URL(req.url)
    const status = url.searchParams.get('status') === 'error' ? 'error' as const : url.searchParams.get('status') === 'success' ? 'success' as const : undefined
    const logs = await adminAiLogs({
      limit: Number(url.searchParams.get('limit') ?? 50),
      status,
    })
    return Response.json({ logs })
  } catch (err) {
    return errorResponse(err)
  }
}
