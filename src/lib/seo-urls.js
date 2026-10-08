/**
 * Server-side helpers shared by the SEO Health and Indexing Report admin
 * tools: which public URLs Famies has, which blog_posts are live, and how
 * to read the live sitemap.xml.
 *
 * Public URL structure:
 *   - static pages (STATIC_PAGES below)
 *   - every live blog_posts row at https://famies.app<slug>
 *     (slug is stored with a leading slash)
 */
import { SITE_URL, absoluteUrl } from '@/lib/site';

/** Hand-built public pages. Keep in sync with src/app/sitemap.js. */
export const STATIC_PAGES = [
  '/',
  '/inspiration',
  '/contact',
  '/skapa-event',
  '/privacy',
  '/terms',
  '/deletion',
  '/partnerpresentation',
];

/**
 * Top-level paths owned by real app routes. A blog_posts slug whose first
 * segment matches one of these is shadowed by the static route and can
 * never be reached at /<slug>.
 */
export const RESERVED_PATHS = [
  ...STATIC_PAGES.filter((p) => p !== '/'),
  '/admin',
  '/api',
  '/auth',
  '/login',
  '/register',
  '/dashboard',
  '/settings',
  '/early-access',
  '/sitemap.xml',
  '/robots.txt',
  '/feed.xml',
  '/favicon.ico',
  '/indexnow-key',
];

export const SITE_HOST = (() => {
  try {
    return new URL(SITE_URL).hostname.toLowerCase();
  } catch {
    return 'famies.app';
  }
})();

/** Bare host without "www." — matches famies.app and www.famies.app. */
export const BARE_HOST = SITE_HOST.replace(/^www\./, '');

/** True for an absolute URL on the Famies domain (apex or www). */
export function isOwnHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^www\./, '');
  return h === BARE_HOST;
}

/** Pathname of a URL or path, no trailing slash (except root), lowercased. */
export function normalizePath(raw) {
  let p;
  try {
    p = new URL(raw, SITE_URL).pathname || '/';
  } catch {
    p = String(raw || '/');
  }
  try {
    p = decodeURI(p);
  } catch {
    /* keep encoded */
  }
  if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '') || '/';
  return p.toLowerCase();
}

/** PostgREST filter for "live" posts — same rule as the RLS policy. */
export function liveFilterString(now = new Date()) {
  return `status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${now.toISOString()})`;
}

export function isLivePost(post, now = Date.now()) {
  if (!post) return false;
  if (post.status === 'published') return true;
  return post.status === 'scheduled' && !!post.scheduled_at && new Date(post.scheduled_at).getTime() <= now;
}

/**
 * Every blog_posts row (paged past PostgREST's 1000-row cap).
 * `live: true` limits it to live posts.
 */
export async function fetchAllPosts(db, columns, { live = false } = {}) {
  const PAGE = 1000;
  const rows = [];
  for (let from = 0; from < 50000; from += PAGE) {
    let q = db.from('blog_posts').select(columns);
    if (live) q = q.or(liveFilterString());
    const { data, error } = await q.order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/**
 * The public URL list built from the database: static pages + every live
 * post. Each entry: { url, path, kind: 'static' | 'post', postId, title, publishedAt }.
 */
export async function getPublicUrls(db) {
  const posts = await fetchAllPosts(db, 'id, title, slug, status, scheduled_at, published_at, created_at', { live: true });
  const seen = new Set();
  const list = [];
  for (const path of STATIC_PAGES) {
    seen.add(normalizePath(path));
    list.push({ url: absoluteUrl(path), path, kind: 'static', postId: null, title: null, publishedAt: null });
  }
  for (const p of posts) {
    if (!p.slug) continue;
    const key = normalizePath(p.slug);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({
      url: absoluteUrl(p.slug),
      path: p.slug,
      kind: 'post',
      postId: p.id,
      title: p.title,
      publishedAt: p.published_at || p.scheduled_at || p.created_at || null,
    });
  }
  return list;
}

/**
 * <loc> URLs from the live sitemap.xml (follows a sitemap index one level
 * deep). Returns { ok, status, urls } and never throws.
 */
export async function getSitemapUrls({ timeout = 10000 } = {}) {
  const read = async (url) => {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
      headers: { 'User-Agent': 'Famies-Admin/1.0' },
    });
    return { res, xml: res.ok ? await res.text() : '' };
  };
  const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));

  try {
    const { res, xml } = await read(`${SITE_URL}/sitemap.xml`);
    if (!res.ok) return { ok: false, status: res.status, urls: [] };
    if (/<sitemapindex/i.test(xml)) {
      const children = locs(xml).slice(0, 20);
      const urls = [];
      for (const child of children) {
        try {
          const r = await read(child);
          if (r.res.ok) urls.push(...locs(r.xml));
        } catch {
          /* skip broken child sitemap */
        }
      }
      return { ok: true, status: res.status, urls };
    }
    return { ok: true, status: res.status, urls: locs(xml) };
  } catch (err) {
    return { ok: false, status: 0, urls: [], error: err?.message || 'unreachable' };
  }
}

/** Keep only absolute URLs on the Famies domain, deduped. */
export function filterOwnUrls(urls) {
  const out = [];
  const seen = new Set();
  for (const raw of urls || []) {
    if (typeof raw !== 'string') continue;
    let u;
    try {
      u = new URL(raw.trim());
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || !isOwnHost(u.hostname)) continue;
    const href = u.toString();
    if (seen.has(href)) continue;
    seen.add(href);
    out.push(href);
  }
  return out;
}

/** "/admin/pages/edit?id=12" — where an issue on a post gets fixed. */
export function editPath(postId) {
  return postId == null ? null : `/admin/pages/edit?id=${postId}`;
}
