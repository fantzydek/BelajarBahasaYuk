// MikuAI — xAI Grok client (official API, OpenAI-compatible endpoints).
// Server-side only. Talks to https://api.x.ai/v1 exclusively.
import { XAI_BASE_URL, XAI_MODEL } from './config'
import type { AiCompleteParams, AiCompleteResult, AiUsage } from './index'

const DEFAULT_MAX_TOKENS = 2048
const MAX_RETRIES = 3
const REQUEST_TIMEOUT_MS = 120_000

interface ChatChoiceDelta {
  delta?: { content?: string }
  message?: { content?: string }
}

interface ChatChunk {
  choices?: ChatChoiceDelta[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4))
}

function normalizeUsage(u: AiUsage): AiUsage {
  return {
    promptTokens: u.promptTokens,
    completionTokens: u.completionTokens,
    totalTokens: u.totalTokens || u.promptTokens + u.completionTokens,
  }
}

function buildHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.XAI_API_KEY ?? ''}`,
  }
}

function buildBody(params: AiCompleteParams, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: XAI_MODEL,
    messages: params.messages,
    max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: params.temperature ?? 0.7,
    stream,
  }
  if (stream) body.stream_options = { include_usage: true }
  if (params.json) body.response_format = { type: 'json_object' }
  return body
}

function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600)
}

function backoffDelay(attempt: number): number {
  return Math.min(30_000, Math.round(1000 * 2 ** attempt + Math.random() * 500))
}

function apiError(status: number, text: string): Error & { code?: string } {
  let message = `xAI API error ${status}`
  try {
    const parsed = JSON.parse(text)
    message = parsed?.error?.message ?? parsed?.error ?? message
  } catch {
    if (text) message += `: ${text.slice(0, 200)}`
  }
  const err = new Error(message) as Error & { code?: string }
  err.code = status === 429 ? 'ai_rate_limited' : status >= 500 ? 'ai_upstream' : `ai_http_${status}`
  return err
}

async function fetchWithRetry(body: Record<string, unknown>): Promise<Response> {
  let lastError: unknown = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, backoffDelay(attempt - 1)))
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(`${XAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (res.ok) return res
      const text = await res.text().catch(() => '')
      if (!isRetryable(res.status)) throw apiError(res.status, text)
      lastError = apiError(res.status, text)
    } catch (e) {
      clearTimeout(timeout)
      const err = e as Error & { code?: string; name?: string }
      if (err.code?.startsWith('ai_')) throw err
      if (err.name === 'AbortError') {
        throw Object.assign(new Error('Permintaan ke layanan AI melebihi batas waktu.'), {
          code: 'ai_timeout',
        })
      }
      lastError = Object.assign(new Error('Tidak dapat menghubungi layanan AI.'), {
        code: 'ai_network',
      })
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Layanan AI tidak tersedia.')
}

/** Parse an SSE body stream into a text-delta stream + final usage. */
function sseToText(body: ReadableStream<Uint8Array>): {
  stream: ReadableStream<string>
  usage: AiUsage
} {
  const usage: AiUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  let completionText = ''
  let buffer = ''

  const stream = new ReadableStream<string>({
    async start(controller) {
      const reader = body.getReader()
      const decoder = new TextDecoder()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const raw of lines) {
            const line = raw.trim()
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trim()
            if (!payload || payload === '[DONE]') continue
            try {
              const chunk = JSON.parse(payload) as ChatChunk
              const delta = chunk.choices?.[0]?.delta?.content
              if (delta) {
                completionText += delta
                controller.enqueue(delta)
              }
              if (chunk.usage) {
                usage.promptTokens = chunk.usage.prompt_tokens ?? usage.promptTokens
                usage.completionTokens = chunk.usage.completion_tokens ?? usage.completionTokens
                usage.totalTokens = chunk.usage.total_tokens ?? usage.totalTokens
              }
            } catch {
              // ignore malformed keep-alive fragments
            }
          }
        }
        if (!usage.completionTokens) usage.completionTokens = estimateTokens(completionText)
        if (!usage.totalTokens) usage.totalTokens = usage.promptTokens + usage.completionTokens
        controller.close()
      } catch (e) {
        controller.error(e)
      }
    },
  })

  return { stream, usage }
}

export async function streamSSE(params: AiCompleteParams): Promise<{
  stream: ReadableStream<string>
  usage: AiUsage
}> {
  const res = await fetchWithRetry(buildBody(params, true))
  if (!res.body) throw Object.assign(new Error('Layanan AI tidak mengirim data.'), { code: 'ai_upstream' })
  const { stream, usage } = sseToText(res.body)
  usage.promptTokens = usage.promptTokens || estimateTokens(params.messages.map((m) => m.content).join(' '))
  return { stream, usage: normalizeUsage(usage) }
}

export async function completeJSON(params: AiCompleteParams): Promise<AiCompleteResult> {
  const res = await fetchWithRetry(buildBody({ ...params, json: true }, false))
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  }
  const content = data.choices?.[0]?.message?.content ?? ''
  if (!content) {
    throw Object.assign(new Error('Layanan AI mengembalikan respons kosong.'), { code: 'ai_empty' })
  }
  const usage: AiUsage = {
    promptTokens: data.usage?.prompt_tokens ?? estimateTokens(params.messages.map((m) => m.content).join(' ')),
    completionTokens: data.usage?.completion_tokens ?? estimateTokens(content),
    totalTokens: data.usage?.total_tokens ?? 0,
  }
  return {
    content,
    usage: normalizeUsage(usage),
    provider: 'grok',
    model: XAI_MODEL,
  }
}
