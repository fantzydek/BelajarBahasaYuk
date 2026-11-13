// MikuAI — User registration/login/profile operations across both auth drivers.
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { createLocalSession, destroyLocalSession } from '@/lib/auth/session'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { Level, SessionUser } from '@/lib/types'

export async function registerUser(
  email: string,
  password: string,
  displayName: string | null,
  userAgent?: string,
): Promise<{ user: SessionUser | null; error?: string }> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase!.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) return { user: null, error: error.message }
    // Email confirmation may be required before a session exists.
    if (!data.session) {
      return { user: null, error: 'Registrasi berhasil. Silakan verifikasi email Anda sebelum masuk.' }
    }
    const p = data.user
    return {
      user: {
        id: p!.id,
        email: p!.email ?? email,
        displayName: displayName,
        username: null,
        avatarUrl: null,
        role: 'user',
        nativeLanguage: 'Indonesian',
        targetLanguage: 'English',
        level: 'beginner',
        createdAt: p!.created_at,
      },
    }
  }

  // Local driver
  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) return { user: null, error: 'Email sudah terdaftar. Silakan masuk.' }
  // Bootstrap: the very first account (when no admin exists yet) becomes the
  // admin so the Admin Panel is reachable in a fresh local installation.
  const adminExists = await db.user.findFirst({ where: { role: 'admin' } })
  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      displayName: displayName ?? email.split('@')[0],
      role: adminExists ? 'user' : 'admin',
    },
  })
  await createLocalSession(user.id, userAgent)
  return { user: sessionFromLocal(user) }
}

export async function loginUser(
  email: string,
  password: string,
  userAgent?: string,
): Promise<{ user: SessionUser | null; error?: string }> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error || !data.user) return { user: null, error: error?.message ?? 'Login gagal.' }
    const { data: profile } = await supabase!
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()
    const p = (profile ?? {}) as Record<string, unknown>
    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? email,
        displayName: (p.display_name as string) ?? null,
        username: (p.username as string) ?? null,
        avatarUrl: (p.avatar_url as string) ?? null,
        role: (p.role as 'user' | 'admin') ?? 'user',
        nativeLanguage: (p.native_language as string) ?? 'Indonesian',
        targetLanguage: (p.target_language as string) ?? 'English',
        level: (p.level as Level) ?? 'beginner',
        createdAt: String(p.created_at ?? data.user.created_at),
      },
    }
  }

  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { user: null, error: 'Email atau kata sandi salah.' }
  }
  await createLocalSession(user.id, userAgent)
  return { user: sessionFromLocal(user) }
}

export async function logout(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    await supabase?.auth.signOut()
    return
  }
  await destroyLocalSession()
}

export async function requestPasswordReset(email: string): Promise<{ ok: boolean; token?: string; error?: string }> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || undefined
    const { error } = await supabase!.auth.resetPasswordForEmail(email, {
      redirectTo: appUrl ? `${appUrl}/reset-password` : undefined,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  // Do not reveal whether the account exists.
  if (!user) return { ok: true }
  const { randomBytes } = await import('crypto')
  const token = randomBytes(24).toString('hex')
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  })
  // No mail service in sandbox: the token is returned so the reset flow can be
  // completed end-to-end. In Supabase mode the email link flow is used instead.
  return { ok: true, token }
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const record = await db.passwordResetToken.findUnique({ where: { token } })
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, error: 'Tautan reset tidak valid atau sudah kedaluwarsa.' }
  }
  await db.user.update({
    where: { id: record.userId },
    data: { passwordHash: hashPassword(newPassword) },
  })
  await db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })
  await db.authSession.deleteMany({ where: { userId: record.userId } })
  return { ok: true }
}

export async function updateProfile(
  userId: string,
  patch: { displayName?: string; username?: string; nativeLanguage?: string; targetLanguage?: string; level?: Level; avatarUrl?: string },
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { error } = await supabase!
      .from('profiles')
      .update({
        ...(patch.displayName !== undefined ? { display_name: patch.displayName } : {}),
        ...(patch.username !== undefined ? { username: patch.username } : {}),
        ...(patch.nativeLanguage !== undefined ? { native_language: patch.nativeLanguage } : {}),
        ...(patch.targetLanguage !== undefined ? { target_language: patch.targetLanguage } : {}),
        ...(patch.level !== undefined ? { level: patch.level } : {}),
        ...(patch.avatarUrl !== undefined ? { avatar_url: patch.avatarUrl } : {}),
      })
      .eq('id', userId)
    if (error) throw new Error(error.message)
    return
  }
  await db.user.update({
    where: { id: userId },
    data: {
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.username !== undefined ? { username: patch.username } : {}),
      ...(patch.nativeLanguage !== undefined ? { nativeLanguage: patch.nativeLanguage } : {}),
      ...(patch.targetLanguage !== undefined ? { targetLanguage: patch.targetLanguage } : {}),
      ...(patch.level !== undefined ? { level: patch.level } : {}),
      ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
    },
  })
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data } = await supabase!.auth.getUser()
    const email = data.user?.email
    if (email) {
      const { error } = await supabase!.auth.signInWithPassword({ email, password: currentPassword })
      if (error) return { ok: false, error: 'Kata sandi saat ini salah.' }
    }
    const { error: updateError } = await supabase!.auth.updateUser({ password: newPassword })
    if (updateError) return { ok: false, error: updateError.message }
    return { ok: true }
  }
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return { ok: false, error: 'Kata sandi saat ini salah.' }
  }
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(newPassword) },
  })
  return { ok: true }
}

/** Admin only: change a user's role via service role / direct db. */
export async function adminSetRole(adminId: string, targetUserId: string, role: 'user' | 'admin'): Promise<void> {
  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdminClient()
    const { error } = await admin!.from('profiles').update({ role }).eq('id', targetUserId)
    if (error) throw new Error(error.message)
    return
  }
  await db.user.update({ where: { id: targetUserId }, data: { role } })
}

function sessionFromLocal(user: {
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
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role as 'user' | 'admin',
    nativeLanguage: user.nativeLanguage,
    targetLanguage: user.targetLanguage,
    level: user.level as Level,
    createdAt: user.createdAt.toISOString(),
  }
}
