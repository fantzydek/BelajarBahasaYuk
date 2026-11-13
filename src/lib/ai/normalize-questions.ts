// MikuAI — Normalize AI-generated quiz/exam questions into hard-validated
// shapes. Models occasionally output extra question types ("reading", "mc",
// "true_false") or answer with the option letter ("b") instead of the option
// text; both are repaired here so a single odd field never voids a whole
// question set. Persisted questions always use the three concrete types.
import type { QuestionType } from '@/lib/types'

export interface RawAiQuestion {
  questionType?: unknown
  question?: unknown
  options?: unknown
  correctAnswer?: unknown
  explanation?: unknown
  topic?: unknown
}

export interface NormalizedQuestion {
  questionType: QuestionType
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  topic: string
}

function canonicalType(raw: string): QuestionType {
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (t.includes('arrange') || t.includes('word_order') || t.includes('reorder') || t.includes('susun')) return 'sentence_arrangement'
  if (t.includes('fill') || t.includes('blank') || t.includes('isian') || t.includes('short_answer')) return 'fill_blank'
  if (t.includes('choice') || t === 'mc' || t.includes('pilihan') || t.includes('multiple')) return 'multiple_choice'
  // reading / true_false / grammar / vocabulary / unknown → best-effort MC,
  // degraded to fill_blank later when options are unusable.
  return 'multiple_choice'
}

/** Map an option-letter answer ("b", "B.", "(c)") to the option text. */
function resolveLetterAnswer(correctAnswer: string, options: string[]): string {
  const m = correctAnswer.trim().match(/^\(?([a-hA-H])[.)]?$/)
  if (!m || options.length === 0) return correctAnswer
  const idx = m[1].toLowerCase().charCodeAt(0) - 97
  return idx >= 0 && idx < options.length ? options[idx] : correctAnswer
}

/**
 * Convert raw AI questions into validated shapes. Drops unusable entries and
 * de-duplicates by question text. Returns only questions that can be graded.
 */
export function normalizeQuestions(
  raw: RawAiQuestion[],
  maxCount: number,
): NormalizedQuestion[] {
  const out: NormalizedQuestion[] = []
  const seen = new Set<string>()

  for (const q of raw) {
    if (out.length >= maxCount) break
    const text = String(q.question ?? '').trim()
    if (!text || seen.has(text)) continue
    seen.add(text)

    let questionType = canonicalType(String(q.questionType ?? 'multiple_choice'))
    let options = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 12) : []

    // A "multiple choice" question without usable options degrades to fill_blank.
    if (questionType === 'multiple_choice' && options.length < 2) {
      questionType = 'fill_blank'
      options = []
    }
    // Sentence arrangement keeps shuffled words as options; fill_blank drops them.
    if (questionType === 'fill_blank') options = []

    let correctAnswer = String(q.correctAnswer ?? '').trim()
    if (questionType === 'multiple_choice') {
      correctAnswer = resolveLetterAnswer(correctAnswer, options)
      // If the answer text does not exactly match any option, snap to the
      // closest option so grading stays deterministic.
      if (options.length > 0 && !options.some((o) => o.toLowerCase() === correctAnswer.toLowerCase())) {
        const partial = options.find((o) => o.toLowerCase().includes(correctAnswer.toLowerCase()) || correctAnswer.toLowerCase().includes(o.toLowerCase()))
        correctAnswer = partial ?? correctAnswer
      }
    }
    if (!correctAnswer) continue

    out.push({
      questionType,
      question: text,
      options,
      correctAnswer,
      explanation: String(q.explanation ?? '').trim(),
      topic: String(q.topic ?? 'umum').trim() || 'umum',
    })
  }
  return out
}
