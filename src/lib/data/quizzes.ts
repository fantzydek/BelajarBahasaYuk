// MikuAI — Quiz attempts & questions data access + server-side grading
// (Supabase / local).
import { db } from '@/lib/db'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { QuestionType, QuizAttemptDTO, QuizQuestionDTO, QuizType, Level } from '@/lib/types'

interface ParsedQuestion {
  questionType: QuestionType
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  topic: string | null
}

interface QuizQuestionRow {
  id: string
  attempt_id: string
  attemptId: string
  question_type: string
  questionType: string
  question: string
  options: unknown
  correct_answer: string
  correctAnswer: string
  explanation: string | null
  user_answer: string | null
  userAnswer: string | null
  is_correct: boolean | null
  isCorrect: boolean | null
  order_index: number
  orderIndex: number
  topic: string | null
}

function mapQuestion(r: QuizQuestionRow, revealAnswers: boolean): QuizQuestionDTO {
  const optionsRaw = r.options
  let options: string[] = []
  if (Array.isArray(optionsRaw)) options = optionsRaw.map(String)
  else if (typeof optionsRaw === 'string') {
    try {
      const parsed = JSON.parse(optionsRaw)
      options = Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      options = []
    }
  }
  return {
    id: r.id,
    attemptId: r.attempt_id ?? r.attemptId,
    questionType: (r.question_type ?? r.questionType) as QuestionType,
    question: r.question,
    options,
    orderIndex: r.order_index ?? r.orderIndex,
    topic: r.topic ?? null,
    ...(revealAnswers
      ? {
          userAnswer: r.user_answer ?? r.userAnswer ?? null,
          isCorrect: r.is_correct ?? r.isCorrect ?? null,
          correctAnswer: r.correct_answer ?? r.correctAnswer,
          explanation: r.explanation ?? null,
        }
      : {}),
  }
}

function mapAttempt(r: Record<string, unknown>, questions?: QuizQuestionDTO[]): QuizAttemptDTO {
  let weak: string[] = []
  const weakRaw = r.weak_topics ?? r.weakTopics
  if (Array.isArray(weakRaw)) weak = weakRaw.map(String)
  else if (typeof weakRaw === 'string') {
    try {
      weak = JSON.parse(weakRaw)
    } catch {
      weak = []
    }
  }
  const mode = (r.mode as string) === 'exam' ? 'exam' : 'practice'
  const timeLimitRaw = r.time_limit_seconds ?? r.timeLimitSeconds
  return {
    id: String(r.id),
    language: String(r.language ?? ''),
    level: (r.level as Level) ?? 'beginner',
    quizType: (r.quiz_type ?? r.quizType) as QuizType,
    mode,
    timeLimitSeconds: timeLimitRaw == null ? null : Number(timeLimitRaw),
    topic: (r.topic as string) ?? null,
    status: (r.status as 'active' | 'completed') ?? 'active',
    totalQuestions: Number(r.total_questions ?? r.totalQuestions ?? 0),
    correctCount: Number(r.correct_count ?? r.correctCount ?? 0),
    score: (r.score as number) ?? null,
    durationSeconds: (r.duration_seconds ?? r.durationSeconds) as number | null,
    weakTopics: weak,
    startedAt: new Date(String(r.started_at ?? r.startedAt)).toISOString(),
    completedAt: r.completed_at
      ? new Date(String(r.completed_at)).toISOString()
      : r.completedAt
        ? new Date(String(r.completedAt)).toISOString()
        : null,
    questions,
  }
}

