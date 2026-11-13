// MikuAI — POST /api/ai/vocabulary — vocabulary assistant: teaches a word
// (definition, translation, examples, synonyms) as structured data.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { vocabularyAiSchema } from '@/lib/validation'
import { assertAiAvailable } from '@/lib/ai'
import { aiStructured } from '@/lib/ai/structured'
import { vocabularyAssistantPrompt } from '@/lib/ai/prompts'
import { enforceAiRateLimit, failAiAttempt, beginAiAttempt, parseBody } from '@/lib/ai/route-helpers'
import { logAiUsage } from '@/lib/ai/usage'

export const runtime = 'nodejs'
export const maxDuration = 120

const vocabularyOutputSchema = z.object({
  word: z.string().min(1),
  pronunciation: z.string().default(''),
  partOfSpeech: z.string().default(''),
  translation: z.string().default(''),
  definition: z.string().default(''),
  examples: z.array(z.object({ source: z.string(), translation: z.string() })).max(5).default([]),
  synonyms: z.array(z.string()).max(10).default([]),
  category: z.string().default('general'),
})

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  let ctx: ReturnType<typeof beginAiAttempt> | null = null
  try {
    const user = await requireUser()
    const body = await parseBody(req, vocabularyAiSchema)
    enforceAiRateLimit(user, 'vocabulary')

    const { provider, model } = assertAiAvailable()
    ctx = beginAiAttempt(user, 'vocabulary', provider, model)

    const { data: parsed, usage } = await aiStructured(
      {
        messages: [
          { role: 'system', content: vocabularyAssistantPrompt },
          {
            role: 'user',
            content: `Bahasa target: ${body.language}.\nKata: ${body.word}${body.context ? `\nKonteks pemakaian: ${body.context}` : ''}`,
          },
        ],
        maxTokens: 1200,
        temperature: 0.4,
      },
      vocabularyOutputSchema,
    )

    await logAiUsage({
      userId: user.id,
      feature: 'vocabulary',
      provider: ctx.provider,
      model: ctx.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      durationMs: Date.now() - startedAt,
      status: 'success',
    })

    return Response.json({ word: parsed })
  } catch (err) {
    if (ctx) return failAiAttempt(ctx, err, startedAt)
    return errorResponse(err)
  }
}
