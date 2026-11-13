// MikuAI — PATCH / DELETE /api/vocabulary/[id]
import { NextRequest } from 'next/server'
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { vocabularyUpdateSchema } from '@/lib/validation'
import { updateVocabulary, deleteVocabulary } from '@/lib/data/vocabulary'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser()
    const { id } = await params
    const parsed = vocabularyUpdateSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      throw new ApiError(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Input tidak valid.')
    }
    await updateVocabulary(user.id, id, parsed.data)
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser()
    const { id } = await params
    await deleteVocabulary(user.id, id)
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
