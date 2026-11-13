// MikuAI — Zod validation schemas for every API input.
import { z } from 'zod'
import { LANGUAGE_NAMES, LESSON_CATEGORIES } from '@/lib/languages'

const language = z.enum([
  'English', 'Japanese', 'Korean', 'Spanish', 'French', 'German',
  'Mandarin Chinese', 'Arabic', 'Indonesian',
])
const level = z.enum(['beginner', 'intermediate', 'advanced'])
const style = z.enum(['formal', 'informal', 'neutral'])

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
  password: z
    .string()
    .min(8, 'Kata sandi minimal 8 karakter.')
    .regex(/[a-zA-Z]/, 'Kata sandi harus mengandung huruf.')
    .regex(/[0-9]/, 'Kata sandi harus mengandung angka.'),
  displayName: z.string().trim().max(60).optional().nullable(),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
})

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
})

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(10, 'Token tidak valid.'),
  password: z
    .string()
    .min(8, 'Kata sandi minimal 8 karakter.')
    .regex(/[a-zA-Z]/, 'Kata sandi harus mengandung huruf.')
    .regex(/[0-9]/, 'Kata sandi harus mengandung angka.'),
})

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'Kata sandi minimal 8 karakter.')
    .regex(/[a-zA-Z]/, 'Kata sandi harus mengandung huruf.')
    .regex(/[0-9]/, 'Kata sandi harus mengandung angka.'),
})

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1, 'Nama tidak boleh kosong.').max(60).optional(),
  username: z.string().trim().min(3, 'Username minimal 3 karakter.').max(30).regex(/^[a-zA-Z0-9_.-]+$/, 'Username hanya boleh huruf, angka, titik, garis bawah, dan strip.').optional().nullable(),
  nativeLanguage: language.optional(),
  targetLanguage: language.optional(),
  level: level.optional(),
})

export const sessionCreateSchema = z.object({
  title: z.string().trim().max(80).optional(),
  language,
  level,
})

export const sessionRenameSchema = z.object({
  title: z.string().trim().min(1, 'Judul tidak boleh kosong.').max(80),
})

export const tutorSchema = z.object({
  sessionId: z.string().uuid('ID sesi tidak valid.').optional().nullable(),
  message: z.string().trim().min(1, 'Pesan tidak boleh kosong.').max(4000, 'Pesan maksimal 4000 karakter.'),
  language,
  level,
})

export const translateSchema = z.object({
  text: z.string().trim().min(1, 'Teks tidak boleh kosong.').max(5000, 'Teks maksimal 5000 karakter.'),
  sourceLanguage: z.enum(['auto', ...LANGUAGE_NAMES as [string, ...string[]]]),
  targetLanguage: language,
  style: style.default('neutral'),
})

export const grammarSchema = z.object({
  text: z.string().trim().min(1, 'Teks tidak boleh kosong.').max(5000),
  language,
})

export const vocabularyAiSchema = z.object({
  word: z.string().trim().min(1, 'Kata tidak boleh kosong.').max(120),
  language,
  context: z.string().trim().max(1000).optional(),
})

export const vocabularySaveSchema = z.object({
  language,
  word: z.string().trim().min(1).max(120),
  translation: z.string().trim().max(500).optional().nullable(),
  definition: z.string().trim().max(1000).optional().nullable(),
  exampleSentence: z.string().trim().max(1000).optional().nullable(),
  pronunciation: z.string().trim().max(120).optional().nullable(),
  category: z.string().trim().max(40).optional(),
  source: z.enum(['manual', 'tutor', 'translator', 'vocabulary_ai']).optional(),
})

export const vocabularyUpdateSchema = z.object({
  language: language.optional(),
  word: z.string().trim().min(1).max(120).optional(),
  translation: z.string().trim().max(500).optional().nullable(),
  definition: z.string().trim().max(1000).optional().nullable(),
  exampleSentence: z.string().trim().max(1000).optional().nullable(),
  pronunciation: z.string().trim().max(120).optional().nullable(),
  category: z.string().trim().max(40).optional(),
})

export const vocabularyReviewSchema = z.object({
  vocabularyId: z.string().uuid('ID kosakata tidak valid.'),
  correct: z.boolean(),
})

export const quizGenerateSchema = z.object({
  language,
  level,
  quizType: z.enum([
    'multiple_choice', 'fill_blank', 'sentence_arrangement', 'grammar', 'vocabulary', 'reading',
  ]),
  topic: z.string().trim().max(120).optional().nullable(),
  count: z.number().int().min(1).max(10).default(5),
})

export const examGenerateSchema = z.object({
  language,
  level,
  topic: z.string().trim().max(120).optional().nullable(),
  count: z.number().int().min(5).max(20).default(10),
  timeLimitMinutes: z.number().int().min(5).max(60).default(15),
})

export const quizSubmitSchema = z.object({
  attemptId: z.string().uuid('ID percobaan tidak valid.'),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        answer: z.string().max(2000).default(''),
      }),
    )
    .min(1, 'Jawaban tidak boleh kosong.'),
  durationSeconds: z.number().int().min(0).max(60 * 60 * 6),
})

export const lessonGenerateSchema = z.object({
  language,
  level,
  category: z.enum(LESSON_CATEGORIES.map((c) => c.value) as [string, ...string[]]),
  topic: z.string().trim().max(120).optional().nullable(),
})

export const lessonCompleteSchema = z.object({
  lessonId: z.string().uuid('ID pelajaran tidak valid.'),
  score: z.number().int().min(0).max(100).optional().nullable(),
})

export const adminRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['user', 'admin']),
})

export const assignmentCreateSchema = z.object({
  language,
  level,
  topic: z.string().trim().max(120).optional().nullable(),
})

export const assignmentSubmitSchema = z.object({
  text: z.string().trim().min(20, 'Jawaban minimal 20 karakter.').max(8000, 'Jawaban maksimal 8000 karakter.'),
})

export const adminLessonUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  language,
  level,
  category: z.enum(LESSON_CATEGORIES.map((c) => c.value) as [string, ...string[]]),
  summary: z.string().trim().max(500).optional().nullable(),
  isPublic: z.boolean().optional(),
  sections: z.array(z.record(z.string(), z.unknown())).optional(),
})
