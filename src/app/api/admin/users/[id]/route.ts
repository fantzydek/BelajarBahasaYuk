// MikuAI — PATCH /api/admin/users/[id] — change user role (admin only, server-enforced)
import { NextRequest } from 'next/server'
import { requireAdmin, errorResponse, ApiError } from '@/lib/auth/guard'
import { adminRoleSchema } from '@/lib/validation'
import { adminSetRole } from '@/lib/data/profile'
import { getCurrentUser } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const parsed = adminRoleSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      throw new ApiError(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Input tidak valid.')
    }
    if (parsed.data.userId === admin.id && parsed.data.role !== 'admin') {
      throw new ApiError(400, 'self_demote', 'Anda tidak dapat menurunkan role akun sendiri.')
    }
    await adminSetRole(admin.id, parsed.data.userId, parsed.data.role)
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
