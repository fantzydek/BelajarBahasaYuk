// MikuAI — POST /api/ai/translate — AI translation with detection, styles,
// alternatives, idiom and grammar explanations. Persists to translation_history.
import { NextRequest } from 'next/server'
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { translateSchema } from '@/lib/validation'
import { assertAiAvailable } from '@/lib/ai'
import { aiStructured } from '@/lib/ai/structured'
import { translationSystemPrompt } from '@/lib/ai/prompts'
import { enforceAiRateLimit, failAiAttempt, beginAiAttempt, parseBody } from '@/lib/ai/route-helpers'
import { z } from 'zod'
import { saveTranslation } from '@/lib/data/translations'
import { recordActivity } from '@/lib/data/activity'

export const runtime = 'nodejs'
export const maxDuration = 120

const translationOutputSchema = z.object({
  detected: z.string().default(''),
  translation: z.string().min(1),
  alternatives: z.array(z.string()).max(5).default([]),
  explanation: z.string().default(''),
  grammar_notes: z.string().default(''),
  idioms: z
    .array(z.object({ idiom: z.string(), meaning: z.string() }))
    .max(10)
    .default([]),
})

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  let ctx: ReturnType<typeof beginAiAttempt> | null = null
  try {
    const user = await requireUser()
    const body = await parseBody(req, translateSchema)
    enforceAiRateLimit(user, 'translate', body)

    const { provider, model } = assertAiAvailable()
    ctx = beginAiAttempt(user, 'translate', provider, model)

    const sourceNote =
      body.sourceLanguage === 'auto'
        ? 'Deteksi bahasa sumber secara otomatis dari teks pengguna.'
        : `Bahasa sumber: ${body.sourceLanguage}.`

    const { data: parsed, usage } = await aiStructured(
      {
        messages: [
          { role: 'system', content: translationSystemPrompt(body.style) },
          {
            role: 'user',
            content: `${sourceNote}\nBahasa target: ${body.targetLanguage}.\nTeks:\n"""${body.text}"""`,
          },
        ],
        maxTokens: 2048,
        temperature: 0.3,
      },
      translationOutputSchema,
    )

    const saved = await saveTranslation(user.id, {
      sourceLanguage: body.sourceLanguage === 'auto' ? parsed.detected || 'auto' : body.sourceLanguage,
      targetLanguage: body.targetLanguage,
      detectedSource: parsed.detected || null,
      sourceText: body.text,
      translatedText: parsed.translation,
      style: body.style,
      alternatives: parsed.alternatives,
      explanation: parsed.explanation || null,
      grammarNotes: parsed.grammar_notes || null,
      idioms: parsed.idioms,
    })

    await recordActivity(user.id, {
      activityType: 'translation',
      title: `Menerjemahkan: ${body.text.slice(0, 60)}`,
      description: `${parsed.detected || body.sourceLanguage} → ${body.targetLanguage} (gaya ${body.style})`,
      language: body.targetLanguage,
      refId: saved.id,
      durationMinutes: 1,
    }, { studyMinutes: 1 })

    await import('@/lib/ai/usage').then((m) =>
      m.logAiUsage({
        userId: user.id,
        feature: 'translate',
        provider: ctx!.provider,
        model: ctx!.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        durationMs: Date.now() - startedAt,
        status: 'success',
      }),
    )

    return Response.json({ result: saved })
  } catch (err) {
    if (ctx) return failAiAttempt(ctx, err, startedAt)
    return errorResponse(err)
  }
}
