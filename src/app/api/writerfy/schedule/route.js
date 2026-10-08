import { NextResponse } from 'next/server';
import { checkWriterfyAuth } from '@/lib/writerfy-auth';
import { getDb } from '@/lib/db';
import { revalidatePosts } from '@/lib/cache';
import { absoluteUrl } from '@/lib/site';

/**
 * POST /api/writerfy/schedule — give a draft a future publish time.
 *
 * Body: { id, scheduledAt | publishAt }   (ISO 8601 with offset)
 * The post goes live at that moment: public pages already treat
 * "scheduled and due" as live, and /api/cron/publish-scheduled flips the
 * status to published.
 *
 * 200 ok · 400 missing fields / already published · 401 bad token
 * 404 post not found · 422 time is in the past
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!checkWriterfyAuth(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { success: false, error: 'DATABASE_URL is not set on the server' },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid JSON body' }, { status: 400 });
  }

  const id = body?.id;
  const whenRaw = body?.scheduledAt || body?.publishAt;
  if (!id || !whenRaw) {
    return NextResponse.json({ success: false, error: 'id and scheduledAt are required' }, { status: 400 });
  }

  const when = new Date(whenRaw);
  if (isNaN(when.getTime())) {
    return NextResponse.json(
      { success: false, error: 'scheduledAt is not a valid ISO 8601 timestamp' },
      { status: 400 }
    );
  }
  // 5s grace for client clock drift.
  if (when.getTime() <= Date.now() - 5000) {
    return NextResponse.json({ success: false, error: 'scheduledAt must be in the future' }, { status: 422 });
  }

  const { data: post, error: fetchErr } = await db
    .from('blog_posts')
    .select('id, slug, status')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
  if (!post) return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
  if (post.status === 'published') {
    return NextResponse.json({ success: false, error: 'Post already published' }, { status: 400 });
  }

  const { data: updated, error: updateErr } = await db
    .from('blog_posts')
    .update({ status: 'scheduled', scheduled_at: when.toISOString(), published_at: null })
    .eq('id', id)
    .select('id, slug, scheduled_at')
    .single();
  if (updateErr || !updated) {
    return NextResponse.json({ success: false, error: updateErr?.message || 'update failed' }, { status: 500 });
  }

  revalidatePosts(updated.slug);

  return NextResponse.json({
    success: true,
    id: updated.id,
    url: absoluteUrl(updated.slug),
    scheduledAt: updated.scheduled_at,
  });
}
