// MikuAI — Supported learning languages (shared client/server).
export interface LanguageOption {
  code: string
  name: string
  flag: string
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'zh', name: 'Mandarin Chinese', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
]

export const LANGUAGE_NAMES = SUPPORTED_LANGUAGES.map((l) => l.name)

export function languageFlag(name: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.name.toLowerCase() === name.toLowerCase())?.flag ?? '🌐'
}

export const LEVELS = [
  { value: 'beginner', label: 'Pemula' },
  { value: 'intermediate', label: 'Menengah' },
  { value: 'advanced', label: 'Mahir' },
] as const

export const LESSON_CATEGORIES = [
  { value: 'vocabulary', label: 'Kosakata' },
  { value: 'grammar', label: 'Tata Bahasa' },
  { value: 'reading', label: 'Membaca' },
  { value: 'writing', label: 'Menulis' },
  { value: 'conversation', label: 'Percakapan' },
  { value: 'daily', label: 'Ekspresi Harian' },
] as const

export const QUIZ_TYPES = [
  { value: 'multiple_choice', label: 'Pilihan Ganda' },
  { value: 'fill_blank', label: 'Isian' },
  { value: 'sentence_arrangement', label: 'Susun Kalimat' },
  { value: 'grammar', label: 'Tes Tata Bahasa' },
  { value: 'vocabulary', label: 'Tes Kosakata' },
  { value: 'reading', label: 'Pemahaman Bacaan' },
] as const
