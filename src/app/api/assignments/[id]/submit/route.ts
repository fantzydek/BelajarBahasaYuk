// MikuAI — POST /api/assignments/[id]/submit — save the essay, grade it with
// Grok using a rubric, persist scores + feedback, record learning activity.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireUser, errorResponse, ApiError } from '@/lib/auth/guard'
import { assignmentSubmitSchema } from '@/lib/validation'
import { assertAiAvailable } from '@/lib/ai'
import { aiStructured } from '@/lib/ai/structured'
import { assignmentGradePrompt } from '@/lib/ai/prompts'
import { enforceAiRateLimit, failAiAttempt, beginAiAttempt, parseBody } from '@/lib/ai/route-helpers'
import { logAiUsage } from '@/lib/ai/usage'
import { getAssignment, saveGradedSubmission } from '@/lib/data/assignments'
import { recordActivity } from '@/lib/data/activity'
import type { AssignmentFeedback } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 180

const gradeOutputSchema = z.object({
  scores: z.object({
    grammar: z.number().min(0).max(100),
    vocabulary: z.number().min(0).max(100),
    structure: z.number().min(0).max(100),
    content: z.number().min(0).max(100),
  }),
  overall: z.number().min(0).max(100),
  summary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  correctedText: z.string().nullable().default(null),
  tips: z.array(z.string()).default([]),
})

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  let ctx: ReturnType<typeof beginAiAttempt> | null = null
  try {
    const user = await requireUser()
    const { id } = await params
    const body = await parseBody(req, assignmentSubmitSchema)

    const assignment = await getAssignment(user.id, id)
    if (!assignment) throw new ApiError(404, 'not_found', 'Tugas tidak ditemukan.')
    if (assignment.status === 'graded') {
      throw new ApiError(409, 'already_graded', 'Tugas ini sudah dikumpulkan dan dinilai. Buat tugas baru untuk berlatih lagi.')
    }

    const wordCount = countWords(body.text)
    if (wordCount < Math.floor(assignment.minWords * 0.6)) {
      throw new ApiError(400, 'too_short', `Jawaban terlalu pendek (${wordCount} kata). Target minimal ${assignment.minWords} kata.`)
    }

    enforceAiRateLimit(user, 'assignment_grade')
    const { provider, model } = assertAiAvailable()
    ctx = beginAiAttempt(user, 'assignment_grade', provider, model)

    const { data: grade, usage } = await aiStructured(
      {
        messages: [
          {
            role: 'system',
            content: assignmentGradePrompt(
              assignment.language,
              assignment.title,
              assignment.prompt,
              assignment.criteria,
              assignment.minWords,
              assignment.maxWords,
              body.text,
            ),
          },
          { role: 'user', content: 'Nilai jawaban tugas di atas sekarang sesuai skema JSON.' },
        ],
        maxTokens: 3000,
        temperature: 0.4,
      },
      gradeOutputSchema,
    )

    const feedback: AssignmentFeedback = {
      summary: grade.summary.trim(),
      strengths: grade.strengths.map((s) => s.trim()).filter(Boolean).slice(0, 4),
      improvements: grade.improvements.map((s) => s.trim()).filter(Boolean).slice(0, 4),
      correctedText: grade.correctedText?.trim() || null,
      tips: grade.tips.map((s) => s.trim()).filter(Boolean).slice(0, 4),
    }

    const saved = await saveGradedSubmission(user.id, id, body.text, wordCount, {
      scores: grade.scores,
      overall: Math.round(grade.overall),
      feedback,
      provider: ctx.provider,
      model: ctx.model,
    })

    await logAiUsage({
      userId: user.id,
      feature: 'assignment_grade',
      provider: ctx.provider,
      model: ctx.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      durationMs: Date.now() - startedAt,
      status: 'success',
    })

    await recordActivity(user.id, {
      activityType: 'assignment',
      title: `Tugas "${saved.title}" — nilai ${saved.overallScore}`,
      description: feedback.summary,
      language: saved.language,
      refId: saved.id,
      metadata: {
        scores: grade.scores,
        overall: saved.overallScore,
        wordCount,
        strengths: feedback.strengths,
        improvements: feedback.improvements,
      },
      durationMinutes: 10,
    }, { studyMinutes: 10 })

    return Response.json({ assignment: saved })
  } catch (err) {
    if (ctx) return failAiAttempt(ctx, err, startedAt)
    return errorResponse(err)
  }
}
