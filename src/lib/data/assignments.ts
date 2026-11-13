// MikuAI — Writing assignments data access (Supabase / local dual driver).
// Prompt is AI-generated; the submission is AI-graded with a rubric.
import { db } from '@/lib/db'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type {
  AssignmentFeedback,
  AssignmentRubricScores,
  Level,
  WritingAssignmentDTO,
} from '@/lib/types'

interface AssignmentRow {
  id: string
  user_id?: string
  userId?: string
  language: string
  level: string
  topic: string | null
  title: string
  prompt: string
  instructions: string | null
  min_words?: number
  minWords?: number
  max_words?: number
  maxWords?: number
  criteria: unknown
  status: string
  submission_text?: string | null
  submissionText?: string | null
  word_count?: number | null
  wordCount?: number | null
  score_grammar?: number | null
  scoreGrammar?: number | null
  score_vocabulary?: number | null
  scoreVocabulary?: number | null
  score_structure?: number | null
  scoreStructure?: number | null
  score_content?: number | null
  scoreContent?: number | null
  overall_score?: number | null
  overallScore?: number | null
  feedback: unknown
  ai_provider?: string | null
  aiProvider?: string | null
  ai_model?: string | null
  aiModel?: string | null
  submitted_at?: string | Date | null
  submittedAt?: string | Date | null
  graded_at?: string | Date | null
  gradedAt?: string | Date | null
  created_at?: string | Date
  createdAt?: string | Date
}

function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  return []
}

function parseFeedback(raw: unknown): AssignmentFeedback | null {
  if (!raw) return null
  let obj: Record<string, unknown> | null = null
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  } else if (typeof raw === 'object') {
    obj = raw as Record<string, unknown>
  }
  if (!obj) return null
  return {
    summary: String(obj.summary ?? ''),
    strengths: Array.isArray(obj.strengths) ? obj.strengths.map(String) : [],
    improvements: Array.isArray(obj.improvements) ? obj.improvements.map(String) : [],
    correctedText: obj.correctedText == null ? null : String(obj.correctedText),
    tips: Array.isArray(obj.tips) ? obj.tips.map(String) : [],
  }
}

function toIso(v: string | Date | null | undefined): string | null {
  if (!v) return null
  return new Date(v).toISOString()
}

function mapAssignment(r: AssignmentRow): WritingAssignmentDTO {
  const scores: AssignmentRubricScores | null =
    r.score_grammar != null || r.scoreGrammar != null
      ? {
          grammar: Number(r.score_grammar ?? r.scoreGrammar ?? 0),
          vocabulary: Number(r.score_vocabulary ?? r.scoreVocabulary ?? 0),
          structure: Number(r.score_structure ?? r.scoreStructure ?? 0),
          content: Number(r.score_content ?? r.scoreContent ?? 0),
        }
      : null
  return {
    id: String(r.id),
    language: r.language,
    level: (r.level as Level) ?? 'beginner',
    topic: r.topic ?? null,
    title: r.title,
    prompt: r.prompt,
    instructions: r.instructions ?? null,
    minWords: Number(r.min_words ?? r.minWords ?? 50),
    maxWords: Number(r.max_words ?? r.maxWords ?? 200),
    criteria: parseJsonArray(r.criteria),
    status: (r.status as 'active' | 'graded') ?? 'active',
    submissionText: r.submission_text ?? r.submissionText ?? null,
    wordCount: r.word_count ?? r.wordCount ?? null,
    scores,
    overallScore: r.overall_score != null ? Number(r.overall_score) : r.overallScore != null ? Number(r.overallScore) : null,
    feedback: parseFeedback(r.feedback),
    aiProvider: r.ai_provider ?? r.aiProvider ?? null,
    aiModel: r.ai_model ?? r.aiModel ?? null,
    submittedAt: toIso(r.submitted_at ?? r.submittedAt),
    gradedAt: toIso(r.graded_at ?? r.gradedAt),
    createdAt: toIso(r.created_at ?? r.createdAt) ?? new Date().toISOString(),
  }
}

