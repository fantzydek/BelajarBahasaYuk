// MikuAI — GET detail / DELETE /api/history/[id]
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { getHistoryItem, deleteHistoryItem } from '@/lib/data/history'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser()
    const { id } = await params
    const item = await getHistoryItem(user.id, id)
    if (!item) throw new ApiError(404, 'not_found', 'Aktivitas tidak ditemukan.')
    return Response.json({ item })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser()
    const { id } = await params
    await deleteHistoryItem(user.id, id)
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
