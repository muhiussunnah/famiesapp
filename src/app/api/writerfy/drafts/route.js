import { NextResponse } from 'next/server';
import { checkWriterfyAuth } from '@/lib/writerfy-auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/writerfy/drafts — every draft post, newest edit first. Writerfy's
 * Schedule tab lists these so a draft can be given a publish time.
 * → { drafts: [{ id, title, excerpt, slug, createdAt, updatedAt }] }
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!checkWriterfyAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();
  if (!db) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server' }, { status: 503 });
  }

  const { data, error } = await db
    .from('blog_posts')
    .select('id, title, slug, excerpt, created_at, updated_at')
    .eq('status', 'draft')
    .order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    drafts: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title || '',
      excerpt: row.excerpt || '',
      slug: row.slug || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
}
