// MikuAI — Public landing page.
import Link from 'next/link'
import {
  MessageSquareText, Languages, GraduationCap, BookMarked, ClipboardList,
  LineChart, ArrowRight, Sparkles, ShieldCheck, Zap, Globe2,
} from 'lucide-react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SUPPORTED_LANGUAGES } from '@/lib/languages'

const FEATURES = [
  {
    icon: MessageSquareText,
    title: 'AI Tutor Percakapan',
    desc: 'Guru bahasa AI yang sabar: jelaskan tata bahasa, koreksi kalimat, beri contoh, dan ajak latihan percakapan real-time dengan streaming.',
  },
  {
    icon: Languages,
    title: 'Translator Kontekstual',
    desc: 'Terjemahan sadar konteks dengan deteksi bahasa otomatis, gaya formal/informal, penjelasan idiom, dan varian alternatif.',
  },
  {
    icon: GraduationCap,
    title: 'Language Academy',
    desc: 'Kurikulum terstruktur per bahasa dan level: kosakata, tata bahasa, membaca, menulis, dan percakapan — plus pelajaran yang dibuat AI.',
  },
  {
    icon: BookMarked,
    title: 'Smart Vocabulary',
    desc: 'Simpan kata dari Tutor dan Translator, ulangi dengan flashcard dan jadwal review pintar, lacaki mastery tiap kata.',
  },
  {
    icon: ClipboardList,
    title: 'Kuis, Ujian & Tugas',
    desc: 'Kuis per topik, ujian berwaktu dengan nilai kelulusan, dan tugas menulis yang dinilai guru AI dengan rubrik lengkap — semua kesalahan dibahas.',
  },
  {
    icon: LineChart,
    title: 'Analitik Belajar',
    desc: 'Streak, waktu belajar, grafik aktivitas mingguan, dan perkembangan per bahasa — semua dari data nyata Anda.',
  },
]

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Subtle hero glow */}
      <div className="hero-glow -top-72 left-1/2 -translate-x-1/2" aria-hidden />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2.5" aria-label="Navigasi masuk">
          <Button variant="ghost" className="text-silver hover:text-white" asChild>
            <Link href="/login">Masuk</Link>
          </Button>
          <Button className="bg-primary hover:bg-primary/90" asChild>
            <Link href="/register">Mulai Gratis</Link>
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative z-10 mx-auto max-w-4xl px-5 pt-16 pb-14 text-center sm:pt-24">
          <Badge variant="outline" className="mb-5 border-primary/40 bg-primary/10 text-primary px-3 py-1 text-[12px]">
            <Sparkles size={13} className="mr-1.5" /> Ditenagai xAI Grok — guru bahasa AI terbaru
          </Badge>
          <h1
            className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.08]"
            style={{ fontFamily: 'var(--font-display), sans-serif' }}
          >
            Learn Languages.{' '}
            <span className="text-primary">Understand the World.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-silver">
            MikuAI adalah platform belajar bahasa berbasis AI: tutor percakapan pribadi,
            penerjemah pintar, academy terstruktur, kosakata dengan flashcard, kuis dinamis,
            dan analitik belajar — semuanya tersinkron di semua perangkat Anda.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="bg-primary hover:bg-primary/90 h-12 px-7 text-[15px]" asChild>
              <Link href="/register">
                Mulai Belajar Sekarang <ArrowRight size={16} className="ml-1.5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-7 text-[15px] border-[rgba(168,183,204,0.25)] text-silver hover:text-white" asChild>
              <Link href="/login">Sudah punya akun? Masuk</Link>
            </Button>
          </div>

          {/* Language chips */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="Bahasa yang didukung">
            {SUPPORTED_LANGUAGES.map((l) => (
              <span
                key={l.code}
                className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(168,183,204,0.18)] bg-secondary/60 px-3.5 py-1.5 text-[12.5px] text-silver"
              >
                <span aria-hidden>{l.flag}</span> {l.name}
              </span>
            ))}
          </div>
        </section>

        {/* Feature grid */}
        <section className="relative z-10 mx-auto max-w-6xl px-5 py-14" aria-label="Fitur utama">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <article
                  key={f.title}
                  className="card-hover rounded-2xl border border-border bg-card/80 p-5"
                >
                  <span className="mb-3.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <Icon size={19} />
                  </span>
                  <h2 className="text-[15.5px] font-semibold text-foreground">{f.title}</h2>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-silver">{f.desc}</p>
                </article>
              )
            })}
          </div>
        </section>

        {/* Trust strip */}
        <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20">
          <div className="grid gap-4 rounded-2xl border border-border bg-card/60 p-6 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={18} />
              <div>
                <p className="text-[14px] font-semibold">Data hanya milik Anda</p>
                <p className="mt-0.5 text-[12.5px] text-silver leading-relaxed">
                  Isolasi akun ketat dengan Row Level Security di database — riwayat, kosakata, dan progres Anda privat.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="mt-0.5 shrink-0 text-primary" size={18} />
              <div>
                <p className="text-[14px] font-semibold">Respons streaming real-time</p>
                <p className="mt-0.5 text-[12.5px] text-silver leading-relaxed">
                  Jawaban tutor mengalir saat dibuat, dan sinkronisasi realtime menjaga semua perangkat Anda selalu terbaru.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe2 className="mt-0.5 shrink-0 text-primary" size={18} />
              <div>
                <p className="text-[14px] font-semibold">9 bahasa, penjelasan berbahasa Indonesia</p>
                <p className="mt-0.5 text-[12.5px] text-silver leading-relaxed">
                  Minta penjelasan dalam bahasa Indonesia kapan pun — AI beradaptasi dengan bahasa Anda.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border py-7 text-center">
        <p className="text-[12.5px] text-silver/70">
          © {new Date().getFullYear()} MikuAI — Learn Languages. Understand the World.
        </p>
      </footer>
    </div>
  )
}
