// MikuAI — GET /api/quiz/attempts/[id] — attempt detail (answers revealed only when completed)
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { getAttempt } from '@/lib/data/quizzes'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const attempt = await getAttempt(user.id, id)
    if (!attempt) throw new ApiError(404, 'not_found', 'Percobaan kuis tidak ditemukan.')
    return Response.json({ attempt })
  } catch (err) {
    return errorResponse(err)
  }
}
