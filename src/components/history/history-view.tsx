'use client'

// MikuAI — Learning history: unified activity log with filters, search,
// detail view, and delete.
import { useCallback, useEffect, useState } from 'react'
import {
  History as HistoryIcon, Search, Trash2, Loader2, Sparkles, Languages,
  GraduationCap, BookMarked, ClipboardList, X, FileWarning, Timer, PenLine,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiDelete, apiFetch } from '@/lib/client/api'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGUAGES, languageFlag } from '@/lib/languages'
import type { ActivityType, HistoryDTO, SessionUser } from '@/lib/types'

const TYPE_META: Record<ActivityType, { label: string; icon: typeof Sparkles; color: string }> = {
  tutor: { label: 'AI Tutor', icon: Sparkles, color: 'text-primary' },
  translation: { label: 'Terjemahan', icon: Languages, color: 'text-[#43d0a0]' },
  lesson: { label: 'Pelajaran', icon: GraduationCap, color: 'text-[#9d7bff]' },
  vocabulary: { label: 'Kosakata', icon: BookMarked, color: 'text-[#f0b429]' },
  quiz: { label: 'Kuis', icon: ClipboardList, color: 'text-[#ef4d56]' },
  exam: { label: 'Ujian', icon: Timer, color: 'text-[#ef4d56]' },
  assignment: { label: 'Tugas Menulis', icon: PenLine, color: 'text-[#43d0a0]' },
}

const ALL_TYPES: ActivityType[] = ['tutor', 'translation', 'lesson', 'vocabulary', 'quiz', 'exam', 'assignment']

