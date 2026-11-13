// MikuAI — AI usage logging to ai_usage_logs (server-side only).
// Stores no user message content — only metadata, tokens, and error codes.
import { db } from '@/lib/db'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { isSupabaseAdminConfigured } from '@/lib/supabase/config'

export interface AiUsageLogInput {
  userId: string | null
  feature: string
  provider: string
  model: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  durationMs?: number
  status?: 'success' | 'error'
  errorCode?: string | null
  errorMessage?: string | null
}

export async function logAiUsage(input: AiUsageLogInput): Promise<void> {
  const row = {
    user_id: input.userId,
    feature: input.feature,
    provider: input.provider,
    model: input.model,
    prompt_tokens: input.promptTokens ?? 0,
    completion_tokens: input.completionTokens ?? 0,
    total_tokens: input.totalTokens ?? (input.promptTokens ?? 0) + (input.completionTokens ?? 0),
    duration_ms: input.durationMs ?? 0,
    status: input.status ?? 'success',
    error_code: input.errorCode ?? null,
    // Never log raw payloads; truncate defensively.
    error_message: input.errorMessage ? input.errorMessage.slice(0, 300) : null,
  }

  try {
    if (isSupabaseAdminConfigured()) {
      const admin = getSupabaseAdminClient()
      await admin?.from('ai_usage_logs').insert(row)
    } else {
      await db.aiUsageLog.create({
        data: {
          userId: input.userId,
          feature: input.feature,
          provider: input.provider,
          model: input.model,
          promptTokens: row.prompt_tokens,
          completionTokens: row.completion_tokens,
          totalTokens: row.total_tokens,
          durationMs: row.duration_ms,
          status: row.status,
          errorCode: row.error_code,
          errorMessage: row.error_message,
        },
      })
    }
  } catch (e) {
    // Logging must never break the user-facing request.
    console.error('[ai-usage] failed to persist log:', e instanceof Error ? e.message : e)
  }
}
