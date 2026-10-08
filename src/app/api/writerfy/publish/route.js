import { NextResponse } from 'next/server';
import { marked } from 'marked';
import { checkWriterfyAuth } from '@/lib/writerfy-auth';
import { getDb } from '@/lib/db';
import { sanitizeArticleHtml } from '@/lib/sanitize';
import { revalidatePosts } from '@/lib/cache';
import {
  normalizeSlug, slugify, plainText, autoExcerpt, truncate, readTime,
  resolveFeaturedImage, dedupeProductHeadings,
} from '@/lib/content-helpers';
import { resolveCategory, isReservedSlug, readPublishFields } from '@/lib/writerfy';
import { absoluteUrl, DEFAULT_AUTHOR_NAME, DEFAULT_AUTHOR_ROLE } from '@/lib/site';

/**
 * Writerfy ingestion endpoint — same contract as mushroomidentifiers.com.
 * Also served at /api/writerify/publish (the spelling Writerify's
 * "Custom API" form uses).
 *
 * Token-authenticated (Authorization: Bearer $WRITERFY_API_TOKEN) so the
 * Writerify desktop app can create or update articles in the same
 * blog_posts table the admin panel writes to. Accepts Markdown (default)
 * or HTML (`content_format: "html"`); Markdown is converted server-side and
 * everything is sanitised before it is stored. Metadata may come as flat
 * fields or inside Writerify's `frontmatter` (see readPublishFields).
 *
 * GET  → health check { ok: true, service: 'writerfy-publish' }
 * POST → { id, slug, url, status, updated }   (409 if the slug exists,
 *        unless ?overwrite=true or body.overwrite)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

marked.setOptions({ gfm: true, breaks: false });

function normaliseLayout(v) {
  return v === 'full' || v === 'full-page' ? 'full-page' : 'with-sidebar';
}

export async function GET(req) {
  if (!checkWriterfyAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    service: 'writerfy-publish',
    version: 1,
    databaseConfigured: !!getDb(),
  });
}

export async function POST(req) {
  if (!checkWriterfyAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: 'DATABASE_URL is not set on the server' }, { status: 503 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!body?.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (!body?.content || typeof body.content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  // ── Content ─────────────────────────────────────────────────────
  const rawHtml =
    body.content_format === 'html' ? body.content : marked.parse(body.content, { async: false });
  const content = dedupeProductHeadings(sanitizeArticleHtml(rawHtml));

  // ── Derived fields ──────────────────────────────────────────────
  const slug = normalizeSlug(body.slug) || '/' + slugify(body.title);
  if (slug === '/' || isReservedSlug(slug)) {
    return NextResponse.json({ error: `slug "${slug}" is reserved by the website` }, { status: 400 });
  }

  const fields = readPublishFields(body);
  const excerpt = truncate(fields.excerpt || autoExcerpt(content), 500);
  const status = fields.status;
  const now = new Date().toISOString();

  const row = {
    title: body.title.trim(),
    slug,
    excerpt,
    content,
    featured_image: resolveFeaturedImage(fields.featured_image, content),
    category: resolveCategory(fields.category),
    read_time: readTime(content),
    status,
    author_name: fields.author_name || DEFAULT_AUTHOR_NAME,
    author_role: fields.author_role || DEFAULT_AUTHOR_ROLE,
    meta_title: truncate(fields.meta_title || body.title.trim(), 60),
    meta_description: truncate(fields.meta_description || plainText(excerpt), 160),
    layout: normaliseLayout(body.layout),
    custom_css: body.custom_css || null,
    custom_schema: fields.custom_schema || null,
    scheduled_at: null,
    published_at: status === 'published' ? now : null,
  };

  const overwrite = req.nextUrl.searchParams.get('overwrite') === 'true' || !!body.overwrite;

  const { data: existing, error: lookupError } = await db
    .from('blog_posts')
    .select('id, slug, published_at')
    .eq('slug', slug)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });

  let saved;
  if (existing) {
    if (!overwrite) {
      return NextResponse.json(
        {
          error: 'slug already exists',
          id: existing.id,
          slug: existing.slug,
          hint: 'POST with ?overwrite=true or set { "overwrite": true } to replace.',
        },
        { status: 409 }
      );
    }
    // Republishing keeps the original publish date.
    const patch = {
      ...row,
      published_at: status === 'published' ? existing.published_at || now : null,
    };
    const { data, error } = await db
      .from('blog_posts')
      .update(patch)
      .eq('id', existing.id)
      .select('id, slug, status')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    saved = data;
  } else {
    const { data, error } = await db.from('blog_posts').insert(row).select('id, slug, status').single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'slug already exists (race)', slug }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    saved = data;
  }

  revalidatePosts(saved.slug);

  return NextResponse.json({
    id: saved.id,
    slug: saved.slug,
    url: absoluteUrl(saved.slug),
    status: saved.status,
    updated: !!existing,
  });
}