export function HistoryView({ user }: { user: SessionUser }) {
  const [items, setItems] = useState<HistoryDTO[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [types, setTypes] = useState<ActivityType[]>([])
  const [language, setLanguage] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [detail, setDetail] = useState<HistoryDTO | null>(null)
  const pageSize = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (search.trim()) params.set('search', search.trim())
      if (types.length) params.set('types', types.join(','))
      if (language !== 'all') params.set('language', language)
      if (from) params.set('from', from)
      if (to) params.set('to', `${to}T23:59:59.999Z`)
      const res = await apiFetch<{ items: HistoryDTO[]; total: number }>(`/api/history?${params}`, { silent: true })
      setItems(res.items)
      setTotal(res.total)
    } catch {
      toast.error('Gagal memuat riwayat.')
    } finally {
      setLoading(false)
    }
     
  }, [page, search, types, language, from, to])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(item: HistoryDTO) {
    if (!window.confirm(`Hapus aktivitas "${item.title}" dari riwayat?`)) return
    try {
      await apiDelete(`/api/history/${item.id}`)
      setItems((it) => it.filter((x) => x.id !== item.id))
      setTotal((t) => t - 1)
      if (detail?.id === item.id) setDetail(null)
      toast.success('Aktivitas dihapus dari riwayat.')
    } catch {
      /* handled */
    }
  }

  function toggleType(t: ActivityType) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const activeFilters = types.length > 0 || language !== 'all' || from || to || search.trim()

  return (
    <div className="space-y-4 animate-fade-up">
      <Card className="border-border bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-[15px]">
            <HistoryIcon size={16} className="text-primary" /> Riwayat Belajar
            <span className="ml-auto text-[11.5px] font-normal text-silver">{total} aktivitas</span>
          </CardTitle>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-silver/60" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Cari aktivitas…"
                className="h-9 pl-8 text-[13px] bg-secondary/50"
                aria-label="Cari riwayat"
              />
            </div>
            <Select value={language} onValueChange={(v) => { setLanguage(v); setPage(1) }}>
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
            <Input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1) }}
              className="h-9 w-[140px] text-[12.5px] bg-secondary/50"
              aria-label="Dari tanggal"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1) }}
              className="h-9 w-[140px] text-[12.5px] bg-secondary/50"
              aria-label="Sampai tanggal"
            />
            {activeFilters && (
              <Button variant="ghost" size="sm" className="h-9 text-[12px] text-silver" onClick={() => { setSearch(''); setTypes([]); setLanguage('all'); setFrom(''); setTo(''); setPage(1) }}>
                <X size={13} className="mr-1" /> Reset filter
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {ALL_TYPES.map((t) => {
              const meta = TYPE_META[t]
              const active = types.includes(t)
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors',
                    active ? 'border-primary bg-primary/12 text-foreground' : 'border-[rgba(168,183,204,0.2)] text-silver hover:text-foreground',
                  )}
                >
                  <meta.icon size={12} className={active ? meta.color : 'text-silver/60'} />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <FileWarning className="mx-auto mb-3 text-silver/50" size={28} />
              <p className="text-[14px] text-silver">
                {activeFilters ? 'Tidak ada aktivitas yang cocok dengan filter.' : 'Belum ada aktivitas belajar tercatat.'}
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-[rgba(168,183,204,0.08)]">
                {items.map((h) => {
                  const meta = TYPE_META[h.activityType] ?? TYPE_META.tutor
                  const Icon = meta.icon
                  return (
                    <li key={h.id} className="group flex items-center gap-3 py-3">
                      <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary', meta.color)}>
                        <Icon size={15} />
                      </span>
                      <button className="min-w-0 flex-1 text-left" onClick={() => setDetail(h)}>
                        <p className="truncate text-[13.5px] text-foreground">{h.title}</p>
                        <p className="text-[11.5px] text-silver/80">
                          {new Date(h.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {h.language ? ` · ${languageFlag(h.language)} ${h.language}` : ''}
                          {h.durationMinutes ? ` · ${h.durationMinutes} mnt` : ''}
                        </p>
                      </button>
                      <Badge variant="outline" className="hidden sm:inline-flex text-[10.5px] border-[rgba(168,183,204,0.2)] text-silver capitalize">
                        {meta.label}
                      </Badge>
                      <button
                        className="rounded-lg p-1.5 text-silver/50 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-opacity"
                        onClick={() => remove(h)}
                        aria-label={`Hapus ${h.title}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  )
                })}
              </ul>
              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between">
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

      {/* Detail dialog */}
      <Dialog open={Boolean(detail)} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[15px] flex items-center gap-2">
              {detail && metaOf(detail.activityType, { className: 'text-primary', size: 16 })}
              Detail aktivitas
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-[13.5px]">
              <p className="text-foreground font-medium leading-relaxed">{detail.title}</p>
              {detail.description && <p className="text-silver leading-relaxed">{detail.description}</p>}
              <div className="rounded-xl border border-border bg-secondary/40 p-3.5 space-y-1.5 text-[12.5px]">
                <p className="text-silver">Kategori: <span className="capitalize text-foreground">{TYPE_META[detail.activityType]?.label ?? detail.activityType}</span></p>
                {detail.language && <p className="text-silver">Bahasa: <span className="text-foreground">{detail.language}</span></p>}
                <p className="text-silver">Waktu: <span className="text-foreground">{new Date(detail.createdAt).toLocaleString('id-ID')}</span></p>
                {detail.durationMinutes && <p className="text-silver">Durasi: <span className="text-foreground">{detail.durationMinutes} menit</span></p>}
                {detail.metadata && Object.keys(detail.metadata).length > 0 && (
                  <p className="text-silver break-all">Detail: <span className="text-foreground">{JSON.stringify(detail.metadata)}</span></p>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            {detail && (
              <Button size="sm" variant="destructive" onClick={() => remove(detail)}>
                {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Trash2 size={14} className="mr-1" />}
                Hapus dari Riwayat
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function metaOf(type: ActivityType, props: { className?: string; size?: number }) {
  const Icon = TYPE_META[type]?.icon ?? Sparkles
  return <Icon {...props} />
}
