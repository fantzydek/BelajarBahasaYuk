// MikuAI — Shared helpers for AI route handlers: input parsing, per-user
// throttling, duplicate-submission guard, friendly errors, usage logging.
import { NextRequest, NextResponse } from 'next/server'
import { ZodSchema } from 'zod'
import { createHash } from 'crypto'
import { ApiError, errorResponse } from '@/lib/auth/guard'
import type { SessionUser } from '@/lib/types'
import { checkRateLimit, isDuplicateSubmission } from './rate-limit'
import { logAiUsage } from './usage'

export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    throw new ApiError(400, 'invalid_json', 'Format permintaan tidak valid.')
  }
  const result = schema.safeParse(json)
  if (!result.success) {
    const first = result.error.issues[0]
    throw new ApiError(400, 'validation_error', first?.message ?? 'Input tidak valid.')
  }
  return result.data
}

const AI_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  tutor: { limit: 20, windowMs: 60_000 },
  translate: { limit: 15, windowMs: 60_000 },
  grammar: { limit: 15, windowMs: 60_000 },
  vocabulary: { limit: 20, windowMs: 60_000 },
  quiz: { limit: 8, windowMs: 60_000 },
  exam: { limit: 5, windowMs: 60_000 },
  assignment: { limit: 10, windowMs: 60_000 },
  assignment_grade: { limit: 10, windowMs: 60_000 },
  lesson: { limit: 8, windowMs: 60_000 },
  recommend: { limit: 10, windowMs: 60_000 },
}

/** Throws 429 ApiError when the user exceeds the endpoint quota. */
export function enforceAiRateLimit(user: SessionUser, feature: string, payload?: unknown): void {
  const cfg = AI_LIMITS[feature] ?? { limit: 10, windowMs: 60_000 }
  const rl = checkRateLimit(`ai:${feature}:${user.id}`, cfg.limit, cfg.windowMs)
  if (!rl.allowed) {
    throw new ApiError(
      429,
      'rate_limited',
      `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfterSeconds} detik.`,
    )
  }
  if (payload !== undefined) {
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32)
    if (isDuplicateSubmission(user.id, feature, hash)) {
      throw new ApiError(429, 'duplicate_request', 'Permintaan yang sama sedang diproses. Tunggu sebentar.')
    }
  }
}

const FRIENDLY_ERRORS: Record<string, string> = {
  ai_unconfigured: 'Layanan AI belum dikonfigurasi. Admin perlu mengisi XAI_API_KEY pada environment server.',
  ai_rate_limited: 'Layanan AI sedang sibuk. Silakan coba lagi beberapa saat lagi.',
  ai_timeout: 'Layanan AI lambat merespons. Silakan coba lagi.',
  ai_network: 'Tidak dapat menghubungi layanan AI. Periksa koneksi server atau konfigurasi API.',
  ai_output_invalid: 'Respons AI tidak dapat diproses. Silakan coba lagi.',
  ai_empty: 'Respons AI kosong. Silakan coba lagi.',
}

export function friendlyAiMessage(err: unknown): string {
  const code = (err as { code?: string })?.code
  if (code && FRIENDLY_ERRORS[code]) return FRIENDLY_ERRORS[code]
  const msg = err instanceof Error ? err.message : ''
  if (msg.includes('rate limit') || msg.includes('Rate limit')) return FRIENDLY_ERRORS.ai_rate_limited
  return 'Layanan AI sedang mengalami gangguan. Silakan coba lagi nanti.'
}

export interface AiAttemptContext {
  user: SessionUser
  feature: string
  provider: string
  model: string
}

export function beginAiAttempt(user: SessionUser, feature: string, provider: string, model: string): AiAttemptContext {
  return { user, feature, provider, model }
}

/** Log success/failure for an AI attempt; returns the friendly error response. */
export async function failAiAttempt(
  ctx: AiAttemptContext,
  err: unknown,
  startedAt: number,
): Promise<NextResponse> {
  const code = (err as { code?: string })?.code ?? 'ai_error'
  const status = code === 'ai_unconfigured' ? 503 : (err as { status?: number })?.status ?? 502
  await logAiUsage({
    userId: ctx.user.id,
    feature: ctx.feature,
    provider: ctx.provider,
    model: ctx.model,
    durationMs: Date.now() - startedAt,
    status: 'error',
    errorCode: code,
    errorMessage: err instanceof Error ? err.message : String(err),
  })
  return NextResponse.json({ error: friendlyAiMessage(err), code }, { status })
}

export { errorResponse }
