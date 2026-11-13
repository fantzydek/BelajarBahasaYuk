// MikuAI — Client-side fetch helpers with friendly error handling.
'use client'

import { toast } from 'sonner'

export class ApiClientError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit & { silent?: boolean } = {},
): Promise<T> {
  const { silent, ...rest } = options
  let res: Response
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...(rest.headers ?? {}),
      },
    })
  } catch {
    if (!silent) toast.error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.')
    throw new ApiClientError(0, 'network', 'Tidak dapat terhubung ke server.')
  }

  let payload: { error?: string; code?: string } & Record<string, unknown> = {}
  try {
    payload = await res.json()
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    const message = payload.error ?? 'Terjadi kesalahan. Silakan coba lagi.'
    const code = payload.code ?? 'error'
    if (res.status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`
      }
      throw new ApiClientError(401, code, 'Sesi berakhir. Silakan masuk kembali.')
    }
    if (!silent) toast.error(message)
    throw new ApiClientError(res.status, code, message)
  }

  return payload as T
}

export async function apiPost<T>(url: string, body?: unknown, options: RequestInit = {}): Promise<T> {
  return apiFetch<T>(url, { ...options, method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined })
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return apiFetch<T>(url, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined })
}

export async function apiDelete<T>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: 'DELETE' })
}
