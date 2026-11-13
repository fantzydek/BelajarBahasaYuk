// MikuAI — GET /api/translations — paginated history with search + language filter
import { NextRequest } from 'next/server'
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { listTranslations } from '@/lib/data/translations'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const result = await listTranslations(user.id, {
      page: Number(url.searchParams.get('page') ?? 1),
      limit: Number(url.searchParams.get('limit') ?? 20),
      search: url.searchParams.get('search') ?? undefined,
      language: url.searchParams.get('language') ?? undefined,
    })
    return Response.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
