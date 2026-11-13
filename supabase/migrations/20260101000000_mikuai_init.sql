-- ============================================================================
-- MikuAI — Supabase initial migration
-- Tables: profiles, learning_history, chat_sessions, chat_messages,
--         translation_history, vocabulary, lessons, lesson_progress,
--         quiz_attempts, quiz_questions, learning_progress, user_streaks,
--         ai_usage_logs
-- Includes: UUID PKs, foreign keys with cascade, timestamps, indexes,
--           constraints, updated_at triggers, RLS policies, realtime.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Admin check without RLS recursion (SECURITY DEFINER reads profiles.role).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  username        text unique,
  display_name    text,
  avatar_url      text,
  role            text not null default 'user' check (role in ('user', 'admin')),
  native_language text not null default 'Indonesian',
  target_language text not null default 'English',
  level           text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- chat_sessions / chat_messages
-- ---------------------------------------------------------------------------

create table public.chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null default 'Percakapan baru',
  language   text not null default 'English',
  level      text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_sessions_user_updated_idx on public.chat_sessions (user_id, updated_at desc);

create trigger chat_sessions_updated_at before update on public.chat_sessions
  for each row execute function public.set_updated_at();

create table public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant', 'system')),
  content    text not null,
  tokens     integer,
  created_at timestamptz not null default now()
);

create index chat_messages_session_created_idx on public.chat_messages (session_id, created_at);
create index chat_messages_user_idx on public.chat_messages (user_id);

-- ---------------------------------------------------------------------------
-- translation_history
-- ---------------------------------------------------------------------------

create table public.translation_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  source_language text not null,
  target_language text not null,
  detected_source text,
  source_text     text not null,
  translated_text text not null,
  style           text not null default 'neutral' check (style in ('formal', 'informal', 'neutral')),
  alternatives    jsonb,
  explanation     text,
  grammar_notes   text,
  idioms          jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index translation_history_user_created_idx on public.translation_history (user_id, created_at desc);

create trigger translation_history_updated_at before update on public.translation_history
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- vocabulary
-- ---------------------------------------------------------------------------

