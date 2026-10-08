import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/**
 * On-site content stats for the admin Dashboard (database only — no
 * Google needed).
 *
 * GET → {
 *   posts:   { total, published, draft, scheduled },
 *   views:   { total, pages },                 // from page_views
 *   topPosts, recentPosts, upcoming,           // blog_posts rows
 *   forms:   { contact, newsletter, earlyAccess } each { total, last7d, latestAt },
 *   latestMessages                             // 5 newest contact_messages
 * }
 *
 * Every query is independent: a failing one (e.g. a table that does not
 * exist yet) yields null for that number instead of failing the request.
 */
const POST_FIELDS = 'id, title, slug, status, views, updated_at, published_at, scheduled_at';

async function count(query) {
  try {
    const { count: n, error } = await query;
    if (error) return null;
    return n ?? 0;
  } catch {
    return null;
  }
}

async function rows(query) {
  try {
    const { data, error } = await query;
    if (error) return null;
    return data ?? [];
  } catch {
    return null;
  }
}

/** Sum of page_views.views, paging past PostgREST's 1000-row cap. */
async function viewTotals(db) {
  const PAGE = 1000;
  let total = 0;
  let pages = 0;
  try {
    for (let from = 0; from < PAGE * 50; from += PAGE) {
      const { data, error } = await db.from('page_views').select('views').order('slug').range(from, from + PAGE - 1);
      if (error) return { total: null, pages: null };
      for (const r of data ?? []) total += Number(r.views) || 0;
      pages += data?.length ?? 0;
      if (!data || data.length < PAGE) break;
    }
    return { total, pages };
  } catch {
    return { total: null, pages: null };
  }
}

async function formStats(db, table, since) {
  const head = () => db.from(table).select('id', { count: 'exact', head: true });
  const [total, last7d, latest] = await Promise.all([
    count(head()),
    count(head().gte('created_at', since)),
    rows(db.from(table).select('created_at').order('created_at', { ascending: false }).limit(1)),
  ]);
  return { total, last7d, latestAt: latest?.[0]?.created_at ?? null };
}

export async function GET() {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const postCount = () => db.from('blog_posts').select('id', { count: 'exact', head: true });

  const [
    total, published, draft, scheduled,
    views, topPosts, recentPosts, upcoming,
    contact, newsletter, earlyAccess, latestMessages,
  ] = await Promise.all([
    count(postCount()),
    count(postCount().eq('status', 'published')),
    count(postCount().eq('status', 'draft')),
    count(postCount().eq('status', 'scheduled')),
    viewTotals(db),
    rows(db.from('blog_posts').select(POST_FIELDS).gt('views', 0).order('views', { ascending: false }).limit(10)),
    rows(db.from('blog_posts').select(POST_FIELDS).order('updated_at', { ascending: false }).limit(8)),
    rows(
      db.from('blog_posts').select(POST_FIELDS).eq('status', 'scheduled')
        .order('scheduled_at', { ascending: true }).limit(5)
    ),
    formStats(db, 'contact_messages', since),
    formStats(db, 'newsletter', since),
    formStats(db, 'early_access', since),
    rows(
      db.from('contact_messages').select('id, name, email, subject, message, created_at')
        .order('created_at', { ascending: false }).limit(5)
    ),
  ]);

  return NextResponse.json({
    posts: { total, published, draft, scheduled },
    views,
    topPosts: topPosts ?? [],
    recentPosts: recentPosts ?? [],
    upcoming: upcoming ?? [],
    forms: { contact, newsletter, earlyAccess },
    latestMessages: (latestMessages ?? []).map((m) => ({
      ...m,
      message: m.message && m.message.length > 160 ? m.message.slice(0, 160) + '…' : m.message,
    })),
  });
}
