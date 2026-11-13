// MikuAI — Supabase configuration detection.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

/**
 * True when the app is connected to a real Supabase project.
 * When false, the app runs on the local preview driver (Prisma/SQLite +
 * local credential auth) so every feature remains testable without cloud
 * credentials. Production deployments MUST configure Supabase.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
}

export const APP_NAME = 'MikuAI'
export const APP_TAGLINE = 'Learn Languages. Understand the World.'
