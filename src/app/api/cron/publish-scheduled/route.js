import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { revalidatePosts } from '@/lib/cache';

/**
 * Flips every scheduled post whose time has come to `published`.
 *
 * Public pages already show "scheduled and due" posts on time, so this job
 * only tidies up the status (admin lists, Writerfy drafts, counts). Runs
 * daily (Coolify scheduled task or vercel.json); any cron can call it.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: 'DATABASE_URL is not set on the server' }, { status: 503 });
  }

  const { data: due, error } = await db
    .from('blog_posts')
    .select('id, slug, scheduled_at')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const published = [];
  for (const post of due ?? []) {
    const { error: updateErr } = await db
      .from('blog_posts')
      .update({ status: 'published', published_at: post.scheduled_at, scheduled_at: null })
      .eq('id', post.id)
      .eq('status', 'scheduled');
    if (!updateErr) published.push(post.slug);
  }

  if (published.length) revalidatePosts(...published);

  return NextResponse.json({ ok: true, published: published.length, slugs: published });
}
