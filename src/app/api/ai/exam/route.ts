// MikuAI — POST /api/ai/exam — generate a timed exam (mixed question types)
// with Grok, persist as quiz_attempt(mode='exam') + quiz_questions.
// Correct answers are never exposed to the client before submission.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { examGenerateSchema } from '@/lib/validation'
import { assertAiAvailable } from '@/lib/ai'
import { aiStructured } from '@/lib/ai/structured'
import { examPrompt } from '@/lib/ai/prompts'
import { enforceAiRateLimit, failAiAttempt, beginAiAttempt, parseBody } from '@/lib/ai/route-helpers'
import { logAiUsage } from '@/lib/ai/usage'
import { createAttempt } from '@/lib/data/quizzes'
import { normalizeQuestions, type RawAiQuestion } from '@/lib/ai/normalize-questions'

export const runtime = 'nodejs'
export const maxDuration = 180

// questionType is widened to string: models sometimes emit "reading",
// "true_false", etc. normalizeQuestions maps them to the three concrete types.
const examOutputSchema = z.object({
  questions: z
    .array(
      z.object({
        questionType: z.string().default('multiple_choice'),
        question: z.string().min(1),
        options: z.array(z.string()).default([]),
        correctAnswer: z.string().min(1),
        explanation: z.string().default(''),
        topic: z.string().default('umum'),
      }),
    )
    .min(1),
})

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  let ctx: ReturnType<typeof beginAiAttempt> | null = null
  try {
    const user = await requireUser()
    const body = await parseBody(req, examGenerateSchema)
    enforceAiRateLimit(user, 'exam')

    const { provider, model } = assertAiAvailable()
    ctx = beginAiAttempt(user, 'exam', provider, model)

    const { data: parsed, usage } = await aiStructured(
      {
        messages: [
          { role: 'system', content: examPrompt(body.language, body.level, body.topic ?? null, body.count) },
          { role: 'user', content: `Buat ${body.count} soal ujian sekarang.` },
        ],
        maxTokens: 8192,
        temperature: 0.75,
      },
      examOutputSchema,
    )

    // Normalize + hard-validate each question before persisting (repairs
    // odd types like "reading" and letter answers like "b").
    const questions = normalizeQuestions(parsed.questions as RawAiQuestion[], body.count)

    if (questions.length < Math.min(5, body.count)) {
      throw Object.assign(new Error('Struktur soal ujian tidak lengkap.'), { code: 'ai_output_invalid' })
    }

    const attempt = await createAttempt(user.id, {
      language: body.language,
      level: body.level,
      quizType: 'exam',
      topic: body.topic ?? null,
      questions,
      mode: 'exam',
      timeLimitSeconds: body.timeLimitMinutes * 60,
    })

    await logAiUsage({
      userId: user.id,
      feature: 'exam',
      provider: ctx.provider,
      model: ctx.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      durationMs: Date.now() - startedAt,
      status: 'success',
    })

    return Response.json({ attempt })
  } catch (err) {
    if (ctx) return failAiAttempt(ctx, err, startedAt)
    return errorResponse(err)
  }
}
