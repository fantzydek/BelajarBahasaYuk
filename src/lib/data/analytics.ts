// MikuAI — Dashboard & analytics aggregates (real DB queries only).
import { db } from '@/lib/db'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type {
  DashboardStats,
  HistoryDTO,
  LearningProgressDTO,
  Level,
} from '@/lib/types'
import { getStreak } from './activity'
import { lessonsCompletedCount } from './lessons'
import { recentHistory } from './history'

function mapProgress(r: Record<string, unknown>): LearningProgressDTO {
  return {
    id: String(r.id),
    language: String(r.language ?? ''),
    level: (r.level as Level) ?? 'beginner',
    vocabularyCount: Number(r.vocabulary_count ?? r.vocabularyCount ?? 0),
    lessonsCompleted: Number(r.lessons_completed ?? r.lessonsCompleted ?? 0),
    quizzesTaken: Number(r.quizzes_taken ?? r.quizzesTaken ?? 0),
    avgQuizScore: Number(r.avg_quiz_score ?? r.avgQuizScore ?? 0),
    studyMinutes: Number(r.study_minutes ?? r.studyMinutes ?? 0),
    updatedAt: new Date(String(r.updated_at ?? r.updatedAt)).toISOString(),
  }
}

export async function languageProgress(userId: string): Promise<LearningProgressDTO[]> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data } = await supabase
      ?.from('learning_progress')
      .select('*')
      .eq('user_id', userId)
      .order('study_minutes', { ascending: false })
    return (data ?? []).map((r) => mapProgress(r as Record<string, unknown>))
  }
  const rows = await db.learningProgress.findMany({
    where: { userId },
    orderBy: { studyMinutes: 'desc' },
  })
  return rows.map((r) => mapProgress(r as unknown as Record<string, unknown>))
}

export async function vocabularyCount(userId: string, language?: string): Promise<number> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    let q = supabase
      ?.from('vocabulary')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (language) q = q?.eq('language', language)
    const { count } = await q
    return count ?? 0
  }
  return db.vocabulary.count({ where: { userId, ...(language ? { language } : {}) } })
}

export async function dailyActivityCounts(
  userId: string,
  days: number,
): Promise<{ date: string; count: number }[]> {
  const since = new Date(Date.now() - (days - 1) * 86_400_000)
  since.setUTCHours(0, 0, 0, 0)

  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data } = await supabase
      ?.from('learning_history')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
    const tally = new Map<string, number>()
    for (const r of data ?? []) {
      const date = String((r as { created_at: string }).created_at).slice(0, 10)
      tally.set(date, (tally.get(date) ?? 0) + 1)
    }
    return buildRange(days, tally)
  }

  const rows = await db.learningHistory.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { createdAt: true },
  })
  const tally = new Map<string, number>()
  for (const r of rows) {
    const date = r.createdAt.toISOString().slice(0, 10)
    tally.set(date, (tally.get(date) ?? 0) + 1)
  }
  return buildRange(days, tally)
}

function buildRange(days: number, tally: Map<string, number>) {
  const out: { date: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const date = d.toISOString().slice(0, 10)
    out.push({ date, count: tally.get(date) ?? 0 })
  }
  return out
}

export async function quizStats(userId: string, language?: string): Promise<{ taken: number; avgScore: number }> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    let q = supabase
      ?.from('quiz_attempts')
      .select('score')
      .eq('user_id', userId)
      .eq('status', 'completed')
    if (language) q = q?.eq('language', language)
    const { data } = await q
    const scores = (data ?? [])
      .map((r) => Number((r as { score: number | null }).score))
      .filter((s) => !Number.isNaN(s))
    return {
      taken: scores.length,
      avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
    }
  }
  const rows = await db.quizAttempt.findMany({
    where: { userId, status: 'completed', ...(language ? { language } : {}) },
    select: { score: true },
  })
  const scores = rows.map((r) => r.score).filter((s): s is number => s !== null)
  return {
    taken: scores.length,
    avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
  }
}

export async function translationCount(userId: string): Promise<number> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { count } = await supabase
      ?.from('translation_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    return count ?? 0
  }
  return db.translationHistory.count({ where: { userId } })
}

export async function chatSessionCount(userId: string): Promise<number> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { count } = await supabase
      ?.from('chat_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    return count ?? 0
  }
  return db.chatSession.count({ where: { userId } })
}

export async function getDashboardStats(
  user: { id: string; displayName: string | null; targetLanguage: string; level: Level },
): Promise<DashboardStats> {
  const [streak, vocabTotal, lessonsTotal, quiz, activity7, recent, progress, todayCounts] =
    await Promise.all([
      getStreak(user.id),
      vocabularyCount(user.id),
      lessonsCompletedCount(user.id),
      quizStats(user.id),
      dailyActivityCounts(user.id, 7),
      recentHistory(user.id, 8),
      languageProgress(user.id),
      dailyActivityCounts(user.id, 1),
    ])

  const dayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  const weeklyActivity = activity7.map((d) => ({
    ...d,
    label: dayLabels[new Date(`${d.date}T00:00:00Z`).getUTCDay()],
  }))

  const totalStudyMinutes = progress.reduce((acc, p) => acc + p.studyMinutes, 0)
  const totalQuizzes = progress.reduce((acc, p) => acc + p.quizzesTaken, 0) || quiz.taken
  const weightedAvg = progress.length
    ? progress.reduce((acc, p) => acc + p.avgQuizScore * Math.max(1, p.quizzesTaken), 0) /
      progress.reduce((acc, p) => acc + Math.max(1, p.quizzesTaken), 0)
    : quiz.avgScore

  return {
    displayName: user.displayName ?? 'Pembelajar',
    targetLanguage: user.targetLanguage,
    level: user.level,
    todayActivity: todayCounts[0]?.count ?? 0,
    totalVocabulary: vocabTotal,
    lessonsCompleted: lessonsTotal,
    quizzesTaken: totalQuizzes,
    avgQuizScore: Math.round(weightedAvg * 10) / 10 || quiz.avgScore,
    studyMinutes: totalStudyMinutes,
    streak,
    weeklyActivity,
    recentActivities: recent as HistoryDTO[],
    languageProgress: progress,
  }
}
