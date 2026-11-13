// MikuAI — Translation history data access (Supabase / local).
import { db } from '@/lib/db'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { TranslationDTO, TranslationStyle } from '@/lib/types'

function parseJsonArray(v: unknown): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v.map(String)
  try {
    const parsed = JSON.parse(String(v))
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function mapRow(r: Record<string, unknown>): TranslationDTO {
  return {
    id: String(r.id),
    sourceLanguage: String(r.source_language ?? r.sourceLanguage ?? ''),
    targetLanguage: String(r.target_language ?? r.targetLanguage ?? ''),
    detectedSource: (r.detected_source ?? r.detectedSource) as string | null,
    sourceText: String(r.source_text ?? r.sourceText ?? ''),
    translatedText: String(r.translated_text ?? r.translatedText ?? ''),
    style: ((r.style as TranslationStyle) ?? 'neutral') satisfies TranslationStyle,
    alternatives: parseJsonArray(r.alternatives),
    explanation: (r.explanation as string) ?? null,
    grammarNotes: (r.grammar_notes ?? r.grammarNotes) as string | null,
    idioms: (() => {
      const raw = r.idioms
      if (!raw) return []
      const arr = Array.isArray(raw) ? raw : JSON.parse(String(raw))
      return (arr as { idiom: string; meaning: string }[]).map((i) => `${i.idiom} — ${i.meaning}`)
    })(),
    createdAt: new Date(String(r.created_at ?? r.createdAt)).toISOString(),
  }
}

export interface TranslationInput {
  sourceLanguage: string
  targetLanguage: string
  detectedSource: string | null
  sourceText: string
  translatedText: string
  style: TranslationStyle
  alternatives: string[]
  explanation: string | null
  grammarNotes: string | null
  idioms: { idiom: string; meaning: string }[]
}

export async function saveTranslation(userId: string, input: TranslationInput): Promise<TranslationDTO> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      ?.from('translation_history')
      .insert({
        user_id: userId,
        source_language: input.sourceLanguage,
        target_language: input.targetLanguage,
        detected_source: input.detectedSource,
        source_text: input.sourceText,
        translated_text: input.translatedText,
        style: input.style,
        alternatives: input.alternatives,
        explanation: input.explanation,
        grammar_notes: input.grammarNotes,
        idioms: input.idioms,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return mapRow(data as Record<string, unknown>)
  }
  const row = await db.translationHistory.create({
    data: {
      userId,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      detectedSource: input.detectedSource,
      sourceText: input.sourceText,
      translatedText: input.translatedText,
      style: input.style,
      alternatives: JSON.stringify(input.alternatives),
      explanation: input.explanation,
      grammarNotes: input.grammarNotes,
      idioms: JSON.stringify(input.idioms),
    },
  })
  return {
    id: row.id,
    sourceLanguage: row.sourceLanguage,
    targetLanguage: row.targetLanguage,
    detectedSource: row.detectedSource,
    sourceText: row.sourceText,
    translatedText: row.translatedText,
    style: row.style as TranslationStyle,
    alternatives: parseJsonArray(row.alternatives),
    explanation: row.explanation,
    grammarNotes: row.grammarNotes,
    idioms: parseJsonArray(row.idioms),
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listTranslations(
  userId: string,
  opts: { page?: number; limit?: number; search?: string; language?: string } = {},
): Promise<{ items: TranslationDTO[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20))

  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    let query = supabase
      ?.from('translation_history')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (opts.search) query = query?.ilike('source_text', `%${opts.search}%`)
    if (opts.language) query = query?.or(`target_language.eq.${opts.language},source_language.eq.${opts.language}`)
    const { data, count, error } = await query
      .range((page - 1) * limit, page * limit - 1)
    if (error) throw new Error(error.message)
    return { items: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)), total: count ?? 0 }
  }

  const where = {
    userId,
    ...(opts.search ? { sourceText: { contains: opts.search } } : {}),
    ...(opts.language ? { OR: [{ targetLanguage: opts.language }, { sourceLanguage: opts.language }] } : {}),
  }
  const [rows, total] = await Promise.all([
    db.translationHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.translationHistory.count({ where }),
  ])
  return {
    items: rows.map((r) => ({
      id: r.id,
      sourceLanguage: r.sourceLanguage,
      targetLanguage: r.targetLanguage,
      detectedSource: r.detectedSource,
      sourceText: r.sourceText,
      translatedText: r.translatedText,
      style: r.style as TranslationStyle,
      alternatives: parseJsonArray(r.alternatives),
      explanation: r.explanation,
      grammarNotes: r.grammarNotes,
      idioms: parseJsonArray(r.idioms),
      createdAt: r.createdAt.toISOString(),
    })),
    total,
  }
}

export async function deleteTranslation(userId: string, id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { error } = await supabase?.from('translation_history').delete().eq('id', id).eq('user_id', userId)
    if (error) throw new Error(error.message)
    return
  }
  await db.translationHistory.deleteMany({ where: { id, userId } })
}
