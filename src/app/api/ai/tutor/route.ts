// MikuAI — POST /api/ai/tutor — streaming AI tutor (SSE).
// Flow: validate → rate limit → create/find session → save user message →
// stream Grok response → persist assistant message → log usage → record activity.
import { NextRequest } from 'next/server'
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { tutorSchema } from '@/lib/validation'
import { assertAiAvailable, aiStream, aiComplete } from '@/lib/ai'
import { tutorPrompt, TUTOR_TITLE_PROMPT } from '@/lib/ai/prompts'
import { enforceAiRateLimit, parseBody } from '@/lib/ai/route-helpers'
import { logAiUsage } from '@/lib/ai/usage'
import { addMessage, createSession, getSession, recentContext, listSessions, renameSession } from '@/lib/data/chat'
import { recordActivity } from '@/lib/data/activity'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  try {
    const user = await requireUser()
    const body = await parseBody(req, tutorSchema)
    enforceAiRateLimit(user, 'tutor')

    const { provider, model } = assertAiAvailable()

    // Resolve or create the chat session (owned strictly by this user).
    let sessionId = body.sessionId ?? null
    let history: { role: 'user' | 'assistant'; content: string }[] = []
    if (sessionId) {
      const session = await getSession(user.id, sessionId)
      if (!session) {
        throw new ApiError(404, 'not_found', 'Sesi percakapan tidak ditemukan.')
      }
    } else {
      const sessions = await listSessions(user.id, 1)
      sessionId = sessions[0]?.id ?? null
    }
    if (!sessionId) {
      const created = await createSession(user.id, { language: body.language, level: body.level })
      sessionId = created.id
    } else {
      history = await recentContext(user.id, sessionId, 16)
    }

    await addMessage(user.id, sessionId, 'user', body.message)

    const messages = [
      { role: 'system' as const, content: tutorPrompt(body.language, body.level) },
      ...history,
      { role: 'user' as const, content: body.message },
    ]

    const { stream, usage, provider: actualProvider, model: actualModel } = await aiStream({ messages, maxTokens: 2048 })

    let full = ''
    let logged = false
    const finalize = async () => {
      if (logged) return
      logged = true
      try {
        if (full.trim()) {
          await addMessage(user.id, sessionId!, 'assistant', full, usage.completionTokens)
        }
      } catch (e) {
        console.error('[tutor] failed to persist assistant message:', e instanceof Error ? e.message : e)
      }
      await logAiUsage({
        userId: user.id,
        feature: 'tutor',
        provider: actualProvider,
        model: actualModel,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        durationMs: Date.now() - startedAt,
        status: 'success',
      })
      await recordActivity(user.id, {
        activityType: 'tutor',
        title: `Sesi AI Tutor: ${body.message.slice(0, 60)}`,
        language: body.language,
        refId: sessionId,
        metadata: { level: body.level },
        durationMinutes: 2,
      }, { studyMinutes: 2 })

      // Auto-title brand-new conversations (best effort).
      try {
        const session = await getSession(user.id, sessionId!)
        if (session && session.title === 'Percakapan baru') {
          const res = await aiComplete({
            messages: [
              { role: 'system', content: TUTOR_TITLE_PROMPT },
              { role: 'user', content: body.message.slice(0, 500) },
            ],
            maxTokens: 40,
            temperature: 0.4,
          })
          const title = res.content.trim().replace(/^["']|["']$/g, '').slice(0, 80)
          if (title) await renameSession(user.id, sessionId!, title)
        }
      } catch {
        /* best effort */
      }
    }

    const encoder = new TextEncoder()
    const sse = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }
        send('meta', { sessionId, provider: actualProvider, model: actualModel })
        try {
          const reader = stream.getReader()
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) {
              full += value
              send('delta', { text: value })
            }
          }
          await finalize()
          send('done', { sessionId })
        } catch (e) {
          const code = (e as { code?: string }).code ?? 'ai_error'
          await logAiUsage({
            userId: user.id,
            feature: 'tutor',
            provider: actualProvider,
            model: actualModel,
            durationMs: Date.now() - startedAt,
            status: 'error',
            errorCode: code,
            errorMessage: e instanceof Error ? e.message : String(e),
          })
          send('error', { message: (e as Error).message || 'Layanan AI terganggu.', code })
        } finally {
          controller.close()
        }
      },
      cancel() {
        void finalize()
      },
    })

    return new Response(sse, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
}
