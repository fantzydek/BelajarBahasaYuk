'use client'

// MikuAI — Dashboard: real stats from the database, live-updating.
import { useState } from 'react'
import Link from 'next/link'
import {
  BookMarked, GraduationCap, ClipboardList, Flame, Clock, Activity,
  ArrowRight, Sparkles, Loader2, AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLiveData } from '@/hooks/use-live-data'
import { apiPost } from '@/lib/client/api'
import { languageFlag } from '@/lib/languages'
import type { DashboardStats, SessionUser } from '@/lib/types'

const ACTIVITY_ICONS = { tutor: Sparkles, translation: Activity, lesson: GraduationCap, vocabulary: BookMarked, quiz: ClipboardList } as const

interface RecommendItem {
  title: string
  detail: string
  href: string
  cta: string
}

export function DashboardView({ user }: { user: SessionUser }) {
  const live = useLiveData<{ stats: DashboardStats }>('/api/dashboard', user.id, [
    'learning_history', 'learning_progress', 'vocabulary', 'quiz_attempts', 'lesson_progress', 'user_streaks',
  ])
  const [reco, setReco] = useState<RecommendItem[] | null>(null)
  const [recoLoading, setRecoLoading] = useState(false)
  const [recoError, setRecoError] = useState<string | null>(null)

  const stats = live.data?.stats

  async function loadRecommendations() {
    setRecoLoading(true)
    setRecoError(null)
    try {
      const res = await apiPost<{ items: RecommendItem[] }>('/api/ai/recommend')
      setReco(res.items)
    } catch (e) {
      setRecoError(e instanceof Error ? e.message : 'Rekomendasi gagal dimuat.')
    } finally {
      setRecoLoading(false)
    }
  }

  if (live.loading && !stats) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Memuat dashboard">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (live.error || !stats) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-center gap-3 py-6">
          <AlertTriangle className="text-destructive" size={20} />
          <div>
            <p className="font-medium">Gagal memuat dashboard</p>
            <p className="text-[13px] text-silver">{live.error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={live.refresh}>Coba lagi</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const statCards = [
    { icon: Activity, label: 'Aktivitas hari ini', value: stats.todayActivity, suffix: 'aktivitas' },
    { icon: BookMarked, label: 'Total kosakata', value: stats.totalVocabulary, suffix: 'kata' },
    { icon: GraduationCap, label: 'Pelajaran selesai', value: stats.lessonsCompleted, suffix: 'pelajaran' },
    { icon: ClipboardList, label: 'Rata-rata kuis', value: stats.avgQuizScore, suffix: 'poin' },
    { icon: Clock, label: 'Waktu belajar', value: stats.studyMinutes, suffix: 'menit' },
  ]

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Welcome */}
      <section className="rounded-2xl border border-border bg-card/80 p-5 sm:p-6 card-hover">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12.5px] text-silver">Selamat belajar,</p>
            <h2 className="mt-0.5 text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
              Halo, {stats.displayName} 👋
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[13.5px] text-silver">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden>{languageFlag(stats.targetLanguage)}</span>
                <strong className="text-foreground font-semibold">{stats.targetLanguage}</strong>
              </span>
              <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 capitalize">{stats.level}</Badge>
              {stats.streak.currentStreak > 0 && (
                <Badge variant="outline" className="border-[#f0b429]/40 text-[#f0b429] bg-[#f0b429]/10">
                  <Flame size={12} className="mr-1" /> {stats.streak.currentStreak} hari beruntun
                </Badge>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11.5px] uppercase tracking-wider text-silver/60">Streak terpanjang</p>
            <p className="text-3xl font-bold text-primary" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
              {stats.streak.longestStreak}<span className="text-[13px] text-silver font-normal"> hari</span>
            </p>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Ringkasan belajar">
        {statCards.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="card-hover border-border bg-card/80">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
                    <Icon size={15.5} />
                  </span>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
                  {s.value}
                </p>
                <p className="mt-0.5 text-[12px] text-silver">{s.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      {/* Charts + recommendations */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">Aktivitas 7 hari terakhir</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weeklyActivity} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,183,204,0.12)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8b99ad', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#8b99ad', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(38,123,255,0.08)' }}
                  contentStyle={{
                    background: '#0d1219', border: '1px solid rgba(168,183,204,0.16)', borderRadius: 12,
                    fontSize: 13, color: '#fff',
                  }}
                  formatter={(v: number) => [`${v} aktivitas`, 'Jumlah']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                />
                <Bar dataKey="count" fill="#267bff" radius={[6, 6, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Sparkles size={15} className="text-primary" /> Rekomendasi AI
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!reco && !recoLoading && !recoError && (
              <div className="py-6 text-center">
                <p className="text-[13px] text-silver mb-3">Minta rekomendasi belajar personal dari AI berdasarkan statistik Anda.</p>
                <Button onClick={loadRecommendations} className="bg-primary hover:bg-primary/90" size="sm">
                  <Sparkles size={14} className="mr-1.5" /> Buat Rekomendasi
                </Button>
              </div>
            )}
            {recoLoading && (
              <div className="flex items-center justify-center py-8 gap-2 text-[13px] text-silver">
                <Loader2 size={15} className="animate-spin" /> Menganalisis data belajar Anda…
              </div>
            )}
            {recoError && (
              <div className="py-4 text-center">
                <p className="text-[12.5px] text-destructive mb-2">{recoError}</p>
                <Button variant="outline" size="sm" onClick={loadRecommendations}>Coba lagi</Button>
              </div>
            )}
            {reco && !recoLoading && (
              <ul className="space-y-2.5">
                {reco.map((r, i) => (
                  <li key={i} className="rounded-xl border border-border bg-secondary/50 p-3">
                    <p className="text-[13px] font-semibold text-foreground">{r.title}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-silver">{r.detail}</p>
                    <Link href={r.href} className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
                      {r.cta} <ArrowRight size={11} />
                    </Link>
                  </li>
                ))}
                <li>
                  <Button variant="ghost" size="sm" className="w-full text-silver" onClick={loadRecommendations}>
                    <Sparkles size={12} className="mr-1" /> Segarkan rekomendasi
                  </Button>
                </li>
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent activities */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">Aktivitas terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentActivities.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-silver">
                Belum ada aktivitas. Mulai dari <Link href="/tutor" className="text-primary hover:underline">AI Tutor</Link> atau{' '}
                <Link href="/academy" className="text-primary hover:underline">Academy</Link>!
              </p>
            ) : (
              <ul className="divide-y divide-[rgba(168,183,204,0.08)]">
                {stats.recentActivities.map((a) => {
                  const Icon = ACTIVITY_ICONS[a.activityType] ?? Activity
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-2.5">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-silver">
                        <Icon size={14.5} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] text-foreground">{a.title}</p>
                        <p className="text-[11.5px] text-silver/80">
                          {new Date(a.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {a.language ? ` · ${a.language}` : ''}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10.5px] capitalize border-[rgba(168,183,204,0.2)] text-silver">
                        {a.activityType}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}
            <Button variant="ghost" size="sm" className="mt-2 w-full text-silver hover:text-foreground" asChild>
              <Link href="/history">Lihat semua riwayat <ArrowRight size={13} className="ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">Progres per bahasa</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.languageProgress.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-silver">
                Pilih bahasa fokus di <Link href="/settings" className="text-primary hover:underline">Pengaturan</Link> lalu mulai belajar.
              </p>
            ) : (
              <ul className="space-y-3">
                {stats.languageProgress.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium text-foreground">
                        {languageFlag(p.language)} {p.language}
                      </span>
                      <span className="text-silver text-[12px]">{p.studyMinutes} mnt</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, (p.vocabularyCount * 10 + p.lessonsCompleted * 8 + p.quizzesTaken * 6))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-silver/80">
                      {p.vocabularyCount} kata · {p.lessonsCompleted} pelajaran · {p.quizzesTaken} kuis
                      {p.avgQuizScore > 0 ? ` · rata-rata ${Math.round(p.avgQuizScore)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
