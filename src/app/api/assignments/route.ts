// MikuAI — GET /api/assignments — list the user's writing assignments.
import { NextRequest } from 'next/server'
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { listAssignments } from '@/lib/data/assignments'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const result = await listAssignments(user.id, {
      page: Number(url.searchParams.get('page') ?? 1),
      limit: Number(url.searchParams.get('limit') ?? 12),
      language: url.searchParams.get('language') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    })
    return Response.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
