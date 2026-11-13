// MikuAI — GET /api/sessions/[id]/messages
import { NextRequest } from 'next/server'
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { getSession, listMessages } from '@/lib/data/chat'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser()
    const { id } = await params
    const session = await getSession(user.id, id)
    if (!session) throw new ApiError(404, 'not_found', 'Sesi tidak ditemukan.')
    const url = new URL(req.url)
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 200)))
    const before = url.searchParams.get('before') ?? undefined
    const messages = await listMessages(user.id, id, limit, before)
    return Response.json({ messages })
  } catch (err) {
    return errorResponse(err)
  }
}
