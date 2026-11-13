// MikuAI — Lessons & lesson progress data access (Supabase / local).
import { db } from '@/lib/db'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { LessonCategory, LessonDTO, LessonProgressDTO, LessonSection, Level } from '@/lib/types'

function mapRow(r: Record<string, unknown>): LessonDTO {
  let sections: LessonSection[] = []
  const raw = r.content
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    sections = (parsed?.sections as LessonSection[]) ?? []
  } catch {
    sections = []
  }
  return {
    id: String(r.id),
    language: String(r.language ?? ''),
    level: (r.level as Level) ?? 'beginner',
    category: (r.category as LessonCategory) ?? 'vocabulary',
    title: String(r.title ?? ''),
    slug: String(r.slug ?? ''),
    summary: (r.summary as string) ?? null,
    sections,
    orderIndex: Number(r.order_index ?? r.orderIndex ?? 0),
    isPublic: Boolean(r.is_public ?? r.isPublic ?? true),
    createdBy: (r.created_by ?? r.createdBy) as string | null,
    createdAt: new Date(String(r.created_at ?? r.createdAt)).toISOString(),
  }
}

export async function listLessons(
  language: string,
  level: Level,
  userId?: string,
): Promise<LessonDTO[]> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      ?.from('lessons')
      .select('*')
      .eq('language', language)
      .eq('level', level)
      .order('order_index', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
  }
  const rows = await db.lesson.findMany({
    where: {
      language,
      level,
      OR: [{ isPublic: true }, ...(userId ? [{ createdBy: userId }] : [])],
    },
    orderBy: { orderIndex: 'asc' },
  })
  return rows.map((r) => mapRow(r as unknown as Record<string, unknown>))
}

export async function getLesson(userId: string | null, lessonId: string): Promise<LessonDTO | null> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data } = await supabase?.from('lessons').select('*').eq('id', lessonId).single()
    if (!data) return null
    const lesson = mapRow(data as Record<string, unknown>)
    if (!lesson.isPublic && lesson.createdBy !== userId) return null
    return lesson
  }
  const row = await db.lesson.findUnique({ where: { id: lessonId } })
  if (!row) return null
  if (!row.isPublic && row.createdBy !== userId) return null
  return mapRow(row as unknown as Record<string, unknown>)
}

export async function saveLesson(
  userId: string,
  input: { language: string; level: Level; category: LessonCategory; title: string; slug: string; summary?: string | null; sections: LessonSection[]; isPublic?: boolean },
): Promise<LessonDTO> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      ?.from('lessons')
      .insert({
        user_id_note: undefined,
        created_by: userId,
        language: input.language,
        level: input.level,
        category: input.category,
        title: input.title,
        slug: `${input.slug}-${Date.now().toString(36)}`,
        summary: input.summary ?? null,
        content: { sections: input.sections },
        is_public: input.isPublic ?? false,
        order_index: 100,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return mapRow(data as Record<string, unknown>)
  }
  const row = await db.lesson.create({
    data: {
      createdBy: userId,
      language: input.language,
      level: input.level,
      category: input.category,
      title: input.title,
      slug: `${input.slug}-${Date.now().toString(36)}`,
      summary: input.summary ?? null,
      content: JSON.stringify({ sections: input.sections }),
      isPublic: input.isPublic ?? false,
      orderIndex: 100,
    },
  })
  return mapRow(row as unknown as Record<string, unknown>)
}

export async function listLessonProgress(userId: string, language?: string): Promise<LessonProgressDTO[]> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    let query = supabase?.from('lesson_progress').select('*, lessons!inner(language)').eq('user_id', userId)
    if (language) query = query?.eq('lessons.language', language)
    const { data } = await query
    return (data ?? []).map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: String(row.id),
        lessonId: String(row.lesson_id),
        status: row.status as LessonProgressDTO['status'],
        score: (row.score as number) ?? null,
        completedAt: new Date(String(row.completed_at ?? row.created_at)).toISOString(),
      }
    })
  }
  const rows = await db.lessonProgress.findMany({
    where: { userId, ...(language ? { lesson: { language } } : {}) },
  })
  return rows.map((r) => ({
    id: r.id,
    lessonId: r.lessonId,
    status: r.status as LessonProgressDTO['status'],
    score: r.score,
    completedAt: r.completedAt.toISOString(),
  }))
}

