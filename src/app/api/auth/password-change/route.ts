// MikuAI — POST /api/auth/password-change — change password while signed in
import { NextRequest } from 'next/server'
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { passwordChangeSchema } from '@/lib/validation'
import { changePassword } from '@/lib/data/profile'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = passwordChangeSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      throw new ApiError(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Input tidak valid.')
    }
    const result = await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword)
    if (!result.ok) throw new ApiError(400, 'password_change_failed', result.error ?? 'Gagal mengubah kata sandi.')
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
