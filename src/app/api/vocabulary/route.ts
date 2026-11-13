// MikuAI — GET (list+filters) / POST (save) /api/vocabulary
import { NextRequest } from 'next/server'
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { vocabularySaveSchema } from '@/lib/validation'
import { listVocabulary, saveVocabulary } from '@/lib/data/vocabulary'
import { recordActivity } from '@/lib/data/activity'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const result = await listVocabulary(user.id, {
      page: Number(url.searchParams.get('page') ?? 1),
      limit: Number(url.searchParams.get('limit') ?? 30),
      search: url.searchParams.get('search') ?? undefined,
      language: url.searchParams.get('language') ?? undefined,
      category: url.searchParams.get('category') ?? undefined,
      dueOnly: url.searchParams.get('due') === 'true',
    })
    return Response.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = vocabularySaveSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      throw new ApiError(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Input tidak valid.')
    }
    const item = await saveVocabulary(user.id, parsed.data)
    await recordActivity(user.id, {
      activityType: 'vocabulary',
      title: `Menyimpan kata "${item.word}"`,
      language: item.language,
      refId: item.id,
      metadata: { source: item.source },
      durationMinutes: 1,
    }, { vocabularyCount: 1, studyMinutes: 1 })
    return Response.json({ item }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
