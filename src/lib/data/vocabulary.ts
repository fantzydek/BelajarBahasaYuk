// MikuAI — Vocabulary data access (Supabase / local).
import { db } from '@/lib/db'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { refreshVocabularyCount } from './activity'
import type { VocabSource, VocabularyDTO } from '@/lib/types'

function mapRow(r: Record<string, unknown>): VocabularyDTO {
  return {
    id: String(r.id),
    language: String(r.language ?? ''),
    word: String(r.word ?? ''),
    translation: (r.translation as string) ?? null,
    definition: (r.definition as string) ?? null,
    exampleSentence: (r.example_sentence ?? r.exampleSentence) as string | null,
    pronunciation: (r.pronunciation as string) ?? null,
    category: String(r.category ?? 'general'),
    source: ((r.source as VocabSource) ?? 'manual') satisfies VocabSource,
    masteryLevel: Number(r.mastery_level ?? r.masteryLevel ?? 0),
    timesReviewed: Number(r.times_reviewed ?? r.timesReviewed ?? 0),
    correctCount: Number(r.correct_count ?? r.correctCount ?? 0),
    lastReviewedAt: toIso(r.last_reviewed_at ?? r.lastReviewedAt),
    nextReviewAt: toIso(r.next_review_at ?? r.nextReviewAt),
    createdAt: new Date(String(r.created_at ?? r.createdAt)).toISOString(),
  }
}

function toIso(v: unknown): string | null {
  if (!v) return null
  try {
    return new Date(String(v)).toISOString()
  } catch {
    return null
  }
}

export interface VocabularyInput {
  language: string
  word: string
  translation?: string | null
  definition?: string | null
  exampleSentence?: string | null
  pronunciation?: string | null
  category?: string
  source?: VocabSource
}

export async function saveVocabulary(userId: string, input: VocabularyInput): Promise<VocabularyDTO> {
  // Spaced-restyle-lite schedule: mastery 0 → review in 1 day, growing per level.
  const masteryGates = [1, 2, 4, 7, 14, 30]

  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      ?.from('vocabulary')
      .insert({
        user_id: userId,
        language: input.language,
        word: input.word,
        translation: input.translation ?? null,
        definition: input.definition ?? null,
        example_sentence: input.exampleSentence ?? null,
        pronunciation: input.pronunciation ?? null,
        category: input.category ?? 'general',
        source: input.source ?? 'manual',
        next_review_at: new Date(Date.now() + masteryGates[0] * 86_400_000).toISOString(),
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    const dto = mapRow(data as Record<string, unknown>)
    await refreshVocabularyCount(userId, input.language)
    return dto
  }

  const row = await db.vocabulary.create({
    data: {
      userId,
      language: input.language,
      word: input.word,
      translation: input.translation ?? null,
      definition: input.definition ?? null,
      exampleSentence: input.exampleSentence ?? null,
      pronunciation: input.pronunciation ?? null,
      category: input.category ?? 'general',
      source: input.source ?? 'manual',
      nextReviewAt: new Date(Date.now() + masteryGates[0] * 86_400_000),
    },
  })
  await refreshVocabularyCount(userId, input.language)
  return mapRow(row as unknown as Record<string, unknown>)
}

export async function listVocabulary(
  userId: string,
  opts: { page?: number; limit?: number; search?: string; language?: string; category?: string; dueOnly?: boolean } = {},
): Promise<{ items: VocabularyDTO[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(100, Math.max(1, opts.limit ?? 30))

  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    let query = supabase
      ?.from('vocabulary')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (opts.search) query = query?.or(`word.ilike.%${opts.search}%,translation.ilike.%${opts.search}%`)
    if (opts.language) query = query?.eq('language', opts.language)
    if (opts.category) query = query?.eq('category', opts.category)
    if (opts.dueOnly) query = query?.lte('next_review_at', new Date().toISOString())
    const { data, count, error } = await query.range((page - 1) * limit, page * limit - 1)
    if (error) throw new Error(error.message)
    return { items: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)), total: count ?? 0 }
  }

  const where = {
    userId,
    ...(opts.search
      ? { OR: [{ word: { contains: opts.search } }, { translation: { contains: opts.search } }] }
      : {}),
    ...(opts.language ? { language: opts.language } : {}),
    ...(opts.category ? { category: opts.category } : {}),
    ...(opts.dueOnly ? { nextReviewAt: { lte: new Date() } } : {}),
  }
  const [rows, total] = await Promise.all([
    db.vocabulary.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    db.vocabulary.count({ where }),
  ])
  return { items: rows.map((r) => mapRow(r as unknown as Record<string, unknown>)), total }
}

