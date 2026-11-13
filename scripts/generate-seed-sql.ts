// Generates supabase/migrations/*_seed.sql from scripts/seed-data.ts so the
// lesson library is identical in Supabase (production) and local preview.
import { writeFileSync } from 'fs'
import { SEED_LESSONS } from './seed-data'

function esc(s: string): string {
  return s.replace(/'/g, "''")
}

const statements: string[] = []
statements.push('-- MikuAI seed: starter lesson library (shared with scripts/seed-data.ts)')

for (const l of SEED_LESSONS) {
  const content = JSON.stringify(l.content).replace(/'/g, "''")
  statements.push(
    `insert into public.lessons (language, level, category, title, slug, summary, content, order_index, is_public)\n` +
      `values ('${esc(l.language)}', '${l.level}', '${l.category}', '${esc(l.title)}', '${l.slug}', '${esc(l.summary)}', '${content}'::jsonb, ${l.orderIndex}, true)\n` +
      `on conflict (slug) do update set title = excluded.title, summary = excluded.summary, content = excluded.content, order_index = excluded.order_index;`,
  )
}

const sql = statements.join('\n\n') + '\n'
writeFileSync('supabase/migrations/20260101010000_mikuai_seed.sql', sql)
console.log(`Wrote supabase/migrations/20260101010000_mikuai_seed.sql (${SEED_LESSONS.length} lessons)`)