export async function completeLesson(
  userId: string,
  lessonId: string,
  score: number | null,
  recordFn: (input: Parameters<typeof import('./activity').recordActivity>[1]) => Promise<void>,
): Promise<{ alreadyCompleted: boolean }> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data: existing } = await supabase
      ?.from('lesson_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .single()
    if (existing) return { alreadyCompleted: true }
    await supabase
      ?.from('lesson_progress')
      .insert({ user_id: userId, lesson_id: lessonId, status: 'completed', score })
    return { alreadyCompleted: false }
  }
  const existing = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  })
  if (existing) return { alreadyCompleted: true }
  await db.lessonProgress.create({
    data: { userId, lessonId, status: 'completed', score },
  })
  return { alreadyCompleted: false }
}

export async function lessonsCompletedCount(userId: string, language?: string): Promise<number> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { count } = await supabase
      ?.from('lesson_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    return count ?? 0
  }
  return db.lessonProgress.count({
    where: { userId, ...(language ? { lesson: { language } } : {}) },
  })
}

/** Admin: content management CRUD (uses admin client / prisma directly). */
export async function adminListLessons(): Promise<LessonDTO[]> {
  if (isSupabaseConfigured()) {
    const { getSupabaseAdminClient } = await import('@/lib/supabase/admin')
    const { data } = await getSupabaseAdminClient()
      ?.from('lessons')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
  }
  const rows = await db.lesson.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  return rows.map((r) => mapRow(r as unknown as Record<string, unknown>))
}

export async function adminUpsertLesson(
  input: Partial<LessonDTO> & { sections?: LessonSection[] },
): Promise<void> {
  const data: Record<string, unknown> = {}
  if (input.title !== undefined) data.title = input.title
  if (input.language !== undefined) data.language = input.language
  if (input.level !== undefined) data.level = input.level
  if (input.category !== undefined) data.category = input.category
  if (input.summary !== undefined) data.summary = input.summary
  if (input.isPublic !== undefined) {
    data.is_public = input.isPublic
    data.isPublic = input.isPublic
  }
  if (input.sections) {
    data.content = { sections: input.sections }
  }
  if (input.id) {
    if (isSupabaseConfigured()) {
      const { getSupabaseAdminClient } = await import('@/lib/supabase/admin')
      const payload = { ...data }
      delete payload.isPublic
      await getSupabaseAdminClient()?.from('lessons').update(payload).eq('id', input.id)
      return
    }
    const prismaData = { ...data } as Record<string, unknown>
    if ('is_public' in prismaData) {
      prismaData.isPublic = prismaData.is_public
      delete prismaData.is_public
    }
    if ('content' in prismaData && typeof prismaData.content !== 'string') {
      prismaData.content = JSON.stringify(prismaData.content)
    }
    await db.lesson.update({ where: { id: input.id }, data: prismaData as never })
    return
  }
  const slugBase =
    (input.title ?? 'lesson').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'lesson'
  if (isSupabaseConfigured()) {
    const { getSupabaseAdminClient } = await import('@/lib/supabase/admin')
    const payload = { ...data, slug: `${slugBase}-${Date.now().toString(36)}` }
    delete payload.isPublic
    await getSupabaseAdminClient()?.from('lessons').insert(payload)
    return
  }
  const prismaData = { ...data } as Record<string, unknown>
  if ('is_public' in prismaData) {
    prismaData.isPublic = prismaData.is_public
    delete prismaData.is_public
  }
  await db.lesson.create({
    data: {
      ...(prismaData as {
        title: string
        language: string
        level: string
        category: string
      }),
      slug: `${slugBase}-${Date.now().toString(36)}`,
      content:
        typeof prismaData.content === 'string' ? prismaData.content : JSON.stringify({ sections: [] }),
    } as never,
  })
}

export async function adminDeleteLesson(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { getSupabaseAdminClient } = await import('@/lib/supabase/admin')
    await getSupabaseAdminClient()?.from('lessons').delete().eq('id', id)
    return
  }
  await db.lesson.delete({ where: { id } })
}
