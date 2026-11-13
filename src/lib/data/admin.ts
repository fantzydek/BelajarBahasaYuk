// MikuAI — Admin data access: platform stats, users, AI usage, DB health.
import { db } from '@/lib/db'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured, isSupabaseAdminConfigured } from '@/lib/supabase/config'
import { resolveAiProvider, providerModel } from '@/lib/ai/config'
import type { AdminStats, AdminUserRow, AiUsageLogDTO, Role } from '@/lib/types'

function mapLog(r: Record<string, unknown>, email?: string | null): AiUsageLogDTO {
  return {
    id: String(r.id),
    userId: (r.user_id ?? r.userId) as string | null,
    userEmail: email ?? null,
    feature: String(r.feature ?? ''),
    provider: String(r.provider ?? ''),
    model: String(r.model ?? ''),
    promptTokens: Number(r.prompt_tokens ?? r.promptTokens ?? 0),
    completionTokens: Number(r.completion_tokens ?? r.completionTokens ?? 0),
    totalTokens: Number(r.total_tokens ?? r.totalTokens ?? 0),
    durationMs: Number(r.duration_ms ?? r.durationMs ?? 0),
    status: (r.status as 'success' | 'error') ?? 'success',
    errorCode: (r.error_code ?? r.errorCode) as string | null,
    errorMessage: (r.error_message ?? r.errorMessage) as string | null,
    createdAt: new Date(String(r.created_at ?? r.createdAt)).toISOString(),
  }
}

export async function adminStats(): Promise<AdminStats> {
  const since24h = new Date(Date.now() - 86_400_000).toISOString()
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString()

  if (isSupabaseConfigured() && isSupabaseAdminConfigured()) {
    const admin = getSupabaseAdminClient()!
    const [users, sessions, translations, vocab, attempts, lessons, logs24h] = await Promise.all([
      admin.from('profiles').select('id, created_at', { count: 'exact' }),
      admin.from('chat_sessions').select('id', { count: 'exact' }),
      admin.from('translation_history').select('id', { count: 'exact' }),
      admin.from('vocabulary').select('id', { count: 'exact' }),
      admin.from('quiz_attempts').select('id', { count: 'exact' }),
      admin.from('lessons').select('id', { count: 'exact' }),
      admin.from('ai_usage_logs').select('feature, total_tokens, status, created_at').gte('created_at', since24h),
    ])

    const logs = (logs24h.data ?? []) as { feature: string; total_tokens: number; status: string; created_at: string }[]
    const byFeature = new Map<string, { calls: number; tokens: number }>()
    let errors = 0
    let tokens = 0
    for (const l of logs) {
      const f = byFeature.get(l.feature) ?? { calls: 0, tokens: 0 }
      f.calls++
      f.tokens += Number(l.total_tokens) || 0
      byFeature.set(l.feature, f)
      if (l.status === 'error') errors++
      tokens += Number(l.total_tokens) || 0
    }

    const userRows = (users.data ?? []) as { id: string; created_at: string }[]
    const active7d = new Set(
      ((await admin.from('learning_history').select('user_id').gte('created_at', since7d)).data ?? []).map(
        (r) => String((r as { user_id: string }).user_id),
      ),
    )

    return {
      totalUsers: users.count ?? 0,
      activeUsers7d: active7d.size,
      totalSessions: sessions.count ?? 0,
      totalTranslations: translations.count ?? 0,
      totalVocabulary: vocab.count ?? 0,
      totalQuizzes: attempts.count ?? 0,
      totalLessons: lessons.count ?? 0,
      aiCalls24h: logs.length,
      aiErrors24h: errors,
      aiTokens24h: tokens,
      aiByFeature: [...byFeature.entries()].map(([feature, v]) => ({ feature, ...v })),
      provider: {
        aiProvider: resolveAiProvider(),
        model: providerModel(),
        dbDriver: 'supabase',
      },
    }
  }

  // Local driver
  const [totalUsers, activeUsers, sessions, translations, vocab, attempts, lessons, logs] = await Promise.all([
    db.user.count(),
    db.learningHistory.findMany({ where: { createdAt: { gte: new Date(since7d) } }, select: { userId: true }, distinct: ['userId'] }),
    db.chatSession.count(),
    db.translationHistory.count(),
    db.vocabulary.count(),
    db.quizAttempt.count(),
    db.lesson.count(),
    db.aiUsageLog.findMany({ where: { createdAt: { gte: new Date(since24h) } } }),
  ])
  const byFeature = new Map<string, { calls: number; tokens: number }>()
  let errors = 0
  let tokens = 0
  for (const l of logs) {
    const f = byFeature.get(l.feature) ?? { calls: 0, tokens: 0 }
    f.calls++
    f.tokens += l.totalTokens
    byFeature.set(l.feature, f)
    if (l.status === 'error') errors++
    tokens += l.totalTokens
  }

  return {
    totalUsers,
    activeUsers7d: activeUsers.length,
    totalSessions: sessions,
    totalTranslations: translations,
    totalVocabulary: vocab,
    totalQuizzes: attempts,
    totalLessons: lessons,
    aiCalls24h: logs.length,
    aiErrors24h: errors,
    aiTokens24h: tokens,
    aiByFeature: [...byFeature.entries()].map(([feature, v]) => ({ feature, ...v })),
    provider: {
      aiProvider: resolveAiProvider(),
      model: providerModel(),
      dbDriver: 'local',
    },
  }
}

