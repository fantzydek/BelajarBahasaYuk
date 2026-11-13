// MikuAI — POST /api/ai/quiz — generate a validated quiz with Grok, persist
// as quiz_attempt + quiz_questions. Answers are never exposed to the client
// before submission.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { quizGenerateSchema } from '@/lib/validation'
import { assertAiAvailable } from '@/lib/ai'
import { aiStructured } from '@/lib/ai/structured'
import { quizPrompt } from '@/lib/ai/prompts'
import { enforceAiRateLimit, failAiAttempt, beginAiAttempt, parseBody } from '@/lib/ai/route-helpers'
import { logAiUsage } from '@/lib/ai/usage'
import { createAttempt } from '@/lib/data/quizzes'
import { normalizeQuestions, type RawAiQuestion } from '@/lib/ai/normalize-questions'

export const runtime = 'nodejs'
export const maxDuration = 180

// questionType widened to string; concrete types enforced by normalizeQuestions.
const quizOutputSchema = z.object({
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
    const body = await parseBody(req, quizGenerateSchema)
    enforceAiRateLimit(user, 'quiz')

    const { provider, model } = assertAiAvailable()
    ctx = beginAiAttempt(user, 'quiz', provider, model)

    const { data: parsed, usage } = await aiStructured(
      {
        messages: [
          { role: 'system', content: quizPrompt(body.language, body.level, body.quizType, body.topic ?? null, body.count) },
          { role: 'user', content: `Buat ${body.count} soal sekarang.` },
        ],
        maxTokens: 4096,
        temperature: 0.8,
      },
      quizOutputSchema,
    )

    // Normalize + hard-validate each question before persisting. When the
    // requested quiz type is concrete it wins over the model's classification.
    const concreteTypes = new Set(['multiple_choice', 'fill_blank', 'sentence_arrangement'])
    const questions = normalizeQuestions(
      (parsed.questions as RawAiQuestion[]).map((q) =>
        concreteTypes.has(body.quizType) ? { ...q, questionType: body.quizType } : q,
      ),
      body.count,
    )

    if (questions.length === 0) {
      throw Object.assign(new Error('Struktur soal tidak lengkap.'), { code: 'ai_output_invalid' })
    }

    const attempt = await createAttempt(user.id, {
      language: body.language,
      level: body.level,
      quizType: body.quizType,
      topic: body.topic ?? null,
      questions,
    })

    await logAiUsage({
      userId: user.id,
      feature: 'quiz',
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
