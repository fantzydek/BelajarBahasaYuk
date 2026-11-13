// MikuAI — POST /api/lessons/progress — mark lesson completed
import { NextRequest } from 'next/server'
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { lessonCompleteSchema } from '@/lib/validation'
import { completeLesson, getLesson } from '@/lib/data/lessons'
import { recordActivity } from '@/lib/data/activity'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = lessonCompleteSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      throw new ApiError(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Input tidak valid.')
    }
    const lesson = await getLesson(user.id, parsed.data.lessonId)
    if (!lesson) throw new ApiError(404, 'not_found', 'Pelajaran tidak ditemukan.')

    const { alreadyCompleted } = await completeLesson(user.id, parsed.data.lessonId, parsed.data.score ?? null, recordActivity)

    if (!alreadyCompleted) {
      await recordActivity(user.id, {
        activityType: 'lesson',
        title: `Menyelesaikan pelajaran: ${lesson.title}`,
        language: lesson.language,
        refId: lesson.id,
        metadata: { level: lesson.level, category: lesson.category },
        durationMinutes: 10,
      }, { lessonsCompleted: 1, studyMinutes: 10 })
    }
    return Response.json({ ok: true, alreadyCompleted })
  } catch (err) {
    return errorResponse(err)
  }
}
