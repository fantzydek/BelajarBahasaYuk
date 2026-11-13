# MikuAI — Learn Languages. Understand the World.

MikuAI is a production-minded, full-stack **AI language learning platform**: an interactive AI tutor with streaming responses, a context-aware translator, a structured language academy, smart vocabulary with flashcards, AI-generated quizzes with server-side grading, a unified learning history, live analytics, and a protected admin panel — all backed by a real database and a real AI provider.

- **Brand**: black `#080B10` canvas, white text, elegant blue `#267BFF` accent, silver `#A8B7CC` secondary, dark sidebar, subtle micro-animations. Dark-only premium SaaS design system.
- **AI**: **xAI Grok only** (`grok-4.7` via the official `https://api.x.ai/v1` API). No other AI provider is integrated. All AI requests run on secure server-side routes; keys never reach the browser.
- **Stack**: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui + Lucide · Supabase (PostgreSQL, Auth, Realtime, RLS) · Prisma (local preview driver) · Recharts · Zod.

---

## 1. Architecture overview

```
src/
  app/
    page.tsx                  # Public landing page
    (auth)/login|register|forgot-password|reset-password   # Auth pages
    (app)/                    # Protected shell (dark sidebar + topbar)
      dashboard/ tutor/ translator/ academy/ vocabulary/
      practice/ history/ progress/ settings/ admin/
    api/
      auth/                   # register, login, logout, session, profile,
                              # password-reset (+ confirm), password-change
      ai/                     # tutor (SSE streaming), translate, grammar,
                              # vocabulary, quiz, exam, assignment, lesson, recommend
      assignments/            # writing assignments: list, detail, delete,
                              # submit (AI rubric grading)
      sessions/               # chat sessions CRUD + messages
      translations/           # translation history (paginated, delete)
      vocabulary/             # CRUD + review (SRS-lite outcome)
      lessons/                # list, detail, progress
      quiz/attempts/          # attempts list/detail/submit (server grading;
                              # mode='exam' untuk ujian berwaktu)
      history/                # unified activity log (filters, delete)
      dashboard/ analytics/   # aggregates from real DB queries
      admin/                  # stats, users (+role), logs, health, lessons CRUD
  components/                 # feature views + shadcn/ui primitives
  lib/
    ai/                       # grok.ts (xAI client), dev-fallback.ts, prompts.ts,
                              # usage.ts, rate-limit.ts, structured.ts, json.ts
    supabase/                 # client, server, admin clients + config
    auth/                     # password hashing, sessions, guards
    data/                     # repositories (dual driver: Supabase | local)
    validation/               # Zod schemas for every API input
  hooks/use-live-data.ts      # realtime subscriptions + polling fallback
supabase/migrations/         # SQL schema + RLS policies + seed
prisma/schema.prisma         # mirrored schema for the local preview driver
scripts/                     # seed.ts, seed-data.ts, generate-seed-sql.ts
```

### Dual driver design (documented, not silent)

| Concern | Production (Supabase configured) | Sandbox preview (no Supabase env) |
|---|---|---|
| Database | Supabase PostgreSQL, RLS enforced on every query | Local SQLite via Prisma (mirrored schema) |
| Auth | Supabase Auth (email/password, reset email, cookie sessions) | Local credential auth (scrypt hashes, HttpOnly session cookie) |
| Realtime | Supabase Realtime `postgres_changes` channels with proper cleanup | Light polling fallback (15 s) |
| AI | **xAI Grok** via `XAI_API_KEY` (`grok-4.7`) | If `AI_DEV_FALLBACK=true` and no key: labeled sandbox dev model; visible in Admin panel and `ai_usage_logs` (`provider="dev-fallback"`) |

The application code never hardcodes fake statistics and never silently swaps providers: the Admin panel shows the active AI provider/model and database driver at all times.

---

## 2. Feature map

