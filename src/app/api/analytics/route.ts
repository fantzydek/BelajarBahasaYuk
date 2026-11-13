// MikuAI — GET /api/analytics — learning analytics aggregates (real queries)
import { requireUser, errorResponse } from '@/lib/auth/guard'
import { languageProgress, dailyActivityCounts, quizStats, vocabularyCount, translationCount, chatSessionCount } from '@/lib/data/analytics'
import { getStreak } from '@/lib/data/activity'
import { lessonsCompletedCount } from '@/lib/data/lessons'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const language = url.searchParams.get('language') ?? undefined
    const days = Math.min(90, Math.max(7, Number(url.searchParams.get('days') ?? 30)))

    const [progress, activity, quiz, vocab, translations, sessions, lessons, streak] = await Promise.all([
      languageProgress(user.id),
      dailyActivityCounts(user.id, days),
      quizStats(user.id),
      vocabularyCount(user.id),
      translationCount(user.id),
      chatSessionCount(user.id),
      lessonsCompletedCount(user.id),
      getStreak(user.id),
    ])

    return Response.json({
      progress,
      activity,
      quiz,
      totals: {
        vocabulary: vocab,
        translations,
        chatSessions: sessions,
        lessons,
        studyMinutes: progress.reduce((a, p) => a + p.studyMinutes, 0),
      },
      streak,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
