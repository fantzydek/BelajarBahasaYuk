// MikuAI — GET /api/quiz/attempts — quiz attempt history (paginated)
import { NextRequest } from 'next/server'
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { listAttempts } from '@/lib/data/quizzes'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const result = await listAttempts(user.id, {
      page: Number(url.searchParams.get('page') ?? 1),
      limit: Number(url.searchParams.get('limit') ?? 20),
      language: url.searchParams.get('language') ?? undefined,
      quizType: url.searchParams.get('quizType') ?? undefined,
      mode: url.searchParams.get('mode') ?? undefined,
    })
    return Response.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
