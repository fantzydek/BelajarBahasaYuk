// MikuAI — POST /api/ai/assignment — AI generates a writing assignment brief
// (title, prompt, instructions, word range, rubric criteria) and persists it.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { assignmentCreateSchema } from '@/lib/validation'
import { assertAiAvailable } from '@/lib/ai'
import { aiStructured } from '@/lib/ai/structured'
import { assignmentPrompt } from '@/lib/ai/prompts'
import { enforceAiRateLimit, failAiAttempt, beginAiAttempt, parseBody } from '@/lib/ai/route-helpers'
import { logAiUsage } from '@/lib/ai/usage'
import { createAssignment } from '@/lib/data/assignments'

export const runtime = 'nodejs'
export const maxDuration = 180

const assignmentOutputSchema = z.object({
  title: z.string().min(1).max(200),
  prompt: z.string().min(1).max(2000),
  instructions: z.string().max(2000).default(''),
  minWords: z.number().int().min(20).max(500).catch(60),
  maxWords: z.number().int().min(40).max(800).catch(150),
  criteria: z.array(z.string().min(1).max(160)).max(6).default([]),
})

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  let ctx: ReturnType<typeof beginAiAttempt> | null = null
  try {
    const user = await requireUser()
    const body = await parseBody(req, assignmentCreateSchema)
    enforceAiRateLimit(user, 'assignment')

    const { provider, model } = assertAiAvailable()
    ctx = beginAiAttempt(user, 'assignment', provider, model)

    const { data: parsed, usage } = await aiStructured(
      {
        messages: [
          { role: 'system', content: assignmentPrompt(body.language, body.level, body.topic ?? null) },
          { role: 'user', content: 'Buat satu tugas menulis sekarang.' },
        ],
        maxTokens: 1500,
        temperature: 0.8,
      },
      assignmentOutputSchema,
    )

    const minWords = Math.max(20, Math.min(500, parsed.minWords))
    const maxWords = Math.max(minWords + 10, Math.min(800, parsed.maxWords))

    const assignment = await createAssignment(user.id, {
      language: body.language,
      level: body.level,
      topic: body.topic ?? null,
      title: parsed.title.trim(),
      prompt: parsed.prompt.trim(),
      instructions: parsed.instructions.trim() || null,
      minWords,
      maxWords,
      criteria: parsed.criteria.map((c) => c.trim()).filter(Boolean).slice(0, 6),
    })

    await logAiUsage({
      userId: user.id,
      feature: 'assignment',
      provider: ctx.provider,
      model: ctx.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      durationMs: Date.now() - startedAt,
      status: 'success',
    })

    return Response.json({ assignment })
  } catch (err) {
    if (ctx) return failAiAttempt(ctx, err, startedAt)
    return errorResponse(err)
  }
}