export async function createAttempt(
  userId: string,
  input: {
    language: string
    level: Level
    quizType: QuizType
    topic: string | null
    questions: ParsedQuestion[]
    mode?: 'practice' | 'exam'
    timeLimitSeconds?: number | null
  },
): Promise<QuizAttemptDTO> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      ?.from('quiz_attempts')
      .insert({
        user_id: userId,
        language: input.language,
        level: input.level,
        quiz_type: input.quizType,
        mode: input.mode ?? 'practice',
        time_limit_seconds: input.timeLimitSeconds ?? null,
        topic: input.topic,
        status: 'active',
        total_questions: input.questions.length,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    const attempt = data as Record<string, unknown>
    const rows = input.questions.map((q, i) => ({
      attempt_id: String(attempt.id),
      user_id: userId,
      question_type: q.questionType,
      question: q.question,
      options: q.options,
      correct_answer: q.correctAnswer,
      explanation: q.explanation,
      order_index: i,
      topic: q.topic,
    }))
    const { data: qRows, error: qError } = await supabase?.from('quiz_questions').insert(rows).select()
    if (qError) throw new Error(qError.message)
    return mapAttempt(attempt, (qRows ?? []).map((r) => mapQuestion(r as QuizQuestionRow, false)))
  }

  const attempt = await db.quizAttempt.create({
    data: {
      userId,
      language: input.language,
      level: input.level,
      quizType: input.quizType,
      mode: input.mode ?? 'practice',
      timeLimitSeconds: input.timeLimitSeconds ?? null,
      topic: input.topic,
      status: 'active',
      totalQuestions: input.questions.length,
    },
  })
  for (const [i, q] of input.questions.entries()) {
    await db.quizQuestion.create({
      data: {
        attemptId: attempt.id,
        userId,
        questionType: q.questionType,
        question: q.question,
        options: JSON.stringify(q.options),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        orderIndex: i,
        topic: q.topic,
      },
    })
  }
  const qRows = await db.quizQuestion.findMany({ where: { attemptId: attempt.id }, orderBy: { orderIndex: 'asc' } })
  return mapAttempt(
    attempt as unknown as Record<string, unknown>,
    qRows.map((r) => mapQuestion(r as unknown as QuizQuestionRow, false)),
  )
}

export async function getAttempt(userId: string, attemptId: string): Promise<QuizAttemptDTO | null> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data: attempt } = await supabase
      ?.from('quiz_attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .single()
    if (!attempt) return null
    const { data: questions } = await supabase
      ?.from('quiz_questions')
      .select('*')
      .eq('attempt_id', attemptId)
      .order('order_index', { ascending: true })
    const reveal = String((attempt as Record<string, unknown>).status) === 'completed'
    return mapAttempt(
      attempt as Record<string, unknown>,
      (questions ?? []).map((r) => mapQuestion(r as QuizQuestionRow, reveal)),
    )
  }
  const attempt = await db.quizAttempt.findFirst({ where: { id: attemptId, userId } })
  if (!attempt) return null
  const questions = await db.quizQuestion.findMany({ where: { attemptId }, orderBy: { orderIndex: 'asc' } })
  return mapAttempt(
    attempt as unknown as Record<string, unknown>,
    questions.map((r) => mapQuestion(r as unknown as QuizQuestionRow, attempt.status === 'completed')),
  )
}

