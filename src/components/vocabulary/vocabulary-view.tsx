'use client'

// MikuAI — Smart Vocabulary: CRUD, search/filter, flashcards, SRS review.
import { useCallback, useEffect, useState } from 'react'
import {
  BookPlus, Search, Trash2, Pencil, Layers, RotateCcw, Loader2,
  ChevronLeft, ChevronRight, Check, X, BookMarked, AlertTriangle, Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { apiPost, apiPatch, apiDelete, apiFetch } from '@/lib/client/api'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGUAGES, languageFlag } from '@/lib/languages'
import type { SessionUser, VocabularyDTO } from '@/lib/types'

type Mode = 'list' | 'flashcards' | 'review'

const emptyForm = {
  id: '',
  language: '',
  word: '',
  translation: '',
  definition: '',
  exampleSentence: '',
  pronunciation: '',
  category: 'general',
}

export function VocabularyView({ user }: { user: SessionUser }) {
  const [mode, setMode] = useState<Mode>('list')
  const [items, setItems] = useState<VocabularyDTO[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [languageFilter, setLanguageFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<string[]>([])

  // add/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // flashcards
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const pageSize = 12

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (search.trim()) params.set('search', search.trim())
      if (languageFilter !== 'all') params.set('language', languageFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (mode === 'review') params.set('due', 'true')
      const res = await apiFetch<{ items: VocabularyDTO[]; total: number }>(`/api/vocabulary?${params}`, { silent: true })
      setItems(res.items)
      setTotal(res.total)
      setCardIndex(0)
      setFlipped(false)
    } catch {
      toast.error('Gagal memuat kosakata.')
    } finally {
      setLoading(false)
    }
     
  }, [page, search, languageFilter, categoryFilter, mode])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    apiFetch<{ items: string[] }>('/api/vocabulary?limit=100', { silent: true })
      .then(() => void 0)
      .catch(() => void 0)
    // category list derived from current items; server endpoint returns items only.
  }, [])

  function openAdd() {
    setForm({ ...emptyForm, language: user.targetLanguage })
    setFormErrors({})
    setDialogOpen(true)
  }

  function openEdit(item: VocabularyDTO) {
    setForm({
      id: item.id,
      language: item.language,
      word: item.word,
      translation: item.translation ?? '',
      definition: item.definition ?? '',
      exampleSentence: item.exampleSentence ?? '',
      pronunciation: item.pronunciation ?? '',
      category: item.category,
    })
    setFormErrors({})
    setDialogOpen(true)
  }

  async function save() {
    const errs: Record<string, string> = {}
    if (!form.word.trim()) errs.word = 'Kata wajib diisi.'
    if (!form.language) errs.language = 'Pilih bahasa.'
    setFormErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      const payload = {
        language: form.language,
        word: form.word.trim(),
        translation: form.translation.trim() || null,
        definition: form.definition.trim() || null,
        exampleSentence: form.exampleSentence.trim() || null,
        pronunciation: form.pronunciation.trim() || null,
        category: form.category.trim() || 'general',
        source: 'manual' as const,
      }
      if (form.id) {
        await apiPatch(`/api/vocabulary/${form.id}`, payload)
        toast.success('Kosakata diperbarui.')
      } else {
        await apiPost('/api/vocabulary', payload)
        toast.success(`"${form.word.trim()}" tersimpan.`)
      }
      setDialogOpen(false)
      await load()
    } catch {
      /* handled */
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: VocabularyDTO) {
    if (!window.confirm(`Hapus "${item.word}" dari kosakata?`)) return
    try {
      await apiDelete(`/api/vocabulary/${item.id}`)
      setItems((it) => it.filter((x) => x.id !== item.id))
      setTotal((t) => t - 1)
      toast.success(`"${item.word}" dihapus.`)
    } catch {
      /* handled */
    }
  }

  async function reviewWord(correct: boolean) {
    const item = items[cardIndex]
    if (!item) return
    try {
      await apiPost('/api/vocabulary/review', { vocabularyId: item.id, correct })
      toast.success(correct ? `Kerja bagus — "${item.word}" naik level!` : `"${item.word}" dijadwalkan ulang.`)
      setFlipped(false)
      setCardIndex((i) => (i + 1 < items.length ? i + 1 : 0))
      await load()
    } catch {
      /* handled */
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // ---------- Flashcards / review mode ----------
  if (mode !== 'list') {
    const current = items[cardIndex]
    return (
      <div className="mx-auto max-w-[640px] space-y-4 animate-fade-up">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-silver hover:text-white" onClick={() => { setMode('list'); setFlipped(false) }}>
            <ChevronLeft size={15} className="mr-1" /> Kembali ke daftar
          </Button>
          <Badge variant="outline" className="ml-auto border-primary/40 bg-primary/10 text-primary text-[11px]">
            {mode === 'review' ? 'Jadwal Review' : 'Flashcards'} · {items.length} kata
          </Badge>
        </div>

        {loading ? (
          <Skeleton className="h-[320px] rounded-2xl" />
        ) : items.length === 0 ? (
          <Card className="border-border bg-card/80">
            <CardContent className="py-12 text-center">
              <BookMarked className="mx-auto mb-3 text-silver/50" size={30} />
              <p className="text-[14px] text-silver">
                {mode === 'review'
                  ? 'Tidak ada kata yang jatuh tempo review hari ini. Kerja bagus! 🎉'
                  : 'Belum ada kosakata. Simpan kata baru dulu dari daftar di bawah.'}
              </p>
              <Button className="mt-4 bg-primary hover:bg-primary/90" onClick={() => setMode('list')}>
                Kembali
              </Button>
            </CardContent>
          </Card>
        ) : current ? (
          <>
            <div className="text-center text-[12.5px] text-silver">
              Kartu {cardIndex + 1} dari {items.length}
            </div>

            <button
              onClick={() => setFlipped((f) => !f)}
              className="group relative block h-[300px] w-full cursor-pointer select-none rounded-3xl border border-border bg-card/90 p-8 text-center transition-all duration-300 hover:border-primary/40"
              aria-label={flipped ? 'Tampilkan depan kartu' : 'Tampilkan belakang kartu'}
            >
              {!flipped ? (
                <div className="flex h-full flex-col items-center justify-center">
                  <p className="text-[11.5px] uppercase tracking-[0.18em] text-silver/60">{languageFlag(current.language)} {current.language}</p>
                  <h2 className="mt-3 text-3xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
                    {current.word}
                  </h2>
                  {current.pronunciation && <p className="mt-2 text-[13px] italic text-silver">/{current.pronunciation}/</p>}
                  <p className="mt-6 text-[12px] text-silver/60">Klik untuk melihat arti</p>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center overflow-y-auto scrollbar-thin">
                  <p className="text-2xl font-bold text-primary" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
                    {current.translation ?? '—'}
                  </p>
                  {current.definition && <p className="mt-3 max-w-[440px] text-[13.5px] leading-relaxed text-silver">{current.definition}</p>}
                  {current.exampleSentence && (
                    <p className="mt-3 max-w-[440px] text-[12.5px] italic text-silver/80">“{current.exampleSentence}”</p>
                  )}
                  <div className="mt-4 flex gap-2 text-[10.5px] text-silver/50">
                    <Badge variant="outline" className="border-[rgba(168,183,204,0.2)] text-silver">mastery {current.masteryLevel}/5</Badge>
                    <Badge variant="outline" className="border-[rgba(168,183,204,0.2)] text-silver capitalize">{current.category}</Badge>
                  </div>
                </div>
              )}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-12 border-[#ef4d56]/40 text-[#ef4d56] hover:bg-[#ef4d56]/10"
                onClick={() => reviewWord(false)}
              >
                <X size={16} className="mr-1.5" /> Belum hafal
              </Button>
              <Button className="h-12 bg-[#43d0a0] hover:bg-[#43d0a0]/90 text-[#08131a] font-semibold" onClick={() => reviewWord(true)}>
                <Check size={16} className="mr-1.5" /> Hafal
              </Button>
            </div>

            <div className="flex items-center justify-center gap-3 text-[12.5px] text-silver">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-silver" onClick={() => { setFlipped(false); setCardIndex((i) => (i - 1 + items.length) % items.length) }} aria-label="Kartu sebelumnya">
                <ChevronLeft size={15} />
              </Button>
              navigasi kartu
              <Button variant="ghost" size="icon" className="h-8 w-8 text-silver" onClick={() => { setFlipped(false); setCardIndex((i) => (i + 1) % items.length) }} aria-label="Kartu berikutnya">
                <ChevronRight size={15} />
              </Button>
            </div>
          </>
        ) : null}
      </div>
    )
  }

  // ---------- List mode ----------
  return (
    <div className="space-y-4 animate-fade-up">
      <Card className="border-border bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-[15px]">
            <BookMarked size={16} className="text-primary" /> Smart Vocabulary
            <span className="ml-auto text-[11.5px] font-normal text-silver">{total} kata tersimpan</span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <div className="relative min-w-[180px] flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-silver/60" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Cari kata atau terjemahan…"
                className="h-9 pl-8 text-[13px] bg-secondary/50"
                aria-label="Cari kosakata"
              />
            </div>
            <Select value={languageFilter} onValueChange={(v) => { setLanguageFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9 w-[160px] text-[12.5px]" aria-label="Filter bahasa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua bahasa</SelectItem>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.name}>{l.flag} {l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9 w-[150px] text-[12.5px]" aria-label="Filter kategori">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-9 text-[12.5px] text-silver" onClick={() => setMode('flashcards')} disabled={total === 0}>
              <Layers size={14} className="mr-1" /> Flashcards
            </Button>
            <Button variant="outline" className="h-9 text-[12.5px] text-primary border-primary/40 hover:bg-primary/10" onClick={() => { setMode('review'); setPage(1) }}>
              <RotateCcw size={14} className="mr-1" /> Review
            </Button>
            <Button className="h-9 bg-primary hover:bg-primary/90 text-[12.5px]" onClick={openAdd}>
              <BookPlus size={14} className="mr-1" /> Tambah Kata
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <BookMarked className="mx-auto mb-3 text-silver/50" size={30} />
              <p className="text-[14px] text-silver">
                {search || languageFilter !== 'all' || categoryFilter !== 'all'
                  ? 'Tidak ada kosakata yang cocok dengan filter.'
                  : 'Belum ada kosakata. Simpan kata dari AI Tutor, Translator, atau tambah manual.'}
              </p>
              <Button className="mt-4 bg-primary hover:bg-primary/90" onClick={openAdd}>
                <Plus size={14} className="mr-1" /> Tambah Kata Pertama
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((v) => (
                  <article key={v.id} className="group rounded-xl border border-border bg-secondary/40 p-3.5 card-hover">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-foreground">{v.word}</p>
                        {v.pronunciation && <p className="text-[11.5px] italic text-silver/70">/{v.pronunciation}/</p>}
                      </div>
                      <Badge variant="outline" className="shrink-0 border-[rgba(168,183,204,0.2)] text-[10px] text-silver">
                        {languageFlag(v.language)}
                      </Badge>
                    </div>
                    {v.translation && <p className="mt-1.5 text-[13.5px] font-medium text-primary">{v.translation}</p>}
                    {v.definition && <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-silver">{v.definition}</p>}
                    {v.exampleSentence && <p className="mt-1.5 line-clamp-1 text-[11.5px] italic text-silver/70">“{v.exampleSentence}”</p>}
                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1" aria-label={`Mastery ${v.masteryLevel} dari 5`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className={cn('h-1.5 w-4 rounded-full', i < v.masteryLevel ? 'bg-primary' : 'bg-secondary')} />
                        ))}
                      </div>
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="rounded p-1.5 text-silver/60 hover:text-primary hover:bg-primary/10" onClick={() => openEdit(v)} aria-label={`Edit ${v.word}`}>
                          <Pencil size={13} />
                        </button>
                        <button className="rounded p-1.5 text-silver/60 hover:text-destructive hover:bg-destructive/10" onClick={() => remove(v)} aria-label={`Hapus ${v.word}`}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button variant="ghost" size="sm" className="h-8 text-[12px] text-silver" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Sebelumnya
                  </Button>
                  <span className="text-[11.5px] text-silver/70">Hal. {page} / {totalPages}</span>
                  <Button variant="ghost" size="sm" className="h-8 text-[12px] text-silver" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Berikutnya
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[480px] max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="text-[15px]">{form.id ? 'Edit kosakata' : 'Tambah kosakata baru'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="v-lang">Bahasa</Label>
                <Select value={form.language} onValueChange={(v) => setForm((f) => ({ ...f, language: v }))}>
                  <SelectTrigger id="v-lang" className="text-[13px]" aria-invalid={Boolean(formErrors.language)}>
                    <SelectValue placeholder="Pilih bahasa" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.name}>{l.flag} {l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.language && <p className="text-[11.5px] text-destructive">{formErrors.language}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-cat">Kategori</Label>
                <Input id="v-cat" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="general, food, travel…" className="text-[13px]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-word">Kata *</Label>
              <Input id="v-word" value={form.word} onChange={(e) => setForm((f) => ({ ...f, word: e.target.value }))} placeholder="Kata dalam bahasa target" className="text-[13px]" aria-invalid={Boolean(formErrors.word)} />
              {formErrors.word && <p className="text-[11.5px] text-destructive">{formErrors.word}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="v-trans">Terjemahan</Label>
                <Input id="v-trans" value={form.translation} onChange={(e) => setForm((f) => ({ ...f, translation: e.target.value }))} placeholder="Arti dalam bahasa Indonesia" className="text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-pron">Pengucapan</Label>
                <Input id="v-pron" value={form.pronunciation} onChange={(e) => setForm((f) => ({ ...f, pronunciation: e.target.value }))} placeholder="ka-fé" className="text-[13px]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-def">Definisi</Label>
              <Textarea id="v-def" value={form.definition} onChange={(e) => setForm((f) => ({ ...f, definition: e.target.value }))} placeholder="Penjelasan singkat arti kata" className="min-h-[60px] text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-ex">Contoh kalimat</Label>
              <Textarea id="v-ex" value={form.exampleSentence} onChange={(e) => setForm((f) => ({ ...f, exampleSentence: e.target.value }))} placeholder="Kalimat contoh pemakaian" className="min-h-[60px] text-[13px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" disabled={saving} onClick={save}>
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {form.id ? 'Simpan Perubahan' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
