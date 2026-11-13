// MikuAI — POST /api/auth/login
import { NextRequest } from 'next/server'
import { errorResponse, ApiError } from '@/lib/auth/guard'
import { checkRateLimit } from '@/lib/ai/rate-limit'
import { loginSchema } from '@/lib/validation'
import { loginUser } from '@/lib/data/profile'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(400, 'validation_error', parsed.error.issues[0]?.message ?? 'Input tidak valid.')
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
    const rl = checkRateLimit(`${'login'}:${ip}`, 10, 5 * 60_000)
    if (!rl.allowed) {
      throw new ApiError(429, 'rate_limited', `Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfterSeconds} detik.`)
    }
    const userAgent = req.headers.get('user-agent') ?? undefined
    const { user, error } = await loginUser(parsed.data.email, parsed.data.password, userAgent)
    if (error || !user) throw new ApiError(401, 'invalid_credentials', error ?? 'Login gagal.')
    return Response.json({ user })
  } catch (err) {
    return errorResponse(err)
  }
}
