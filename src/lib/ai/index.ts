// MikuAI — Unified AI completion interface (server-side only).
//
// Primary provider: xAI Grok — official API at https://api.x.ai/v1/chat/completions.
//   • Streaming via SSE (`stream: true`).
//   • Exponential backoff with jitter on 429 / temporary 5xx responses.
//   • Configurable output token limits (maxTokens).
//   • Token usage reporting (prompt/completion/total) for usage tracking.
//
// The optional dev-fallback adapter (sandbox preview only, no key configured)
// exposes the exact same interface so route handlers never branch on provider.

import { AI_UNCONFIGURED_MESSAGE, resolveAiProvider } from './config'
import { streamSSE, completeJSON as grokComplete } from './grok'
import { streamSSE as devStream, completeJSON as devComplete } from './dev-fallback'

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface AiCompleteResult {
  content: string
  usage: AiUsage
  provider: string
  model: string
}

export interface AiCompleteParams {
  messages: AiMessage[]
  maxTokens?: number
  temperature?: number
  /** Strict JSON mode hint for structured outputs. */
  json?: boolean
}

export interface AiStreamResult {
  stream: ReadableStream<string>
  usage: AiUsage
  provider: string
  model: string
}

/** Ensure an AI provider is available or throw a friendly error. */
export function assertAiAvailable(): { provider: string; model: string } {
  const provider = resolveAiProvider()
  if (provider === 'unconfigured') {
    const err = new Error(AI_UNCONFIGURED_MESSAGE) as Error & { code?: string }
    err.code = 'ai_unconfigured'
    throw err
  }
  return {
    provider,
    model: provider === 'grok' ? (process.env.XAI_MODEL || 'grok-4.7') : 'dev-sandbox-model',
  }
}

export async function aiComplete(params: AiCompleteParams): Promise<AiCompleteResult> {
  const provider = resolveAiProvider()
  if (provider === 'unconfigured') {
    const err = new Error(AI_UNCONFIGURED_MESSAGE) as Error & { code?: string }
    err.code = 'ai_unconfigured'
    throw err
  }
  return provider === 'grok' ? grokComplete(params) : devComplete(params)
}

export async function aiStream(params: AiCompleteParams): Promise<AiStreamResult> {
  const provider = resolveAiProvider()
  if (provider === 'unconfigured') {
    const err = new Error(AI_UNCONFIGURED_MESSAGE) as Error & { code?: string }
    err.code = 'ai_unconfigured'
    throw err
  }
  if (provider === 'grok') {
    const { stream, usage } = await streamSSE(params)
    return { stream, usage, provider: 'grok', model: process.env.XAI_MODEL || 'grok-4.7' }
  }
  const { stream, usage } = await devStream(params)
  return { stream, usage, provider: 'dev-fallback', model: 'dev-sandbox-model' }
}
