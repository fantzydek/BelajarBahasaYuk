// MikuAI — AI provider resolution.
//
// Production provider is xAI Grok ONLY (api.x.ai), configured via XAI_API_KEY.
// If XAI_API_KEY is missing AND AI_DEV_FALLBACK=true (sandbox preview only),
// the sandbox development model is used so the preview stays fully testable.
// That fallback is always visible in the Admin panel and usage logs are
// labelled provider="dev-fallback". It is never activated in a properly
// configured production deployment.

export type AiProviderName = 'grok' | 'dev-fallback' | 'unconfigured'

export const XAI_MODEL = process.env.XAI_MODEL || 'grok-4.7'
export const XAI_BASE_URL = (process.env.XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, '')
export const AI_DEV_FALLBACK = process.env.AI_DEV_FALLBACK === 'true'

export function resolveAiProvider(): AiProviderName {
  if (process.env.XAI_API_KEY) return 'grok'
  if (AI_DEV_FALLBACK) return 'dev-fallback'
  return 'unconfigured'
}

export function providerModel(): string {
  return resolveAiProvider() === 'grok' ? XAI_MODEL : 'dev-sandbox-model'
}

export const AI_UNCONFIGURED_MESSAGE =
  'Layanan AI belum dikonfigurasi. Set environment variable XAI_API_KEY (xAI Grok) untuk mengaktifkan fitur AI. Lihat README bagian Setup.'
