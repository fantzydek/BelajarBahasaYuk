// MikuAI — POST /api/quiz/attempts/[id]/submit — server-side grading
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { submitAttempt, refreshQuizAverage } from '@/lib/data/quizzes'
import { recordActivity } from '@/lib/data/activity'

export const runtime = 'nodejs'

const submitSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.string().min(1), answer: z.string().max(2000).default('') }))
    .min(1, 'Jawaban tidak boleh kosong.'),
  durationSeconds: z.number().int().min(0).max(60 * 60 * 6),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const parsed = submitSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      throw new ApiError(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Input tidak valid.')
    }
    const result = await submitAttempt(
      user.id,
      id,
      parsed.data.answers,
      parsed.data.durationSeconds,
      refreshQuizAverage,
    )
    const isExam = result.attempt.mode === 'exam'
    await recordActivity(user.id, {
      activityType: isExam ? 'exam' : 'quiz',
      title: isExam
        ? `Ujian ${result.attempt.language} — nilai ${result.score}`
        : `Kuis ${result.attempt.quizType} ${result.attempt.language} — nilai ${result.score}`,
      language: result.attempt.language,
      refId: result.attempt.id,
      metadata: {
        correct: result.correctCount,
        total: result.attempt.totalQuestions,
        weakTopics: result.weakTopics,
        ...(isExam ? { timeLimitSeconds: result.attempt.timeLimitSeconds, durationSeconds: parsed.data.durationSeconds } : {}),
      },
      durationMinutes: isExam ? Math.max(1, Math.round(parsed.data.durationSeconds / 60)) : 5,
    }, {
      quizzesTaken: 1,
      studyMinutes: isExam ? Math.max(1, Math.round(parsed.data.durationSeconds / 60)) : 5,
    })

    return Response.json({ attempt: result.attempt, correctCount: result.correctCount, score: result.score, weakTopics: result.weakTopics })
  } catch (err) {
    return errorResponse(err)
  }
}
