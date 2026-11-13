// MikuAI — GET /api/lessons/[id]
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { getLesson } from '@/lib/data/lessons'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const lesson = await getLesson(user.id, id)
    if (!lesson) throw new ApiError(404, 'not_found', 'Pelajaran tidak ditemukan.')
    return Response.json({ lesson })
  } catch (err) {
    return errorResponse(err)
  }
}
