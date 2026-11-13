'use client'

// MikuAI — Admin panel: users, AI usage, error monitoring, DB health,
// content management. Server-side role is re-checked on every API call.
import { useCallback, useEffect, useState } from 'react'
import {
  ShieldCheck, Users, Zap, AlertTriangle, Database, Activity, Loader2,
  Trash2, Pencil, Plus, BookOpen, Cpu, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { apiPost, apiFetch, apiDelete } from '@/lib/client/api'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGUAGES, LEVELS, LESSON_CATEGORIES } from '@/lib/languages'
import type { AdminStats, AdminUserRow, AiUsageLogDTO, LessonDTO, SessionUser } from '@/lib/types'

interface DbHealth {
  driver: string
  latencyMs: number
  status: string
  error: string | null
  tables: { name: string; rows: number }[]
}

export function AdminView({ admin }: { admin: SessionUser }) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [logs, setLogs] = useState<AiUsageLogDTO[]>([])
  const [logFilter, setLogFilter] = useState<'all' | 'error'>('all')
  const [health, setHealth] = useState<DbHealth | null>(null)
  const [lessons, setLessons] = useState<LessonDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // lesson editor
  const [lessonDialog, setLessonDialog] = useState(false)
  const [lessonForm, setLessonForm] = useState({ id: '', title: '', language: 'English', level: 'beginner', category: 'vocabulary', summary: '', isPublic: true, body: '' })
  const [lessonSaving, setLessonSaving] = useState(false)

  const load = useCallback(async (showToast = false) => {
    setRefreshing(true)
    try {
      const [s, u, l, h, ls] = await Promise.all([
        apiFetch<{ stats: AdminStats }>('/api/admin/stats', { silent: true }),
        apiFetch<{ users: AdminUserRow[] }>('/api/admin/users', { silent: true }),
        apiFetch<{ logs: AiUsageLogDTO[] }>(`/api/admin/logs?limit=40${logFilter === 'error' ? '&status=error' : ''}`, { silent: true }),
        apiFetch<{ health: DbHealth }>('/api/admin/health', { silent: true }),
        apiFetch<{ lessons: LessonDTO[] }>('/api/admin/lessons', { silent: true }),
      ])
      setStats(s.stats)
      setUsers(u.users)
      setLogs(l.logs)
      setHealth(h.health)
      setLessons(ls.lessons)
      if (showToast) toast.success('Data admin diperbarui.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat data admin.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
     
  }, [logFilter])

  useEffect(() => {
    void load()
  }, [load])

  async function setRole(userId: string, role: 'user' | 'admin') {
    try {
      await apiPost(`/api/admin/users/${userId}`, { userId, role })
      setUsers((us) => us.map((u) => (u.id === userId ? { ...u, role } : u)))
      toast.success(`Role diubah menjadi ${role}.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengubah role.')
    }
  }

  async function deleteLesson(id: string) {
    if (!window.confirm('Hapus pelajaran ini secara permanen?')) return
    try {
      await apiDelete(`/api/admin/lessons?id=${id}`)
      setLessons((ls) => ls.filter((l) => l.id !== id))
      toast.success('Pelajaran dihapus.')
    } catch {
      /* handled */
    }
  }

  function openLessonEditor(lesson?: LessonDTO) {
    if (lesson) {
      setLessonForm({
        id: lesson.id,
        title: lesson.title,
        language: lesson.language,
        level: lesson.level,
        category: lesson.category,
        summary: lesson.summary ?? '',
        isPublic: lesson.isPublic,
        body: lesson.sections.map((s) => s.heading || s.type).join('\n'),
      })
    } else {
      setLessonForm({ id: '', title: '', language: 'English', level: 'beginner', category: 'vocabulary', summary: '', isPublic: true, body: '' })
    }
    setLessonDialog(true)
  }

  async function saveLesson() {
    if (!lessonForm.title.trim()) {
      toast.error('Judul pelajaran wajib diisi.')
      return
    }
    setLessonSaving(true)
    try {
      await apiPost('/api/admin/lessons', {
        id: lessonForm.id || undefined,
        title: lessonForm.title.trim(),
        language: lessonForm.language,
        level: lessonForm.level,
        category: lessonForm.category,
        summary: lessonForm.summary.trim() || null,
        isPublic: lessonForm.isPublic,
        sections: lessonForm.body.trim()
          ? [{ type: 'explanation', heading: 'Konten', body: lessonForm.body.trim() }]
          : undefined,
      })
      toast.success(lessonForm.id ? 'Pelajaran diperbarui.' : 'Pelajaran baru disimpan.')
      setLessonDialog(false)
      await load()
    } catch {
      /* handled */
    } finally {
      setLessonSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  const statCards = stats ? [
    { icon: Users, label: 'Total pengguna', value: stats.totalUsers, sub: `${stats.activeUsers7d} aktif 7 hari` },
    { icon: Zap, label: 'Panggilan AI (24 jam)', value: stats.aiCalls24h, sub: `${stats.aiTokens24h.toLocaleString('id-ID')} token` },
    { icon: AlertTriangle, label: 'Kesalahan AI (24 jam)', value: stats.aiErrors24h, sub: stats.aiErrors24h === 0 ? 'semua sehat' : 'perlu dicek' },
    { icon: BookOpen, label: 'Pelajaran di katalog', value: stats.totalLessons, sub: `${stats.totalSessions} sesi chat · ${stats.totalTranslations} terjemahan` },
  ] : []

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/80 p-5">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <ShieldCheck size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
            Admin Panel
          </h2>
          <p className="text-[12.5px] text-silver">Kelola pengguna, pantau AI, dan kelola konten — {admin.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stats && (
            <>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                <Cpu size={11} className="mr-1" /> AI: {stats.provider.aiProvider} · {stats.provider.model}
              </Badge>
              <Badge variant="outline" className="border-[rgba(168,183,204,0.25)] text-silver">
                <Database size={11} className="mr-1" /> DB: {stats.provider.dbDriver}
              </Badge>
            </>
          )}
          <Button variant="outline" size="sm" className="h-8 text-[12px] text-silver" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={13} className={cn('mr-1', refreshing && 'animate-spin')} /> Segarkan
          </Button>
        </div>
      </section>

      {stats?.provider.aiProvider === 'dev-fallback' && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-[#f0b429]/40 bg-[#f0b429]/8 p-4 text-[13px] leading-relaxed">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#f0b429]" />
          <p className="text-silver">
            <strong className="text-foreground">Mode fallback sandbox aktif:</strong> XAI_API_KEY belum diisi, jadi fitur AI memakai model pengembangan sandbox.
            Untuk produksi, isi <code className="rounded bg-secondary px-1.5 py-0.5 text-[12px] text-[#9cc2ff]">XAI_API_KEY</code> pada file environment — semua permintaan otomatis memakai xAI Grok ({stats.provider.model}).
          </p>
        </div>
      )}

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="border-border bg-card/80 card-hover">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
                    <Icon size={15} />
                  </span>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display), sans-serif' }}>{s.value}</p>
                <p className="mt-0.5 text-[11.5px] text-silver">{s.label}</p>
                <p className="text-[10.5px] text-silver/60">{s.sub}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      {/* Users table */}
      <Card className="border-border bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <Users size={15} className="text-primary" /> Manajemen Pengguna
            <span className="ml-auto text-[11.5px] font-normal text-silver">{users.length} akun</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-silver/60">
                <th className="pb-2 pr-3 font-medium">Pengguna</th>
                <th className="pb-2 pr-3 font-medium">Fokus</th>
                <th className="pb-2 pr-3 font-medium">Aktivitas</th>
                <th className="pb-2 pr-3 font-medium">Terakhir aktif</th>
                <th className="pb-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(168,183,204,0.07)]">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-foreground">{u.displayName ?? '—'}</p>
                    <p className="text-[11.5px] text-silver/70">{u.email}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-silver">
                    {u.targetLanguage} · <span className="capitalize">{u.level}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-silver">
                    {u.activityCount} aktivitas · {u.vocabularyCount} kata
                  </td>
                  <td className="py-2.5 pr-3 text-silver/80">
                    {u.lastActivityAt ? new Date(u.lastActivityAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td className="py-2.5">
                    <Select value={u.role} onValueChange={(v) => setRole(u.id, v as 'user' | 'admin')}>
                      <SelectTrigger className="h-7 w-[105px] text-[12px]" aria-label={`Role ${u.email}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* AI usage + logs */}
        <Card className="border-border bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Activity size={15} className="text-primary" /> AI Usage & Error Monitor
            </CardTitle>
            <div className="flex gap-1.5 pt-1.5">
              <Button size="sm" variant={logFilter === 'all' ? 'default' : 'outline'} className={logFilter === 'all' ? 'h-7 bg-primary text-[12px]' : 'h-7 text-[12px] text-silver'} onClick={() => setLogFilter('all')}>
                Semua
              </Button>
              <Button size="sm" variant={logFilter === 'error' ? 'destructive' : 'outline'} className="h-7 text-[12px]" onClick={() => setLogFilter('error')}>
                Hanya Error
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats && stats.aiByFeature.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {stats.aiByFeature.map((f) => (
                  <Badge key={f.feature} variant="outline" className="border-[rgba(168,183,204,0.2)] text-silver text-[11px]">
                    {f.feature}: {f.calls}× · {f.tokens.toLocaleString('id-ID')} token
                  </Badge>
                ))}
              </div>
            )}
            {logs.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-silver">Belum ada log AI.</p>
            ) : (
              <ul className="max-h-[300px] space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
                {logs.map((l) => (
                  <li key={l.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[12px]">
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', l.status === 'success' ? 'bg-[#43d0a0]' : 'bg-[#ef4d56]')} />
                    <span className="font-medium text-foreground">{l.feature}</span>
                    <span className="text-silver/70">{l.provider} · {l.model}</span>
                    <span className="ml-auto text-silver/70">{l.totalTokens.toLocaleString('id-ID')} tok · {(l.durationMs / 1000).toFixed(1)}s</span>
                    <span className="text-silver/50">{new Date(l.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* DB health */}
        <Card className="border-border bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Database size={15} className="text-primary" /> Database Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {health && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px]">
                  <Badge variant="outline" className={cn('capitalize', health.status === 'healthy' ? 'border-[#43d0a0]/40 text-[#43d0a0]' : 'border-[#ef4d56]/40 text-[#ef4d56]')}>
                    {health.status}
                  </Badge>
                  <span className="text-silver">driver: {health.driver}</span>
                  <span className="text-silver">latensi: {health.latencyMs} ms</span>
                  {health.error && <span className="text-[#ef4d56]">{health.error}</span>}
                </div>
                <ul className="grid max-h-[280px] grid-cols-2 gap-1.5 overflow-y-auto scrollbar-thin pr-1">
                  {health.tables.map((t) => (
                    <li key={t.name} className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-[11.5px]">
                      <span className="truncate text-silver">{t.name}</span>
                      <span className="font-medium text-foreground">{t.rows}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lesson content management */}
      <Card className="border-border bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <BookOpen size={15} className="text-primary" /> Manajemen Konten Pelajaran
            <Button size="sm" className="ml-auto h-8 bg-primary hover:bg-primary/90 text-[12px]" onClick={() => openLessonEditor()}>
              <Plus size={13} className="mr-1" /> Pelajaran Baru
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lessons.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-silver">Katalog pelajaran kosong.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {lessons.slice(0, 24).map((l) => (
                <li key={l.id} className="group flex items-center gap-2.5 rounded-xl border border-border bg-secondary/40 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{l.title}</p>
                    <p className="text-[11px] text-silver/70 capitalize">
                      {l.language} · {l.level} · {l.category} {l.isPublic ? '· publik' : '· privat'}
                    </p>
                  </div>
                  <button className="rounded-lg p-1.5 text-silver/60 hover:text-primary hover:bg-primary/10" onClick={() => openLessonEditor(l)} aria-label={`Edit ${l.title}`}>
                    <Pencil size={13} />
                  </button>
                  <button className="rounded-lg p-1.5 text-silver/60 hover:text-destructive hover:bg-destructive/10" onClick={() => deleteLesson(l.id)} aria-label={`Hapus ${l.title}`}>
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {lessons.length > 24 && <p className="mt-2 text-[11.5px] text-silver/60">+{lessons.length - 24} pelajaran lainnya</p>}
        </CardContent>
      </Card>

      {/* Lesson editor dialog */}
      <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
        <DialogContent className="max-w-[520px] max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="text-[15px]">{lessonForm.id ? 'Edit pelajaran' : 'Pelajaran baru'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="al-title">Judul</Label>
              <Input id="al-title" value={lessonForm.title} onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))} className="text-[13px]" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Bahasa</Label>
                <Select value={lessonForm.language} onValueChange={(v) => setLessonForm((f) => ({ ...f, language: v }))}>
                  <SelectTrigger className="text-[12.5px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((l) => <SelectItem key={l.code} value={l.name}>{l.flag} {l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Level</Label>
                <Select value={lessonForm.level} onValueChange={(v) => setLessonForm((f) => ({ ...f, level: v }))}>
                  <SelectTrigger className="text-[12.5px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Select value={lessonForm.category} onValueChange={(v) => setLessonForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="text-[12.5px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LESSON_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="al-summary">Ringkasan</Label>
              <Input id="al-summary" value={lessonForm.summary} onChange={(e) => setLessonForm((f) => ({ ...f, summary: e.target.value }))} className="text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="al-body">Isi pelajaran</Label>
              <Textarea id="al-body" value={lessonForm.body} onChange={(e) => setLessonForm((f) => ({ ...f, body: e.target.value }))} placeholder="Tulis materi pelajaran…" className="min-h-[120px] text-[13px]" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5">
              <Label htmlFor="al-public" className="text-[13px] font-normal">Publik (dapat dibaca semua pengguna terautentikasi)</Label>
              <Switch id="al-public" checked={lessonForm.isPublic} onCheckedChange={(v) => setLessonForm((f) => ({ ...f, isPublic: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setLessonDialog(false)}>Batal</Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" disabled={lessonSaving} onClick={saveLesson}>
              {lessonSaving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
