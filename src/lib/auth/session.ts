// MikuAI — Unified session resolution across both auth drivers.
// - Supabase mode: auth session from Supabase Auth (cookie-managed by @supabase/ssr),
//   profile row in `profiles`.
// - Local mode: HttpOnly cookie token -> auth_sessions table.
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { Level, Role, SessionUser } from '@/lib/types'

export const LOCAL_SESSION_COOKIE = 'mikuai_session'
const SESSION_DAYS = 30

export async function createLocalSession(userId: string, userAgent?: string): Promise<string> {
  const { randomBytes } = await import('crypto')
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await db.authSession.create({
    data: { userId, token, userAgent: userAgent ?? null, expiresAt },
  })
  const store = await cookies()
  store.set(LOCAL_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
  return token
}

export async function destroyLocalSession(): Promise<void> {
  const store = await cookies()
  const token = store.get(LOCAL_SESSION_COOKIE)?.value
  if (token) {
    await db.authSession.deleteMany({ where: { token } })
  }
  store.delete(LOCAL_SESSION_COOKIE)
}

function mapLocalUser(u: {
  id: string
  email: string
  displayName: string | null
  username: string | null
  avatarUrl: string | null
  role: string
  nativeLanguage: string
  targetLanguage: string
  level: string
  createdAt: Date
}): SessionUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    username: u.username,
    avatarUrl: u.avatarUrl,
    role: u.role as Role,
    nativeLanguage: u.nativeLanguage,
    targetLanguage: u.targetLanguage,
    level: u.level as Level,
    createdAt: u.createdAt.toISOString(),
  }
}

/** Resolve the current user from either auth driver. Returns null when signed out. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    if (!supabase) return null
    const { data } = await supabase.auth.getUser()
    if (!data?.user) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()
    const p = profile as Record<string, unknown> | null
    return {
      id: data.user.id,
      email: data.user.email ?? '',
      displayName: (p?.display_name as string) ?? null,
      username: (p?.username as string) ?? null,
      avatarUrl: (p?.avatar_url as string) ?? null,
      role: ((p?.role as Role) ?? 'user') satisfies Role,
      nativeLanguage: (p?.native_language as string) ?? 'Indonesian',
      targetLanguage: (p?.target_language as string) ?? 'English',
      level: ((p?.level as Level) ?? 'beginner') satisfies Level,
      createdAt: String(p?.created_at ?? data.user.created_at),
    }
  }

  // Local mode
  const store = await cookies()
  const token = store.get(LOCAL_SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.authSession.findUnique({ where: { token } })
  if (!session || session.expiresAt < new Date()) return null
  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user) return null
  return mapLocalUser(user)
}
