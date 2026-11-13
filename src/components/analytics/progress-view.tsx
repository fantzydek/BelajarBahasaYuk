'use client'

// MikuAI — Learning analytics: real database aggregates with dynamic charts.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LineChart as LineChartIcon, Clock, BookMarked, GraduationCap, ClipboardList,
  Flame, TrendingUp, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { apiFetch } from '@/lib/client/api'
import { languageFlag } from '@/lib/languages'
import type { LearningProgressDTO, SessionUser, StreakDTO } from '@/lib/types'

interface AnalyticsPayload {
  progress: LearningProgressDTO[]
  activity: { date: string; count: number }[]
  quiz: { taken: number; avgScore: number }
  totals: { vocabulary: number; translations: number; chatSessions: number; lessons: number; studyMinutes: number }
  streak: StreakDTO
}

export function ProgressView({ user }: { user: SessionUser }) {
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [attempts, setAttempts] = useState<{ id: string; score: number; startedAt: string; quizType: string }[]>([])

  useEffect(() => {
    let cancelled = false
    apiFetch<AnalyticsPayload>(`/api/analytics?days=${days}`, { silent: true })
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false)
          toast.error('Gagal memuat analitik.')
        }
      })
    apiFetch<{ items: { id: string; score: number | null; startedAt: string; quizType: string; status: string }[] }>('/api/quiz/attempts?limit=12', { silent: true })
      .then((r) => {
        if (!cancelled) {
          setAttempts(
            r.items
              .filter((a) => a.status === 'completed' && a.score !== null)
              .slice(0, 10)
              .map((a) => ({ id: a.id, score: a.score as number, startedAt: a.startedAt, quizType: a.quizType })),
          )
        }
      })
      .catch(() => void 0)
    return () => {
      cancelled = true
    }
  }, [days])

  if (loading && !data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }

  if (!data) {
    return <p className="py-10 text-center text-[13.5px] text-silver">Data analitik tidak tersedia.</p>
  }

  const chartData = data.activity.map((d) => ({
    ...d,
    label: new Date(`${d.date}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  }))

  const quizData = attempts.map((a, i) => ({
    n: `#${i + 1}`,
    nilai: a.score,
    type: a.quizType.replace(/_/g, ' '),
    date: new Date(a.startedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
  })).reverse()

  const totals = [
    { icon: Clock, label: 'Total waktu belajar', value: `${data.totals.studyMinutes} mnt` },
    { icon: BookMarked, label: 'Kosakata tersimpan', value: data.totals.vocabulary },
    { icon: GraduationCap, label: 'Pelajaran selesai', value: data.totals.lessons },
    { icon: ClipboardList, label: 'Rata-rata nilai kuis', value: data.quiz.avgScore },
    { icon: Flame, label: 'Streak saat ini', value: `${data.streak.currentStreak} hari` },
  ]

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Totals */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {totals.map((t) => {
          const Icon = t.icon
          return (
            <Card key={t.label} className="border-border bg-card/80 card-hover">
              <CardContent className="p-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <Icon size={15.5} />
                </span>
                <p className="mt-3 text-[22px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
                  {t.value}
                </p>
                <p className="mt-0.5 text-[11.5px] text-silver">{t.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      {/* Activity chart */}
      <Card className="border-border bg-card/80">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <TrendingUp size={15} className="text-primary" /> Aktivitas belajar
          </CardTitle>
          <div className="flex gap-1.5">
            {[7, 30, 90].map((d) => (
              <Button key={d} size="sm" variant={days === d ? 'default' : 'outline'} className={days === d ? 'h-7 bg-primary text-[12px]' : 'h-7 text-[12px] text-silver'} onClick={() => setDays(d)}>
                {d} hari
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#267bff" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#267bff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,183,204,0.12)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#8b99ad', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
              <YAxis allowDecimals={false} tick={{ fill: '#8b99ad', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0d1219', border: '1px solid rgba(168,183,204,0.16)', borderRadius: 12, fontSize: 13, color: '#fff' }}
                formatter={(v: number) => [`${v} aktivitas`, 'Jumlah']}
              />
              <Area type="monotone" dataKey="count" stroke="#267bff" strokeWidth={2} fill="url(#activityFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Quiz performance */}
        <Card className="border-border bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">Performa kuis terakhir</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            {quizData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-[13px] text-silver">Belum ada kuis selesai.</p>
                <Button size="sm" variant="outline" className="mt-3 text-primary border-primary/40" asChild>
                  <Link href="/practice">Coba kuis pertama</Link>
                </Button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={quizData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,183,204,0.12)" vertical={false} />
                  <XAxis dataKey="n" tick={{ fill: '#8b99ad', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#8b99ad', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0d1219', border: '1px solid rgba(168,183,204,0.16)', borderRadius: 12, fontSize: 13, color: '#fff' }}
                    formatter={(v: number) => [`${v}`, 'Nilai']}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as { type?: string; date?: string } | undefined
                      return p ? `${p.type} · ${p.date}` : ''
                    }}
                  />
                  <Line type="monotone" dataKey="nilai" stroke="#43d0a0" strokeWidth={2.4} dot={{ fill: '#43d0a0', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Per-language progress */}
        <Card className="border-border bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">Progres per bahasa</CardTitle>
          </CardHeader>
          <CardContent>
            {data.progress.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-silver">
                Belum ada progres. Mulai belajar di <Link href="/academy" className="text-primary hover:underline">Academy</Link> atau{' '}
                <Link href="/tutor" className="text-primary hover:underline">AI Tutor</Link>.
              </p>
            ) : (
              <ul className="space-y-4">
                {data.progress.map((p) => {
                  const composite = Math.min(100, p.vocabularyCount * 6 + p.lessonsCompleted * 12 + p.quizzesTaken * 10)
                  return (
                    <li key={p.id}>
                      <div className="flex items-center justify-between text-[13.5px]">
                        <span className="font-medium text-foreground">{languageFlag(p.language)} {p.language}</span>
                        <Badge variant="outline" className="text-[10.5px] border-primary/40 bg-primary/10 text-primary capitalize">{p.level}</Badge>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${composite}%` }} />
                      </div>
                      <p className="mt-1.5 text-[11.5px] text-silver/80">
                        {p.vocabularyCount} kata · {p.lessonsCompleted} pelajaran · {p.quizzesTaken} kuis
                        {p.avgQuizScore > 0 ? ` · rata-rata ${Math.round(p.avgQuizScore)}` : ''} · {p.studyMinutes} menit
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Streak + stats summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card/80">
          <CardContent className="p-4">
            <p className="text-[12px] text-silver">Streak terpanjang</p>
            <p className="mt-1 text-[26px] font-bold text-[#f0b429]" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
              {data.streak.longestStreak} hari
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/80">
          <CardContent className="p-4">
            <p className="text-[12px] text-silver">Hari belajar total</p>
            <p className="mt-1 text-[26px] font-bold text-primary" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
              {data.streak.totalActiveDays} hari
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/80">
          <CardContent className="p-4">
            <p className="text-[12px] text-silver">Terjemahan & sesi chat</p>
            <p className="mt-1 text-[26px] font-bold text-foreground" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
              {data.totals.translations} · {data.totals.chatSessions}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
