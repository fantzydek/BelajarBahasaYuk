'use client'

// MikuAI — AI Translator: detection, swap, styles, alternatives, idioms,
// grammar notes, copy, and history management.
import { useCallback, useEffect, useState } from 'react'
import {
  Languages, ArrowLeftRight, Copy, Loader2, BookPlus, Sparkles,
  Trash2, History as HistoryIcon, Search, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { apiPost, apiDelete, apiFetch, ApiClientError } from '@/lib/client/api'
import { SUPPORTED_LANGUAGES, languageFlag } from '@/lib/languages'
import type { TranslationDTO, TranslationStyle, SessionUser } from '@/lib/types'

const STYLES: { value: TranslationStyle; label: string; hint: string }[] = [
  { value: 'neutral', label: 'Netral', hint: 'Natural untuk semua situasi' },
  { value: 'formal', label: 'Formal', hint: 'Register resmi dan hormat' },
  { value: 'informal', label: 'Informal', hint: 'Bahasa percakapan sehari-hari' },
]

export function TranslatorView({ user }: { user: SessionUser }) {
  const [text, setText] = useState('')
  const [source, setSource] = useState('auto')
  const [target, setTarget] = useState(user.targetLanguage)
  const [style, setStyle] = useState<TranslationStyle>('neutral')
  const [result, setResult] = useState<TranslationDTO | null>(null)
  const [loading, setLoading] = useState(false)
  // history
  const [history, setHistory] = useState<TranslationDTO[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [search, setSearch] = useState('')
  const [historyLoading, setHistoryLoading] = useState(true)
  const [detail, setDetail] = useState<TranslationDTO | null>(null)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({ page: String(historyPage), limit: '8' })
      if (search.trim()) params.set('search', search.trim())
      const res = await apiFetch<{ items: TranslationDTO[]; total: number }>(`/api/translations?${params}`, { silent: true })
      setHistory(res.items)
      setHistoryTotal(res.total)
    } finally {
      setHistoryLoading(false)
    }
     
  }, [historyPage, search])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  function swapLanguages() {
    if (source === 'auto') {
      toast.info('Deteksi otomatis aktif — tulis teksnya dulu, nanti bahasa sumber terdeteksi.')
      return
    }
    setSource(target)
    setTarget(source)
    if (result) {
      setText(result.translatedText)
      setResult(null)
    }
  }

  async function translate() {
    if (!text.trim()) {
      toast.error('Teks yang diterjemahkan tidak boleh kosong.')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await apiPost<{ result: TranslationDTO }>('/api/ai/translate', {
        text: text.trim(),
        sourceLanguage: source,
        targetLanguage: target,
        style,
      })
      setResult(res.result)
      void loadHistory()
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'duplicate_request') {
        toast.info('Permintaan yang sama sedang diproses.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function copyResult() {
    if (!result) return
    await navigator.clipboard.writeText(result.translatedText)
    toast.success('Terjemahan disalin ke clipboard.')
  }

  async function deleteHistoryItem(id: string) {
    try {
      await apiDelete(`/api/translations/${id}`)
      setHistory((h) => h.filter((x) => x.id !== id))
      setHistoryTotal((t) => t - 1)
      if (detail?.id === id) setDetail(null)
      if (result?.id === id) setResult(null)
      toast.success('Riwayat terjemahan dihapus.')
    } catch {
      /* handled */
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px] animate-fade-up">
      <div className="space-y-4">
        {/* Input card */}
        <Card className="border-border bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Languages size={16} className="text-primary" /> AI Translator
              <Badge variant="outline" className="ml-auto border-primary/40 bg-primary/10 text-primary text-[10.5px]">
                <Sparkles size={11} className="mr-1" /> deteksi otomatis
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="h-9 flex-1 text-[13px]" aria-label="Bahasa sumber">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">🌐 Deteksi Otomatis</SelectItem>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.name}>{l.flag} {l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-silver hover:text-primary" onClick={swapLanguages} aria-label="Tukar bahasa">
                <ArrowLeftRight size={15} />
              </Button>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className="h-9 flex-1 text-[13px]" aria-label="Bahasa target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.name}>{l.flag} {l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tulis teks yang ingin diterjemahkan… (maks. 5000 karakter)"
              className="min-h-[120px] bg-secondary/50 text-[14px]"
              maxLength={5000}
              aria-label="Teks sumber"
            />

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden" role="radiogroup" aria-label="Gaya terjemahan">
                {STYLES.map((s) => (
                  <button
                    key={s.value}
                    role="radio"
                    aria-checked={style === s.value}
                    onClick={() => setStyle(s.value)}
                    className={`px-3 py-1.5 text-[12.5px] transition-colors ${style === s.value ? 'bg-primary text-primary-foreground font-medium' : 'text-silver hover:text-foreground hover:bg-secondary'}`}
                    title={s.hint}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <Button onClick={translate} disabled={loading || !text.trim()} className="ml-auto bg-primary hover:bg-primary/90 h-9">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Languages size={15} />}
                {loading ? 'Menerjemahkan…' : 'Terjemahkan'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result card */}
        {loading && (
          <Card className="border-border bg-card/80">
            <CardContent className="space-y-3 py-5">
              <Skeleton className="h-5 w-2/3 rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
              <p className="text-[12px] text-silver flex items-center gap-1.5"><Sparkles size={12} className="text-primary animate-pulse" /> Menganalisis konteks, idiom, dan tata bahasa…</p>
            </CardContent>
          </Card>
        )}

        {result && !loading && (
          <Card className="border-primary/25 bg-card/80 card-hover animate-fade-up">
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-[15px]">
                Terjemahan
                <Badge variant="outline" className="text-[10.5px] border-[rgba(168,183,204,0.2)] text-silver capitalize">
                  {languageFlag(result.sourceLanguage)} {result.sourceLanguage} → {languageFlag(result.targetLanguage)} {result.targetLanguage}
                </Badge>
                <Badge variant="outline" className="text-[10.5px] border-[rgba(168,183,204,0.2)] text-silver capitalize">{result.style}</Badge>
                <Button variant="outline" size="sm" className="ml-auto h-8 text-[12px] text-silver" onClick={copyResult}>
                  <Copy size={13} className="mr-1" /> Salin
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <p className="text-[17px] leading-relaxed font-medium text-foreground">{result.translatedText}</p>

              {result.alternatives.length > 0 && (
                <div>
                  <p className="text-[11.5px] uppercase tracking-wider text-silver/60 mb-1.5">Alternatif</p>
                  <ul className="space-y-1.5">
                    {result.alternatives.map((alt, i) => (
                      <li key={i} className="rounded-lg bg-secondary/50 border border-border px-3 py-2 text-[13.5px] text-silver">{alt}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.explanation && (
                <div>
                  <p className="text-[11.5px] uppercase tracking-wider text-silver/60 mb-1">Penjelasan</p>
                  <p className="text-[13.5px] leading-relaxed text-silver">{result.explanation}</p>
                </div>
              )}
              {result.grammarNotes && (
                <div>
                  <p className="text-[11.5px] uppercase tracking-wider text-silver/60 mb-1">Catatan tata bahasa</p>
                  <p className="text-[13.5px] leading-relaxed text-silver">{result.grammarNotes}</p>
                </div>
              )}
              {result.idioms.length > 0 && (
                <div>
                  <p className="text-[11.5px] uppercase tracking-wider text-silver/60 mb-1.5">Idiom</p>
                  <ul className="space-y-1.5">
                    {result.idioms.map((id, i) => (
                      <li key={i} className="text-[13px] text-silver"><span className="text-primary font-medium">{id.split(' — ')[0]}</span>{' — '}{id.split(' — ').slice(1).join(' — ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* History sidebar */}
      <Card className="border-border bg-card/80 self-start lg:sticky lg:top-[72px]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <HistoryIcon size={15} className="text-primary" /> Riwayat Terjemahan
            <span className="ml-auto text-[11.5px] font-normal text-silver">{historyTotal} total</span>
          </CardTitle>
          <div className="relative pt-1.5">
            <Search size={14} className="absolute left-2.5 top-[22px] text-silver/60" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setHistoryPage(1)
              }}
              placeholder="Cari riwayat…"
              className="h-8 pl-8 text-[12.5px] bg-secondary/50"
              aria-label="Cari riwayat terjemahan"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {historyLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-silver">Belum ada riwayat terjemahan.</p>
          ) : (
            <>
              <ul className="space-y-2 max-h-[430px] overflow-y-auto scrollbar-thin pr-1">
                {history.map((t) => (
                  <li key={t.id} className="group rounded-xl border border-border bg-secondary/40 p-3 card-hover cursor-pointer" onClick={() => setDetail(t)}>
                    <div className="flex items-center gap-1.5 text-[10.5px] text-silver/70">
                      <span>{languageFlag(t.sourceLanguage)} {t.sourceLanguage}</span>
                      <span>→</span>
                      <span>{languageFlag(t.targetLanguage)} {t.targetLanguage}</span>
                      <Badge variant="outline" className="ml-auto text-[9.5px] border-[rgba(168,183,204,0.2)] text-silver capitalize">{t.style}</Badge>
                      <button
                        className="rounded p-0.5 text-silver/50 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          void deleteHistoryItem(t.id)
                        }}
                        aria-label="Hapus riwayat terjemahan"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12.5px] text-silver">{t.sourceText}</p>
                    <p className="mt-0.5 line-clamp-1 text-[12.5px] font-medium text-foreground">{t.translatedText}</p>
                    <p className="mt-1 text-[10px] text-silver/50">
                      {new Date(t.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </li>
                ))}
              </ul>
              {historyTotal > 8 && (
                <div className="flex items-center justify-between pt-1">
                  <Button variant="ghost" size="sm" className="h-7 text-[12px] text-silver" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => p - 1)}>
                    Sebelumnya
                  </Button>
                  <span className="text-[11px] text-silver/70">Hal. {historyPage} / {Math.ceil(historyTotal / 8)}</span>
                  <Button variant="ghost" size="sm" className="h-7 text-[12px] text-silver" disabled={historyPage >= Math.ceil(historyTotal / 8)} onClick={() => setHistoryPage((p) => p + 1)}>
                    Berikutnya
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Detail terjemahan">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetail(null)} aria-label="Tutup" />
          <div className="relative z-10 w-full max-w-[560px] rounded-2xl border border-border bg-card p-5 max-h-[85vh] overflow-y-auto scrollbar-thin animate-fade-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display), sans-serif' }}>Detail terjemahan</h3>
              <button className="rounded-lg p-1.5 text-silver hover:text-white hover:bg-secondary" onClick={() => setDetail(null)} aria-label="Tutup detail">
                ✕
              </button>
            </div>
            <div className="space-y-3 text-[13.5px]">
              <div className="flex gap-2 text-[11px] text-silver/70">
                <Badge variant="outline" className="border-[rgba(168,183,204,0.2)] text-silver capitalize">{detail.sourceLanguage} → {detail.targetLanguage}</Badge>
                <Badge variant="outline" className="border-[rgba(168,183,204,0.2)] text-silver capitalize">{detail.style}</Badge>
              </div>
              <div className="rounded-xl bg-secondary/50 border border-border p-3">
                <p className="text-[11px] uppercase tracking-wider text-silver/60 mb-1">Sumber</p>
                <p className="text-silver leading-relaxed">{detail.sourceText}</p>
              </div>
              <div className="rounded-xl bg-primary/8 border border-primary/25 p-3">
                <p className="text-[11px] uppercase tracking-wider text-silver/60 mb-1">Hasil</p>
                <p className="leading-relaxed text-foreground font-medium">{detail.translatedText}</p>
              </div>
              {detail.explanation && <p className="text-silver leading-relaxed"><strong className="text-foreground">Penjelasan:</strong> {detail.explanation}</p>}
              {detail.grammarNotes && <p className="text-silver leading-relaxed"><strong className="text-foreground">Tata bahasa:</strong> {detail.grammarNotes}</p>}
              {detail.alternatives.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-silver/60 mb-1">Alternatif</p>
                  <ul className="list-disc pl-5 space-y-1 text-silver">{detail.alternatives.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </div>
              )}
              {detail.idioms.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-silver/60 mb-1">Idiom</p>
                  <ul className="space-y-1 text-silver">{detail.idioms.map((i, idx) => <li key={idx}>• {i}</li>)}</ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
