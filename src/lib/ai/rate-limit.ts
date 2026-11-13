// MikuAI — Per-user sliding-window rate limiter (in-memory).
// Protects AI endpoints from bursts and accidental duplicate submissions.
// For multi-instance production deployments swap the Map for Redis/Upstash —
// the interface stays identical.

interface WindowState {
  timestamps: number[]
}

const buckets = new Map<string, WindowState>()
const lastRequest = new Map<string, number>()

const MAX_KEYS = 10_000

function prune() {
  if (buckets.size <= MAX_KEYS && lastRequest.size <= MAX_KEYS) return
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [k, v] of buckets) {
    if (!v.timestamps.length || v.timestamps[v.timestamps.length - 1] < cutoff) buckets.delete(k)
  }
  for (const [k, t] of lastRequest) {
    if (t < cutoff) lastRequest.delete(k)
  }
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
  remaining: number
}

/**
 * Sliding window check.
 * @param key unique per user+endpoint
 * @param limit max requests inside windowMs
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  prune()
  const now = Date.now()
  const state = buckets.get(key) ?? { timestamps: [] }
  state.timestamps = state.timestamps.filter((t) => now - t < windowMs)

  if (state.timestamps.length >= limit) {
    const oldest = state.timestamps[0]
    buckets.set(key, state)
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
      remaining: 0,
    }
  }

  state.timestamps.push(now)
  buckets.set(key, state)
  return { allowed: true, retryAfterSeconds: 0, remaining: limit - state.timestamps.length }
}

/**
 * Duplicate-submission guard: identical (user, feature, payloadHash) requests
 * within the dedupe window are rejected (e.g. double-click on Generate).
 */
const DUPLICATE_WINDOW_MS = 2500
export function isDuplicateSubmission(userId: string, feature: string, payloadHash: string): boolean {
  const key = `${userId}:${feature}:${payloadHash}`
  const last = lastRequest.get(key)
  const now = Date.now()
  lastRequest.set(key, now)
  return last !== undefined && now - last < DUPLICATE_WINDOW_MS
}
