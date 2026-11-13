// MikuAI — Supabase admin client (service role key, bypasses RLS).
// SERVER ONLY. Never import from client code. Used for admin operations,
// usage logging, and profile/role management.
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, isSupabaseAdminConfigured } from './config'

export function getSupabaseAdminClient() {
  if (!isSupabaseAdminConfigured()) return null
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
