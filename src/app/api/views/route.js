import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { normalizeSlug } from '@/lib/content-helpers';

/**
 * Page-view counter.
 * GET  ?slug=/x            → { views }
 * GET  ?slugs=/a,/b        → { views: { '/a': 3, '/b': 0 } }
 * POST { slug }            → atomic +1 (page_views + blog_posts.views)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const db = getDb();
  const slugsParam = req.nextUrl.searchParams.get('slugs');
  if (slugsParam) {
    const slugs = slugsParam.split(',').map(normalizeSlug).filter(Boolean).slice(0, 100);
    const map = Object.fromEntries(slugs.map((s) => [s, 0]));
    if (db && slugs.length) {
      const { data } = await db.from('page_views').select('slug, views').in('slug', slugs);
      for (const row of data ?? []) map[row.slug] = row.views || 0;
    }
    return NextResponse.json({ views: map });
  }

  const slug = normalizeSlug(req.nextUrl.searchParams.get('slug'));
  if (!slug || !db) return NextResponse.json({ views: 0 });
  const { data } = await db.from('page_views').select('views').eq('slug', slug).maybeSingle();
  return NextResponse.json({ views: data?.views || 0 });
}

export async function POST(req) {
  const { slug: raw } = await req.json().catch(() => ({}));
  const slug = normalizeSlug(raw);
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false });

  // Only count real, live posts — keeps junk slugs out of page_views.
  const { data: post } = await db
    .from('blog_posts')
    .select('id')
    .eq('slug', slug)
    .in('status', ['published', 'scheduled'])
    .maybeSingle();
  if (!post) return NextResponse.json({ ok: false }, { status: 404 });

  const { data: views, error } = await db.rpc('increment_page_view', { p_slug: slug });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, views });
}
