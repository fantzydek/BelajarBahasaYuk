'use client'

// MikuAI — Tugas Menulis: AI generates the brief, user writes the essay,
// Grok grades it with a rubric (grammar/vocabulary/structure/content) and
// gives corrected text + improvement feedback. Everything persists to DB.
import { useCallback, useEffect, useState } from 'react'
import {
  PenLine, Sparkles, Loader2, Check, ChevronLeft, Trash2, ClipboardList,
  Target, AlertTriangle, Lightbulb, BookOpen, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { apiPost, apiFetch, apiDelete, ApiClientError } from '@/lib/client/api'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGUAGES, LEVELS, languageFlag } from '@/lib/languages'
import type { SessionUser, WritingAssignmentDTO } from '@/lib/types'

const ASPECTS: { key: 'grammar' | 'vocabulary' | 'structure' | 'content'; label: string; color: string }[] = [
  { key: 'grammar', label: 'Tata Bahasa', color: '#267bff' },
  { key: 'vocabulary', label: 'Kosakata', color: '#43d0a0' },
  { key: 'structure', label: 'Struktur', color: '#9d7bff' },
  { key: 'content', label: 'Isi & Gagasan', color: '#f0b429' },
]

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export function AssignmentsView({ user }: { user: SessionUser }) {
  const [language, setLanguage] = useState(user.targetLanguage)
  const [level, setLevel] = useState(user.level)
  const [topic, setTopic] = useState('')
  const [creating, setCreating] = useState(false)

  const [items, setItems] = useState<WritingAssignmentDTO[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [listLoading, setListLoading] = useState(true)

  const [current, setCurrent] = useState<WritingAssignmentDTO | null>(null)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await apiFetch<{ items: WritingAssignmentDTO[]; total: number }>(
        `/api/assignments?page=${page}&limit=12`,
        { silent: true },
      )
      setItems(res.items)
      setTotal(res.total)
    } finally {
      setListLoading(false)
    }
  }, [page])

  useEffect(() => {
    void loadList()
  }, [loadList])

  async function createAssignment() {
    setCreating(true)
    try {
      const res = await apiPost<{ assignment: WritingAssignmentDTO }>('/api/ai/assignment', {
        language,
        level,
        topic: topic.trim() || null,
      })
      setCurrent(res.assignment)
      setText('')
      toast.success('Tugas baru siap! Selamat menulis.')
      void loadList()
    } finally {
      setCreating(false)
    }
  }

  async function openAssignment(a: WritingAssignmentDTO) {
    try {
      const res = await apiFetch<{ assignment: WritingAssignmentDTO }>(`/api/assignments/${a.id}`)
      setCurrent(res.assignment)
      setText(res.assignment.submissionText ?? '')
    } catch {
      /* handled */
    }
  }

  async function submitAssignment() {
    if (!current) return
    setSubmitting(true)
    try {
      const res = await apiPost<{ assignment: WritingAssignmentDTO }>(
        `/api/assignments/${current.id}/submit`,
        { text: text.trim() },
      )
      setCurrent(res.assignment)
      toast.success(`Tugas dinilai! Nilai keseluruhan: ${res.assignment.overallScore}`)
      void loadList()
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'too_short') {
        toast.error(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function removeAssignment(id: string) {
    setDeletingId(id)
    try {
      await apiDelete(`/api/assignments/${id}`)
      if (current?.id === id) setCurrent(null)
      toast.success('Tugas dihapus.')
      void loadList()
    } finally {
      setDeletingId(null)
    }
  }

  function backToList() {
    setCurrent(null)
  }

  // ---------- Writing view ----------
  if (current && current.status === 'active') {
    const words = countWords(text)
    const minSubmit = Math.floor(current.minWords * 0.6)
    const canSubmit = text.trim().length >= 20 && words >= minSubmit
    return (
      <div className="mx-auto max-w-[820px] space-y-4 animate-fade-up">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-silver hover:text-white" onClick={backToList}>
            <ChevronLeft size={15} className="mr-1" /> Daftar Tugas
          </Button>
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[11px]">
            {languageFlag(current.language)} {current.language} · <span className="capitalize ml-1">{current.level}</span>
          </Badge>
        </div>

        <Card className="border-primary/25 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-start gap-2 text-[16px] leading-snug">
              <FileText size={17} className="mt-0.5 shrink-0 text-primary" />
              {current.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[14px] leading-relaxed text-foreground whitespace-pre-line">{current.prompt}</p>
            {current.instructions && (
              <div className="rounded-xl border border-border bg-secondary/40 p-3">
                <p className="text-[12px] font-semibold text-silver mb-1">Petunjuk penulisan</p>
                <p className="text-[13px] leading-relaxed text-silver whitespace-pre-line">{current.instructions}</p>
              </div>
            )}
            {current.criteria.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold text-silver mb-1.5">Kriteria penilaian</p>
                <div className="flex flex-wrap gap-1.5">
                  {current.criteria.map((c) => (
                    <Badge key={c} variant="outline" className="border-[rgba(168,183,204,0.2)] text-silver text-[11px] font-normal">
                      <Target size={10} className="mr-1 text-primary" /> {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[12px] text-silver/70">Target panjang: <span className="text-foreground font-medium">{current.minWords}–{current.maxWords}</span> kata.</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80">
          <CardContent className="p-4 space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Tulis jawabanmu di sini dalam ${current.language}…`}
              className="min-h-[260px] text-[14.5px] leading-relaxed resize-y"
              aria-label="Jawaban tugas menulis"
              maxLength={8000}
            />
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn('text-[12.5px] tabular-nums', words < current.minWords ? 'text-[#f0b429]' : 'text-[#43d0a0]')}>
                {words} kata · target {current.minWords}–{current.maxWords}
              </span>
              {words > current.maxWords && (
                <span className="text-[12px] text-[#ef4d56]">melebihi batas maksimal — dipersilakan, tapi ringkas lebih baik</span>
              )}
              <Button
                onClick={submitAssignment}
                disabled={submitting || !canSubmit}
                className="ml-auto bg-primary hover:bg-primary/90"
              >
                {submitting ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <Sparkles size={15} className="mr-1.5" />}
                {submitting ? 'Guru AI sedang menilai…' : 'Kumpulkan untuk Dinilai'}
              </Button>
            </div>
            {!canSubmit && text.trim().length > 0 && (
              <p className="text-[12px] text-silver/70">Minimal {minSubmit} kata sebelum bisa dikumpulkan.</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---------- Grading overlay ----------
  if (current && submitting) {
    return (
      <div className="mx-auto max-w-[760px] space-y-4 animate-fade-up">
        <Card className="border-primary/30 bg-card/80">
          <CardContent className="py-10 text-center">
            <Loader2 size={28} className="mx-auto animate-spin text-primary" />
            <p className="mt-4 text-[15px] font-semibold text-foreground">Guru AI sedang menilai tulisanmu…</p>
            <p className="mt-1 text-[13px] text-silver">Menilai 4 aspek: tata bahasa, kosakata, struktur, dan isi — plus koreksi lengkap.</p>
            <div className="mt-5 space-y-2 text-left max-w-[420px] mx-auto">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---------- Result view ----------
  if (current && current.status === 'graded') {
    const scores = current.scores
    const overall = current.overallScore ?? 0
    const fb = current.feedback
    return (
      <div className="mx-auto max-w-[820px] space-y-4 animate-fade-up">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-silver hover:text-white" onClick={backToList}>
            <ChevronLeft size={15} className="mr-1" /> Daftar Tugas
          </Button>
        </div>

        <Card className={cn('border bg-card/80', overall >= 70 ? 'border-[#43d0a0]/40' : 'border-[#f0b429]/40')}>
          <CardContent className="py-6 text-center">
            <p className="text-[13px] text-silver">Nilai tugas &ldquo;{current.title}&rdquo;</p>
            <p className="mt-1 text-5xl font-bold" style={{ fontFamily: 'var(--font-display), sans-serif', color: overall >= 70 ? '#43d0a0' : '#f0b429' }}>
              {overall}
            </p>
            <p className="mt-1.5 text-[13px] text-silver">
              {languageFlag(current.language)} {current.language} · {current.wordCount} kata ·{' '}
              {current.gradedAt ? new Date(current.gradedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
            </p>
            {scores && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 text-left">
                {ASPECTS.map((a) => {
                  const v = scores[a.key]
                  return (
                    <div key={a.key} className="rounded-xl border border-border bg-secondary/40 px-3.5 py-3">
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="text-silver">{a.label}</span>
                        <span className="font-bold text-foreground tabular-nums">{v}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-[rgba(168,183,204,0.15)] overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, v)}%`, backgroundColor: a.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {fb?.summary && (
              <p className="mt-5 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-left text-[13.5px] leading-relaxed text-silver">
                <BookOpen size={13} className="mr-1.5 inline text-primary" />
                {fb.summary}
              </p>
            )}
          </CardContent>
        </Card>

        {fb && (fb.strengths.length > 0 || fb.improvements.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {fb.strengths.length > 0 && (
              <Card className="border-[#43d0a0]/30 bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13.5px] flex items-center gap-1.5 text-[#43d0a0]"><Check size={14} /> Kekuatan tulisanmu</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {fb.strengths.map((s, i) => (
                      <li key={i} className="text-[13px] leading-relaxed text-silver flex gap-2">
                        <span className="text-[#43d0a0] shrink-0">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {fb.improvements.length > 0 && (
              <Card className="border-[#f0b429]/30 bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[13.5px] flex items-center gap-1.5 text-[#f0b429]"><AlertTriangle size={14} /> Perlu diperbaiki</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {fb.improvements.map((s, i) => (
                      <li key={i} className="text-[13px] leading-relaxed text-silver flex gap-2">
                        <span className="text-[#f0b429] shrink-0">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {fb?.correctedText && (
          <Card className="border-primary/25 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-[13.5px] flex items-center gap-1.5 text-primary"><PenLine size={14} /> Versi yang sudah diperbaiki</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="rounded-xl border border-border bg-secondary/40 p-3.5 text-[13.5px] leading-relaxed text-foreground whitespace-pre-line">
                {fb.correctedText}
              </p>
            </CardContent>
          </Card>
        )}

        {fb?.tips && fb.tips.length > 0 && (
          <Card className="border-border bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-[13.5px] flex items-center gap-1.5"><Lightbulb size={14} className="text-[#f0b429]" /> Saran latihan lanjutan</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {fb.tips.map((t, i) => (
                  <li key={i} className="text-[13px] leading-relaxed text-silver flex gap-2">
                    <span className="text-primary shrink-0">→</span> {t}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card className="border-border bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13.5px]">Jawaban aslimu</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="rounded-xl border border-border bg-secondary/30 p-3.5 text-[13.5px] leading-relaxed text-silver whitespace-pre-line">
              {current.submissionText}
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-center gap-2 pb-2">
          <Button onClick={backToList} variant="outline" className="text-silver">
            <ClipboardList size={14} className="mr-1.5" /> Kembali ke Daftar
          </Button>
        </div>
      </div>
    )
  }

  // ---------- List + create ----------
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px] animate-fade-up">
      <Card className="border-border bg-card/80 self-start">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <PenLine size={16} className="text-primary" /> Buat Tugas Menulis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-primary/25 bg-primary/8 p-3.5 text-[12.5px] leading-relaxed text-silver">
            <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5"><Sparkles size={13} className="text-primary" /> Cara kerja</p>
            AI menyusun soal esai sesuai bahasa & level-mu. Tulis jawabanmu, lalu guru AI menilai dengan rubrik
            (tata bahasa, kosakata, struktur, isi), memberi versi perbaikan, dan saran latihan.
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
            <label className="text-[12px] text-silver">Topik (opsional)</label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="mis. surat lamaran kerja, cerita liburan…" className="text-[13px]" maxLength={120} />
          </div>

          <Button onClick={createAssignment} disabled={creating} className="w-full bg-primary hover:bg-primary/90 h-11 text-[14px]">
            {creating ? <Loader2 size={15} className="animate-spin mr-2" /> : <Sparkles size={15} className="mr-2" />}
            {creating ? 'Menyusun tugas dengan AI…' : 'Buat Tugas dengan AI'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/80 self-start">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <ClipboardList size={15} className="text-primary" /> Daftar Tugas
            {total > 0 && <Badge variant="outline" className="ml-auto text-[10px] border-[rgba(168,183,204,0.2)] text-silver">{total}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {listLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-silver">Belum ada tugas. Buat tugas menulis pertamamu!</p>
          ) : (
            <>
              <ul className="space-y-2 max-h-[460px] overflow-y-auto scrollbar-thin pr-1">
                {items.map((a) => (
                  <li key={a.id} className="group relative">
                    <button
                      onClick={() => openAssignment(a)}
                      className="w-full rounded-xl border border-border bg-secondary/40 p-3 text-left card-hover"
                    >
                      <div className="flex items-center gap-2 text-[11px] text-silver/70">
                        {a.status === 'graded' ? (
                          <Badge variant="outline" className="text-[9.5px] border-[#43d0a0]/40 text-[#43d0a0]">Dinilai</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9.5px] border-[#f0b429]/40 text-[#f0b429]">Menunggu</Badge>
                        )}
                        <span>{languageFlag(a.language)} {a.language}</span>
                        <span className="ml-auto">{new Date(a.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                      </div>
                      <p className="mt-1.5 truncate text-[13px] font-medium text-foreground">{a.title}</p>
                      {a.status === 'graded' ? (
                        <p className="mt-0.5 text-[12px]">
                          <span className={cn('font-bold', (a.overallScore ?? 0) >= 70 ? 'text-[#43d0a0]' : 'text-[#f0b429]')}>{a.overallScore}</span>
                          <span className="text-silver/70"> / 100 · {a.wordCount} kata</span>
                        </p>
                      ) : (
                        <p className="mt-0.5 truncate text-[11.5px] text-silver/60">{a.prompt}</p>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void removeAssignment(a.id)
                      }}
                      disabled={deletingId === a.id}
                      aria-label={`Hapus tugas ${a.title}`}
                      className="absolute right-2 top-2 rounded-lg p-1.5 text-silver/50 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                    >
                      {deletingId === a.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </li>
                ))}
              </ul>
              {items.length >= 12 && (
                <div className="flex items-center justify-between pt-1">
                  <Button variant="ghost" size="sm" className="h-7 text-[12px] text-silver" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Sebelumnya
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-[12px] text-silver" onClick={() => setPage((p) => p + 1)}>
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