create table public.vocabulary (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  language         text not null,
  word             text not null,
  translation      text,
  definition       text,
  example_sentence text,
  pronunciation    text,
  category         text not null default 'general',
  source           text not null default 'manual' check (source in ('manual', 'tutor', 'translator', 'vocabulary_ai')),
  mastery_level    smallint not null default 0 check (mastery_level between 0 and 5),
  times_reviewed   integer not null default 0,
  correct_count    integer not null default 0,
  last_reviewed_at timestamptz,
  next_review_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index vocabulary_user_language_idx on public.vocabulary (user_id, language);
create index vocabulary_user_next_review_idx on public.vocabulary (user_id, next_review_at);

create trigger vocabulary_updated_at before update on public.vocabulary
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lessons (public content readable by authenticated users)
-- ---------------------------------------------------------------------------

create table public.lessons (
  id          uuid primary key default gen_random_uuid(),
  language    text not null,
  level       text not null check (level in ('beginner', 'intermediate', 'advanced')),
  category    text not null check (category in ('vocabulary', 'grammar', 'reading', 'writing', 'conversation', 'daily')),
  title       text not null,
  slug        text not null unique,
  summary     text,
  content     jsonb not null default '[]'::jsonb,
  order_index integer not null default 0,
  is_public   boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index lessons_language_level_category_idx on public.lessons (language, level, category, order_index);
create index lessons_created_by_idx on public.lessons (created_by);

create trigger lessons_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lesson_progress
-- ---------------------------------------------------------------------------

create table public.lesson_progress (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  status      text not null default 'completed' check (status in ('in_progress', 'completed')),
  score       integer check (score between 0 and 100),
  completed_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index lesson_progress_user_lesson_idx on public.lesson_progress (user_id, lesson_id);
create index lesson_progress_user_idx on public.lesson_progress (user_id);

create trigger lesson_progress_updated_at before update on public.lesson_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- quiz_attempts / quiz_questions
-- ---------------------------------------------------------------------------

create table public.quiz_attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  language         text not null,
  level            text not null check (level in ('beginner', 'intermediate', 'advanced')),
  quiz_type        text not null check (quiz_type in ('multiple_choice', 'fill_blank', 'sentence_arrangement', 'grammar', 'vocabulary', 'reading')),
  topic            text,
  status           text not null default 'active' check (status in ('active', 'completed')),
  total_questions  integer not null default 0,
  correct_count    integer not null default 0,
  score            integer check (score between 0 and 100),
  duration_seconds integer,
  weak_topics      jsonb,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index quiz_attempts_user_created_idx on public.quiz_attempts (user_id, created_at desc);

create trigger quiz_attempts_updated_at before update on public.quiz_attempts
  for each row execute function public.set_updated_at();

create table public.quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  attempt_id     uuid not null references public.quiz_attempts(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  question_type  text not null check (question_type in ('multiple_choice', 'fill_blank', 'sentence_arrangement')),
  question       text not null,
  options        jsonb,
  correct_answer text not null,
  explanation    text,
  user_answer    text,
  is_correct     boolean,
  order_index    integer not null default 0,
  topic          text,
  created_at     timestamptz not null default now()
);

create index quiz_questions_attempt_order_idx on public.quiz_questions (attempt_id, order_index);
create index quiz_questions_user_idx on public.quiz_questions (user_id);

-- ---------------------------------------------------------------------------
-- learning_history
-- ---------------------------------------------------------------------------

create table public.learning_history (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  activity_type    text not null check (activity_type in ('tutor', 'translation', 'lesson', 'vocabulary', 'quiz')),
  title            text not null,
  description      text,
  language         text,
  ref_id           uuid,
  metadata         jsonb,
  duration_minutes integer,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index learning_history_user_type_created_idx on public.learning_history (user_id, activity_type, created_at desc);
create index learning_history_user_created_idx on public.learning_history (user_id, created_at desc);

create trigger learning_history_updated_at before update on public.learning_history
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- learning_progress (one aggregate row per user + language)
-- ---------------------------------------------------------------------------

create table public.learning_progress (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  language          text not null,
  level             text not null default 'beginner',
  vocabulary_count  integer not null default 0,
  lessons_completed integer not null default 0,
  quizzes_taken     integer not null default 0,
  avg_quiz_score    numeric(5,2) not null default 0,
  study_minutes     integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index learning_progress_user_language_idx on public.learning_progress (user_id, language);
create index learning_progress_user_idx on public.learning_progress (user_id);

create trigger learning_progress_updated_at before update on public.learning_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_streaks
-- ---------------------------------------------------------------------------

create table public.user_streaks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users(id) on delete cascade,
  current_streak    integer not null default 0,
  longest_streak    integer not null default 0,
  total_active_days integer not null default 0,
  last_activity_date date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger user_streaks_updated_at before update on public.user_streaks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ai_usage_logs (no sensitive payload stored)
-- ---------------------------------------------------------------------------

create table public.ai_usage_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  feature           text not null,
  provider          text not null default 'grok',
  model             text not null,
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens      integer not null default 0,
  duration_ms       integer not null default 0,
  status            text not null default 'success' check (status in ('success', 'error')),
  error_code        text,
  error_message     text,
  created_at        timestamptz not null default now()
);

create index ai_usage_logs_user_created_idx on public.ai_usage_logs (user_id, created_at desc);
create index ai_usage_logs_status_created_idx on public.ai_usage_logs (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.chat_sessions       enable row level security;
alter table public.chat_messages       enable row level security;
alter table public.translation_history enable row level security;
alter table public.vocabulary          enable row level security;
alter table public.lessons             enable row level security;
alter table public.lesson_progress     enable row level security;
alter table public.quiz_attempts       enable row level security;
alter table public.quiz_questions      enable row level security;
alter table public.learning_history    enable row level security;
alter table public.learning_progress   enable row level security;
alter table public.user_streaks        enable row level security;
alter table public.ai_usage_logs       enable row level security;

-- profiles: read/update own; admins can read all profiles.
create policy "profiles_select_own" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profiles_insert_own" on public.profiles for insert
  with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- role escalation must go through an admin/service-role operation; users cannot
-- change their own role via anon key (protected by trigger below).

create or replace function public.protect_role_column()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role <> old.role and not public.is_admin() then
    raise exception 'Role changes require administrator privileges';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_role_column();

-- Generic owner-only policies for private tables.
do $$
declare t text;
begin
  foreach t in array array[
    'chat_sessions', 'chat_messages', 'translation_history', 'vocabulary',
    'lesson_progress', 'quiz_attempts', 'quiz_questions',
    'learning_history', 'learning_progress', 'user_streaks'
  ] loop
    execute format($f$
      create policy "%1$s_select_own" on public.%1$s for select using (user_id = auth.uid());
      create policy "%1$s_insert_own" on public.%1$s for insert with check (user_id = auth.uid());
      create policy "%1$s_update_own" on public.%1$s for update using (user_id = auth.uid()) with check (user_id = auth.uid());
      create policy "%1$s_delete_own" on public.%1$s for delete using (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- lessons: authenticated users read public lessons or their own generated ones;
-- owners manage their own; admins manage everything.
create policy "lessons_select" on public.lessons for select
  using (is_public = true or created_by = auth.uid() or public.is_admin());
create policy "lessons_insert_owner" on public.lessons for insert
  with check (created_by = auth.uid() or public.is_admin());
create policy "lessons_update_owner" on public.lessons for update
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());
create policy "lessons_delete_owner" on public.lessons for delete
  using (created_by = auth.uid() or public.is_admin());

-- ai_usage_logs: users read their own logs; inserts happen server-side with the
-- service role key (no client insert policy on purpose).
create policy "ai_usage_logs_select_own" on public.ai_usage_logs for select
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Realtime (live sync for chat, vocabulary, quiz, progress, dashboard)
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.chat_sessions;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.vocabulary;
alter publication supabase_realtime add table public.quiz_attempts;
alter publication supabase_realtime add table public.lesson_progress;
alter publication supabase_realtime add table public.learning_history;
alter publication supabase_realtime add table public.learning_progress;
alter publication supabase_realtime add table public.user_streaks;