export async function updateVocabulary(
  userId: string,
  id: string,
  patch: Partial<VocabularyInput> & { masteryLevel?: number },
): Promise<void> {
  const data: Record<string, unknown> = {}
  if (patch.word !== undefined) data.word = patch.word
  if (patch.translation !== undefined) data.translation = patch.translation
  if (patch.definition !== undefined) data.definition = patch.definition
  if (patch.exampleSentence !== undefined) data.example_sentence = patch.exampleSentence
  if (patch.exampleSentence !== undefined && !isSupabaseConfigured()) data.exampleSentence = patch.exampleSentence
  if (patch.pronunciation !== undefined) data.pronunciation = patch.pronunciation
  if (patch.category !== undefined) data.category = patch.category
  if (patch.language !== undefined) data.language = patch.language
  if (patch.masteryLevel !== undefined) data.mastery_level = patch.masteryLevel

  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { error } = await supabase?.from('vocabulary').update(data).eq('id', id).eq('user_id', userId)
    if (error) throw new Error(error.message)
    return
  }
  const prismaData: Record<string, unknown> = { ...data }
  const snake: Record<string, string> = { example_sentence: 'exampleSentence', mastery_level: 'masteryLevel' }
  for (const [k, v] of Object.entries(snake)) {
    if (k in prismaData) {
      prismaData[v] = prismaData[k]
      delete prismaData[k]
    }
  }
  await db.vocabulary.updateMany({ where: { id, userId }, data: prismaData })
}

export async function deleteVocabulary(userId: string, id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { error } = await supabase?.from('vocabulary').delete().eq('id', id).eq('user_id', userId)
    if (error) throw new Error(error.message)
    return
  }
  const existing = await db.vocabulary.findFirst({ where: { id, userId } })
  await db.vocabulary.deleteMany({ where: { id, userId } })
  if (existing) await refreshVocabularyCount(userId, existing.language)
}

/** Record a flashcard/review outcome and advance the SRS-lite schedule. */
export async function recordReview(userId: string, id: string, correct: boolean): Promise<VocabularyDTO | null> {
  const masteryGates = [1, 2, 4, 7, 14, 30]
  let current: VocabularyDTO | null

  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data } = await supabase?.from('vocabulary').select('*').eq('id', id).eq('user_id', userId).single()
    if (!data) return null
    current = mapRow(data as Record<string, unknown>)
  } else {
    const row = await db.vocabulary.findFirst({ where: { id, userId } })
    if (!row) return null
    current = mapRow(row as unknown as Record<string, unknown>)
  }

  const mastery = correct ? Math.min(5, current.masteryLevel + 1) : Math.max(0, current.masteryLevel - 1)
  const nextReview = new Date(Date.now() + masteryGates[mastery] * 86_400_000)
  const updates = {
    mastery_level: mastery,
    masteryLevel: mastery,
    times_reviewed: current.timesReviewed + 1,
    timesReviewed: current.timesReviewed + 1,
    correct_count: correct ? current.correctCount + 1 : current.correctCount,
    correctCount: correct ? current.correctCount + 1 : current.correctCount,
    last_reviewed_at: new Date().toISOString(),
    lastReviewedAt: new Date(),
    next_review_at: nextReview.toISOString(),
    nextReviewAt: nextReview,
  }

  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data } = await supabase
      ?.from('vocabulary')
      .update({
        mastery_level: updates.mastery_level,
        times_reviewed: updates.times_reviewed,
        correct_count: updates.correct_count,
        last_reviewed_at: updates.last_reviewed_at,
        next_review_at: updates.next_review_at,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()
    return data ? mapRow(data as Record<string, unknown>) : null
  }

  const row = await db.vocabulary.update({
    where: { id },
    data: {
      masteryLevel: updates.masteryLevel,
      timesReviewed: updates.timesReviewed,
      correctCount: updates.correctCount,
      lastReviewedAt: updates.lastReviewedAt,
      nextReviewAt: updates.nextReviewAt,
    },
  })
  return mapRow(row as unknown as Record<string, unknown>)
}

export async function vocabularyCategories(userId: string): Promise<string[]> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data } = await supabase?.from('vocabulary').select('category').eq('user_id', userId)
    return [...new Set((data ?? []).map((r) => String((r as { category: string }).category)))]
  }
  const rows = await db.vocabulary.findMany({ where: { userId }, select: { category: true }, distinct: ['category'] })
  return rows.map((r) => r.category)
}
