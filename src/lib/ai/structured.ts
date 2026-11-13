// MikuAI — Structured AI calls with automatic one-shot retry.
// When a model returns non-JSON output, a corrective reminder is appended and
// the request retried once. Guards all features that parse AI JSON.
import { ZodSchema } from 'zod'
import { aiComplete, type AiCompleteParams, type AiUsage } from './index'
import { extractJson, AiOutputError } from './json'

const RETRY_INSTRUCTION =
  'Balasan sebelumnya tidak berupa JSON yang valid atau tidak sesuai skema. Balas HANYA JSON valid sesuai skema yang diminta, tanpa teks lain, tanpa pembuka, tanpa penutup.'

export async function aiStructured<T>(
  params: AiCompleteParams,
  schema: ZodSchema<T>,
  retries = 1,
): Promise<{ data: T; usage: AiUsage; provider: string; model: string }> {
  let lastError: unknown = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    const messages =
      attempt === 0
        ? params.messages
        : [...params.messages, { role: 'user' as const, content: RETRY_INSTRUCTION }]
    try {
      const res = await aiComplete({ ...params, messages, json: true })
      const data = extractJson(res.content, schema)
      return { data, usage: res.usage, provider: res.provider, model: res.model }
    } catch (e) {
      lastError = e
      if (!(e instanceof AiOutputError)) throw e
    }
  }
  throw lastError
}
