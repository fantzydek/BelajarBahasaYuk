'use client'

// MikuAI — Practice Center: tabbed hub for knowledge testing.
//   • Kuis          — quick AI-generated quizzes
//   • Ujian         — timed exams with auto-submit and pass mark
//   • Tugas Menulis — AI-briefed essays graded with a rubric
import { useState } from 'react'
import { ClipboardList, Timer, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QuizView } from '@/components/practice/quiz-view'
import { ExamView } from '@/components/practice/exam-view'
import { AssignmentsView } from '@/components/practice/assignments-view'
import type { SessionUser } from '@/lib/types'

type Tab = 'quiz' | 'exam' | 'assignment'

const TABS: { value: Tab; label: string; desc: string; icon: typeof ClipboardList }[] = [
  { value: 'quiz', label: 'Kuis', desc: 'Latihan singkat per topik', icon: ClipboardList },
  { value: 'exam', label: 'Ujian', desc: 'Ujian berwaktu, ada nilai kelulusan', icon: Timer },
  { value: 'assignment', label: 'Tugas Menulis', desc: 'Esai yang dinilai guru AI', icon: PenLine },
]

export function PracticeView({ user }: { user: SessionUser }) {
  const [tab, setTab] = useState<Tab>('quiz')

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        role="tablist"
        aria-label="Mode latihan"
      >
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.value
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.value)}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                active
                  ? 'border-primary bg-primary/12 shadow-[inset_0_2px_0_0_var(--primary)]'
                  : 'border-border bg-card/60 hover:border-primary/40',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  active ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-silver',
                )}
              >
                <Icon size={17} />
              </span>
              <span className="min-w-0">
                <span className={cn('block text-[13.5px] font-semibold', active ? 'text-foreground' : 'text-silver')}>
                  {t.label}
                </span>
                <span className="block truncate text-[11.5px] text-silver/70">{t.desc}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Active mode */}
      <div role="tabpanel" aria-label={TABS.find((t) => t.value === tab)?.label}>
        {tab === 'quiz' && <QuizView user={user} />}
        {tab === 'exam' && <ExamView user={user} />}
        {tab === 'assignment' && <AssignmentsView user={user} />}
      </div>
    </div>
  )
}
