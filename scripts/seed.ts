// MikuAI — Local database seed (sandbox preview driver).
// Seeds: lesson library, admin account, demo account with real activity rows.
// Production seeding is done via supabase/migrations/*_seed.sql instead.
import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'
import { SEED_LESSONS } from './seed-data'

const prisma = new PrismaClient()

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

async function main() {
  console.log('Seeding lessons…')
  for (const l of SEED_LESSONS) {
    const existing = await prisma.lesson.findUnique({ where: { slug: l.slug } })
    if (existing) {
      await prisma.lesson.update({
        where: { slug: l.slug },
        data: {
          title: l.title,
          summary: l.summary,
          content: JSON.stringify(l.content),
          orderIndex: l.orderIndex,
          language: l.language,
          level: l.level,
          category: l.category,
          isPublic: true,
        },
      })
    } else {
      await prisma.lesson.create({
        data: {
          language: l.language,
          level: l.level,
          category: l.category,
          title: l.title,
          slug: l.slug,
          summary: l.summary,
          content: JSON.stringify(l.content),
          orderIndex: l.orderIndex,
          isPublic: true,
        },
      })
    }
  }
  console.log(`Seeded ${SEED_LESSONS.length} lessons.`)

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@mikuai.app').toLowerCase()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'MikuAdmin2026!'

  let admin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashPassword(adminPassword),
        displayName: 'Administrator',
        role: 'admin',
        targetLanguage: 'English',
        level: 'advanced',
      },
    })
    console.log(`Admin account created: ${adminEmail} / (see SEED_ADMIN_PASSWORD in .env)`)
  } else {
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'admin', passwordHash: hashPassword(adminPassword) } })
    console.log(`Admin account refreshed: ${adminEmail}`)
  }

  // Demo learner with genuine activity rows so dashboard/analytics are alive.
  const demoEmail = 'demo@mikuai.app'
  let demo = await prisma.user.findUnique({ where: { email: demoEmail } })
  if (!demo) {
    demo = await prisma.user.create({
      data: {
        email: demoEmail,
        passwordHash: hashPassword('Demo1234!'),
        displayName: 'Demo Pembelajar',
        username: 'demo',
        targetLanguage: 'English',
        level: 'beginner',
      },
    })
    console.log(`Demo account created: ${demoEmail} / Demo1234!`)

    const demoId = demo.id

    // Vocabulary
    const vocab = [
      { language: 'English', word: 'greeting', translation: 'sapaan', definition: 'Kata atau ungkapan yang dipakai untuk menyapa seseorang.', exampleSentence: 'A friendly greeting starts every conversation.', pronunciation: 'GREE-ting', category: 'general', source: 'tutor' },
      { language: 'English', word: 'delicious', translation: 'enak', definition: 'Memiliki rasa atau bau yang sangat menyenangkan.', exampleSentence: 'This fried rice is delicious!', pronunciation: 'di-LI-shes', category: 'food', source: 'vocabulary_ai' },
      { language: 'English', word: 'cooperative', translation: 'koperasi', definition: 'Organisasi bisnis yang dimiliki dan dijalankan bersama anggotanya.', exampleSentence: 'The farmers sell coffee through a cooperative.', pronunciation: 'ko-OP-er-a-tif', category: 'business', source: 'lesson' },
      { language: 'English', word: 'middleman', translation: 'tengkulak / perantara', definition: 'Orang yang membeli dan menjual kembali, berada di antara produsen dan pembeli.', exampleSentence: 'Middlemen decided the price of his beans.', pronunciation: 'MID-el-man', category: 'business', source: 'lesson' },
      { language: 'English', word: 'order', translation: 'memesan', definition: 'Meminta makanan atau barang dari penjual.', exampleSentence: 'I would like to order a coffee, please.', pronunciation: 'OR-der', category: 'food', source: 'tutor' },
      { language: 'Japanese', word: 'こんにちは (konnichiwa)', translation: 'selamat siang', definition: 'Sapaan yang dipakai pada siang hari.', exampleSentence: 'こんにちは、田中さん。', pronunciation: 'kon-nee-chee-wa', category: 'general', source: 'lesson' },
      { language: 'Japanese', word: 'いくらですか (ikura desu ka)', translation: 'berapa harganya?', definition: 'Pertanyaan untuk menanyakan harga.', exampleSentence: 'これはいくらですか。', pronunciation: 'i-ku-ra des-ka', category: 'shopping', source: 'lesson' },
      { language: 'Spanish', word: 'la reserva', translation: 'reservasi', definition: 'Pemesanan yang sudah dikonfirmasi sebelumnya.', exampleSentence: 'Tengo una reserva a nombre de María.', pronunciation: 're-SER-ba', category: 'travel', source: 'lesson' },
      { language: 'Spanish', word: 'el desayuno', translation: 'sarapan', definition: 'Makan pagi hari pertama.', exampleSentence: '¿A qué hora es el desayuno?', pronunciation: 'de-sa-YU-no', category: 'food', source: 'lesson' },
      { language: 'Spanish', word: 'funcionar', translation: 'berfungsi', definition: 'Bekerja atau beroperasi sebagaimana mestinya.', exampleSentence: 'El aire acondicionado no funciona.', pronunciation: 'fun-sio-NAR', category: 'general', source: 'tutor' },
    ]
    for (const [i, v] of vocab.entries()) {
      await prisma.vocabulary.create({
        data: {
          ...v,
          userId: demoId,
          masteryLevel: i % 4,
          timesReviewed: (i % 3) + 1,
          correctCount: i % 3,
          lastReviewedAt: new Date(Date.now() - i * 86_400_000),
          nextReviewAt: new Date(Date.now() + (i - 2) * 86_400_000),
        },
      })
    }

    // Chat session + messages
    const session = await prisma.chatSession.create({
      data: { userId: demoId, title: 'Perkenalan diri dalam bahasa Inggris', language: 'English', level: 'beginner' },
    })
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        userId: demoId,
        role: 'user',
        content: 'Halo, saya ingin belajar memperkenalkan diri dalam bahasa Inggris. Tolong ajarkan ya!',
      },
    })
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        userId: demoId,
        role: 'assistant',
        content:
          'Dengan senang hati! **Perkenalan diri** biasanya mengikuti pola sederhana:\n\n1. **Sapaan** — "Hi, my name is Rina."\n2. **Asal** — "I am from Jakarta."\n3. **Pekerjaan/hobi** — "I work as a teacher." / "I like reading."\n4. **Penutup** — "Nice to meet you!"\n\n**Contoh lengkap:**\n> Hi, my name is Rina. I am from Jakarta. I work as a teacher. Nice to meet you!\n\n**Saran latihan:** coba tulis perkenalanmu sendiri di sini, nanti saya koreksi bersama.',
      },
    })

    // Translation history
    await prisma.translationHistory.create({
      data: {
        userId: demoId,
        sourceLanguage: 'Indonesian',
        targetLanguage: 'English',
        detectedSource: 'Indonesian',
        sourceText: 'Terima kasih sudah membantu saya kemarin.',
        translatedText: 'Thank you for helping me yesterday.',
        style: 'neutral',
        alternatives: JSON.stringify(['Thanks for your help yesterday.', 'Thank you for the help you gave me yesterday.']),
        explanation: 'Struktur "thank you for + V-ing" adalah pola baku untuk berterima kasih atas suatu tindakan.',
        grammarNotes: 'Setelah "for", kata kerja memakai bentuk -ing (gerund): for helping, for coming.',
        idioms: JSON.stringify([{ idiom: 'thank you for…', meaning: 'pola formal maupun santai untuk ucapan terima kasih' }]),
      },
    })

    // Quiz attempt (completed)
    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: demoId,
        language: 'English',
        level: 'beginner',
        quizType: 'vocabulary',
        topic: 'greetings',
        status: 'completed',
        totalQuestions: 3,
        correctCount: 2,
        score: 67,
        durationSeconds: 145,
        weakTopics: JSON.stringify(['formal greetings']),
        completedAt: new Date(Date.now() - 86_400_000),
      },
    })
    const questions = [
      { question: 'Choose the correct greeting for 8 a.m.: ___', options: ['Good night', 'Good morning', 'Good evening', 'See you later'], correctAnswer: 'Good morning', userAnswer: 'Good morning', isCorrect: true, explanation: '"Good morning" dipakai sebelum tengah hari (sekitar 00:00–12:00).', topic: 'greetings' },
      { question: 'Complete: "Nice to ___ you."', options: [], correctAnswer: 'meet', userAnswer: 'met', isCorrect: false, explanation: 'Setelah "nice to" kita memakai bentuk dasar kata kerja: nice to MEET you.', topic: 'introductions' },
      { question: 'What does "How are you?" mean in Indonesian?', options: ['Siapa namamu?', 'Apa kabar?', 'Dari mana?', 'Berapa umurmu?'], correctAnswer: 'Apa kabar?', userAnswer: 'Apa kabar?', isCorrect: true, explanation: '"How are you?" adalah sapaan untuk menanyakan kabar seseorang.', topic: 'greetings' },
    ]
    for (const [i, q] of questions.entries()) {
      await prisma.quizQuestion.create({
        data: { attemptId: attempt.id, userId: demoId, questionType: q.options.length ? 'multiple_choice' : 'fill_blank', question: q.question, options: JSON.stringify(q.options), correctAnswer: q.correctAnswer, explanation: q.explanation, userAnswer: q.userAnswer, isCorrect: q.isCorrect, orderIndex: i, topic: q.topic },
      })
    }

    // Lesson progress (2 completed)
    const lessons = await prisma.lesson.findMany({ where: { language: 'English', level: 'beginner' } })
    for (const l of lessons.slice(0, 2)) {
      await prisma.lessonProgress.create({
        data: { userId: demoId, lessonId: l.id, status: 'completed', score: 90 },
      })
    }

    // Learning history + progress + streak
    const today = new Date()
    const day = (n: number) => new Date(today.getTime() - n * 86_400_000)
    const histories = [
      { activityType: 'tutor', title: 'Sesi AI Tutor: perkenalan diri', language: 'English', durationMinutes: 8, createdAt: day(0) },
      { activityType: 'lesson', title: 'Menyelesaikan pelajaran: Present Simple Tense', language: 'English', durationMinutes: 10, createdAt: day(0) },
      { activityType: 'translation', title: 'Menerjemahkan kalimat terima kasih', language: 'English', durationMinutes: 2, createdAt: day(1) },
      { activityType: 'quiz', title: 'Kuis kosakata: greetings — nilai 67', language: 'English', durationMinutes: 5, createdAt: day(1) },
      { activityType: 'vocabulary', title: 'Menyimpan kata "middleman"', language: 'English', durationMinutes: 1, createdAt: day(1) },
      { activityType: 'lesson', title: 'Menyelesaikan pelajaran: Greetings & Introductions', language: 'English', durationMinutes: 10, createdAt: day(2) },
      { activityType: 'tutor', title: 'Sesi AI Tutor: tanya partikel は', language: 'Japanese', durationMinutes: 6, createdAt: day(3) },
      { activityType: 'vocabulary', title: 'Menyimpan 5 kosakata baru', language: 'Spanish', durationMinutes: 3, createdAt: day(4) },
    ]
    for (const h of histories) {
      await prisma.learningHistory.create({
        data: { userId: demoId, ...h, description: null, createdAt: h.createdAt },
      })
    }
    await prisma.learningProgress.create({
      data: { userId: demoId, language: 'English', level: 'beginner', vocabularyCount: 5, lessonsCompleted: 2, quizzesTaken: 1, avgQuizScore: 67, studyMinutes: 26 },
    })
    await prisma.learningProgress.create({
      data: { userId: demoId, language: 'Japanese', level: 'beginner', vocabularyCount: 2, studyMinutes: 6 },
    })
    await prisma.learningProgress.create({
      data: { userId: demoId, language: 'Spanish', level: 'beginner', vocabularyCount: 3, studyMinutes: 3 },
    })
    await prisma.userStreak.create({
      data: { userId: demoId, currentStreak: 2, longestStreak: 5, totalActiveDays: 12, lastActivityDate: new Date().toISOString().slice(0, 10) },
    })

    // AI usage sample logs
    await prisma.aiUsageLog.create({
      data: { userId: demoId, feature: 'tutor', provider: 'dev-fallback', model: 'dev-sandbox-model', promptTokens: 320, completionTokens: 280, totalTokens: 600, durationMs: 2100, status: 'success' },
    })
    await prisma.aiUsageLog.create({
      data: { userId: demoId, feature: 'translate', provider: 'dev-fallback', model: 'dev-sandbox-model', promptTokens: 180, completionTokens: 140, totalTokens: 320, durationMs: 1600, status: 'success' },
    })

    console.log('Demo activity seeded (vocabulary, chat, translations, quiz, history, streak).')
  } else {
    console.log(`Demo account exists: ${demoEmail}`)
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
