import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { revalidatePosts } from '@/lib/cache';
import { SITE_URL, DEFAULT_CATEGORY, DEFAULT_AUTHOR_NAME, DEFAULT_AUTHOR_ROLE } from '@/lib/site';
import { slugify, normalizeSlug, autoExcerpt, readTime, resolveFeaturedImage } from '@/lib/content-helpers';

/**
 * Admin CRUD for blog_posts (articles + standalone pages).
 *
 * GET  ?id=12                       → the full post row
 * GET  ?index=1                     → { posts: [{ id, title, slug, status, category }] } — every post,
 *                                     no content (used by the Interlink Checker)
 * GET  ?page=1&status=draft&q=höst  → { posts, total, page, totalPages, status,
 *                                       publishedCount, draftCount, scheduledCount }
 *                                     (list rows carry `internal_links` instead of `content`)
 * POST   { title, slug, content, … }      → creates, returns the row
 * PATCH  { id, …fields }                  → partial update, returns the row
 * DELETE { id }  (or ?id=12)              → { ok: true }
 *
 * Slugs are stored with a leading slash and served at famies.app/<slug>.
 */
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;
const STATUSES = ['draft', 'published', 'scheduled'];
const LAYOUTS = ['with-sidebar', 'full-page'];

// Slugs that would shadow a real route of the site.
const RESERVED_SLUGS = [
  '/admin', '/api', '/inspiration', '/contact', '/privacy', '/terms', '/deletion',
  '/skapa-event', '/partnerpresentation', '/login', '/early-access', '/auth',
  '/sitemap.xml', '/robots.txt', '/feed.xml', '/uploads', '/indexnow-key',
  // Old URLs that now redirect.
  '/dashboard', '/register', '/settings', '/blog',
];

const LIST_FIELDS =
  'id, title, slug, status, category, views, featured_image, author_name, created_at, updated_at, published_at, scheduled_at, content';

const json = (body, status = 200) => NextResponse.json(body, { status });

// ── helpers ───────────────────────────────────────────────────

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SITE_HOST = (() => {
  try {
    return new URL(SITE_URL).host.replace(/^www\./, '');
  } catch {
    return 'famies.app';
  }
})();

const INTERNAL_LINK_RE = new RegExp(
  `<a\\s[^>]*href=["'](\\/(?!\\/)[^"']*|https?:\\/\\/(?:www\\.)?${escapeRegExp(SITE_HOST)}[^"']*)["'][^>]*>`,
  'gi'
);

function countInternalLinks(html) {
  if (!html) return 0;
  return (html.match(INTERNAL_LINK_RE) || []).length;
}

function isReservedSlug(slug) {
  const lower = slug.toLowerCase();
  return RESERVED_SLUGS.some((r) => lower === r || lower.startsWith(r + '/'));
}

