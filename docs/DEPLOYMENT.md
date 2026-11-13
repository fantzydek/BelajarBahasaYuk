# MikuAI — Deployment Guide

## 1. Deploy to Vercel (recommended)

### 1.1 Prepare Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run, in order:
   - `supabase/migrations/20260101000000_mikuai_init.sql` (schema + RLS + realtime)
   - `supabase/migrations/20260101010000_mikuai_seed.sql` (starter lesson library)
3. **Authentication → Providers → Email**: enable *Email* (password sign-in).
4. **Authentication → URL Configuration**: set *Site URL* to your production domain and add `https://YOUR-DOMAIN/reset-password` to *Redirect URLs* (password reset flow).
5. Grant your admin account:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

### 1.2 Prepare xAI
1. Create an API key at [console.x.ai](https://console.x.ai).
2. Ensure the key has access to `grok-4.7` (or adjust `XAI_MODEL`).

### 1.3 Deploy the app
1. Push the repository to GitHub/GitLab.
2. In Vercel: **New Project → import the repo** (framework auto-detected: Next.js).
3. Configure environment variables (Project → Settings → Environment Variables):

   | Variable | Value | Sensitive |
   |---|---|---|
   | `XAI_API_KEY` | `xai-…` | yes |
   | `XAI_MODEL` | `grok-4.7` | no |
   | `XAI_BASE_URL` | `https://api.x.ai/v1` | no |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | no |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key from Supabase | no |
   | `SUPABASE_SERVICE_ROLE_KEY` | service-role key from Supabase | yes |
   | `NEXT_PUBLIC_APP_URL` | `https://your-domain` | no |
   | `AI_DEV_FALLBACK` | `false` | no |

   Do **not** set `DATABASE_URL` (Prisma/SQLite) in production — it is only used by the local preview driver, which is bypassed entirely once the Supabase variables are present.
4. Deploy. Run `npm run build` locally first if you want to verify the production build.

## 2. Deploy to a VPS

```bash
# prerequisites: node >= 20, pm2
git clone <your-repo> mikuai && cd mikuai
npm ci
cp .env.example .env   # fill in Supabase + xAI values (production set)
npm run build
pm2 start npm --name mikuai -- run start   # serves on port 3000
```

Put Nginx/Caddy in front for TLS. Example Caddy rule:

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

## 3. Post-deployment verification

1. Register a fresh account → confirm a row appears in `profiles` (and `auth.users`).
2. Send one tutor message → confirm `chat_sessions`, `chat_messages`, `learning_history`, `user_streaks` update and `ai_usage_logs` shows `provider='grok'`.
3. Generate + submit a quiz → confirm `quiz_attempts`/`quiz_questions` complete with scores.
4. Open `/admin` as the admin → stats, AI logs (`status='success'`), DB health `healthy`.
5. Verify a second account cannot read the first account's data (RLS).

## 4. Rollback & notes

- Database migrations are additive; keep them in `supabase/migrations` and apply in order.
- The runtime AI provider is chosen per request from env vars; rotating `XAI_API_KEY` requires a redeploy/restart only.
- Rate limiting is in-memory per instance. For horizontal scaling, back `lib/ai/rate-limit.ts` with Redis (the interface is a single function).
