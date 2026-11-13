// MikuAI — Robust JSON extraction from AI responses.
// Models occasionally wrap JSON in markdown fences or prose; this normalizes it.
import { ZodSchema } from 'zod'

export class AiOutputError extends Error {
  code = 'ai_output_invalid'
  constructor(message = 'Respons AI tidak valid. Silakan coba lagi.') {
    super(message)
  }
}

export function extractJson<T>(raw: string, schema: ZodSchema<T>): T {
  let text = raw.trim()

  // Strip markdown fences if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()

  // Fast path: direct parse.
  let candidate = text

  // Otherwise, slice from first { or [ to matching last } or ].
  if (!candidate.startsWith('{') && !candidate.startsWith('[')) {
    const firstObj = text.indexOf('{')
    const firstArr = text.indexOf('[')
    const start = firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr)
    if (start === -1) throw new AiOutputError()
    const endObj = text.lastIndexOf('}')
    const endArr = text.lastIndexOf(']')
    const end = Math.max(endObj, endArr)
    if (end <= start) throw new AiOutputError()
    candidate = text.slice(start, end + 1)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    throw new AiOutputError()
  }

  const result = schema.safeParse(parsed)
  if (!result.success) throw new AiOutputError()
  return result.data
}
