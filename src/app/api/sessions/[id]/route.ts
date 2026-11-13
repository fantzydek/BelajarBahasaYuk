// MikuAI — GET / PATCH (rename) / DELETE /api/sessions/[id]
import { NextRequest } from 'next/server'
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { sessionRenameSchema } from '@/lib/validation'
import { getSession, renameSession, deleteSession, listMessages } from '@/lib/data/chat'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser()
    const { id } = await params
    const session = await getSession(user.id, id)
    if (!session) throw new ApiError(404, 'not_found', 'Sesi tidak ditemukan.')
    const messages = await listMessages(user.id, id)
    return Response.json({ session, messages })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser()
    const { id } = await params
    const parsed = sessionRenameSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      throw new ApiError(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Input tidak valid.')
    }
    const session = await getSession(user.id, id)
    if (!session) throw new ApiError(404, 'not_found', 'Sesi tidak ditemukan.')
    await renameSession(user.id, id, parsed.data.title)
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser()
    const { id } = await params
    await deleteSession(user.id, id)
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