1. **Auth** — register, login, logout, session persistence, password reset (Supabase email flow in production; token flow in local preview), password change, profile editing, account settings. Every route under `(app)` is protected server-side; `/api/*` guards re-check on every call.
2. **Dashboard** — welcome message, learning activity summary, current language + level, daily activity, total vocabulary, completed lessons, quiz scores, learning streak, recent activities, AI recommendations (derived from the user's real stats, 30-min cache).
3. **Miku AI Tutor** — Grok-powered streaming chat (SSE), persistent multi-session history, rename/delete sessions, context-aware follow-ups, grammar/vocabulary explanations, sentence correction, examples, practice suggestions, beginner/intermediate/advanced levels, Indonesian-friendly responses, save-word-to-vocabulary dialog.
4. **AI Translator** — automatic language detection, source/target selection, swap, copy, formal/informal/neutral styles, alternatives, grammar notes, idiom explanations, paginated searchable history, delete, save-word shortcut.
5. **Language Academy** — language + level selection, 6 lesson categories (vocabulary, grammar, reading, writing, conversation, daily expressions), seeded lesson library (13 lessons), AI lesson generation on demand, completion tracking feeding progress + streaks.
6. **Smart Vocabulary** — save words manually or from Tutor/Translator/AI lookup, definitions, translations, pronunciation, categories, search + filters, flashcards, SRS-lite review schedule (1/2/4/7/14/30-day mastery gates), mastery levels 0–5.
7. **Practice Center — Kuis, Ujian & Tugas** — a tabbed knowledge-testing hub:
   - **Kuis** — multiple choice, fill-in-the-blank, sentence arrangement, grammar/vocabulary/reading tests; answers are validated with Zod, stored server-side, **never exposed before submission**; server-side grading, score, correct answers, mistake explanations, weak-topic recommendations; attempt history.
   - **Ujian (timed exams)** — AI generates mixed-type exam papers (5–20 questions); a live countdown (5–30 minutes) with color-coded urgency, answered counter and **auto-submit when time runs out**; pass mark 70 with pass/fail verdict, time-used vs. limit, weak-topic recap, and a full per-question review (your answer vs. correct answer + explanation). Exam attempts are stored in `quiz_attempts` with `mode='exam'` and appear in history/analytics.
   - **Tugas Menulis (writing assignments)** — AI composes the brief (title, prompt, instructions, word target, rubric criteria); the learner writes the essay in-app with a live word counter; **Grok grades the submission with a 4-aspect rubric** (grammar, vocabulary, structure, content) plus overall score, summary, strengths, concrete improvements, a corrected version of the text, and follow-up tips. Graded assignments persist in `writing_assignments` and feed history/analytics/streaks.
8. **Learning History** — unified log of tutor/translation/lesson/vocabulary/quiz/exam/assignment activity with type filters, language filter, date range, search, detail dialog, delete; loaded entirely from the database.
9. **Learning Analytics** — total study time, vocabulary, lessons, quiz performance (line chart), weekly/monthly activity (area chart), streaks, per-language progress; all from real queries.
10. **Admin Panel** — platform stats, user management with role changes, AI usage + error monitoring, per-feature token stats, database health (13-table row counts + latency), lesson content management. Role checks are enforced server-side on every admin API call (frontend checks are cosmetic only).

---

## 3. Setup

### 3.1 Prerequisites

- Node.js ≥ 20 or Bun ≥ 1.1
- An xAI API key with access to `grok-4.7`
- (Production) A Supabase project

### 3.2 Local development (sandbox preview driver)

```bash
# 1. Install dependencies
bun install        # or: npm install

# 2. Configure environment
cp .env.example .env
#    - leave Supabase vars empty to use the local driver
#    - set XAI_API_KEY for real Grok responses (or leave empty +
#      AI_DEV_FALLBACK=true to use the sandbox dev model)

# 3. Create the local database schema and seed it
bun run db:push
bun run scripts/seed.ts

# 4. Start the dev server
bun run dev        # http://localhost:3000
```

Seeded accounts (local driver only):

| Account | Email | Password |
|---|---|---|
| Administrator | `admin@mikuai.app` | value of `SEED_ADMIN_PASSWORD` (default `MikuAdmin2026!`) |
| Demo learner (with sample activity data) | `demo@mikuai.app` | `Demo1234!` |

> Change or delete these accounts before any real deployment. In Supabase mode no seed accounts are created; grant admin by running `update profiles set role='admin' where email='you@example.com';` in the Supabase SQL editor.

### 3.3 Production setup (Supabase + Grok)

1. **Supabase**: create a project → SQL Editor → run `supabase/migrations/20260101000000_mikuai_init.sql`, then `supabase/migrations/20260101010000_mikuai_seed.sql`.
   The migration creates all 13 tables (`profiles`, `learning_history`, `chat_sessions`, `chat_messages`, `translation_history`, `vocabulary`, `lessons`, `lesson_progress`, `quiz_attempts`, `quiz_questions`, `learning_progress`, `user_streaks`, `ai_usage_logs`) with UUID PKs, foreign keys + cascades, `created_at`/`updated_at` triggers, indexes, constraints, **Row Level Security policies** (owner-only access; public read for lessons; admin helpers), role-escalation protection, and adds the tables to the `supabase_realtime` publication. It also installs a `handle_new_user` trigger that auto-creates a profile per auth user.
2. **Auth settings**: enable Email provider in Supabase Auth (password login + reset emails). Optionally set the reset redirect URL to `https://YOUR-DOMAIN/reset-password`.
3. **Environment**: set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `XAI_API_KEY`, `XAI_MODEL=grok-4.7`. Set `AI_DEV_FALLBACK=false` (or remove it) so the sandbox fallback can never activate.
4. The app detects the Supabase env automatically on boot and switches every data path to Supabase.

---

## 4. AI architecture notes

- `lib/ai/grok.ts` — xAI client: `POST {XAI_BASE_URL}/chat/completions`, SSE streaming (`stream_options.include_usage`), JSON mode for structured outputs, exponential backoff with jitter on `429`/`5xx`, 120 s timeout, configurable `maxTokens`, token-usage reporting.
- `lib/ai/prompts.ts` — specialized system prompts (tutor persona, translator, grammar assistant, vocabulary assistant, quiz generator, lesson designer, dashboard recommendations) with level-adaptive, Indonesian-friendly instructions and strict JSON schemas.
- `lib/ai/rate-limit.ts` — per-user sliding-window quotas per endpoint + duplicate-submission guard (2.5 s window). Swap the in-memory Map for Redis in multi-instance deployments.
- `lib/ai/usage.ts` — every AI call logs feature, provider, model, tokens, duration, and error codes to `ai_usage_logs`. No message content is stored.
- `lib/ai/structured.ts` — structured-output helper with one automatic corrective retry when the model returns invalid JSON.
- Friendly, localized error messages are returned for every failure mode (unconfigured key, rate limit, timeout, network, invalid output). The app never falls back to another AI provider and never fakes AI responses.

## 5. Security checklist

- Server-side API keys only (`XAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are never imported by client code).
- Supabase RLS policies protect every table; queries additionally filter by the server-resolved `user.id` (client-supplied IDs are never trusted for authorization).
- Zod validation on every API input; parameterized queries only (Prisma/PostgREST).
- Quiz answers never leave the server before submission; grading is server-side.
- Session cookies are HttpOnly, SameSite=Lax, Secure in production.
- Role escalation is blocked by a database trigger; admin APIs re-verify role server-side.
- AI usage logs store metadata only — no user message content.

## 6. Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start the dev server (port 3000) |
| `bun run lint` | ESLint |
| `bun run db:push` | Push the Prisma schema to the local database |
| `bun run scripts/seed.ts` | Seed local DB: lesson library + accounts + demo activity |
| `bun run scripts/generate-seed-sql.ts` | Regenerate `supabase/migrations/*_seed.sql` from the shared lesson data |
| `bun run build` / `bun run start` | Production build / start (standalone) |

## 7. Documentation index

- `docs/DEPLOYMENT.md` — deploying to Vercel / VPS with Supabase.
- `docs/TESTING.md` — manual test plan + API smoke tests used to verify every module.
