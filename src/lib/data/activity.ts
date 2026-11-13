// MikuAI — Activity pipeline: every learning action flows through here so the
// dashboard, analytics, and streaks always reflect real database state.
import { db } from '@/lib/db'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { ActivityType, StreakDTO } from '@/lib/types'

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayUTC(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export interface ActivityInput {
  activityType: ActivityType
  title: string
  description?: string | null
  language?: string | null
  refId?: string | null
  metadata?: Record<string, unknown> | null
  durationMinutes?: number | null
}

/** Append to learning_history, bump streak, and update per-language progress. */
export async function recordActivity(
  userId: string,
  input: ActivityInput,
  progressDelta: { lessonsCompleted?: number; quizzesTaken?: number; vocabularyCount?: number; studyMinutes?: number } = {},
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    if (!supabase) return

    await supabase.from('learning_history').insert({
      user_id: userId,
      activity_type: input.activityType,
      title: input.title,
      description: input.description ?? null,
      language: input.language ?? null,
      ref_id: input.refId ?? null,
      metadata: input.metadata ?? null,
      duration_minutes: input.durationMinutes ?? null,
    })

    // Streak update (atomic-ish read/modify/write by the row owner).
    const { data: streakRow } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single()
    const today = todayUTC()
    const s = streakRow as Record<string, unknown> | null
    if (!s) {
      await supabase.from('user_streaks').insert({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        total_active_days: 1,
        last_activity_date: today,
      })
    } else if (s.last_activity_date !== today) {
      const current = s.last_activity_date === yesterdayUTC() ? Number(s.current_streak) + 1 : 1
      await supabase
        .from('user_streaks')
        .update({
          current_streak: current,
          longest_streak: Math.max(current, Number(s.longest_streak)),
          total_active_days: Number(s.total_active_days) + 1,
          last_activity_date: today,
        })
        .eq('user_id', userId)
    }

    // Per-language progress aggregate.
    if (input.language) {
      const { data: progRow } = await supabase
        .from('learning_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('language', input.language)
        .single()
      const p = progRow as Record<string, unknown> | null
      const next = {
        user_id: userId,
        language: input.language,
        lessons_completed: Number(p?.lessons_completed ?? 0) + (progressDelta.lessonsCompleted ?? 0),
        quizzes_taken: Number(p?.quizzes_taken ?? 0) + (progressDelta.quizzesTaken ?? 0),
        vocabulary_count: Number(p?.vocabulary_count ?? 0) + (progressDelta.vocabularyCount ?? 0),
        study_minutes: Number(p?.study_minutes ?? 0) + (progressDelta.studyMinutes ?? 0),
      }
      if (!p) {
        await supabase.from('learning_progress').insert(next)
      } else {
        await supabase.from('learning_progress').update(next).eq('id', String(p.id))
      }
    }
    return
  }

  // ------------------------- local preview driver -------------------------
  await db.learningHistory.create({
    data: {
      userId,
      activityType: input.activityType,
      title: input.title,
      description: input.description ?? null,
      language: input.language ?? null,
      refId: input.refId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      durationMinutes: input.durationMinutes ?? null,
    },
  })

  const today = todayUTC()
  const existingStreak = await db.userStreak.findUnique({ where: { userId } })
  if (!existingStreak) {
    await db.userStreak.create({
      data: { userId, currentStreak: 1, longestStreak: 1, totalActiveDays: 1, lastActivityDate: today },
    })
  } else if (existingStreak.lastActivityDate !== today) {
    const current = existingStreak.lastActivityDate === yesterdayUTC() ? existingStreak.currentStreak + 1 : 1
    await db.userStreak.update({
      where: { userId },
      data: {
        currentStreak: current,
        longestStreak: Math.max(current, existingStreak.longestStreak),
        totalActiveDays: { increment: 1 },
        lastActivityDate: today,
      },
    })
  }

  if (input.language) {
    const existing = await db.learningProgress.findUnique({
      where: { userId_language: { userId, language: input.language } },
    })
    if (!existing) {
      await db.learningProgress.create({
        data: {
          userId,
          language: input.language,
          lessonsCompleted: progressDelta.lessonsCompleted ?? 0,
          quizzesTaken: progressDelta.quizzesTaken ?? 0,
          vocabularyCount: progressDelta.vocabularyCount ?? 0,
          studyMinutes: progressDelta.studyMinutes ?? 0,
        },
      })
    } else {
      await db.learningProgress.update({
        where: { id: existing.id },
        data: {
          lessonsCompleted: { increment: progressDelta.lessonsCompleted ?? 0 },
          quizzesTaken: { increment: progressDelta.quizzesTaken ?? 0 },
          vocabularyCount: { increment: progressDelta.vocabularyCount ?? 0 },
          studyMinutes: { increment: progressDelta.studyMinutes ?? 0 },
        },
      })
    }
  }
}

/** Recount vocabulary for a language (called after add/delete). */
export async function refreshVocabularyCount(userId: string, language: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    if (!supabase) return
    const { count } = await supabase
      .from('vocabulary')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('language', language)
    const { data: progRow } = await supabase
      .from('learning_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('language', language)
      .single()
    if (progRow) {
      await supabase
        .from('learning_progress')
        .update({ vocabulary_count: count ?? 0 })
        .eq('id', (progRow as { id: string }).id)
    } else if (count) {
      await supabase
        .from('learning_progress')
        .insert({ user_id: userId, language, vocabulary_count: count })
    }
    return
  }
  const count = await db.vocabulary.count({ where: { userId, language } })
  const existing = await db.learningProgress.findUnique({
    where: { userId_language: { userId, language } },
  })
  if (existing) {
    await db.learningProgress.update({ where: { id: existing.id }, data: { vocabularyCount: count } })
  } else if (count > 0) {
    await db.learningProgress.create({ data: { userId, language, vocabularyCount: count } })
  }
}

export async function getStreak(userId: string): Promise<StreakDTO> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data } = await supabase
      ?.from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single()
    const s = data as Record<string, unknown> | null
    return {
      currentStreak: Number(s?.current_streak ?? 0),
      longestStreak: Number(s?.longest_streak ?? 0),
      totalActiveDays: Number(s?.total_active_days ?? 0),
      lastActivityDate: (s?.last_activity_date as string) ?? null,
    }
  }
  const s = await db.userStreak.findUnique({ where: { userId } })
  return {
    currentStreak: s?.currentStreak ?? 0,
    longestStreak: s?.longestStreak ?? 0,
    totalActiveDays: s?.totalActiveDays ?? 0,
    lastActivityDate: s?.lastActivityDate ?? null,
  }
}
