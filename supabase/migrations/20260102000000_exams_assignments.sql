-- MikuAI — Migration 0002: Ujian (timed exams) & Tugas Menulis (AI-graded
-- writing assignments).
--  1. quiz_attempts gains `mode` (practice | exam) + `time_limit_seconds`.
--  2. `exam` allowed in quiz_type / activity_type check constraints.
--  3. New `writing_assignments` table with full RLS (owner-only access),
--     indexes and updated_at trigger.

-- ============================================================
-- 1) quiz_attempts: exam mode + time limit
-- ============================================================
alter table public.quiz_attempts
  add column if not exists mode text not null default 'practice';
alter table public.quiz_attempts
  add column if not exists time_limit_seconds integer;
alter table public.quiz_attempts
  add constraint quiz_attempts_mode_check
  check (mode in ('practice', 'exam'));

-- widen quiz_type: 'exam' aggregates mixed-type exam papers
alter table public.quiz_attempts drop constraint quiz_attempts_quiz_type_check;
alter table public.quiz_attempts
  add constraint quiz_attempts_quiz_type_check
  check (quiz_type in (
    'multiple_choice', 'fill_blank', 'sentence_arrangement',
    'grammar', 'vocabulary', 'reading', 'exam'
  ));

create index if not exists quiz_attempts_user_mode_started_idx
  on public.quiz_attempts (user_id, mode, started_at desc);

-- ============================================================
-- 2) learning_history: allow new activity types
-- ============================================================
alter table public.learning_history drop constraint learning_history_activity_type_check;
alter table public.learning_history
  add constraint learning_history_activity_type_check
  check (activity_type in ('tutor', 'translation', 'lesson', 'vocabulary', 'quiz', 'exam', 'assignment'));

-- ============================================================
-- 3) writing_assignments
-- ============================================================
create table if not exists public.writing_assignments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  language         text not null,
  level            text not null check (level in ('beginner', 'intermediate', 'advanced')),
  topic            text,
  title            text not null,
  prompt           text not null,
  instructions     text,
  min_words        integer not null default 50,
  max_words        integer not null default 200,
  criteria         jsonb not null default '[]'::jsonb,
  status           text not null default 'active' check (status in ('active', 'graded')),
  submission_text  text,
  word_count       integer,
  score_grammar    integer,
  score_vocabulary integer,
  score_structure  integer,
  score_content    integer,
  overall_score    integer,
  feedback         jsonb,
  ai_provider      text,
  ai_model         text,
  submitted_at     timestamptz,
  graded_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.writing_assignments enable row level security;

create policy "writing_assignments_select_own" on public.writing_assignments
  for select to authenticated
  using (user_id = auth.uid());
create policy "writing_assignments_insert_own" on public.writing_assignments
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "writing_assignments_update_own" on public.writing_assignments
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "writing_assignments_delete_own" on public.writing_assignments
  for delete to authenticated
  using (user_id = auth.uid());

create index if not exists writing_assignments_user_created_idx
  on public.writing_assignments (user_id, created_at desc);
create index if not exists writing_assignments_user_status_idx
  on public.writing_assignments (user_id, status);

drop trigger if exists writing_assignments_updated_at on public.writing_assignments;
create trigger writing_assignments_updated_at
  before update on public.writing_assignments
  for each row execute function public.set_updated_at();

-- Realtime: stream assignment status changes to the owner's devices.
alter publication supabase_realtime add table public.writing_assignments;
alter publication supabase_realtime add table public.quiz_attempts;
