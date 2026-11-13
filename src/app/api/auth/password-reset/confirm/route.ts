// MikuAI — POST /api/auth/password-reset/confirm — complete reset with token
// (local driver flow; Supabase flow completes via the emailed link session).
import { NextRequest } from 'next/server'
import { errorResponse, ApiError } from '@/lib/auth/guard'
import { passwordResetConfirmSchema } from '@/lib/validation'
import { confirmPasswordReset } from '@/lib/data/profile'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const parsed = passwordResetConfirmSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      throw new ApiError(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Input tidak valid.')
    }
    const result = await confirmPasswordReset(parsed.data.token, parsed.data.password)
    if (!result.ok) throw new ApiError(400, 'reset_failed', result.error ?? 'Reset gagal.')
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
