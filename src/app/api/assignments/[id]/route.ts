// MikuAI — GET/DELETE /api/assignments/[id] — assignment detail / delete.
import { NextRequest } from 'next/server'
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { getAssignment, deleteAssignment } from '@/lib/data/assignments'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const assignment = await getAssignment(user.id, id)
    if (!assignment) throw new ApiError(404, 'not_found', 'Tugas tidak ditemukan.')
    return Response.json({ assignment })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const deleted = await deleteAssignment(user.id, id)
    if (!deleted) throw new ApiError(404, 'not_found', 'Tugas tidak ditemukan.')
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
