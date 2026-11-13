// MikuAI — API route guards. Server-side authentication checks for all
// protected endpoints. Never trusts client-supplied user IDs.
import { NextResponse } from 'next/server'
import { getCurrentUser } from './session'
import type { SessionUser } from '@/lib/types'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    )
  }
  console.error('[api] unexpected error:', error instanceof Error ? error.message : error)
  return NextResponse.json(
    { error: 'Terjadi kesalahan pada server. Silakan coba lagi.', code: 'internal_error' },
    { status: 500 },
  )
}

/** Throws 401 ApiError when not signed in; returns the user otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new ApiError(401, 'unauthenticated', 'Anda harus masuk untuk mengakses fitur ini.')
  }
  return user
}

/** Throws 401/403 ApiError unless signed in with the admin role. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'admin') {
    throw new ApiError(403, 'forbidden', 'Akses khusus administrator.')
  }
  return user
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init)
}