export async function listAttempts(
  userId: string,
  opts: { page?: number; limit?: number; language?: string; quizType?: string; mode?: string } = {},
): Promise<{ items: QuizAttemptDTO[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20))
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    let query = supabase
      ?.from('quiz_attempts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
    if (opts.language) query = query?.eq('language', opts.language)
    if (opts.quizType) query = query?.eq('quiz_type', opts.quizType)
    if (opts.mode) query = query?.eq('mode', opts.mode)
    const { data, count } = await query.range((page - 1) * limit, page * limit - 1)
    return {
      items: (data ?? []).map((r) => mapAttempt(r as Record<string, unknown>)),
      total: count ?? 0,
    }
  }
  const where = {
    userId,
    ...(opts.language ? { language: opts.language } : {}),
    ...(opts.quizType ? { quizType: opts.quizType } : {}),
    ...(opts.mode ? { mode: opts.mode } : {}),
  }
  const [rows, total] = await Promise.all([
    db.quizAttempt.findMany({ where, orderBy: { startedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    db.quizAttempt.count({ where }),
  ])
  return { items: rows.map((r) => mapAttempt(r as unknown as Record<string, unknown>)), total }
}

function normalizeAnswer(a: string): string {
  return a.trim().toLowerCase().replace(/[.,!?;:"'`]+$/g, '').replace(/\s+/g, ' ')
}

export interface SubmitResult {
  attempt: QuizAttemptDTO
  correctCount: number
  score: number
  weakTopics: string[]
}

/** Grade answers server-side, persist results, return revealed attempt. */
export async function submitAttempt(
  userId: string,
  attemptId: string,
  answers: { questionId: string; answer: string }[],
  durationSeconds: number,
  refreshProgressAvg: (userId: string, language: string) => Promise<void>,
): Promise<SubmitResult> {
  const attempt = await getAttempt(userId, attemptId)
  if (!attempt) throw new Error('Percobaan kuis tidak ditemukan.')
  if (attempt.status === 'completed') {
    const full = await getAttempt(userId, attemptId)
    return {
      attempt: full!,
      correctCount: attempt.correctCount,
      score: attempt.score ?? 0,
      weakTopics: attempt.weakTopics,
    }
  }

  const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]))
  let correct = 0
  const topicTally = new Map<string, { total: number; correct: number }>()

  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data: questions } = await supabase
      ?.from('quiz_questions')
      .select('*')
      .eq('attempt_id', attemptId)
      .order('order_index', { ascending: true })
    for (const raw of questions ?? []) {
      const q = raw as QuizQuestionRow
      const userAnswer = answerMap.get(q.id) ?? ''
      const isCorrect =
        normalizeAnswer(userAnswer) !== '' &&
        normalizeAnswer(userAnswer) === normalizeAnswer(q.correct_answer)
      if (isCorrect) correct++
      const topic = q.topic ?? 'umum'
      const t = topicTally.get(topic) ?? { total: 0, correct: 0 }
      topicTally.set(topic, { total: t.total + 1, correct: t.correct + (isCorrect ? 1 : 0) })
      await supabase
        ?.from('quiz_questions')
        .update({ user_answer: userAnswer, is_correct: isCorrect })
        .eq('id', q.id)
        .eq('user_id', userId)
    }
  } else {
    const questions = await db.quizQuestion.findMany({ where: { attemptId, userId } })
    for (const q of questions) {
      const userAnswer = answerMap.get(q.id) ?? ''
      const isCorrect =
        normalizeAnswer(userAnswer) !== '' &&
        normalizeAnswer(userAnswer) === normalizeAnswer(q.correctAnswer)
      if (isCorrect) correct++
      const topic = q.topic ?? 'umum'
      const t = topicTally.get(topic) ?? { total: 0, correct: 0 }
      topicTally.set(topic, { total: t.total + 1, correct: t.correct + (isCorrect ? 1 : 0) })
      await db.quizQuestion.update({
        where: { id: q.id },
        data: { userAnswer, isCorrect },
      })
    }
  }

  const score = attempt.totalQuestions > 0 ? Math.round((correct / attempt.totalQuestions) * 100) : 0
  const weakTopics = [...topicTally.entries()]
    .filter(([, v]) => v.correct / v.total < 0.6)
    .map(([k]) => k)

  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    await supabase
      ?.from('quiz_attempts')
      .update({
        status: 'completed',
        correct_count: correct,
        score,
        duration_seconds: Math.max(1, Math.round(durationSeconds)),
        weak_topics: weakTopics,
        completed_at: new Date().toISOString(),
      })
      .eq('id', attemptId)
      .eq('user_id', userId)
  } else {
    await db.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'completed',
        correctCount: correct,
        score,
        durationSeconds: Math.max(1, Math.round(durationSeconds)),
        weakTopics: JSON.stringify(weakTopics),
        completedAt: new Date(),
      },
    })
  }

  await refreshProgressAvg(userId, attempt.language)
  const full = await getAttempt(userId, attemptId)
  return { attempt: full!, correctCount: correct, score, weakTopics }
}

/** Recompute average quiz score for a language into learning_progress. */
export async function refreshQuizAverage(userId: string, language: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data } = await supabase
      ?.from('quiz_attempts')
      .select('score')
      .eq('user_id', userId)
      .eq('language', language)
      .eq('status', 'completed')
    const scores = (data ?? []).map((r) => Number((r as { score: number | null }).score)).filter((s) => !Number.isNaN(s))
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const { data: prog } = await supabase
      ?.from('learning_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('language', language)
      .single()
    if (prog) {
      await supabase
        ?.from('learning_progress')
        .update({ avg_quiz_score: Math.round(avg * 100) / 100 })
        .eq('id', (prog as { id: string }).id)
    } else {
      await supabase
        ?.from('learning_progress')
        .insert({ user_id: userId, language, quizzes_taken: 0, avg_quiz_score: Math.round(avg * 100) / 100 })
    }
    return
  }
  const rows = await db.quizAttempt.findMany({
    where: { userId, language, status: 'completed' },
    select: { score: true },
  })
  const scores = rows.map((r) => r.score).filter((s): s is number => s !== null)
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  const prog = await db.learningProgress.findUnique({
    where: { userId_language: { userId, language } },
  })
  if (prog) {
    await db.learningProgress.update({
      where: { id: prog.id },
      data: { avgQuizScore: Math.round(avg * 100) / 100 },
    })
  } else {
    await db.learningProgress.create({
      data: { userId, language, avgQuizScore: Math.round(avg * 100) / 100 },
    })
  }
}
