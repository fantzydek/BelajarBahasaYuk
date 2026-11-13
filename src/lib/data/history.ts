// MikuAI — Learning history queries (Supabase / local).
import { db } from '@/lib/db'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { ActivityType, HistoryDTO } from '@/lib/types'

function mapRow(r: Record<string, unknown>): HistoryDTO {
  let metadata: Record<string, unknown> | null = null
  const raw = r.metadata
  try {
    metadata = typeof raw === 'string' ? JSON.parse(raw) : raw ?? null
  } catch {
    metadata = null
  }
  return {
    id: String(r.id),
    activityType: (r.activity_type ?? r.activityType) as ActivityType,
    title: String(r.title ?? ''),
    description: (r.description as string) ?? null,
    language: (r.language as string) ?? null,
    refId: (r.ref_id ?? r.refId) as string | null,
    metadata,
    durationMinutes: (r.duration_minutes ?? r.durationMinutes) as number | null,
    createdAt: new Date(String(r.created_at ?? r.createdAt)).toISOString(),
  }
}

export interface HistoryQuery {
  page?: number
  limit?: number
  types?: ActivityType[]
  language?: string
  search?: string
  from?: string
  to?: string
}

export async function listHistory(
  userId: string,
  query: HistoryQuery,
): Promise<{ items: HistoryDTO[]; total: number }> {
  const page = Math.max(1, query.page ?? 1)
  const limit = Math.min(100, Math.max(1, query.limit ?? 25))

  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    let q = supabase
      ?.from('learning_history')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (query.types?.length) q = q?.in('activity_type', query.types)
    if (query.language) q = q?.eq('language', query.language)
    if (query.search) q = q?.ilike('title', `%${query.search}%`)
    if (query.from) q = q?.gte('created_at', query.from)
    if (query.to) q = q?.lte('created_at', query.to)
    const { data, count, error } = await q.range((page - 1) * limit, page * limit - 1)
    if (error) throw new Error(error.message)
    return { items: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)), total: count ?? 0 }
  }

  const where = {
    userId,
    ...(query.types?.length ? { activityType: { in: query.types } } : {}),
    ...(query.language ? { language: query.language } : {}),
    ...(query.search ? { title: { contains: query.search } } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  }
  const [rows, total] = await Promise.all([
    db.learningHistory.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    db.learningHistory.count({ where }),
  ])
  return { items: rows.map((r) => mapRow(r as unknown as Record<string, unknown>)), total }
}

export async function getHistoryItem(userId: string, id: string): Promise<HistoryDTO | null> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data } = await supabase
      ?.from('learning_history')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()
    return data ? mapRow(data as Record<string, unknown>) : null
  }
  const row = await db.learningHistory.findFirst({ where: { id, userId } })
  return row ? mapRow(row as unknown as Record<string, unknown>) : null
}

export async function deleteHistoryItem(userId: string, id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { error } = await supabase?.from('learning_history').delete().eq('id', id).eq('user_id', userId)
    if (error) throw new Error(error.message)
    return
  }
  await db.learningHistory.deleteMany({ where: { id, userId } })
}

export async function recentHistory(userId: string, limit = 10): Promise<HistoryDTO[]> {
  const { items } = await listHistory(userId, { page: 1, limit })
  return items
}
