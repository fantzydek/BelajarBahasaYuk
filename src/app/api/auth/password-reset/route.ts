// MikuAI — POST /api/auth/password-reset — request a reset
// Supabase mode: sends the reset email via Supabase Auth.
// Local mode: returns the token directly (no mail service in sandbox).
import { NextRequest } from 'next/server'
import { errorResponse, ApiError } from '@/lib/auth/guard'
import { checkRateLimit } from '@/lib/ai/rate-limit'
import { passwordResetRequestSchema } from '@/lib/validation'
import { requestPasswordReset } from '@/lib/data/profile'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const parsed = passwordResetRequestSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      throw new ApiError(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Input tidak valid.')
    }
    const result = await requestPasswordReset(parsed.data.email)
    if (!result.ok) throw new ApiError(400, 'reset_failed', result.error ?? 'Gagal memproses reset.')
    return Response.json({ ok: true, token: result.token ?? undefined })
  } catch (err) {
    return errorResponse(err)
  }
}
