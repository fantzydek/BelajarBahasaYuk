'use client'

// MikuAI — Live data hooks.
// - Supabase mode: subscribes to postgres_changes via Supabase Realtime with
//   proper channel cleanup (no duplicate listeners).
// - Local mode: light polling keeps the UI in sync across devices/tabs.
import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { apiFetch } from '@/lib/client/api'

/**
 * Returns a monotonically increasing counter that bumps whenever a relevant
 * database change arrives via realtime (Supabase) or polling (local mode).
 * Components pass `bump` into their fetch effect dependency list.
 */
export function useRealtimeBump(
  tables: string[],
  userId: string | null,
  pollMs = 15_000,
): number {
  const [bump, setBump] = useState(0)
  const tablesKey = tables.join(',')
  const lastEventRef = useRef(0)

  const scheduleBump = useCallback(() => {
    const now = Date.now()
    // Debounce bursts of events (e.g. many messages at once).
    if (now - lastEventRef.current < 400) return
    lastEventRef.current = now
    setBump((b) => b + 1)
  }, [])

  useEffect(() => {
    if (!userId) return

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient()
      if (!supabase) return
      const channelName = `mikuai:${tablesKey}:${userId}`
      const channel = supabase
        .channel(channelName, { config: { broadcast: { self: false } } })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          () => scheduleBump(),
        )
      for (const table of tables) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
          () => scheduleBump(),
        )
      }
      channel.subscribe()
      return () => {
        void supabase.removeChannel(channel)
      }
    }

    // Local preview driver: polling fallback.
    const id = setInterval(scheduleBump, pollMs)
    return () => clearInterval(id)
     
  }, [userId, tablesKey, pollMs, scheduleBump])

  return bump
}

interface LiveState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Fetch JSON from an API endpoint and keep it live via realtime/polling.
 * `onBump` lets callers transform the raw payload after refetch.
 */
export function useLiveData<T>(
  url: string,
  userId: string | null,
  realtimeTables: string[] = [],
  options: { pollMs?: number; enabled?: boolean } = {},
): LiveState<T> {
  const { pollMs = 15_000, enabled = true } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bump = useRealtimeBump(realtimeTables, enabled ? userId : null, pollMs)

  const refresh = useCallback(() => {
    apiFetch<T>(url, { silent: true })
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false))
     
  }, [url])

  useEffect(() => {
    if (!enabled) {
      // Data stays null; components treat enabled=false as idle.
      return
    }
    refresh()
  }, [refresh, enabled, bump])

  return { data, loading, error, refresh }
}