export async function adminUsers(limit = 100): Promise<AdminUserRow[]> {
  if (isSupabaseConfigured() && isSupabaseAdminConfigured()) {
    const admin = getSupabaseAdminClient()!
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, display_name, role, level, target_language, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    const rows = (profiles ?? []) as Record<string, unknown>[]
    const result: AdminUserRow[] = []
    for (const p of rows) {
      const id = String(p.id)
      const [hist, vocab, last] = await Promise.all([
        admin.from('learning_history').select('id', { count: 'exact', head: true }).eq('user_id', id),
        admin.from('vocabulary').select('id', { count: 'exact', head: true }).eq('user_id', id),
        admin
          .from('learning_history')
          .select('created_at')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      result.push({
        id,
        email: String(p.email ?? ''),
        displayName: (p.display_name as string) ?? null,
        role: (p.role as Role) ?? 'user',
        level: (p.level as AdminUserRow['level']) ?? 'beginner',
        targetLanguage: String(p.target_language ?? 'English'),
        createdAt: new Date(String(p.created_at)).toISOString(),
        activityCount: hist.count ?? 0,
        vocabularyCount: vocab.count ?? 0,
        lastActivityAt: (last.data as { created_at?: string } | null)?.created_at
          ? new Date(String((last.data as { created_at: string }).created_at)).toISOString()
          : null,
      })
    }
    return result
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      learningHistory: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  })
  const result: AdminUserRow[] = []
  for (const u of users) {
    const [activityCount, vocabularyCount] = await Promise.all([
      db.learningHistory.count({ where: { userId: u.id } }),
      db.vocabulary.count({ where: { userId: u.id } }),
    ])
    result.push({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role as Role,
      level: u.level as AdminUserRow['level'],
      targetLanguage: u.targetLanguage,
      createdAt: u.createdAt.toISOString(),
      activityCount,
      vocabularyCount,
      lastActivityAt: u.learningHistory[0]?.createdAt?.toISOString() ?? null,
    })
  }
  return result
}

export async function adminAiLogs(opts: { limit?: number; status?: 'success' | 'error' } = {}): Promise<AiUsageLogDTO[]> {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50))
  if (isSupabaseConfigured() && isSupabaseAdminConfigured()) {
    const admin = getSupabaseAdminClient()!
    let q = admin
      .from('ai_usage_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (opts.status) q = q.eq('status', opts.status)
    const { data } = await q
    const rows = (data ?? []) as Record<string, unknown>[]
    // enrich emails
    const emails = new Map<string, string>()
    const { data: profiles } = await admin.from('profiles').select('id, email').limit(500)
    for (const p of (profiles ?? []) as { id: string; email: string }[]) emails.set(p.id, p.email)
    return rows.map((r) => mapLog(r, emails.get(String(r.user_id)) ?? null))
  }
  const rows = await db.aiUsageLog.findMany({
    where: opts.status ? { status: opts.status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { email: true } } },
  })
  return rows.map((r) => mapLog(r as unknown as Record<string, unknown>, r.user?.email ?? null))
}

export interface DbHealth {
  driver: 'supabase' | 'local'
  latencyMs: number
  tables: { name: string; rows: number }[]
  status: 'healthy' | 'degraded'
  error: string | null
}

export async function adminDbHealth(): Promise<DbHealth> {
  const started = Date.now()
  try {
    if (isSupabaseConfigured() && isSupabaseAdminConfigured()) {
      const admin = getSupabaseAdminClient()!
      const tables = ['profiles', 'chat_sessions', 'chat_messages', 'translation_history', 'vocabulary', 'lessons', 'lesson_progress', 'quiz_attempts', 'quiz_questions', 'learning_history', 'learning_progress', 'user_streaks', 'ai_usage_logs']
      const rows: { name: string; rows: number }[] = []
      for (const t of tables) {
        const { count } = await admin.from(t).select('id', { count: 'exact', head: true })
        rows.push({ name: t, rows: count ?? 0 })
      }
      const latencyMs = Date.now() - started
      return {
        driver: 'supabase',
        latencyMs,
        tables: rows,
        status: latencyMs < 3000 ? 'healthy' : 'degraded',
        error: null,
      }
    }

    const tables = ['user', 'chatSession', 'chatMessage', 'translationHistory', 'vocabulary', 'lesson', 'lessonProgress', 'quizAttempt', 'quizQuestion', 'learningHistory', 'learningProgress', 'userStreak', 'aiUsageLog'] as const
    const names = ['users (auth)', 'chat_sessions', 'chat_messages', 'translation_history', 'vocabulary', 'lessons', 'lesson_progress', 'quiz_attempts', 'quiz_questions', 'learning_history', 'learning_progress', 'user_streaks', 'ai_usage_logs']
    const rows: { name: string; rows: number }[] = []
    for (const [i, t] of tables.entries()) {
      const count = await (db[t] as { count: (a: { cacheStrategy?: unknown }) => Promise<number> }).count({})
      rows.push({ name: names[i], rows: count })
    }
    const latencyMs = Date.now() - started
    return { driver: 'local', latencyMs, tables: rows, status: 'healthy', error: null }
  } catch (e) {
    return {
      driver: isSupabaseConfigured() ? 'supabase' : 'local',
      latencyMs: Date.now() - started,
      tables: [],
      status: 'degraded',
      error: e instanceof Error ? e.message : 'Kueri basis data gagal.',
    }
  }
}
