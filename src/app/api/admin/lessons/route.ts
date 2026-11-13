// MikuAI — GET / POST / PATCH / DELETE /api/admin/lessons — content management (admin only)
import { NextRequest } from 'next/server'
import { requireAdmin, errorResponse, ApiError } from '@/lib/auth/guard'
import { adminLessonUpsertSchema } from '@/lib/validation'
import { adminListLessons, adminUpsertLesson, adminDeleteLesson } from '@/lib/data/lessons'
import type { LessonSection } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireAdmin()
    const lessons = await adminListLessons()
    return Response.json({ lessons })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const parsed = adminLessonUpsertSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      throw new ApiError(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Input tidak valid.')
    }
    await adminUpsertLesson({
      ...parsed.data,
      sections: parsed.data.sections as unknown as LessonSection[] | undefined,
    })
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin()
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) throw new ApiError(400, 'validation_error', 'Parameter id wajib diisi.')
    await adminDeleteLesson(id)
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
