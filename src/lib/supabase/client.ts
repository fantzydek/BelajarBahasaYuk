'use client'

// MikuAI — Browser Supabase client (anon key, RLS-enforced).
import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config'

let cached: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null
  if (!cached) {
    cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return cached
}
