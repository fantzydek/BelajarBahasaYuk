'use client'

// MikuAI — Language Academy: structured lessons per language/level with
// completion tracking and on-demand AI lesson generation.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  GraduationCap, BookOpen, CheckCircle2, Sparkles, Loader2, ArrowLeft,
  Library, Feather, MessagesSquare, Sun, BookMarked, FileText, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiPost, apiFetch, ApiClientError } from '@/lib/client/api'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGUAGES, LEVELS, LESSON_CATEGORIES, languageFlag } from '@/lib/languages'
import type { LessonDTO, LessonProgressDTO, LessonSection, Level, SessionUser } from '@/lib/types'

const CATEGORY_ICONS = {
  vocabulary: BookMarked,
  grammar: FileText,
  reading: BookOpen,
  writing: Feather,
  conversation: MessagesSquare,
  daily: Sun,
} as const

export function AcademyView({ user }: { user: SessionUser }) {
  const [language, setLanguage] = useState(user.targetLanguage)
  const [level, setLevel] = useState<Level>(user.level)
  const [lessons, setLessons] = useState<LessonDTO[]>([])
  const [progress, setProgress] = useState<LessonProgressDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<LessonDTO | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch<{ items: LessonDTO[]; progress: LessonProgressDTO[] }>(
        `/api/lessons?language=${encodeURIComponent(language)}&level=${level}`,
        { silent: true },
      )
      setLessons(res.items)
      setProgress(res.progress)
    } catch {
      toast.error('Gagal memuat pelajaran.')
    } finally {
      setLoading(false)
    }
     
  }, [language, level])

  useEffect(() => {
    setActive(null)
    void load()
  }, [load])

  const completedIds = new Set(progress.map((p) => p.lessonId))
  const isCompleted = (id: string) => completedIds.has(id)

  async function generateLesson(category: string) {
    setGenerating(category)
    try {
      const res = await apiPost<{ lesson: LessonDTO }>('/api/ai/lesson', {
        language,
        level,
        category,
        topic: null,
      })
      toast.success(`Pelajaran "${res.lesson.title}" dibuat oleh AI.`)
      await load()
      setActive(res.lesson)
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'ai_unconfigured') {
        toast.error('Layanan AI belum dikonfigurasi. Set XAI_API_KEY di server.')
      }
    } finally {
      setGenerating(null)
    }
  }

  async function completeLesson() {
    if (!active || completing) return
    setCompleting(true)
    try {
      const res = await apiPost<{ ok: boolean; alreadyCompleted: boolean }>('/api/lessons/progress', {
        lessonId: active.id,
        score: 100,
      })
      if (res.alreadyCompleted) {
        toast.info('Pelajaran ini sudah pernah diselesaikan.')
      } else {
        toast.success('Pelajaran selesai! Progres diperbarui.')
      }
      await load()
    } catch {
      /* handled */
    } finally {
      setCompleting(false)
    }
  }

  // ---------- Lesson reader ----------
  if (active) {
    return (
      <div className="mx-auto max-w-[860px] space-y-5 animate-fade-up">
        <Button variant="ghost" size="sm" className="text-silver hover:text-white" onClick={() => setActive(null)}>
          <ArrowLeft size={15} className="mr-1" /> Kembali ke daftar pelajaran
        </Button>

        <header className="rounded-2xl border border-border bg-card/80 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary capitalize">{active.category}</Badge>
            <Badge variant="outline" className="border-[rgba(168,183,204,0.2)] text-silver capitalize">{active.level}</Badge>
            {isCompleted(active.id) && (
              <Badge variant="outline" className="border-[#43d0a0]/40 bg-[#43d0a0]/10 text-[#43d0a0]">
                <CheckCircle2 size={11} className="mr-1" /> selesai
              </Badge>
            )}
          </div>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
            {active.title}
          </h1>
          {active.summary && <p className="mt-1.5 text-[14px] leading-relaxed text-silver">{active.summary}</p>}
        </header>

        {active.sections.map((s, i) => (
          <LessonSectionView key={i} section={s} index={i} language={language} />
        ))}

        <div className="flex items-center justify-between rounded-2xl border border-border bg-card/80 p-5">
          <p className="text-[13px] text-silver">Selesai membaca dan mencoba latihannya?</p>
          <Button
            onClick={completeLesson}
            disabled={completing || isCompleted(active.id)}
            className="bg-primary hover:bg-primary/90"
          >
            {completing ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <CheckCircle2 size={15} className="mr-1.5" />}
            {isCompleted(active.id) ? 'Sudah Selesai' : 'Tandai Selesai'}
          </Button>
        </div>
      </div>
    )
  }

  // ---------- Lesson list ----------
  return (
    <div className="space-y-5 animate-fade-up">
      <section className="rounded-2xl border border-border bg-card/80 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <GraduationCap size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
              Language Academy
            </h2>
            <p className="text-[12.5px] text-silver">
              {languageFlag(language)} {language} · level {LEVELS.find((l) => l.value === level)?.label} · {lessons.filter((l) => isCompleted(l.id)).length}/{lessons.length} selesai
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-9 w-[190px] text-[13px]" aria-label="Pilih bahasa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.name}>{l.flag} {l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
              <SelectTrigger className="h-9 w-[140px] text-[13px]" aria-label="Pilih level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LESSON_CATEGORIES.map((cat) => {
            const catLessons = lessons.filter((l) => l.category === cat.value)
            const Icon = CATEGORY_ICONS[cat.value as keyof typeof CATEGORY_ICONS]
            const doneCount = catLessons.filter((l) => isCompleted(l.id)).length
            return (
              <Card key={cat.value} className="border-border bg-card/80 card-hover flex flex-col">
                <CardContent className="flex flex-1 flex-col p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
                      <Icon size={16.5} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-semibold text-foreground">{cat.label}</h3>
                      <p className="text-[11px] text-silver">
                        {catLessons.length ? `${doneCount}/${catLessons.length} selesai` : 'belum ada pelajaran'}
                      </p>
                    </div>
                  </div>

                  {catLessons.length === 0 ? (
                    <div className="mt-3 flex-1 rounded-xl border border-dashed border-[rgba(168,183,204,0.22)] p-3 text-center">
                      <p className="text-[12px] text-silver leading-relaxed">Belum ada pelajaran untuk kombinasi ini.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-8 text-[12px] border-primary/40 text-primary hover:bg-primary/10"
                        onClick={() => generateLesson(cat.value)}
                        disabled={generating !== null}
                      >
                        {generating === cat.value ? (
                          <><Loader2 size={12} className="mr-1 animate-spin" /> Membuat…</>
                        ) : (
                          <><Sparkles size={12} className="mr-1" /> Buat dengan AI</>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <ul className="mt-3 flex-1 space-y-1.5">
                      {catLessons.slice(0, 4).map((l) => (
                        <li key={l.id}>
                          <button
                            onClick={() => setActive(l)}
                            className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-silver transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <span className={cn('inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border', isCompleted(l.id) ? 'border-[#43d0a0] bg-[#43d0a0]/15 text-[#43d0a0]' : 'border-[rgba(168,183,204,0.3)]')}>
                              {isCompleted(l.id) ? <CheckCircle2 size={11} /> : <Library size={9} className="text-silver/50" />}
                            </span>
                            <span className="flex-1 truncate">{l.title}</span>
                          </button>
                        </li>
                      ))}
                      {catLessons.length > 4 && (
                        <li className="px-2.5 text-[11px] text-silver/60">+{catLessons.length - 4} pelajaran lainnya</li>
                      )}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <p className="text-center text-[12px] text-silver/70">
        Pelajaran bawaan tersedia untuk beberapa bahasa. Untuk kombinasi lain, biarkan AI menyusun pelajaran khusus untuk Anda.
      </p>
    </div>
  )
}

function LessonSectionView({ section, index, language }: { section: LessonSection; index: number; language: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card/80 p-5 sm:p-6 animate-fade-up" style={{ animationDelay: `${index * 60}ms` }}>
      <h2 className="mb-3.5 flex items-center gap-2 text-[16px] font-semibold" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
        {section.heading}
      </h2>

      {section.type === 'explanation' && (
        <p className="text-[14.5px] leading-relaxed text-silver whitespace-pre-line">{section.body}</p>
      )}

      {section.type === 'vocabulary' && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {section.items.map((item, i) => (
            <div key={i} className="rounded-xl border border-border bg-secondary/40 p-3">
              <p className="text-[14px] font-semibold text-foreground">{item.word}</p>
              <p className="mt-0.5 text-[13px] text-primary">{item.translation}</p>
              {item.example && <p className="mt-1.5 text-[12px] italic text-silver/80">“{item.example}”</p>}
            </div>
          ))}
        </div>
      )}

      {section.type === 'examples' && (
        <ul className="space-y-2.5">
          {section.items.map((item, i) => (
            <li key={i} className="rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5">
              <p className="text-[14px] text-foreground">{item.source}</p>
              <p className="mt-0.5 text-[13px] text-silver">{item.translation}</p>
            </li>
          ))}
        </ul>
      )}

      {section.type === 'dialog' && (
        <div className="space-y-2.5">
          {section.lines.map((line, i) => (
            <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
              <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5', i % 2 === 0 ? 'bg-secondary/60 border border-border rounded-bl-md' : 'bg-primary/12 border border-primary/25 rounded-br-md')}>
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-silver/70">{line.speaker}</p>
                <p className="mt-0.5 text-[14px] text-foreground">{line.text}</p>
                <p className="mt-0.5 text-[12.5px] text-silver">{line.translation}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {section.type === 'reading' && (
        <div className="space-y-3">
          <p className="rounded-xl border border-border bg-secondary/40 p-4 text-[14.5px] leading-relaxed text-foreground whitespace-pre-line">{section.body}</p>
          <p className="rounded-xl border border-primary/25 bg-primary/8 p-4 text-[13.5px] leading-relaxed text-silver whitespace-pre-line">{section.translation}</p>
          {section.questions && section.questions.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] uppercase tracking-wider text-silver/60">Pertanyaan pemahaman</p>
              <ol className="list-decimal space-y-1 pl-5 text-[13.5px] text-silver">
                {section.questions.map((q, i) => <li key={i}>{q}</li>)}
              </ol>
            </div>
          )}
        </div>
      )}

      {section.type === 'exercise' && (
        <div className="rounded-xl border border-[#f0b429]/30 bg-[#f0b429]/8 p-4">
          <p className="text-[13.5px] font-medium text-foreground">{section.instructions}</p>
          <ul className="mt-2.5 space-y-1.5">
            {section.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[13.5px] text-silver">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f0b429]" />
                {item}
              </li>
            ))}
          </ul>
          <Link href="/tutor" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline">
            Latih jawabanmu bersama AI Tutor →
          </Link>
        </div>
      )}
    </section>
  )
}
