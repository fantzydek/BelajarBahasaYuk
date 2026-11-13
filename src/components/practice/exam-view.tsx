'use client'

// MikuAI — Ujian: timed AI-generated exam (mixed question types), auto-submit
// when the countdown hits zero, server-side grading, pass mark 70.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Timer, Sparkles, Loader2, Send, RotateCcw, Check, X, ChevronLeft,
  Target, AlertTriangle, Lightbulb, Award, Clock,
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
import { SUPPORTED_LANGUAGES, LEVELS, languageFlag } from '@/lib/languages'
import type { QuizAttemptDTO, QuizQuestionDTO, SessionUser } from '@/lib/types'

type Phase = 'setup' | 'running' | 'result'
const PASS_SCORE = 70

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function ExamView({ user }: { user: SessionUser }) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [language, setLanguage] = useState(user.targetLanguage)
  const [level, setLevel] = useState(user.level)
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(10)
  const [minutes, setMinutes] = useState(15)
  const [generating, setGenerating] = useState(false)

  const [attempt, setAttempt] = useState<QuizAttemptDTO | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [chips, setChips] = useState<Record<string, string[]>>({})
  const [secondsLeft, setSecondsLeft] = useState(0)
  const startedAt = useRef<number>(0)
  const autoSubmitted = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [overtime, setOvertime] = useState(false)

  const [result, setResult] = useState<{ score: number; correctCount: number; weakTopics: string[] } | null>(null)

  // past exams
  const [past, setPast] = useState<QuizAttemptDTO[]>([])
  const [pastLoading, setPastLoading] = useState(true)
  const [pastPage, setPastPage] = useState(1)

  const loadPast = useCallback(async () => {
    setPastLoading(true)
    try {
      const res = await apiFetch<{ items: QuizAttemptDTO[]; total: number }>(
        `/api/quiz/attempts?page=${pastPage}&limit=8&mode=exam`,
        { silent: true },
      )
      setPast(res.items)
    } finally {
      setPastLoading(false)
    }
  }, [pastPage])

  useEffect(() => {
    void loadPast()
  }, [loadPast])

  const submit = useCallback(
    async (auto = false) => {
      if (!attempt || submitting || autoSubmitted.current) return
      autoSubmitted.current = true
      setSubmitting(true)
      try {
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))
        const payload = {
          answers: attempt.questions!.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? '' })),
          durationSeconds,
        }
        const res = await apiPost<{ attempt: QuizAttemptDTO; score: number; correctCount: number; weakTopics: string[] }>(
          `/api/quiz/attempts/${attempt.id}/submit`,
          payload,
        )
        setAttempt(res.attempt)
        setResult({ score: res.score, correctCount: res.correctCount, weakTopics: res.weakTopics })
        setOvertime(auto)
        setPhase('result')
        void loadPast()
        toast.success(`Ujian selesai! Nilai Anda: ${res.score}`)
      } catch {
        // allow retry when submission failed
        autoSubmitted.current = false
      } finally {
        setSubmitting(false)
      }
    },
    [attempt, answers, submitting, loadPast],
  )

  // countdown ticker + auto-submit
  useEffect(() => {
    if (phase !== 'running') return
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t)
          void submit(true)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [phase, submit])

  async function generate() {
    setGenerating(true)
    try {
      const res = await apiPost<{ attempt: QuizAttemptDTO }>('/api/ai/exam', {
        language,
        level,
        topic: topic.trim() || null,
        count,
        timeLimitMinutes: minutes,
      })
      setAttempt(res.attempt)
      setAnswers({})
      setChips({})
      autoSubmitted.current = false
      setSecondsLeft(res.attempt.timeLimitSeconds ?? minutes * 60)
      startedAt.current = Date.now()
      setPhase('running')
      toast.success(`Ujian dimulai: ${res.attempt.totalQuestions} soal · ${minutes} menit. Semoga sukses!`)
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'ai_output_invalid') {
        toast.error('AI menghasilkan paket soal yang tidak valid. Coba lagi.')
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

  function reset() {
    setPhase('setup')
    setAttempt(null)
    setResult(null)
    setAnswers({})
    setChips({})
    setOvertime(false)
  }

  async function viewPast(a: QuizAttemptDTO) {
    try {
      const res = await apiFetch<{ attempt: QuizAttemptDTO }>(`/api/quiz/attempts/${a.id}`)
      setAttempt(res.attempt)
      setResult({ score: res.attempt.score ?? 0, correctCount: res.attempt.correctCount, weakTopics: res.attempt.weakTopics })
      setOvertime(false)
      setPhase('result')
    } catch {
      /* handled */
    }
  }

  // ---------- Running exam ----------
  if (phase === 'running' && attempt) {
    const total = attempt.questions!.length
    const answeredCount = attempt.questions!.filter((q) => (answers[q.id] ?? '').trim().length > 0).length
    const urgent = secondsLeft <= 60
    return (
      <div className="mx-auto max-w-[820px] space-y-4 animate-fade-up">
        {/* Sticky exam bar */}
        <div
          className={cn(
            'sticky top-16 z-30 rounded-2xl border p-3.5 backdrop-blur flex flex-wrap items-center gap-3',
            urgent ? 'border-[#ef4d56]/50 bg-[#ef4d56]/10' : 'border-border bg-card/95',
          )}
          role="status"
          aria-live="polite"
        >
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-3 py-1.5 font-bold tabular-nums text-[18px]',
              urgent ? 'bg-[#ef4d56]/15 text-[#ef4d56]' : 'bg-primary/12 text-primary',
            )}
            style={{ fontFamily: 'var(--font-display), sans-serif' }}
          >
            <Timer size={17} className={urgent ? 'animate-pulse' : ''} />
            {formatClock(secondsLeft)}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground">Ujian {languageFlag(language)} {language}</p>
            <p className="text-[11.5px] text-silver">{total} soal · nilai minimal lulus {PASS_SCORE}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className={cn('text-[11px]', urgent ? 'border-[#ef4d56]/40 text-[#ef4d56]' : 'border-primary/40 bg-primary/10 text-primary')}>
              {answeredCount}/{total} terjawab
            </Badge>
          </div>
        </div>

        {urgent && (
          <p className="rounded-xl border border-[#ef4d56]/30 bg-[#ef4d56]/8 px-3.5 py-2 text-[12.5px] text-[#ef4d56] flex items-center gap-1.5">
            <AlertTriangle size={13} /> Waktu hampir habis! Jawaban dikumpulkan otomatis saat waktu berakhir.
          </p>
        )}

        {attempt.questions!.map((q, idx) => (
          <Card key={q.id} className="border-border bg-card/80">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/12 text-[12px] font-bold text-primary">{idx + 1}</span>
                <Badge variant="outline" className="text-[10px] border-[rgba(168,183,204,0.2)] text-silver">
                  {q.questionType === 'multiple_choice' ? 'Pilihan Ganda' : q.questionType === 'fill_blank' ? 'Isian' : 'Susun Kalimat'}
                </Badge>
                {q.topic && <span className="text-[10.5px] text-silver/60">{q.topic}</span>}
                {(answers[q.id] ?? '').trim().length > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-[#43d0a0]"><Check size={11} /> terisi</span>
                )}
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
            {answeredCount < total
              ? `${total - answeredCount} soal belum dijawab.`
              : 'Semua soal terjawab. Kumpulkan sebelum waktu habis!'}
          </p>
          <Button onClick={() => void submit(false)} disabled={submitting} className="bg-primary hover:bg-primary/90">
            {submitting ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <Send size={15} className="mr-1.5" />}
            Kumpulkan Ujian
          </Button>
        </div>
      </div>
    )
  }

  // ---------- Result ----------
  if (phase === 'result' && attempt) {
    const score = result?.score ?? attempt.score ?? 0
    const passed = score >= PASS_SCORE
    const usedSeconds = attempt.durationSeconds ?? 0
    return (
      <div className="mx-auto max-w-[820px] space-y-4 animate-fade-up">
        <Card className={cn('border bg-card/80', passed ? 'border-[#43d0a0]/40' : 'border-[#f0b429]/40')}>
          <CardContent className="py-6 text-center">
            <span
              className={cn(
                'inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-2',
                passed ? 'bg-[#43d0a0]/15 text-[#43d0a0]' : 'bg-[#f0b429]/15 text-[#f0b429]',
              )}
            >
              <Award size={22} />
            </span>
            <p className="text-[13px] text-silver">{passed ? 'Selamat, Anda LULUS ujian!' : 'Belum lulus — terus berlatih!'}</p>
            <p className="mt-1 text-5xl font-bold" style={{ fontFamily: 'var(--font-display), sans-serif', color: passed ? '#43d0a0' : '#f0b429' }}>
              {score}
            </p>
            <p className="mt-1.5 text-[13.5px] text-silver">
              {result?.correctCount ?? attempt.correctCount} benar dari {attempt.totalQuestions} soal ·{' '}
              {languageFlag(attempt.language)} {attempt.language}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-[12px] text-silver">
              <Badge variant="outline" className="border-[rgba(168,183,204,0.2)] text-silver">
                <Clock size={11} className="mr-1" />
                Waktu: {formatClock(usedSeconds)} {attempt.timeLimitSeconds ? `/ ${formatClock(attempt.timeLimitSeconds)}` : ''}
              </Badge>
              {overtime && (
                <Badge variant="outline" className="border-[#ef4d56]/40 text-[#ef4d56]">
                  <AlertTriangle size={11} className="mr-1" /> Dikumpulkan otomatis (waktu habis)
                </Badge>
              )}
              <Badge variant="outline" className={cn('border-[rgba(168,183,204,0.2)]', passed ? 'text-[#43d0a0]' : 'text-[#f0b429]')}>
                Nilai minimal lulus: {PASS_SCORE}
              </Badge>
            </div>
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
                <p className="mt-2 text-[12px] text-silver">Pelajari lagi di Academy atau AI Tutor, lalu coba ujian berikutnya.</p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={reset} className="bg-primary hover:bg-primary/90">
                <RotateCcw size={14} className="mr-1.5" /> Ujian Baru
              </Button>
              <Button variant="outline" className="text-silver" onClick={() => setPhase('setup')}>
                <Timer size={14} className="mr-1.5" /> Kembali ke Setup
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

  // ---------- Setup + past exams ----------
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px] animate-fade-up">
      <Card className="border-border bg-card/80 self-start">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <Timer size={16} className="text-primary" /> Buat Ujian
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-primary/25 bg-primary/8 p-3.5 text-[12.5px] leading-relaxed text-silver">
            <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5"><Award size={13} className="text-primary" /> Aturan ujian</p>
            Soal beragam (pilihan ganda, isian, susun kalimat, pemahaman bacaan) dibuat AI sesuai level.
            Timer berjalan otomatis — jawaban dikumpulkan sendiri saat waktu habis. Nilai kelulusan {PASS_SCORE}.
          </div>

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
            <label className="text-[12px] text-silver">Topik / cakupan materi (opsional)</label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="mis. tenses, kosakata travel… (kosong = umum)" className="text-[13px]" maxLength={120} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[12px] text-silver">Jumlah soal</label>
              <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
                <SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} soal</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] text-silver">Durasi</label>
              <Select value={String(minutes)} onValueChange={(v) => setMinutes(Number(v))}>
                <SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 30].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} menit</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={generate} disabled={generating} className="w-full bg-primary hover:bg-primary/90 h-11 text-[14px]">
            {generating ? <Loader2 size={15} className="animate-spin mr-2" /> : <Sparkles size={15} className="mr-2" />}
            {generating ? 'Menyiapkan paket ujian…' : 'Mulai Ujian'}
          </Button>
          <p className="text-center text-[11.5px] text-silver/70">
            Setelah dimulai, timer tidak bisa dijeda. Siapkan waktu tenang sebelum menekan tombol.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/80 self-start">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <Award size={15} className="text-primary" /> Riwayat Ujian
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pastLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
          ) : past.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-silver">Belum ada ujian. Mulai ujian pertamamu!</p>
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
                        <Badge variant="outline" className="text-[9.5px] border-primary/40 text-primary">UJIAN</Badge>
                        <span>{languageFlag(a.language)} {a.language}</span>
                        <span className="ml-auto">{new Date(a.startedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        {a.status === 'completed' ? (
                          <>
                            <span className={cn('text-[16px] font-bold', (a.score ?? 0) >= PASS_SCORE ? 'text-[#43d0a0]' : 'text-[#f0b429]')}>{a.score}</span>
                            <span className="text-[11.5px] text-silver">{a.correctCount}/{a.totalQuestions} benar</span>
                            {(a.score ?? 0) >= PASS_SCORE ? (
                              <span className="ml-auto text-[10.5px] text-[#43d0a0] flex items-center gap-0.5"><Check size={10} /> Lulus</span>
                            ) : (
                              <span className="ml-auto text-[10.5px] text-[#f0b429]">Belum lulus</span>
                            )}
                          </>
                        ) : (
                          <span className="text-[12px] text-[#f0b429] flex items-center gap-1"><AlertTriangle size={11} /> Belum diselesaikan</span>
                        )}
                      </div>
                      {a.topic && <p className="mt-0.5 text-[11px] text-silver/60">Cakupan: {a.topic}</p>}
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
