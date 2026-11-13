// MikuAI — Core domain types shared across server and client.
// Data layer maps both drivers (Supabase Postgres, local Prisma) to these.

export type Level = 'beginner' | 'intermediate' | 'advanced'
export type Role = 'user' | 'admin'

export type ActivityType = 'tutor' | 'translation' | 'lesson' | 'vocabulary' | 'quiz' | 'exam' | 'assignment'
export type ChatRole = 'user' | 'assistant' | 'system'

export type QuizType =
  | 'multiple_choice'
  | 'fill_blank'
  | 'sentence_arrangement'
  | 'grammar'
  | 'vocabulary'
  | 'reading'
  | 'exam'

export type QuestionType = 'multiple_choice' | 'fill_blank' | 'sentence_arrangement'

export type TranslationStyle = 'formal' | 'informal' | 'neutral'

export type LessonCategory =
  | 'vocabulary'
  | 'grammar'
  | 'reading'
  | 'writing'
  | 'conversation'
  | 'daily'

export type VocabSource = 'manual' | 'tutor' | 'translator' | 'vocabulary_ai'

export interface SessionUser {
  id: string
  email: string
  displayName: string | null
  username: string | null
  avatarUrl: string | null
  role: Role
  nativeLanguage: string
  targetLanguage: string
  level: Level
  createdAt: string
}

export interface ChatSessionDTO {
  id: string
  title: string
  language: string
  level: Level
  createdAt: string
  updatedAt: string
  messageCount?: number
  preview?: string | null
}

export interface ChatMessageDTO {
  id: string
  sessionId: string
  role: ChatRole
  content: string
  createdAt: string
}

export interface TranslationDTO {
  id: string
  sourceLanguage: string
  targetLanguage: string
  detectedSource: string | null
  sourceText: string
  translatedText: string
  style: TranslationStyle
  alternatives: string[]
  explanation: string | null
  grammarNotes: string | null
  idioms: string[]
  createdAt: string
}

export interface VocabularyDTO {
  id: string
  language: string
  word: string
  translation: string | null
  definition: string | null
  exampleSentence: string | null
  pronunciation: string | null
  category: string
  source: VocabSource
  masteryLevel: number
  timesReviewed: number
  correctCount: number
  lastReviewedAt: string | null
  nextReviewAt: string | null
  createdAt: string
}

export type LessonSection =
  | { type: 'explanation'; heading: string; body: string }
  | { type: 'examples'; heading: string; items: { source: string; translation: string }[] }
  | { type: 'vocabulary'; heading: string; items: { word: string; translation: string; example?: string }[] }
  | { type: 'dialog'; heading: string; lines: { speaker: string; text: string; translation: string }[] }
  | { type: 'reading'; heading: string; body: string; translation: string; questions?: string[] }
  | { type: 'exercise'; heading: string; instructions: string; items: string[] }

export interface LessonDTO {
  id: string
  language: string
  level: Level
  category: LessonCategory
  title: string
  slug: string
  summary: string | null
  sections: LessonSection[]
  orderIndex: number
  isPublic: boolean
  createdBy: string | null
  createdAt: string
}

export interface LessonProgressDTO {
  id: string
  lessonId: string
  status: 'in_progress' | 'completed'
  score: number | null
  completedAt: string
}

export interface QuizQuestionDTO {
  id: string
  attemptId: string
  questionType: QuestionType
  question: string
  options: string[]
  orderIndex: number
  topic: string | null
  // Grading fields — only exposed after submission for the owner.
  userAnswer?: string | null
  isCorrect?: boolean | null
  correctAnswer?: string
  explanation?: string | null
}

export interface QuizAttemptDTO {
  id: string
  language: string
  level: Level
  quizType: QuizType
  mode: 'practice' | 'exam'
  timeLimitSeconds: number | null
  topic: string | null
  status: 'active' | 'completed'
  totalQuestions: number
  correctCount: number
  score: number | null
  durationSeconds: number | null
  weakTopics: string[]
  startedAt: string
  completedAt: string | null
  questions?: QuizQuestionDTO[]
}

export interface AssignmentRubricScores {
  grammar: number
  vocabulary: number
  structure: number
  content: number
}

export interface AssignmentFeedback {
  summary: string
  strengths: string[]
  improvements: string[]
  correctedText: string | null
  tips: string[]
}

export interface WritingAssignmentDTO {
  id: string
  language: string
  level: Level
  topic: string | null
  title: string
  prompt: string
  instructions: string | null
  minWords: number
  maxWords: number
  criteria: string[]
  status: 'active' | 'graded'
  submissionText: string | null
  wordCount: number | null
  scores: AssignmentRubricScores | null
  overallScore: number | null
  feedback: AssignmentFeedback | null
  aiProvider: string | null
  aiModel: string | null
  submittedAt: string | null
  gradedAt: string | null
  createdAt: string
}

export interface HistoryDTO {
  id: string
  activityType: ActivityType
  title: string
  description: string | null
  language: string | null
  refId: string | null
  metadata: Record<string, unknown> | null
  durationMinutes: number | null
  createdAt: string
}

export interface LearningProgressDTO {
  id: string
  language: string
  level: Level
  vocabularyCount: number
  lessonsCompleted: number
  quizzesTaken: number
  avgQuizScore: number
  studyMinutes: number
  updatedAt: string
}

export interface StreakDTO {
  currentStreak: number
  longestStreak: number
  totalActiveDays: number
  lastActivityDate: string | null
}

export interface DashboardStats {
  displayName: string
  targetLanguage: string
  level: Level
  todayActivity: number
  totalVocabulary: number
  lessonsCompleted: number
  quizzesTaken: number
  avgQuizScore: number
  studyMinutes: number
  streak: StreakDTO
  weeklyActivity: { date: string; label: string; count: number }[]
  recentActivities: HistoryDTO[]
  languageProgress: LearningProgressDTO[]
}

export interface AiUsageLogDTO {
  id: string
  userId: string | null
  userEmail?: string | null
  feature: string
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  durationMs: number
  status: 'success' | 'error'
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
}

export interface AdminUserRow {
  id: string
  email: string
  displayName: string | null
  role: Role
  level: Level
  targetLanguage: string
  createdAt: string
  activityCount: number
  vocabularyCount: number
  lastActivityAt: string | null
}

export interface AdminStats {
  totalUsers: number
  activeUsers7d: number
  totalSessions: number
  totalTranslations: number
  totalVocabulary: number
  totalQuizzes: number
  totalLessons: number
  aiCalls24h: number
  aiErrors24h: number
  aiTokens24h: number
  aiByFeature: { feature: string; calls: number; tokens: number }[]
  provider: { aiProvider: string; model: string; dbDriver: 'supabase' | 'local' }
}
