// MikuAI — GET (list) / POST (create) /api/sessions
import { NextRequest } from 'next/server'
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { sessionCreateSchema } from '@/lib/validation'
import { listSessions, createSession } from '@/lib/data/chat'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 100)))
    const items = await listSessions(user.id, limit)
    return Response.json({ items })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = sessionCreateSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      throw new ApiError(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Input tidak valid.')
    }
    const session = await createSession(user.id, parsed.data)
    return Response.json({ session }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
