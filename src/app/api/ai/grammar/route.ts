// MikuAI — POST /api/ai/grammar — grammar check & explanations.
import { NextRequest } from 'next/server'
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { grammarSchema } from '@/lib/validation'
import { assertAiAvailable, aiComplete } from '@/lib/ai'
import { grammarAssistantPrompt, levelText } from '@/lib/ai/prompts'
import { enforceAiRateLimit, failAiAttempt, beginAiAttempt, parseBody } from '@/lib/ai/route-helpers'
import { logAiUsage } from '@/lib/ai/usage'
import { recordActivity } from '@/lib/data/activity'
import type { Level } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  let ctx: ReturnType<typeof beginAiAttempt> | null = null
  try {
    const user = await requireUser()
    const body = await parseBody(req, grammarSchema)
    enforceAiRateLimit(user, 'grammar')

    const { provider, model } = assertAiAvailable()
    ctx = beginAiAttempt(user, 'grammar', provider, model)

    const res = await aiComplete({
      messages: [
        {
          role: 'system',
          content: `${grammarAssistantPrompt}\nBahasa target pengguna: ${body.language}. Level: ${levelText((user.level ?? 'beginner') as Level)}.`,
        },
        { role: 'user', content: body.text },
      ],
      maxTokens: 2048,
      temperature: 0.4,
    })

    await logAiUsage({
      userId: user.id,
      feature: 'grammar',
      provider: ctx.provider,
      model: ctx.model,
      promptTokens: res.usage.promptTokens,
      completionTokens: res.usage.completionTokens,
      totalTokens: res.usage.totalTokens,
      durationMs: Date.now() - startedAt,
      status: 'success',
    })

    await recordActivity(user.id, {
      activityType: 'tutor',
      title: `Koreksi tata bahasa (${body.language})`,
      description: body.text.slice(0, 80),
      language: body.language,
      durationMinutes: 1,
    }, { studyMinutes: 1 })

    return Response.json({ content: res.content, provider: ctx.provider, model: ctx.model })
  } catch (err) {
    if (ctx) return failAiAttempt(ctx, err, startedAt)
    return errorResponse(err)
  }
}