function str(v) {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function nullable(v) {
  const s = str(v).trim();
  return s ? s : null;
}

/** Validate + normalise a slug. Returns { slug } or { error }. */
function checkSlug(input) {
  const slug = normalizeSlug(input);
  if (!slug) return { error: 'Slug is required (letters, numbers and dashes).' };
  if (slug.split('/').filter(Boolean).length > 1) {
    return { error: 'The slug must be a single segment, e.g. "hostlov-i-stockholm" (no "/" inside).' };
  }
  if (isReservedSlug(slug)) {
    return { error: `"${slug}" is reserved by an existing page of the site. Pick another slug.` };
  }
  return { slug };
}

async function slugTaken(db, slug, exceptId) {
  let query = db.from('blog_posts').select('id').eq('slug', slug).limit(1);
  if (exceptId != null) query = query.neq('id', exceptId);
  const { data } = await query;
  return Array.isArray(data) && data.length > 0;
}

function validateSchema(raw) {
  const s = nullable(raw);
  if (!s) return { value: null };
  try {
    JSON.parse(s);
    return { value: s };
  } catch (e) {
    return { error: `Custom schema is not valid JSON: ${e.message}` };
  }
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dbError(error) {
  if (error?.code === '23505') return json({ error: 'Another post already uses this slug.' }, 409);
  return json({ error: error?.message || 'Database error' }, 500);
}

/**
 * Apply status rules to `row` (mutates it).
 *  - published → published_at = existing value or now; scheduled_at cleared
 *  - scheduled → published_at null; scheduled_at required (and in the future when it changes)
 *  - draft     → scheduled_at cleared; published_at left as is
 */
function applyStatus(row, status, scheduledAtInput, existing) {
  row.status = status;
  if (status === 'scheduled') {
    const date = parseDate(scheduledAtInput ?? existing?.scheduled_at);
    if (!date) return 'Pick a date and time for the scheduled post.';
    const changed = !existing || !existing.scheduled_at || parseDate(existing.scheduled_at)?.getTime() !== date.getTime();
    if (changed && date.getTime() < Date.now() - 60_000) return 'The scheduled time must be in the future.';
    row.scheduled_at = date.toISOString();
    row.published_at = null;
    return null;
  }
  row.scheduled_at = null;
  if (status === 'published') {
    row.published_at = existing?.published_at || new Date().toISOString();
  } else if (!existing) {
    row.published_at = null;
  }
  return null;
}

// ── GET ───────────────────────────────────────────────────────

export async function GET(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const params = req.nextUrl.searchParams;

  // Single post
  const id = params.get('id');
  if (id) {
    if (!/^\d+$/.test(id)) return json({ error: 'Invalid post ID' }, 400);
    const { data, error: e } = await db.from('blog_posts').select('*').eq('id', Number(id)).maybeSingle();
    if (e) return json({ error: e.message }, 500);
    if (!data) return json({ error: 'Post not found' }, 404);
    return json(data);
  }

  // Lightweight index of every post (Interlink Checker)
  if (params.get('index')) {
    const { data, error: e } = await db
      .from('blog_posts')
      .select('id, title, slug, status, category')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (e) return json({ error: e.message }, 500);
    return json({ posts: data ?? [] });
  }

  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const status = STATUSES.includes(params.get('status')) ? params.get('status') : null;
  // Strip characters that have a meaning inside a PostgREST or() filter.
  const q = (params.get('q') || '').replace(/[%,()*\\"]/g, ' ').replace(/\s+/g, ' ').trim();

  let list = db
    .from('blog_posts')
    .select(LIST_FIELDS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (status) list = list.eq('status', status);
  if (q) {
    // Also match the slug form of the query ("höstlov" → "hostlov").
    const slugQ = slugify(q);
    const filters = [`title.ilike."%${q}%"`, `slug.ilike."%${q}%"`];
    if (slugQ && slugQ !== q) filters.push(`slug.ilike."%${slugQ}%"`);
    list = list.or(filters.join(','));
  }

  // Status counts always reflect the whole table so the tabs show real totals.
  const head = (s) => db.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', s);
  const [listRes, publishedRes, draftRes, scheduledRes] = await Promise.all([
    list,
    head('published'),
    head('draft'),
    head('scheduled'),
  ]);

  if (listRes.error) return json({ error: listRes.error.message }, 500);

  const posts = (listRes.data ?? []).map(({ content, ...rest }) => ({
    ...rest,
    internal_links: countInternalLinks(content),
  }));
  const total = listRes.count ?? 0;

  return json({
    posts,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    status: status ?? 'all',
    q,
    publishedCount: publishedRes.count ?? 0,
    draftCount: draftRes.count ?? 0,
    scheduledCount: scheduledRes.count ?? 0,
  });
}

// ── POST (create) ─────────────────────────────────────────────

export async function POST(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON body' }, 400);

  const title = str(body.title).trim();
  if (!title) return json({ error: 'Title is required' }, 400);

  const slugCheck = checkSlug(body.slug || title);
  if (slugCheck.error) return json({ error: slugCheck.error }, 400);
  const slug = slugCheck.slug;
  if (await slugTaken(db, slug)) return json({ error: `Another post already uses the slug "${slug}".` }, 409);

  const schema = validateSchema(body.custom_schema);
  if (schema.error) return json({ error: schema.error }, 400);

  const content = str(body.content);
  const status = STATUSES.includes(body.status) ? body.status : 'draft';

  const row = {
    title,
    slug,
    content,
    excerpt: nullable(body.excerpt) || autoExcerpt(content),
    read_time: readTime(content),
    featured_image: resolveFeaturedImage(str(body.featured_image), content) || null,
    category: nullable(body.category) || DEFAULT_CATEGORY,
    author_name: nullable(body.author_name) || DEFAULT_AUTHOR_NAME,
    author_role: nullable(body.author_role) || DEFAULT_AUTHOR_ROLE,
    meta_title: nullable(body.meta_title),
    meta_description: nullable(body.meta_description),
    layout: LAYOUTS.includes(body.layout) ? body.layout : 'with-sidebar',
    custom_css: nullable(body.custom_css),
    custom_schema: schema.value,
  };

  const statusError = applyStatus(row, status, body.scheduled_at, null);
  if (statusError) return json({ error: statusError }, 400);

  const { data, error: e } = await db.from('blog_posts').insert(row).select().single();
  if (e) return dbError(e);

  revalidatePosts(data.slug);
  return json(data);
}

// ── PATCH (update) ────────────────────────────────────────────

export async function PATCH(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON body' }, 400);

  const id = Number(body.id);
  if (!id) return json({ error: 'Post ID required' }, 400);

  const { data: existing, error: loadError } = await db
    .from('blog_posts')
    .select('id, slug, status, content, excerpt, featured_image, published_at, scheduled_at')
    .eq('id', id)
    .maybeSingle();
  if (loadError) return json({ error: loadError.message }, 500);
  if (!existing) return json({ error: 'Post not found' }, 404);

  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  const row = {};

  if (has('title')) {
    const title = str(body.title).trim();
    if (!title) return json({ error: 'Title is required' }, 400);
    row.title = title;
  }

  if (has('slug')) {
    const raw = str(body.slug).trim();
    // Leave legacy slugs alone when they are not being changed.
    if (raw !== existing.slug && normalizeSlug(raw) !== existing.slug) {
      const slugCheck = checkSlug(body.slug);
      if (slugCheck.error) return json({ error: slugCheck.error }, 400);
      if (await slugTaken(db, slugCheck.slug, id)) {
        return json({ error: `Another post already uses the slug "${slugCheck.slug}".` }, 409);
      }
      row.slug = slugCheck.slug;
    }
  }

  const content = has('content') ? str(body.content) : existing.content || '';
  if (has('content')) {
    row.content = content;
    row.read_time = readTime(content);
  }

  if (has('excerpt')) {
    // Empty excerpt → generate one from the content.
    row.excerpt = nullable(body.excerpt) || autoExcerpt(content);
  } else if (has('content')) {
    // Only refresh an excerpt that was auto-generated, never a hand-written one.
    const wasAuto = !existing.excerpt || existing.excerpt === autoExcerpt(existing.content || '');
    if (wasAuto) row.excerpt = autoExcerpt(content);
  }

  if (has('featured_image')) {
    row.featured_image = resolveFeaturedImage(str(body.featured_image), content) || null;
  }

  if (has('category')) row.category = nullable(body.category) || DEFAULT_CATEGORY;
  if (has('author_name')) row.author_name = nullable(body.author_name) || DEFAULT_AUTHOR_NAME;
  if (has('author_role')) row.author_role = nullable(body.author_role) || DEFAULT_AUTHOR_ROLE;
  if (has('meta_title')) row.meta_title = nullable(body.meta_title);
  if (has('meta_description')) row.meta_description = nullable(body.meta_description);
  if (has('layout')) row.layout = LAYOUTS.includes(body.layout) ? body.layout : 'with-sidebar';
  if (has('custom_css')) row.custom_css = nullable(body.custom_css);
  if (has('custom_schema')) {
    const schema = validateSchema(body.custom_schema);
    if (schema.error) return json({ error: schema.error }, 400);
    row.custom_schema = schema.value;
  }

  if (has('status') || has('scheduled_at')) {
    const status = has('status') ? body.status : existing.status;
    if (!STATUSES.includes(status)) return json({ error: `Invalid status "${status}"` }, 400);
    const statusError = applyStatus(row, status, has('scheduled_at') ? body.scheduled_at : undefined, existing);
    if (statusError) return json({ error: statusError }, 400);
  }

  if (Object.keys(row).length === 0) return json({ error: 'Nothing to update' }, 400);

  const { data, error: e } = await db.from('blog_posts').update(row).eq('id', id).select().single();
  if (e) return dbError(e);

  revalidatePosts(existing.slug, data.slug);
  return json(data);
}

// ── DELETE ────────────────────────────────────────────────────

export async function DELETE(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const id = Number(body?.id ?? req.nextUrl.searchParams.get('id'));
  if (!id) return json({ error: 'Post ID required' }, 400);

  const { data: post } = await db.from('blog_posts').select('slug').eq('id', id).maybeSingle();
  if (!post) return json({ error: 'Post not found' }, 404);

  const { error: e } = await db.from('blog_posts').delete().eq('id', id);
  if (e) return json({ error: e.message }, 500);

  revalidatePosts(post.slug);
  return json({ ok: true, success: true });
}
