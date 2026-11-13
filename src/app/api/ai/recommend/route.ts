// MikuAI — POST /api/ai/recommend — personalized AI learning recommendations
// derived from the user's real statistics (30-minute result cache per user).
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { assertAiAvailable, aiComplete } from '@/lib/ai'
import { recommendPrompt } from '@/lib/ai/prompts'
import { enforceAiRateLimit, failAiAttempt, beginAiAttempt } from '@/lib/ai/route-helpers'
import { extractJson } from '@/lib/ai/json'
import { logAiUsage } from '@/lib/ai/usage'
import { getDashboardStats } from '@/lib/data/analytics'

export const runtime = 'nodejs'
export const maxDuration = 60

const recommendOutputSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        href: z.string(),
        cta: z.string().default('Mulai'),
      }),
    )
    .min(1)
    .max(5),
})

// Simple in-memory TTL cache (30 min) keyed by user id + stats fingerprint.
type RecommendItem = z.infer<typeof recommendOutputSchema>['items'][number]
const cache = new Map<string, { items: RecommendItem[]; expires: number; fingerprint: string }>()
const TTL_MS = 30 * 60 * 1000

export async function POST(_req: NextRequest) {
  const startedAt = Date.now()
  let ctx: ReturnType<typeof beginAiAttempt> | null = null
  try {
    const user = await requireUser()
    enforceAiRateLimit(user, 'recommend')

    const stats = await getDashboardStats(user)

    const fingerprint = `${stats.todayActivity}|${stats.streak.currentStreak}|${stats.quizzesTaken}|${stats.totalVocabulary}|${stats.lessonsCompleted}`
    const cacheKey = `${user.id}:${user.targetLanguage}:${user.level}`
    const cached = cache.get(cacheKey)
    if (cached && cached.expires > Date.now() && cached.fingerprint === fingerprint) {
      return Response.json({ items: cached.items, cached: true })
    }

    {
      const { provider, model } = assertAiAvailable()
      ctx = beginAiAttempt(user, 'recommend', provider, model)

      const statsJson = JSON.stringify({
        bahasa: stats.targetLanguage,
        level: stats.level,
        aktivitasHariIni: stats.todayActivity,
        streakHari: stats.streak.currentStreak,
        totalKosakata: stats.totalVocabulary,
        pelajaranSelesai: stats.lessonsCompleted,
        kuisDikerjakan: stats.quizzesTaken,
        nilaiRataKuis: stats.avgQuizScore,
        menitBelajar: stats.studyMinutes,
        bahasaProgress: stats.languageProgress.map((p) => ({ bahasa: p.language, kosakata: p.vocabularyCount, nilai: p.avgQuizScore })),
      })

      const res = await aiComplete({
        messages: [{ role: 'system', content: recommendPrompt(statsJson) }, { role: 'user', content: 'Buat 3 rekomendasi.' }],
        maxTokens: 800,
        temperature: 0.6,
      })

      const parsed = extractJson(res.content, recommendOutputSchema)

      const validHrefs = new Set(['/tutor', '/translator', '/academy', '/vocabulary', '/practice'])
      const items = parsed.items.map((i) => ({
        title: i.title,
        detail: i.detail,
        href: validHrefs.has(i.href) ? i.href : '/dashboard',
        cta: i.cta,
      }))

      cache.set(cacheKey, { items, expires: Date.now() + TTL_MS, fingerprint })
      await logAiUsage({
        userId: user.id,
        feature: 'recommend',
        provider,
        model,
        promptTokens: res.usage.promptTokens,
        completionTokens: res.usage.completionTokens,
        totalTokens: res.usage.totalTokens,
        durationMs: Date.now() - startedAt,
        status: 'success',
      })
      return Response.json({ items, cached: false })
    }

    return Response.json({ items: cached!.items, cached: false })
  } catch (err) {
    if (ctx) return failAiAttempt(ctx, err, startedAt)
    return errorResponse(err)
  }
}
