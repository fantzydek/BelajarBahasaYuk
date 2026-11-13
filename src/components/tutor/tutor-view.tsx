'use client'

// MikuAI — AI Tutor: streaming chat with Grok, session management,
// vocabulary saving, and level/language context.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Plus, MessageSquareText, Trash2, Pencil, SendHorizonal, Loader2,
  BookPlus, Sparkles, PanelLeft, X, Check, AlertTriangle, Languages,
} from 'lucide-react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiPost, apiPatch, apiDelete, apiFetch, ApiClientError } from '@/lib/client/api'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGUAGES, LEVELS, languageFlag } from '@/lib/languages'
import type { ChatMessageDTO, ChatSessionDTO, Level, SessionUser } from '@/lib/types'

interface ParsedWord {
  word: string
  pronunciation: string
  partOfSpeech: string
  translation: string
  definition: string
  examples: { source: string; translation: string }[]
  synonyms: string[]
  category: string
}

export function TutorView({ user }: { user: SessionUser }) {
  const [sessions, setSessions] = useState<ChatSessionDTO[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageDTO[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [language, setLanguage] = useState(user.targetLanguage)
  const [level, setLevel] = useState<Level>(user.level)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  // Vocabulary saving
  const [vocabSource, setVocabSource] = useState<ChatMessageDTO | null>(null)
  const [vocabWord, setVocabWord] = useState('')
  const [vocabLookup, setVocabLookup] = useState<ParsedWord | null>(null)
  const [vocabLoading, setVocabLoading] = useState(false)
  const [vocabSaving, setVocabSaving] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const initialized = useRef(false)

  const loadSessions = useCallback(async (selectFirst = false) => {
    try {
      const res = await apiFetch<{ items: ChatSessionDTO[] }>('/api/sessions', { silent: true })
      setSessions(res.items)
      if (selectFirst && res.items.length && !activeId) setActiveId(res.items[0].id)
    } finally {
      setSessionsLoading(false)
    }
     
  }, [])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      void loadSessions(true)
    }
  }, [loadSessions])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    setMessagesLoading(true)
    apiFetch<{ messages: ChatMessageDTO[] }>(`/api/sessions/${activeId}/messages`, { silent: true })
      .then((res) => setMessages(res.messages))
      .catch(() => toast.error('Gagal memuat pesan.'))
      .finally(() => setMessagesLoading(false))
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, streamText])

  async function sendMessage() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setStreaming(true)
    setStreamText('')
    const controller = new AbortController()
    abortRef.current = controller

    let sessionIdForSend = activeId
    const optimistic: ChatMessageDTO = {
      id: `tmp-${Date.now()}`,
      sessionId: sessionIdForSend ?? 'new',
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((m) => [...m, optimistic])

    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdForSend, message: text, language, level }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => null)
        throw new ApiClientError(res.status, payload?.code ?? 'error', payload?.error ?? 'Gagal menghubungi AI.')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let full = ''
      let finalSessionId: string | null = null

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const eventMatch = part.match(/^event: (.+)$/m)
          const dataMatch = part.match(/^data: (.+)$/m)
          if (!eventMatch || !dataMatch) continue
          const event = eventMatch[1]
          const data = JSON.parse(dataMatch[1]) as { text?: string; sessionId?: string; message?: string }
          if (event === 'meta') {
            finalSessionId = data.sessionId ?? null
            if (finalSessionId && finalSessionId !== activeId) {
              setActiveId(finalSessionId)
              sessionIdForSend = finalSessionId
            }
          } else if (event === 'delta' && data.text) {
            full += data.text
            setStreamText(full)
          } else if (event === 'error') {
            toast.error(data.message ?? 'Layanan AI terganggu.')
          } else if (event === 'done') {
            finalSessionId = data.sessionId ?? finalSessionId
          }
        }
      }

      // Reload authoritative messages + sessions (includes saved assistant reply).
      if (sessionIdForSend) {
        setActiveId(sessionIdForSend)
        const res2 = await apiFetch<{ messages: ChatMessageDTO[] }>(`/api/sessions/${sessionIdForSend}/messages`, { silent: true })
        setMessages(res2.messages)
      }
      await loadSessions()
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        toast.info('Pengiriman dibatalkan.')
      } else {
        const msg = err instanceof ApiClientError ? err.message : 'Tidak dapat menghubungi layanan AI. Coba lagi.'
        toast.error(msg)
        setMessages((m) => m.filter((x) => x.id !== optimistic.id))
        setInput(text)
      }
    } finally {
      setStreaming(false)
      setStreamText('')
      abortRef.current = null
    }
  }

  async function createSession() {
    try {
      const res = await apiPost<{ session: ChatSessionDTO }>('/api/sessions', { language, level })
      await loadSessions()
      setActiveId(res.session.id)
      setMessages([])
      toast.success('Percakapan baru dibuat.')
    } catch {
      /* handled by apiPost */
    }
  }

  async function submitRename() {
    if (!renameId || !renameValue.trim()) return
    try {
      await apiPatch(`/api/sessions/${renameId}`, { title: renameValue.trim() })
      setSessions((s) => s.map((x) => (x.id === renameId ? { ...x, title: renameValue.trim() } : x)))
      toast.success('Percakapan diubah namanya.')
    } catch {
      /* handled */
    } finally {
      setRenameId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteId) return
    try {
      await apiDelete(`/api/sessions/${deleteId}`)
      const rest = sessions.filter((s) => s.id !== deleteId)
      setSessions(rest)
      if (activeId === deleteId) {
        setActiveId(rest[0]?.id ?? null)
        setMessages([])
      }
      toast.success('Percakapan dihapus.')
    } catch {
      /* handled */
    } finally {
      setDeleteId(null)
    }
  }

  // ---------- vocabulary from message ----------
  function openVocabDialog(messageContent: string) {
    const source = messages.find((m) => m.content === messageContent) ?? null
    setVocabSource(source)
    setVocabWord('')
    setVocabLookup(null)
  }

  async function lookupWord() {
    const word = vocabWord.trim()
    if (!word) return
    setVocabLoading(true)
    try {
      const res = await apiPost<{ word: ParsedWord }>('/api/ai/vocabulary', { word, language, context: vocabSource?.content.slice(0, 400) })
      setVocabLookup(res.word)
    } catch {
      /* handled */
    } finally {
      setVocabLoading(false)
    }
  }

  async function saveWord() {
    if (!vocabLookup) return
    setVocabSaving(true)
    try {
      await apiPost('/api/vocabulary', {
        language,
        word: vocabLookup.word,
        translation: vocabLookup.translation || null,
        definition: vocabLookup.definition || null,
        pronunciation: vocabLookup.pronunciation || null,
        category: vocabLookup.category || 'general',
        source: 'tutor',
      })
      toast.success(`"${vocabLookup.word}" tersimpan di Vocabulary.`)
      setVocabSource(null)
      setVocabLookup(null)
      setVocabWord('')
    } catch {
      /* handled */
    } finally {
      setVocabSaving(false)
    }
  }

  const sessionList = (
    <div className="flex h-full flex-col">
      <div className="p-3 space-y-2 border-b border-sidebar-border">
        <Button onClick={createSession} className="w-full bg-primary hover:bg-primary/90 h-9 text-[13px]" size="sm">
          <Plus size={14} className="mr-1" /> Percakapan Baru
        </Button>
        <div className="grid grid-cols-2 gap-1.5">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.name}>{l.flag} {l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
            <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <ScrollArea className="flex-1 scrollbar-thin">
        {sessionsLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-secondary animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="p-4 text-[12.5px] text-silver text-center leading-relaxed">
            Belum ada percakapan. Mulai dengan mengetik pesan di bawah — sesi dibuat otomatis.
          </p>
        ) : (
          <ul className="p-2 space-y-1">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setActiveId(s.id)
                    setSidebarOpen(false)
                  }}
                  className={cn(
                    'group w-full rounded-lg px-2.5 py-2 text-left transition-colors',
                    activeId === s.id ? 'bg-primary/12' : 'hover:bg-sidebar-accent',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquareText size={13.5} className={cn('shrink-0', activeId === s.id ? 'text-primary' : 'text-silver/70')} />
                    <span className={cn('flex-1 truncate text-[13px]', activeId === s.id ? 'text-foreground font-medium' : 'text-silver')}>
                      {s.title}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 pl-[22px]">
                    <span className="text-[10.5px] text-silver/60">{languageFlag(s.language)} {s.language}</span>
                    <span className="text-[10.5px] text-silver/60">· {new Date(s.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    <span className="ml-auto flex opacity-0 group-hover:opacity-100 transition-opacity">
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Ganti nama"
                        className="rounded p-1 text-silver/60 hover:text-foreground hover:bg-secondary"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenameId(s.id)
                          setRenameValue(s.title)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation()
                            setRenameId(s.id)
                            setRenameValue(s.title)
                          }
                        }}
                      >
                        <Pencil size={11.5} />
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Hapus"
                        className="rounded p-1 text-silver/60 hover:text-destructive hover:bg-secondary"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteId(s.id)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation()
                            setDeleteId(s.id)
                          }
                        }}
                      >
                        <Trash2 size={11.5} />
                      </span>
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-118px)] gap-4 animate-fade-up">
      {/* Desktop sessions sidebar */}
      <aside className="hidden xl:flex w-[290px] shrink-0 flex-col rounded-2xl border border-sidebar-border bg-sidebar overflow-hidden">
        {sessionList}
      </aside>

      {/* Mobile sessions drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/60" aria-label="Tutup daftar percakapan" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[290px] bg-sidebar border-r border-sidebar-border">
            <button className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-silver hover:text-white hover:bg-secondary" onClick={() => setSidebarOpen(false)} aria-label="Tutup">
              <X size={16} />
            </button>
            {sessionList}
          </div>
        </div>
      )}

      {/* Chat area */}
      <section className="flex flex-1 min-w-0 flex-col rounded-2xl border border-border bg-card/70 overflow-hidden">
        <header className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
          <Button variant="ghost" size="icon" className="xl:hidden h-8 w-8 text-silver" onClick={() => setSidebarOpen(true)} aria-label="Daftar percakapan">
            <PanelLeft size={16} />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
              {sessions.find((s) => s.id === activeId)?.title ?? 'Miku AI Tutor'}
            </h2>
            <p className="text-[11px] text-silver">{languageFlag(language)} {language} · kelaskan pertanyaan dalam bahasa apa pun</p>
          </div>
          <Badge variant="outline" className="ml-auto hidden sm:inline-flex border-primary/40 bg-primary/10 text-primary text-[10.5px]">
            <Sparkles size={11} className="mr-1" /> Grok · streaming
          </Badge>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4" aria-live="polite">
          {messagesLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-secondary/60 animate-pulse max-w-[70%]" />)}
            </div>
          ) : messages.length === 0 && !streaming ? (
            <div className="flex h-full flex-col items-center justify-center text-center px-6">
              <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Languages size={26} />
              </span>
              <h3 className="text-[16px] font-semibold" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
                Miku siap membantu belajar {languageFlag(language)} {language}
              </h3>
              <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-silver">
                Tanyakan tata bahasa, minta koreksi kalimat, latih percakapan, atau minta contoh kalimat.
                Miku akan menjawab sesuai level <strong className="text-foreground">{LEVELS.find((l) => l.value === level)?.label}</strong>.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {['Perkenalkan dirimu dalam bahasa ini', 'Jelaskan perbedaan kata "for" dan "since"', 'Latih aku memesan kopi di kafe'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="rounded-full border border-[rgba(168,183,204,0.2)] bg-secondary/60 px-3.5 py-1.5 text-[12px] text-silver hover:text-white hover:border-primary/40 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {messages.map((m) => (
                <li key={m.id} className={cn('flex gap-2.5', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {m.role === 'assistant' && (
                    <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary text-[11px] font-bold">M</span>
                  )}
                  <div className={cn('group max-w-[85%] sm:max-w-[75%]', m.role === 'user' ? 'order-first' : '')}>
                    {m.role === 'user' ? (
                      <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[14px] leading-relaxed text-primary-foreground">
                        {m.content}
                      </div>
                    ) : (
                      <div className="rounded-2xl rounded-bl-md border border-border bg-secondary/60 px-4 py-3">
                        <div className="ai-prose">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                        <div className="mt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-silver hover:text-primary hover:bg-primary/10"
                            onClick={() => openVocabDialog(m.content)}
                          >
                            <BookPlus size={12} /> Simpan kosakata
                          </button>
                        </div>
                      </div>
                    )}
                    <p className={cn('mt-1 text-[10.5px] text-silver/60', m.role === 'user' ? 'text-right' : 'text-left')}>
                      {new Date(m.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </li>
              ))}
              {streaming && (
                <li className="flex gap-2.5 justify-start">
                  <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary text-[11px] font-bold">M</span>
                  <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-bl-md border border-border bg-secondary/60 px-4 py-3">
                    {streamText ? (
                      <div className="ai-prose stream-cursor">
                        <ReactMarkdown>{streamText}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="flex items-center gap-2 text-[12.5px] text-silver">
                        <Loader2 size={13} className="animate-spin" /> Miku sedang berpikir…
                      </span>
                    )}
                  </div>
                </li>
              )}
            </ul>
          )}
          <div ref={bottomRef} />
        </div>

        <footer className="border-t border-border p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void sendMessage()
            }}
            className="flex items-end gap-2"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendMessage()
                }
              }}
              placeholder={`Tulis pertanyaan atau latihan dalam ${language} atau bahasa Indonesia…`}
              className="min-h-[46px] max-h-32 flex-1 resize-none bg-secondary/50 text-[14px]"
              rows={1}
              aria-label="Pesan untuk AI Tutor"
              disabled={streaming}
            />
            {streaming ? (
              <Button type="button" variant="destructive" size="icon" className="h-[46px] w-[46px]" onClick={() => abortRef.current?.abort()} aria-label="Hentikan">
                <X size={17} />
              </Button>
            ) : (
              <Button type="submit" size="icon" className="h-[46px] w-[46px] bg-primary hover:bg-primary/90" disabled={!input.trim()} aria-label="Kirim pesan">
                <SendHorizonal size={17} />
              </Button>
            )}
          </form>
        </footer>
      </section>

      {/* Rename dialog */}
      <Dialog open={Boolean(renameId)} onOpenChange={(v) => !v && setRenameId(null)}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Ganti nama percakapan</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} maxLength={80} placeholder="Judul baru" />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRenameId(null)}>Batal</Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={submitRename}><Check size={14} className="mr-1" /> Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={Boolean(deleteId)} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Hapus percakapan?</DialogTitle>
          </DialogHeader>
          <p className="text-[13.5px] text-silver leading-relaxed">
            Seluruh pesan dalam percakapan ini akan dihapus permanen dari database. Tindakan ini tidak dapat dibatalkan.
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button size="sm" variant="destructive" onClick={confirmDelete}><Trash2 size={14} className="mr-1" /> Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vocabulary dialog */}
      <Dialog open={Boolean(vocabSource)} onOpenChange={(v) => !v && setVocabSource(null)}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-[15px] flex items-center gap-2">
              <BookPlus size={16} className="text-primary" /> Simpan kosakata dari percakapan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={vocabWord}
                onChange={(e) => setVocabWord(e.target.value)}
                placeholder={`Kata dalam ${language} yang ingin disimpan`}
                onKeyDown={(e) => e.key === 'Enter' && lookupWord()}
              />
              <Button onClick={lookupWord} disabled={!vocabWord.trim() || vocabLoading} className="bg-primary hover:bg-primary/90 shrink-0">
                {vocabLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Cari
              </Button>
            </div>
            {vocabLookup && (
              <div className="rounded-xl border border-border bg-secondary/50 p-3.5 space-y-2 text-[13px]">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-[14.5px] text-foreground">{vocabLookup.word}</p>
                  {vocabLookup.pronunciation && <span className="text-[11.5px] text-silver italic">/{vocabLookup.pronunciation}/</span>}
                </div>
                {vocabLookup.partOfSpeech && <p className="text-[11.5px] text-silver/80 capitalize">{vocabLookup.partOfSpeech}</p>}
                {vocabLookup.translation && <p className="text-foreground"><strong className="text-primary">Terjemahan:</strong> {vocabLookup.translation}</p>}
                {vocabLookup.definition && <p className="text-silver leading-relaxed">{vocabLookup.definition}</p>}
                {vocabLookup.examples.slice(0, 2).map((ex, i) => (
                  <div key={i} className="border-t border-border pt-2">
                    <p className="text-foreground text-[12.5px]">{ex.source}</p>
                    <p className="text-[12px] text-silver">{ex.translation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setVocabSource(null)}>Batal</Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" disabled={!vocabLookup || vocabSaving} onClick={saveWord}>
              {vocabSaving ? <Loader2 size={14} className="animate-spin mr-1" /> : <BookPlus size={14} className="mr-1" />}
              Simpan ke Vocabulary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
