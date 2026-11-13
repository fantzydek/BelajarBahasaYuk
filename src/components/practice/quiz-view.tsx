'use client'

// MikuAI — AI Quiz (Kuis): generate with Grok, take, submit, review mistakes.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ClipboardList, Sparkles, Loader2, Send, RotateCcw, Check, X,
  History as HistoryIcon, ChevronLeft, Target, AlertTriangle, Lightbulb,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { apiPost, apiFetch, ApiClientError } from '@/lib/client/api'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGUAGES, LEVELS, QUIZ_TYPES, languageFlag } from '@/lib/languages'
import type { QuizAttemptDTO, QuizQuestionDTO, SessionUser } from '@/lib/types'

type Phase = 'setup' | 'running' | 'result'

export function QuizView({ user }: { user: SessionUser }) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [language, setLanguage] = useState(user.targetLanguage)
  const [level, setLevel] = useState(user.level)
  const [quizType, setQuizType] = useState('multiple_choice')
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(5)
  const [generating, setGenerating] = useState(false)

  const [attempt, setAttempt] = useState<QuizAttemptDTO | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [chips, setChips] = useState<Record<string, string[]>>({})
  const startedAt = useRef<number>(0)
  const [submitting, setSubmitting] = useState(false)

  // results
  const [result, setResult] = useState<{ score: number; correctCount: number; weakTopics: string[] } | null>(null)

  // past attempts
  const [past, setPast] = useState<QuizAttemptDTO[]>([])
  const [pastLoading, setPastLoading] = useState(true)
  const [pastPage, setPastPage] = useState(1)

  const loadPast = useCallback(async () => {
    setPastLoading(true)
    try {
      const res = await apiFetch<{ items: QuizAttemptDTO[]; total: number }>(`/api/quiz/attempts?page=${pastPage}&limit=8&mode=practice`, { silent: true })
      setPast(res.items)
    } finally {
      setPastLoading(false)
    }
     
  }, [pastPage])

  useEffect(() => {
    void loadPast()
  }, [loadPast])

  async function generate() {
    setGenerating(true)
    try {
      const res = await apiPost<{ attempt: QuizAttemptDTO }>('/api/ai/quiz', {
        language,
        level,
        quizType,
        topic: topic.trim() || null,
        count,
      })
      setAttempt(res.attempt)
      setAnswers({})
      setChips({})
      startedAt.current = Date.now()
      setPhase('running')
      toast.success(`Kuis siap: ${res.attempt.totalQuestions} soal.`)
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'ai_output_invalid') {
        toast.error('AI menghasilkan soal yang tidak valid. Coba lagi atau ubah topik.')
      }
    } finally {
      setGenerating(false)
    }
  }

  function setAnswer(questionId: string, value: string) {
    setAnswers((a) => ({ ...a, [questionId]: value }))
  }

  function toggleChip(q: QuizQuestionDTO, word: string) {
    const used = chips[q.id] ?? []
    if (used.includes(word)) {
      setChips((c) => ({ ...c, [q.id]: used.filter((w) => w !== word) }))
      setAnswers((a) => ({ ...a, [q.id]: used.filter((w) => w !== word).join(' ') }))
    } else {
      const next = [...used, word]
      setChips((c) => ({ ...c, [q.id]: next }))
      setAnswers((a) => ({ ...a, [q.id]: next.join(' ') }))
    }
  }

  async function submit() {
    if (!attempt) return
    setSubmitting(true)
    try {
      const durationSeconds = Math.round((Date.now() - startedAt.current) / 1000)
      const payload = {
        attemptId: attempt.id,
        answers: attempt.questions!.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? '' })),
        durationSeconds,
      }
      const res = await apiPost<{ attempt: QuizAttemptDTO; score: number; correctCount: number; weakTopics: string[] }>(
        `/api/quiz/attempts/${attempt.id}/submit`,
        payload,
      )
      setAttempt(res.attempt)
      setResult({ score: res.score, correctCount: res.correctCount, weakTopics: res.weakTopics })
      setPhase('result')
      void loadPast()
      toast.success(`Kuis selesai! Nilai Anda: ${res.score}`)
    } catch {
      /* handled */
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setPhase('setup')
    setAttempt(null)
    setResult(null)
    setAnswers({})
    setChips({})
  }

  async function viewPast(a: QuizAttemptDTO) {
    try {
      const res = await apiFetch<{ attempt: QuizAttemptDTO }>(`/api/quiz/attempts/${a.id}`)
      setAttempt(res.attempt)
      setResult({ score: res.attempt.score ?? 0, correctCount: res.attempt.correctCount, weakTopics: res.attempt.weakTopics })
      setPhase('result')
    } catch {
      /* handled */
    }
  }

  // ---------- Running quiz ----------
  if (phase === 'running' && attempt) {
    const answeredCount = attempt.questions!.filter((q) => (answers[q.id] ?? '').trim().length > 0).length
    return (
      <div className="mx-auto max-w-[760px] space-y-4 animate-fade-up">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-silver hover:text-white" onClick={reset}>
            <ChevronLeft size={15} className="mr-1" /> Batalkan
          </Button>
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[11px]">
            {answeredCount}/{attempt.questions!.length} terjawab
          </Badge>
          <span className="ml-auto text-[12px] text-silver">{languageFlag(language)} {language} · {topic || 'topik umum'}</span>
        </div>

        {attempt.questions!.map((q, idx) => (
          <Card key={q.id} className="border-border bg-card/80">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/12 text-[12px] font-bold text-primary">{idx + 1}</span>
                <Badge variant="outline" className="text-[10px] border-[rgba(168,183,204,0.2)] text-silver">
                  {q.questionType === 'multiple_choice' ? 'Pilihan Ganda' : q.questionType === 'fill_blank' ? 'Isian' : 'Susun Kalimat'}
                </Badge>
                {q.topic && <span className="text-[10.5px] text-silver/60">{q.topic}</span>}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-[14.5px] leading-relaxed text-foreground whitespace-pre-line">{q.question}</p>

              {q.questionType === 'multiple_choice' && (
                <div className="mt-3 grid gap-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setAnswer(q.id, opt)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-[13.5px] transition-all',
                        answers[q.id] === opt
                          ? 'border-primary bg-primary/12 text-foreground'
                          : 'border-border bg-secondary/40 text-silver hover:border-primary/40 hover:text-foreground',
                      )}
                    >
                      <span className={cn('inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border', answers[q.id] === opt ? 'border-primary bg-primary' : 'border-[rgba(168,183,204,0.4)]')}>
                        {answers[q.id] === opt && <Check size={10} className="text-primary-foreground" />}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.questionType === 'fill_blank' && (
                <Input
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Tulis jawabanmu di sini…"
                  className="mt-3 text-[14px]"
                  aria-label={`Jawaban soal ${idx + 1}`}
                />
              )}

              {q.questionType === 'sentence_arrangement' && (
                <div className="mt-3 space-y-3">
                  <div className="flex min-h-[42px] flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/8 p-2.5">
                    {(chips[q.id] ?? []).length === 0 && <span className="text-[12.5px] text-silver/60">Klik kata di bawah untuk menyusun kalimat…</span>}
                    {(chips[q.id] ?? []).map((w, i) => (
                      <button
                        key={`${w}-${i}`}
                        onClick={() => toggleChip(q, w)}
                        className="rounded-lg bg-primary text-primary-foreground px-2.5 py-1 text-[13px]"
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {q.options.filter((w) => !(chips[q.id] ?? []).includes(w)).map((w, i) => (
                      <button
                        key={`${w}-${i}`}
                        onClick={() => toggleChip(q, w)}
                        className="rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-[13px] text-silver hover:border-primary/40 hover:text-foreground transition-colors"
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        <div className="sticky bottom-3 rounded-2xl border border-border bg-card/95 backdrop-blur p-3 flex items-center gap-3">
          <p className="text-[12.5px] text-silver flex-1">
            {answeredCount < attempt.questions!.length
              ? `${attempt.questions!.length - answeredCount} soal belum dijawab — boleh langsung kumpul atau isi dulu.`
              : 'Semua soal terjawab. Siap dikumpulkan!'}
          </p>
          <Button onClick={submit} disabled={submitting} className="bg-primary hover:bg-primary/90">
            {submitting ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <Send size={15} className="mr-1.5" />}
            Kumpulkan
          </Button>
        </div>
      </div>
    )
  }

  // ---------- Result ----------
  if (phase === 'result' && attempt) {
    const score = result?.score ?? attempt.score ?? 0
    const passed = score >= 70
    return (
      <div className="mx-auto max-w-[760px] space-y-4 animate-fade-up">
        <Card className={cn('border bg-card/80', passed ? 'border-[#43d0a0]/40' : 'border-[#f0b429]/40')}>
          <CardContent className="py-6 text-center">
            <p className="text-[13px] text-silver">Nilai kuis Anda</p>
            <p className="mt-1 text-5xl font-bold" style={{ fontFamily: 'var(--font-display), sans-serif', color: passed ? '#43d0a0' : '#f0b429' }}>
              {score}
            </p>
            <p className="mt-1.5 text-[13.5px] text-silver">
              {result?.correctCount ?? attempt.correctCount} benar dari {attempt.totalQuestions} soal · {languageFlag(attempt.language)} {attempt.language}
            </p>
            {result && result.weakTopics.length > 0 && (
              <div className="mt-4 rounded-xl border border-[#f0b429]/30 bg-[#f0b429]/8 p-3.5 text-left">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                  <Target size={14} className="text-[#f0b429]" /> Topik yang perlu diulang
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.weakTopics.map((t) => (
                    <Badge key={t} variant="outline" className="border-[#f0b429]/40 text-[#f0b429]">{t}</Badge>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-silver">Latih topik ini di AI Tutor atau buat kuis baru dengan topik yang sama.</p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={reset} className="bg-primary hover:bg-primary/90">
                <RotateCcw size={14} className="mr-1.5" /> Buat Kuis Baru
              </Button>
              <Button variant="outline" className="text-silver" onClick={() => setPhase('setup')}>
                <ClipboardList size={14} className="mr-1.5" /> Kembali ke Generator
              </Button>
            </div>
          </CardContent>
        </Card>

        <h3 className="text-[15px] font-semibold text-foreground">Pembahasan jawaban</h3>
        {attempt.questions!.map((q, idx) => {
          const correct = q.isCorrect === true
          return (
            <Card key={q.id} className={cn('border bg-card/80', correct ? 'border-[#43d0a0]/30' : 'border-[#ef4d56]/30')}>
              <CardContent className="p-4">
                <div className="flex items-start gap-2.5">
                  <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', correct ? 'bg-[#43d0a0]/15 text-[#43d0a0]' : 'bg-[#ef4d56]/15 text-[#ef4d56]')}>
                    {correct ? <Check size={13} /> : <X size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] leading-relaxed text-foreground whitespace-pre-line">
                      <span className="text-silver mr-1.5">{idx + 1}.</span>
                      {q.question}
                    </p>
                    <div className="mt-2 grid gap-1.5 text-[13px]">
                      <p>
                        <span className="text-silver/70">Jawaban Anda: </span>
                        <span className={correct ? 'text-[#43d0a0] font-medium' : 'text-[#ef4d56] font-medium'}>
                          {(q.userAnswer ?? '').trim() || '— (kosong)'}
                        </span>
                      </p>
                      {!correct && (
                        <p>
                          <span className="text-silver/70">Jawaban benar: </span>
                          <span className="text-[#43d0a0] font-medium">{q.correctAnswer}</span>
                        </p>
                      )}
                      {q.explanation && (
                        <p className="mt-1 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[12.5px] leading-relaxed text-silver">
                          <Lightbulb size={12} className="mr-1 inline text-[#f0b429]" />
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  // ---------- Setup + history ----------
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px] animate-fade-up">
      <Card className="border-border bg-card/80 self-start">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <ClipboardList size={16} className="text-primary" /> Generator Kuis AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[12px] text-silver">Bahasa</label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.name}>{l.flag} {l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] text-silver">Level</label>
              <Select value={level} onValueChange={(v) => setLevel(v as SessionUser['level'])}>
                <SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] text-silver">Jenis kuis</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {QUIZ_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setQuizType(t.value)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-left text-[12.5px] transition-all',
                    quizType === t.value
                      ? 'border-primary bg-primary/12 text-foreground font-medium'
                      : 'border-border bg-secondary/40 text-silver hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <div className="space-y-1.5">
              <label className="text-[12px] text-silver">Topik (opsional)</label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="mis. past tense, kosakata makanan…" className="text-[13px]" maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] text-silver">Jumlah soal</label>
              <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
                <SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 5, 8, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} soal</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={generate} disabled={generating} className="w-full bg-primary hover:bg-primary/90 h-11 text-[14px]">
            {generating ? <Loader2 size={15} className="animate-spin mr-2" /> : <Sparkles size={15} className="mr-2" />}
            {generating ? 'Membuat kuis dengan AI…' : 'Generate Kuis'}
          </Button>
          <p className="text-center text-[11.5px] text-silver/70">
            Soal dibuat AI sesuai bahasa, level, dan topik — dinilai otomatis di server.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/80 self-start">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <HistoryIcon size={15} className="text-primary" /> Riwayat Kuis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pastLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
          ) : past.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-silver">Belum ada percobaan kuis.</p>
          ) : (
            <>
              <ul className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
                {past.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => viewPast(a)}
                      className="w-full rounded-xl border border-border bg-secondary/40 p-3 text-left card-hover"
                    >
                      <div className="flex items-center gap-2 text-[11px] text-silver/70">
                        <Badge variant="outline" className="text-[9.5px] border-[rgba(168,183,204,0.2)] text-silver capitalize">
                          {a.quizType.replace(/_/g, ' ')}
                        </Badge>
                        <span>{languageFlag(a.language)} {a.language}</span>
                        <span className="ml-auto">{new Date(a.startedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        {a.status === 'completed' ? (
                          <>
                            <span className={cn('text-[16px] font-bold', (a.score ?? 0) >= 70 ? 'text-[#43d0a0]' : 'text-[#f0b429]')}>{a.score}</span>
                            <span className="text-[11.5px] text-silver">{a.correctCount}/{a.totalQuestions} benar</span>
                          </>
                        ) : (
                          <span className="text-[12px] text-[#f0b429] flex items-center gap-1"><AlertTriangle size={11} /> Belum diselesaikan</span>
                        )}
                      </div>
                      {a.topic && <p className="mt-0.5 text-[11px] text-silver/60">Topik: {a.topic}</p>}
                    </button>
                  </li>
                ))}
              </ul>
              {past.length >= 8 && (
                <div className="flex items-center justify-between pt-1">
                  <Button variant="ghost" size="sm" className="h-7 text-[12px] text-silver" disabled={pastPage <= 1} onClick={() => setPastPage((p) => p - 1)}>
                    Sebelumnya
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-[12px] text-silver" onClick={() => setPastPage((p) => p + 1)}>
                    Berikutnya
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
