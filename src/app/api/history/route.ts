// MikuAI — GET /api/history — unified learning history with filters
import { NextRequest } from 'next/server'
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { listHistory } from '@/lib/data/history'
import type { ActivityType } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const typesParam = url.searchParams.get('types')
    const result = await listHistory(user.id, {
      page: Number(url.searchParams.get('page') ?? 1),
      limit: Number(url.searchParams.get('limit') ?? 25),
      types: typesParam ? (typesParam.split(',').filter(Boolean) as ActivityType[]) : undefined,
      language: url.searchParams.get('language') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
    })
    return Response.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
