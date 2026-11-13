# MikuAI — Testing Guide

This is the test plan actually executed against the build. Repeat it after changes.

## 1. Automated checks

```bash
bun run lint          # ESLint must pass with 0 errors
bun run db:push       # schema in sync
bun run scripts/seed.ts   # idempotent seed
```

## 2. API smoke tests (curl)

Login once and reuse the cookie jar for authenticated calls:

```bash
curl -s -c /tmp/c.txt -X POST localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"tester@example.com","password":"Test1234","displayName":"Tester"}'

# session
curl -s -b /tmp/c.txt localhost:3000/api/auth/session

# dashboard aggregates (real DB numbers)
curl -s -b /tmp/c.txt localhost:3000/api/dashboard

# lessons
curl -s -b /tmp/c.txt "localhost:3000/api/lessons?language=English&level=beginner"

# translation (AI)
curl -s -b /tmp/c.txt -X POST localhost:3000/api/ai/translate \
  -H 'Content-Type: application/json' \
  -d '{"text":"Selamat pagi, apa kabar?","sourceLanguage":"auto","targetLanguage":"English","style":"neutral"}'

# tutor streaming (SSE — observe event: meta/delta/done)
curl -s -N -b /tmp/c.txt -X POST localhost:3000/api/ai/tutor \
  -H 'Content-Type: application/json' \
  -d '{"message":"Apa perbedaan nice dan good?","language":"English","level":"beginner"}'

# quiz generate → verify NO correctAnswer leaks → submit → verify grading
curl -s -b /tmp/c.txt -X POST localhost:3000/api/ai/quiz \
  -H 'Content-Type: application/json' \
  -d '{"language":"English","level":"beginner","quizType":"multiple_choice","topic":"greetings","count":3}'

# EXAM: generate a timed mixed exam (mode='exam', timeLimitSeconds set)
curl -s -b /tmp/c.txt -X POST localhost:3000/api/ai/exam \
  -H 'Content-Type: application/json' \
  -d '{"language":"English","level":"beginner","topic":null,"count":5,"timeLimitMinutes":5}'

# then submit via /api/quiz/attempts/<id>/submit — history records activity_type='exam'

# ASSIGNMENT: create brief → submit essay → AI rubric grading
curl -s -b /tmp/c.txt -X POST localhost:3000/api/ai/assignment \
  -H 'Content-Type: application/json' \
  -d '{"language":"English","level":"beginner","topic":"daily routine"}'
curl -s -b /tmp/c.txt -X POST localhost:3000/api/assignments/<id>/submit \
  -H 'Content-Type: application/json' \
  -d '{"text":"My name is Dina. I wake up at 5 oclock every morning. ... (min 60% of minWords)"}'
curl -s -b /tmp/c.txt "localhost:3000/api/assignments?page=1&limit=12"

# admin APIs must 403 for a normal user and 200 for admin
curl -s -b /tmp/c.txt localhost:3000/api/admin/stats
```

Expected results:
- Register returns `{user}` and sets the session cookie.
- Quiz generation response contains `questions` **without** `correctAnswer` fields.
- Quiz submit returns score, correctCount, weakTopics, and revealed answers.
- Exam generation returns `mode:'exam'` + `timeLimitSeconds`; submit records activity `exam`.
- Assignment submit returns rubric `scores` (grammar/vocabulary/structure/content), `overallScore`, feedback (summary/strengths/improvements/correctedText/tips); too-short texts return `400 too_short`; a second submit returns `409 already_graded`.
- Admin stats with a non-admin cookie returns `403 forbidden`.

## 3. Browser end-to-end (golden paths)

1. **Landing** — hero, features, language chips, CTA → `/register`.
2. **Register** — validation errors for weak password; success lands on `/dashboard`.
3. **Dashboard** — real stats (activity today, vocabulary, lessons, quiz average, study minutes, streak), weekly bar chart, AI recommendations load, recent activity list, per-language progress.
4. **AI Tutor** — new session, streaming tokens appear incrementally, markdown renders, session auto-titled; rename + delete session; "Simpan kosakata" dialog saves a word.
5. **Translator** — auto-detection, swap, styles, result card with alternatives/explanation/grammar/idioms, copy, history sidebar with search + delete.
6. **Academy** — language/level switch, lesson library with completion state, lesson reader sections, "Tandai Selesai" updates progress, "Buat dengan AI" generates a lesson.
7. **Vocabulary** — list with search/filters, add/edit/delete, flashcards flip, review mode with due filter and Hafal/Belum-hafal outcomes advancing mastery.
8. **Practice (Kuis)** — generate quiz (all six types render correctly), answer, submit, score card, weak topics, per-question review with explanations, history of attempts.
9. **Practice (Ujian)** — set language/level/count/duration → Mulai Ujian; sticky countdown (red under 60 s), answered counter; let the timer hit zero → answers auto-submit and the result shows the overtime badge; result page: pass/fail verdict (70), time used vs limit, weak topics, per-question review; Riwayat Ujian list with Lulus badges.
10. **Practice (Tugas Menulis)** — create assignment (AI brief with criteria), write with live word counter, submit early (below 60% of min words) → blocked; submit a valid essay → grading overlay → rubric result with 4 aspect bars, strengths/improvements, corrected text, tips; graded item opens from the list; delete works; re-submitting a graded task is rejected (409).
11. **Riwayat** — filters by type (incl. Ujian + Tugas Menulis)/language/date/search, detail dialog, delete.
12. **Analitik** — totals, activity area chart (7/30/90-day switch), quiz performance line, per-language progress, streak cards.
13. **Pengaturan** — profile save reflects in the sidebar/topbar; password change works; account info accurate.
14. **Admin** — visible only for role=admin; stats, provider badge (`dev-fallback` in sandbox / `grok` in production), user role switch, AI logs + error filter, DB health, lesson CRUD.
15. **Responsiveness** — 390 px viewport: hamburger menu, stacked cards, tutor drawer, no horizontal scroll.
16. **Auth guard** — visiting `/dashboard` signed-out redirects to `/login?next=/dashboard`; signed-in users visiting `/login` bounce to `/dashboard`.

## 4. Security spot-checks

- `XAI_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` appear only in `src/lib/ai/grok.ts`, `src/lib/ai/config.ts`, `src/lib/supabase/admin.ts`, and usage logging — never in client bundles.
- Direct DB authorization never trusts client IDs: every repository query filters by the server-resolved `user.id`.
- Rate limits: fire 21 tutor requests within a minute → the 21st returns HTTP 429 with a friendly message.
- Duplicate guard: two identical translate requests within 2.5 s → the second returns `duplicate_request`.
