// MikuAI — POST /api/vocabulary/review — flashcard/SRS review outcome
import { NextRequest } from 'next/server'
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { vocabularyReviewSchema } from '@/lib/validation'
import { recordReview } from '@/lib/data/vocabulary'
import { recordActivity } from '@/lib/data/activity'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = vocabularyReviewSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      throw new ApiError(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Input tidak valid.')
    }
    const item = await recordReview(user.id, parsed.data.vocabularyId, parsed.data.correct)
    if (!item) throw new ApiError(404, 'not_found', 'Kosakata tidak ditemukan.')
    await recordActivity(user.id, {
      activityType: 'vocabulary',
      title: `Review kosakata "${item.word}" — ${parsed.data.correct ? 'benar' : 'salah'}`,
      language: item.language,
      refId: item.id,
      durationMinutes: 1,
    }, { studyMinutes: 1 })
    return Response.json({ item })
  } catch (err) {
    return errorResponse(err)
  }
}
