// MikuAI — DELETE /api/translations/[id]
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { deleteTranslation } from '@/lib/data/translations'

export const runtime = 'nodejs'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    await deleteTranslation(user.id, id)
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
