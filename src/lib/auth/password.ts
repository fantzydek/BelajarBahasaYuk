// MikuAI — Password hashing (scrypt, local preview driver).
// Production password handling is delegated to Supabase Auth.
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const KEY_LENGTH = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, hash] = parts
  const candidate = scryptSync(password, salt, KEY_LENGTH)
  const expected = Buffer.from(hash, 'hex')
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'Kata sandi minimal 8 karakter.'
  if (!/[a-zA-Z]/.test(password)) return 'Kata sandi harus mengandung huruf.'
  if (!/[0-9]/.test(password)) return 'Kata sandi harus mengandung angka.'
  return null
}
