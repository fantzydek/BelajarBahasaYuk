// MikuAI — Sandbox development fallback adapter (SERVER ONLY).
//
// ⚠️  Used exclusively when XAI_API_KEY is NOT configured AND AI_DEV_FALLBACK=true
// (the sandbox preview). It exposes the same interface as the xAI Grok client so
// route handlers never branch on the provider. Production deployments configure
// XAI_API_KEY and this module is never invoked. All usage rows are labelled
// provider="dev-fallback" and the Admin panel surfaces the active provider.
import ZAI from 'z-ai-web-dev-sdk'

import type { AiCompleteParams, AiCompleteResult, AiUsage } from './index'

const DEFAULT_MAX_TOKENS = 2048

interface ChatChunk {
  choices?: { delta?: { content?: string }; message?: { content?: string } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4))
}

/** The sandbox model requires at least one user message; add one if missing. */
function ensureUserMessage(messages: AiMessage[]): AiMessage[] {
  if (messages.some((m) => m.role === 'user')) return messages
  return [...messages, { role: 'user', content: 'Selesaikan tugas di atas sesuai instruksi.' }]
}

async function getZai() {
  try {
    return await ZAI.create()
  } catch {
    throw Object.assign(new Error('Model pengembangan sandbox tidak tersedia.'), {
      code: 'ai_unconfigured',
    })
  }
}

function parseSseBody(body: ReadableStream<Uint8Array>): {
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
              /* ignore */
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
  const zai = await getZai()
  const result = (await zai.chat.completions.create({
    messages: ensureUserMessage(params.messages),
    stream: true,
    max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
  })) as unknown

  if (result instanceof ReadableStream) {
    return parseSseBody(result)
  }

  // Some deployments return an async iterable of chunks instead of a raw stream.
  const asyncIter = result as AsyncIterable<ChatChunk> | null
  if (asyncIter && typeof (asyncIter as Record<string, unknown>)[Symbol.asyncIterator as symbol] === 'function') {
    const usage: AiUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    let text = ''
    const stream = new ReadableStream<string>({
      async start(controller) {
        try {
          for await (const chunk of asyncIter) {
            const delta = chunk.choices?.[0]?.delta?.content
            if (delta) {
              text += delta
              controller.enqueue(delta)
            }
            if (chunk.usage) usage.completionTokens = chunk.usage.completion_tokens ?? usage.completionTokens
          }
          usage.promptTokens = usage.promptTokens || estimateTokens(params.messages.map((m) => m.content).join(' '))
          usage.completionTokens = usage.completionTokens || estimateTokens(text)
          usage.totalTokens = usage.totalTokens || usage.promptTokens + usage.completionTokens
          controller.close()
        } catch (e) {
          controller.error(e)
        }
      },
    })
    return { stream, usage }
  }

  // Last resort: the SDK returned a complete JSON response — simulate streaming.
  const full = (result as ChatChunk)?.choices?.[0]?.message?.content ?? ''
  const usage: AiUsage = {
    promptTokens: estimateTokens(params.messages.map((m) => m.content).join(' ')),
    completionTokens: estimateTokens(full),
    totalTokens: 0,
  }
  usage.totalTokens = usage.promptTokens + usage.completionTokens
  const stream = new ReadableStream<string>({
    start(controller) {
      const size = 24
      for (let i = 0; i < full.length; i += size) {
        controller.enqueue(full.slice(i, i + size))
      }
      controller.close()
    },
  })
  return { stream, usage }
}

export async function completeJSON(params: AiCompleteParams): Promise<AiCompleteResult> {
  const zai = await getZai()
  const result = (await zai.chat.completions.create({
    messages: ensureUserMessage(params.messages),
    max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
  })) as ChatChunk
  const content = result?.choices?.[0]?.message?.content ?? ''
  if (!content) {
    throw Object.assign(new Error('Layanan AI mengembalikan respons kosong.'), { code: 'ai_empty' })
  }
  const usage: AiUsage = {
    promptTokens: estimateTokens(params.messages.map((m) => m.content).join(' ')),
    completionTokens: estimateTokens(content),
    totalTokens: 0,
  }
  usage.totalTokens = usage.promptTokens + usage.completionTokens
  return { content, usage, provider: 'dev-fallback', model: 'dev-sandbox-model' }
}