export async function createAssignment(
  userId: string,
  input: {
    language: string
    level: Level
    topic: string | null
    title: string
    prompt: string
    instructions: string | null
    minWords: number
    maxWords: number
    criteria: string[]
  },
): Promise<WritingAssignmentDTO> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      ?.from('writing_assignments')
      .insert({
        user_id: userId,
        language: input.language,
        level: input.level,
        topic: input.topic,
        title: input.title,
        prompt: input.prompt,
        instructions: input.instructions,
        min_words: input.minWords,
        max_words: input.maxWords,
        criteria: input.criteria,
        status: 'active',
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return mapAssignment(data as AssignmentRow)
  }
  const row = await db.writingAssignment.create({
    data: {
      userId,
      language: input.language,
      level: input.level,
      topic: input.topic,
      title: input.title,
      prompt: input.prompt,
      instructions: input.instructions,
      minWords: input.minWords,
      maxWords: input.maxWords,
      criteria: JSON.stringify(input.criteria),
      status: 'active',
    },
  })
  return mapAssignment(row as unknown as AssignmentRow)
}

export async function getAssignment(userId: string, id: string): Promise<WritingAssignmentDTO | null> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data } = await supabase
      ?.from('writing_assignments')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()
    return data ? mapAssignment(data as AssignmentRow) : null
  }
  const row = await db.writingAssignment.findFirst({ where: { id, userId } })
  return row ? mapAssignment(row as unknown as AssignmentRow) : null
}

export async function listAssignments(
  userId: string,
  opts: { page?: number; limit?: number; language?: string; status?: string } = {},
): Promise<{ items: WritingAssignmentDTO[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(50, Math.max(1, opts.limit ?? 12))
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    let query = supabase
      ?.from('writing_assignments')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (opts.language) query = query?.eq('language', opts.language)
    if (opts.status) query = query?.eq('status', opts.status)
    const { data, count } = await query.range((page - 1) * limit, page * limit - 1)
    return {
      items: (data ?? []).map((r) => mapAssignment(r as AssignmentRow)),
      total: count ?? 0,
    }
  }
  const where = {
    userId,
    ...(opts.language ? { language: opts.language } : {}),
    ...(opts.status ? { status: opts.status } : {}),
  }
  const [rows, total] = await Promise.all([
    db.writingAssignment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.writingAssignment.count({ where }),
  ])
  return { items: rows.map((r) => mapAssignment(r as unknown as AssignmentRow)), total }
}

export async function deleteAssignment(userId: string, id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { error } = await supabase
      ?.from('writing_assignments')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    return !error
  }
  const existing = await db.writingAssignment.findFirst({ where: { id, userId } })
  if (!existing) return false
  await db.writingAssignment.delete({ where: { id } })
  return true
}

export interface GradeInput {
  scores: AssignmentRubricScores
  overall: number
  feedback: AssignmentFeedback
  provider: string
  model: string
}

export async function saveGradedSubmission(
  userId: string,
  id: string,
  submissionText: string,
  wordCount: number,
  grade: GradeInput,
): Promise<WritingAssignmentDTO> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      ?.from('writing_assignments')
      .update({
        status: 'graded',
        submission_text: submissionText,
        word_count: wordCount,
        score_grammar: grade.scores.grammar,
        score_vocabulary: grade.scores.vocabulary,
        score_structure: grade.scores.structure,
        score_content: grade.scores.content,
        overall_score: grade.overall,
        feedback: grade.feedback,
        ai_provider: grade.provider,
        ai_model: grade.model,
        submitted_at: new Date().toISOString(),
        graded_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return mapAssignment(data as AssignmentRow)
  }
  await db.writingAssignment.update({
    where: { id },
    data: {
      status: 'graded',
      submissionText,
      wordCount,
      scoreGrammar: grade.scores.grammar,
      scoreVocabulary: grade.scores.vocabulary,
      scoreStructure: grade.scores.structure,
      scoreContent: grade.scores.content,
      overallScore: grade.overall,
      feedback: JSON.stringify(grade.feedback),
      aiProvider: grade.provider,
      aiModel: grade.model,
      submittedAt: new Date(),
      gradedAt: new Date(),
    },
  })
  const row = await db.writingAssignment.findFirst({ where: { id, userId } })
  return mapAssignment(row as unknown as AssignmentRow)
}
