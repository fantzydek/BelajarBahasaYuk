// MikuAI — Chat sessions & messages data access (Supabase / local).
import { db } from '@/lib/db'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { ChatMessageDTO, ChatSessionDTO, Level } from '@/lib/types'

function mapSession(r: Record<string, unknown>): ChatSessionDTO {
  return {
    id: String(r.id),
    title: String(r.title ?? 'Percakapan baru'),
    language: String(r.language ?? 'English'),
    level: (r.level as Level) ?? 'beginner',
    createdAt: new Date(String(r.created_at ?? r.createdAt)).toISOString(),
    updatedAt: new Date(String(r.updated_at ?? r.updatedAt)).toISOString(),
  }
}

function mapMessage(r: Record<string, unknown>): ChatMessageDTO {
  return {
    id: String(r.id),
    sessionId: String(r.session_id ?? r.sessionId),
    role: (r.role as ChatMessageDTO['role']) ?? 'user',
    content: String(r.content ?? ''),
    createdAt: new Date(String(r.created_at ?? r.createdAt)).toISOString(),
  }
}

export async function listSessions(userId: string, limit = 100, offset = 0): Promise<ChatSessionDTO[]> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      ?.from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => mapSession(r as Record<string, unknown>))
  }
  const rows = await db.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    skip: offset,
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    language: r.language,
    level: r.level as Level,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    messageCount: r.messages.length,
    preview: r.messages.length ? r.messages[r.messages.length - 1].content.slice(0, 80) : null,
  }))
}

export async function getSession(userId: string, sessionId: string): Promise<ChatSessionDTO | null> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data } = await supabase
      ?.from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single()
    return data ? mapSession(data as Record<string, unknown>) : null
  }
  const row = await db.chatSession.findFirst({ where: { id: sessionId, userId } })
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    language: row.language,
    level: row.level as Level,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function createSession(
  userId: string,
  input: { title?: string; language: string; level: Level },
): Promise<ChatSessionDTO> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      ?.from('chat_sessions')
      .insert({ user_id: userId, title: input.title ?? 'Percakapan baru', language: input.language, level: input.level })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return mapSession(data as Record<string, unknown>)
  }
  const row = await db.chatSession.create({
    data: {
      userId,
      title: input.title ?? 'Percakapan baru',
      language: input.language,
      level: input.level,
    },
  })
  return {
    id: row.id,
    title: row.title,
    language: row.language,
    level: row.level as Level,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function renameSession(userId: string, sessionId: string, title: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { error } = await supabase
      ?.from('chat_sessions')
      .update({ title })
      .eq('id', sessionId)
      .eq('user_id', userId)
    if (error) throw new Error(error.message)
    return
  }
  await db.chatSession.updateMany({ where: { id: sessionId, userId }, data: { title } })
}

export async function touchSession(userId: string, sessionId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    await supabase?.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId).eq('user_id', userId)
    return
  }
  await db.chatSession.updateMany({ where: { id: sessionId, userId }, data: { updatedAt: new Date() } })
}

export async function deleteSession(userId: string, sessionId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { error } = await supabase?.from('chat_sessions').delete().eq('id', sessionId).eq('user_id', userId)
    if (error) throw new Error(error.message)
    return
  }
  await db.chatSession.deleteMany({ where: { id: sessionId, userId } })
}

export async function listMessages(
  userId: string,
  sessionId: string,
  limit = 200,
  before?: string,
): Promise<ChatMessageDTO[]> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    let query = supabase
      ?.from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (before) query = query?.lt('created_at', before)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => mapMessage(r as Record<string, unknown>)).reverse()
  }
  const rows = await db.chatMessage.findMany({
    where: {
      sessionId,
      userId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return rows
    .map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      role: r.role as ChatMessageDTO['role'],
      content: r.content,
      createdAt: r.createdAt.toISOString(),
    }))
    .reverse()
}

export async function addMessage(
  userId: string,
  sessionId: string,
  role: ChatMessageDTO['role'],
  content: string,
  tokens?: number,
): Promise<ChatMessageDTO> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      ?.from('chat_messages')
      .insert({ session_id: sessionId, user_id: userId, role, content, tokens: tokens ?? null })
      .select()
      .single()
    if (error) throw new Error(error.message)
    await touchSession(userId, sessionId)
    return mapMessage(data as Record<string, unknown>)
  }
  const row = await db.chatMessage.create({
    data: { sessionId, userId, role, content, tokens: tokens ?? null },
  })
  await touchSession(userId, sessionId)
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as ChatMessageDTO['role'],
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function deleteMessage(userId: string, messageId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient()
    await supabase?.from('chat_messages').delete().eq('id', messageId).eq('user_id', userId)
    return
  }
  await db.chatMessage.deleteMany({ where: { id: messageId, userId } })
}

/** Fetch recent context messages for AI prompting (oldest → newest). */
export async function recentContext(
  userId: string,
  sessionId: string,
  count: number,
): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const msgs = await listMessages(userId, sessionId, count)
  return msgs
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
}
