// MikuAI — GET /api/lessons?language=&level= — lesson list for the academy
import { NextRequest } from 'next/server'
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { listLessons, listLessonProgress } from '@/lib/data/lessons'
import type { Level } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const language = url.searchParams.get('language')
    const level = url.searchParams.get('level') as Level | null
    if (!language || !level) {
      throw new ApiError(400, 'validation_error', 'Parameter language dan level wajib diisi.')
    }
    const [items, progress] = await Promise.all([
      listLessons(language, level, user.id),
      listLessonProgress(user.id, language),
    ])
    return Response.json({ items, progress })
  } catch (err) {
    return errorResponse(err)
  }
}
