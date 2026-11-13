// MikuAI — POST /api/ai/lesson — generate a structured lesson with Grok and
// save it to the lessons table (visible to the generating user + admins).
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { lessonGenerateSchema } from '@/lib/validation'
import { assertAiAvailable } from '@/lib/ai'
import { aiStructured } from '@/lib/ai/structured'
import { lessonPrompt } from '@/lib/ai/prompts'
import { enforceAiRateLimit, failAiAttempt, beginAiAttempt, parseBody } from '@/lib/ai/route-helpers'
import { logAiUsage } from '@/lib/ai/usage'
import { saveLesson } from '@/lib/data/lessons'
import { recordActivity } from '@/lib/data/activity'
import type { LessonSection } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 180

const sectionSchema = z.object({
  type: z.unknown().optional(),
  heading: z.unknown().optional(),
  body: z.unknown().optional(),
  items: z.unknown().optional(),
  lines: z.unknown().optional(),
  instructions: z.unknown().optional(),
  translation: z.unknown().optional(),
  questions: z.unknown().optional(),
})

const lessonOutputSchema = z.object({
  title: z.string().min(1),
  summary: z.unknown().optional(),
  sections: z.array(sectionSchema).min(1),
})

/** Coerce any plausible AI section shape into a canonical LessonSection. */
function normalizeSection(raw: unknown): LessonSection | null {
  const obj = (raw ?? {}) as Record<string, unknown>
  const heading = String(obj.heading ?? '')
  const type = String(obj.type ?? '').toLowerCase()

  const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

  switch (type) {
    case 'explanation':
    case 'text':
    case 'note':
      return { type: 'explanation', heading, body: str(obj.body ?? obj.content ?? obj.text) }

    case 'vocabulary': {
      const items = (Array.isArray(obj.items) ? obj.items : []).map((it) => {
        if (typeof it === 'string') return { word: it, translation: '' }
        const o = (it ?? {}) as Record<string, unknown>
        return {
          word: str(o.word ?? o.term ?? o.phrase),
          translation: str(o.translation ?? o.meaning ?? o.definition),
          example: o.example !== undefined ? str(o.example) : undefined,
        }
      }).filter((i) => i.word)
      return { type: 'vocabulary', heading, items }
    }

    case 'examples':
    case 'example': {
      const items = (Array.isArray(obj.items) ? obj.items : []).map((it) => {
        if (typeof it === 'string') return { source: it, translation: '' }
        const o = (it ?? {}) as Record<string, unknown>
        return {
          source: str(o.source ?? o.text ?? o.sentence ?? o.phrase),
          translation: str(o.translation ?? o.meaning),
        }
      }).filter((i) => i.source)
      return { type: 'examples', heading, items }
    }

    case 'dialog':
    case 'conversation': {
      const lines = (Array.isArray(obj.lines) ? obj.lines : Array.isArray(obj.items) ? obj.items : []).map((ln) => {
        if (typeof ln === 'string') return { speaker: '', text: ln, translation: '' }
        const o = (ln ?? {}) as Record<string, unknown>
        return {
          speaker: str(o.speaker ?? o.who ?? o.person),
          text: str(o.text ?? o.line ?? o.sentence),
          translation: str(o.translation ?? o.meaning),
        }
      }).filter((l) => l.text)
      return { type: 'dialog', heading, lines }
    }

    case 'reading': {
      const questions = (Array.isArray(obj.questions) ? obj.questions : []).map((q) =>
        typeof q === 'string' ? q : str((q as Record<string, unknown>)?.text ?? (q as Record<string, unknown>)?.question),
      ).filter(Boolean)
      return {
        type: 'reading',
        heading,
        body: str(obj.body ?? obj.text ?? obj.content),
        translation: str(obj.translation),
        questions: questions.length ? questions : undefined,
      }
    }

    case 'exercise':
    case 'practice': {
      const items = (Array.isArray(obj.items) ? obj.items : []).map((it) =>
        typeof it === 'string' ? it : str((it as Record<string, unknown>)?.task ?? (it as Record<string, unknown>)?.question ?? (it as Record<string, unknown>)?.text),
      ).filter(Boolean)
      return { type: 'exercise', heading, instructions: str(obj.instructions ?? obj.direction), items }
    }

    default:
      // Unknown section type: render as explanation so no content is lost.
      if (obj.body || obj.content || obj.text) {
        return { type: 'explanation', heading: heading || 'Materi', body: str(obj.body ?? obj.content ?? obj.text) }
      }
      return null
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  let ctx: ReturnType<typeof beginAiAttempt> | null = null
  try {
    const user = await requireUser()
    const body = await parseBody(req, lessonGenerateSchema)
    enforceAiRateLimit(user, 'lesson')

    const { provider, model } = assertAiAvailable()
    ctx = beginAiAttempt(user, 'lesson', provider, model)

    const { data: parsed, usage } = await aiStructured(
      {
        messages: [
          { role: 'system', content: lessonPrompt(body.language, body.level, body.category, body.topic ?? null) },
          { role: 'user', content: 'Buat pelajarannya sekarang.' },
        ],
        maxTokens: 4096,
        temperature: 0.7,
      },
      lessonOutputSchema,
    )
    const sections = parsed.sections.map(normalizeSection).filter((s): s is LessonSection => s !== null)

    if (sections.length === 0) {
      throw Object.assign(new Error('Struktur pelajaran kosong.'), { code: 'ai_output_invalid' })
    }

    const lesson = await saveLesson(user.id, {
      language: body.language,
      level: body.level,
      category: body.category as Parameters<typeof saveLesson>[1]['category'],
      title: parsed.title,
      slug: `${body.language}-${body.level}-${body.category}-ai`.toLowerCase().replace(/\s+/g, '-'),
      summary: parsed.summary ? String(parsed.summary) : null,
      sections,
      isPublic: false,
    })

    await logAiUsage({
      userId: user.id,
      feature: 'lesson',
      provider: ctx.provider,
      model: ctx.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      durationMs: Date.now() - startedAt,
      status: 'success',
    })

    await recordActivity(user.id, {
      activityType: 'lesson',
      title: `Pelajaran AI dibuat: ${parsed.title}`,
      language: body.language,
      refId: lesson.id,
      metadata: { generated: true, level: body.level },
      durationMinutes: 1,
    })

    return Response.json({ lesson })
  } catch (err) {
    if (ctx) return failAiAttempt(ctx, err, startedAt)
    return errorResponse(err)
  }
}
