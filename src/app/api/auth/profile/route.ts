// MikuAI — PATCH /api/auth/profile — update own profile (server-validated)
import { NextRequest } from 'next/server'
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { profileUpdateSchema } from '@/lib/validation'
import { updateProfile } from '@/lib/data/profile'
import { getCurrentUser } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = profileUpdateSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      throw new ApiError(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Input tidak valid.')
    }
    await updateProfile(user.id, parsed.data)
    const updated = await getCurrentUser()
    return Response.json({ user: updated })
  } catch (err) {
    return errorResponse(err)
  }
}
