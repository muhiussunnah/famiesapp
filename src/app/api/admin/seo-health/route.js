import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { SITE_URL, absoluteUrl } from '@/lib/site';
import { plainText, normalizeSlug, extractFirstImage } from '@/lib/content-helpers';
import {
  STATIC_PAGES,
  RESERVED_PATHS,
  SITE_HOST,
  BARE_HOST,
  isOwnHost,
  normalizePath,
  isLivePost,
  fetchAllPosts,
  getPublicUrls,
  getSitemapUrls,
  filterOwnUrls,
} from '@/lib/seo-urls';

/**
 * SEO Health audit (admin only).
 *
 * POST { action: 'content' }        → database audit of every blog_posts row
 *                                    (titles, meta, images, headings, thin
 *                                    content, slugs, internal links, schema)
 * POST { action: 'urls' }           → public URL list to crawl (static pages +
 *                                    live posts, merged with sitemap.xml)
 * POST { action: 'scan', urls }     → fetch ≤ 20 live URLs and run the HTML
 *                                    checks on the rendered page
 * POST { action: 'global' }         → site-wide checks (robots.txt, sitemap,
 *                                    favicon, security headers, HTTPS)
 *
 * The page calls these in sequence and combines the results client-side,
 * so no single request runs long enough to hit a proxy time limit.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const USER_AGENT = 'Famies-SEO-Health/1.0';
const SCAN_LIMIT = 20;
const SCAN_PARALLEL = 10;

/* ───────────────────────── Shared helpers ───────────────────────── */

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function stripTags(s) {
  return String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

function attr(attrs, name) {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? '';
}

function extractImages(html) {
  const imgs = [];
  for (const m of String(html || '').matchAll(/<img\b([^>]*)>/gi)) {
    const src = attr(m[1], 'src') ?? attr(m[1], 'data-src');
    if (src == null) continue;
    imgs.push({ src, alt: attr(m[1], 'alt') });
  }
  return imgs;
}

function extractLinks(html) {
  const links = [];
  for (const m of String(html || '').matchAll(/<a\b([^>]*)>/gi)) {
    const href = attr(m[1], 'href');
    if (href) links.push(decodeEntities(href.trim()));
  }
  return links;
}

function extractTag(html, tag) {
  const out = [];
  for (const m of String(html || '').matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))) {
    out.push(stripTags(m[1]));
  }
  return out;
}

function headingLevels(html) {
  return [...String(html || '').matchAll(/<h([1-6])\b[^>]*>/gi)].map((m) => parseInt(m[1], 10));
}

function firstHeadingSkip(levels) {
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) return [levels[i - 1], levels[i]];
  }
  return null;
}

function wordCount(html) {
  const text = plainText(html);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

/** Parse JSON-LD blocks; returns { types, invalid }. */
function parseJsonLd(blocks) {
  const types = [];
  let invalid = false;
  const collect = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(collect);
    const t = node['@type'];
    if (t) (Array.isArray(t) ? t : [t]).forEach((x) => types.push(String(x)));
    if (Array.isArray(node['@graph'])) node['@graph'].forEach(collect);
  };
  for (const raw of blocks) {
    try {
      collect(JSON.parse(raw));
    } catch {
      invalid = true;
    }
  }
  return { types, invalid };
}

const WEIGHT = { critical: 3, warning: 2, info: 1 };
const CONTENT_MAX = 30;
const PAGE_MAX = 35;

function score(issues, max) {
  const lost = issues.reduce((sum, i) => sum + (WEIGHT[i.severity] || 0), 0);
  return Math.max(0, Math.round(((max - lost) / max) * 100));
}

function createIssueList() {
  const issues = [];
  const add = (check, severity, message, fix, category) => issues.push({ check, severity, message, fix, category });
  return { issues, add };
}

/* ─────────────────────── 1. Database content audit ─────────────────────── */

const STATIC_SET = new Set(STATIC_PAGES.map(normalizePath));
const RESERVED_FIRST_SEGMENTS = new Set(RESERVED_PATHS.map((p) => normalizePath(p).split('/')[1]).filter(Boolean));
const FILE_EXT = /\.[a-z0-9]{2,5}$/i;

function firstSegment(path) {
  return normalizePath(path).split('/')[1] || '';
}

/** Classify an internal content link → 'ok' | 'legacy' | 'unpublished' | 'broken' | null (not internal). */
function classifyLink(href, ctx, selfPath) {
  if (!href || href.startsWith('#') || /^(mailto|tel|sms|javascript):/i.test(href)) return null;

  let url;
  if (href.startsWith('//')) {
    try {
      url = new URL('https:' + href);
    } catch {
      return null;
    }
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    try {
      url = new URL(href);
    } catch {
      return null;
    }
    if (!isOwnHost(url.hostname)) return null;
  } else if (href.startsWith('/')) {
    url = new URL(href, SITE_URL);
  } else {
    return null; // relative "foo/bar" links — ambiguous, ignore
  }
  if (href.startsWith('//') && !isOwnHost(url.hostname)) return null;

  const wrongOrigin = /^(https?:)?\/\//i.test(href) && (url.protocol === 'http:' || url.hostname.toLowerCase() !== SITE_HOST);
  const path = normalizePath(url.pathname);
  if (path === normalizePath(selfPath || '')) return { kind: 'self', path, wrongOrigin };
  if (FILE_EXT.test(path)) return { kind: 'ok', path, wrongOrigin };
  if (STATIC_SET.has(path) || RESERVED_FIRST_SEGMENTS.has(firstSegment(path))) {
    // /inspiration/<slug> is the old article URL scheme.
    if (path.startsWith('/inspiration/')) {
      const target = '/' + path.slice('/inspiration/'.length);
      if (ctx.liveByPath.has(target)) return { kind: 'legacy', path, target, wrongOrigin };
      return { kind: 'broken', path, wrongOrigin };
    }
    return { kind: 'ok', path, wrongOrigin };
  }
  if (ctx.liveByPath.has(path)) return { kind: 'ok', path, wrongOrigin };
  if (ctx.allByPath.has(path)) return { kind: 'unpublished', path, wrongOrigin };
  return { kind: 'broken', path, wrongOrigin };
}

function parseCustomSchema(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const scripts = [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim());
  return parseJsonLd(scripts.length ? scripts : [text]);
}

function checkPost(post, ctx) {
  const { issues, add } = createIssueList();
  const content = post.content || '';
  const live = isLivePost(post, ctx.now);
  const words = wordCount(content);

  /* Meta tags */
  const seoTitle = (post.meta_title || '').trim() || (post.title || '').trim();
  if (!(post.meta_title || '').trim()) {
    add('no-meta-title', 'info', 'No custom SEO title — the article title is used', 'Set an SEO title (30–60 characters) in the page editor', 'Meta Tags');
  }
  if (!seoTitle) {
    add('missing-title', 'critical', 'Post has no title', 'Give the post a descriptive title', 'Meta Tags');
  } else if (seoTitle.length < 30) {
    add('seo-title-short', 'warning', `SEO title is too short (${seoTitle.length} chars, min 30)`, 'Write a descriptive SEO title between 30–60 characters', 'Meta Tags');
  } else if (seoTitle.length > 60) {
    add('seo-title-long', 'warning', `SEO title is too long (${seoTitle.length} chars, max 60)`, 'Shorten the SEO title to 60 characters or less so Google shows all of it', 'Meta Tags');
  }

  const metaDesc = (post.meta_description || '').trim();
  const excerpt = (post.excerpt || '').trim();
  const desc = metaDesc || excerpt;
  if (!desc) {
    add('missing-description', 'warning', 'No meta description or excerpt — an auto-snippet from the first paragraph is used', 'Write a meta description of 120–160 characters', 'Meta Tags');
  } else {
    if (!metaDesc) {
      add('description-from-excerpt', 'info', 'No meta description — the excerpt is used instead', 'Write a dedicated meta description of 120–160 characters', 'Meta Tags');
    }
    if (desc.length < 120) {
      add('desc-short', 'warning', `Meta description too short (${desc.length} chars, min 120)`, 'Expand the meta description to at least 120 characters', 'Meta Tags');
    } else if (desc.length > 160) {
      add('desc-long', 'warning', `Meta description too long (${desc.length} chars, max 160)`, 'Shorten the meta description to 160 characters', 'Meta Tags');
    }
  }

  if (live && seoTitle && (ctx.titleCount.get(seoTitle.toLowerCase()) || 0) > 1) {
    add('duplicate-title', 'critical', `SEO title is shared with ${ctx.titleCount.get(seoTitle.toLowerCase()) - 1} other live post(s)`, 'Every page needs a unique title', 'Meta Tags');
  }
  if (live && desc && (ctx.descCount.get(desc.toLowerCase()) || 0) > 1) {
    add('duplicate-description', 'warning', `Meta description is shared with ${ctx.descCount.get(desc.toLowerCase()) - 1} other live post(s)`, 'Write a unique meta description for every page', 'Meta Tags');
  }

  /* Images */
  const featured = (post.featured_image || '').trim();
  const bodyImage = extractFirstImage(content);
  if (!featured && !bodyImage) {
    add('no-featured-image', 'critical', 'No featured image and no image in the content', 'Add a featured image — it is used on cards, in Google Discover and for social sharing', 'Images');
  } else if (!featured) {
    add('featured-image-fallback', 'info', 'No featured image — the first image in the content is used', 'Set an explicit featured image (ideally 1200×630 px)', 'Images');
  } else if (/^http:\/\//i.test(featured)) {
    add('featured-image-insecure', 'warning', 'Featured image is loaded over http://', 'Use an https:// image URL', 'Images');
  }

  const imgs = extractImages(content);
  const noAlt = imgs.filter((i) => i.alt === null);
  const emptyAlt = imgs.filter((i) => i.alt !== null && !i.alt.trim());
  const insecure = imgs.filter((i) => /^http:\/\//i.test(i.src));
  if (noAlt.length) {
    add('img-missing-alt', 'critical', `${noAlt.length} image(s) in the content missing alt text`, 'Add descriptive alt text to every image (accessibility + image search)', 'Images');
  }
  if (emptyAlt.length) {
    add('img-empty-alt', 'warning', `${emptyAlt.length} image(s) have empty alt text`, 'Describe each image instead of leaving alt=""', 'Images');
  }
  if (insecure.length) {
    add('img-insecure', 'warning', `${insecure.length} content image(s) loaded over http://`, 'Use https:// image URLs to avoid mixed-content warnings', 'Images');
  }

  /* Headings — the page template renders the post title as the H1 */
  const levels = headingLevels(content);
  const h1InContent = levels.filter((l) => l === 1).length;
  if (h1InContent) {
    add('content-h1', 'warning', `Content contains ${h1InContent} H1 heading(s) — the page template already renders the title as H1`, 'Change H1s inside the content to H2', 'Headings');
  }
  if (words > 0 && !levels.includes(2)) {
    add('missing-h2', 'warning', 'Content has no H2 headings', 'Break the content up with H2 subheadings', 'Headings');
  }
  const skip = firstHeadingSkip([1, ...levels]);
  if (skip) {
    add('heading-skip', 'warning', `Heading hierarchy skips a level (h${skip[0]} → h${skip[1]})`, 'Use sequential heading levels (h2 → h3 → h4)', 'Headings');
  }

  /* Content length */
  if (words === 0) {
    add('empty-content', 'critical', 'Post has no content', 'Write the article body', 'Content');
  } else if (words < 150) {
    add('thin-content', 'critical', `Very thin content (${words} words, recommended 300+)`, 'Expand the article with useful, original information', 'Content');
  } else if (words < 300) {
    add('thin-content', 'warning', `Thin content (${words} words, recommended 300+)`, 'Expand the article to at least 300 words', 'Content');
  }

  /* Slug */
  const slug = post.slug || '';
  if (!slug) {
    add('missing-slug', 'critical', 'Post has no slug', 'Set a slug like /my-article', 'URL / Slug');
  } else {
    const clean = normalizeSlug(slug);
    if (clean !== slug) {
      add('slug-not-normalized', 'critical', `Slug "${slug}" is not a clean URL${clean ? ` (expected "${clean}")` : ''}`, 'Use lowercase letters, digits and hyphens with one leading slash (no spaces, å/ä/ö or trailing slash)', 'URL / Slug');
    }
    const seg = firstSegment(slug);
    if (normalizePath(slug) === '/' || RESERVED_FIRST_SEGMENTS.has(seg)) {
      add('slug-reserved', 'critical', `Slug "${slug}" collides with a built-in route — the post can never be reached`, 'Choose a different slug', 'URL / Slug');
    } else if (normalizePath(slug).split('/').filter(Boolean).length > 1) {
      add('slug-nested', 'warning', `Nested slug "${slug}" — posts are served at /<slug>, so this URL may not resolve`, 'Use a single-segment slug like /my-article (check the Live pages tab)', 'URL / Slug');
    }
    if ((ctx.slugCount.get(normalizePath(slug)) || 0) > 1) {
      add('slug-duplicate', 'critical', `Slug "${slug}" is used by ${ctx.slugCount.get(normalizePath(slug)) - 1} other post(s) (ignoring case / trailing slash)`, 'Give every post a unique slug', 'URL / Slug');
    }
    if (slug.length > 75) {
      add('slug-long', 'info', `Slug is long (${slug.length} chars)`, 'Shorter slugs (3–5 words) are easier to share and read in results', 'URL / Slug');
    }
  }

  /* Internal links */
  const counts = { broken: [], unpublished: [], legacy: [], wrongOrigin: 0, internal: new Set() };
  for (const href of extractLinks(content)) {
    const r = classifyLink(href, ctx, slug);
    if (!r) continue;
    if (r.wrongOrigin) counts.wrongOrigin++;
    if (r.kind === 'self') continue;
    counts.internal.add(r.path);
    if (r.kind === 'broken') counts.broken.push(r.path);
    else if (r.kind === 'unpublished') counts.unpublished.push(r.path);
    else if (r.kind === 'legacy') counts.legacy.push(r.path);
  }
  const list = (arr) => [...new Set(arr)].slice(0, 3).join(', ') + (new Set(arr).size > 3 ? ' …' : '');
  if (counts.broken.length) {
    add('broken-internal-links', 'critical', `${counts.broken.length} broken internal link(s): ${list(counts.broken)}`, 'Fix or remove links to pages that do not exist', 'Internal Links');
  }
  if (counts.unpublished.length) {
    add('links-to-unpublished', 'warning', `${counts.unpublished.length} link(s) to unpublished posts: ${list(counts.unpublished)}`, 'Publish the linked posts or remove the links — visitors get a 404 until then', 'Internal Links');
  }
  if (counts.legacy.length) {
    add('legacy-internal-links', 'info', `${counts.legacy.length} link(s) use the old /inspiration/<slug> URL: ${list(counts.legacy)}`, 'Link straight to /<slug> to avoid a redirect hop', 'Internal Links');
  }
  if (counts.wrongOrigin) {
    add('internal-links-origin', 'warning', `${counts.wrongOrigin} internal link(s) use http:// or a www. address`, `Use relative links (/my-article) or ${SITE_URL}/… — www.${BARE_HOST} does not serve HTTPS`, 'Internal Links');
  }
  if (words > 0 && counts.internal.size < 3) {
    add('low-internal-links', 'warning', `Only ${counts.internal.size} internal link(s) in the content (recommended 3+)`, 'Link to related articles and pages to help readers and crawlers', 'Internal Links');
  }

  /* Structured data */
  const schema = parseCustomSchema(post.custom_schema);
  if (schema?.invalid) {
    add('invalid-custom-schema', 'critical', 'Custom schema (JSON-LD) is not valid JSON', 'Fix the JSON syntax in the Custom Schema field — Google ignores invalid structured data', 'Structured Data');
  }

  /* Publishing */
  if (post.status === 'scheduled' && !post.scheduled_at) {
    add('scheduled-no-date', 'critical', 'Post is scheduled but has no publish date — it will never go live', 'Set a scheduled date or publish it', 'Publishing');
  }

  return {
    id: post.id,
    title: post.title || '',
    slug,
    url: slug ? absoluteUrl(slug) : null,
    status: post.status,
    live,
    layout: post.layout,
    words,
    updatedAt: post.updated_at,
    issues,
    score: score(issues, CONTENT_MAX),
  };
}

async function contentAudit(db) {
  const posts = await fetchAllPosts(
    db,
    'id, title, slug, excerpt, content, featured_image, status, meta_title, meta_description, layout, custom_schema, scheduled_at, published_at, updated_at'
  );
  const now = Date.now();
  const liveByPath = new Map();
  const allByPath = new Map();
  const slugCount = new Map();
  const titleCount = new Map();
  const descCount = new Map();

  for (const p of posts) {
    if (!p.slug) continue;
    const key = normalizePath(p.slug);
    allByPath.set(key, p);
    slugCount.set(key, (slugCount.get(key) || 0) + 1);
    if (isLivePost(p, now)) {
      liveByPath.set(key, p);
      const t = ((p.meta_title || '').trim() || (p.title || '').trim()).toLowerCase();
      if (t) titleCount.set(t, (titleCount.get(t) || 0) + 1);
      const d = ((p.meta_description || '').trim() || (p.excerpt || '').trim()).toLowerCase();
      if (d) descCount.set(d, (descCount.get(d) || 0) + 1);
    }
  }

  const ctx = { now, liveByPath, allByPath, slugCount, titleCount, descCount };
  const results = posts.map((p) => checkPost(p, ctx)).sort((a, b) => a.score - b.score);
  return {
    posts: results,
    totals: {
      posts: posts.length,
      live: results.filter((r) => r.live).length,
    },
  };
}

/* ─────────────────────── 2. Live HTML checks (crawl) ─────────────────────── */

/** Every <meta> tag as { key, content, charset, httpEquiv } (key = name or property, lowercased). */
function parseMetaTags(html) {
  return [...html.matchAll(/<meta\b([^>]*)>/gi)].map((m) => ({
    key: (attr(m[1], 'name') ?? attr(m[1], 'property') ?? '').toLowerCase(),
    content: attr(m[1], 'content'),
    charset: attr(m[1], 'charset'),
    httpEquiv: (attr(m[1], 'http-equiv') ?? '').toLowerCase(),
  }));
}

/** Every <link> tag as { rel, href } (rel lowercased). */
function parseLinkTags(html) {
  return [...html.matchAll(/<link\b([^>]*)>/gi)].map((m) => ({
    rel: (attr(m[1], 'rel') ?? '').toLowerCase().trim(),
    href: attr(m[1], 'href'),
  }));
}

function metaValue(metas, name) {
  const hit = metas.find((t) => t.key === name && t.content != null);
  return hit ? decodeEntities(hit.content) : null;
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(stripTags(m[1])) : null;
}

function extractJsonLd(html) {
  return [...html.matchAll(/<script\s+[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim());
}

const hasLang = (html) => /<html[^>]*\slang\s*=\s*["'][^"']+["']/i.test(html);

/** The main content region (article → main → body) for link counting. */
function mainRegion(html) {
  const pick = (tag) => {
    const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*)</${tag}>`, 'i'));
    return m ? m[1] : null;
  };
  return pick('article') || pick('main') || pick('body') || html;
}

/** Pages where H2s / many internal links are not expected. */
const UTILITY_PAGES = new Set(['/privacy', '/terms', '/deletion', '/contact']);

function hostOf(u) {
  try {
    return new URL(u, SITE_URL).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function checkPage(html, url) {
  const { issues, add } = createIssueList();
  const path = normalizePath(url);
  const isContentPage = !UTILITY_PAGES.has(path);
  const metas = parseMetaTags(html);
  const links = parseLinkTags(html);
  const meta = (_html, name) => metaValue(metas, name);
  const canonicalTag = links.find((l) => l.rel === 'canonical' && l.href);
  const robots = metas.filter((t) => t.key === 'robots' || t.key === 'googlebot').map((t) => t.content || '').join(',');

  // 1. Title
  const title = extractTitle(html);
  if (!title) {
    add('missing-title', 'critical', 'Page is missing a <title> tag', 'Add a unique title to the page', 'Meta Tags');
  } else {
    if (title.length < 30) add('title-short', 'warning', `Title is too short (${title.length} chars, min 30)`, 'Write a descriptive title between 30–60 characters', 'Meta Tags');
    if (title.length > 60) add('title-long', 'warning', `Title is too long (${title.length} chars, max 60)`, 'Shorten the title to 60 characters or less for full display in Google', 'Meta Tags');
  }

  // 2. Meta description
  const desc = meta(html, 'description');
  if (!desc) {
    add('missing-description', 'critical', 'Page is missing a meta description', 'Add a meta description of 120–160 characters', 'Meta Tags');
  } else {
    if (desc.length < 120) add('desc-short', 'warning', `Meta description too short (${desc.length} chars, min 120)`, 'Expand the meta description to at least 120 characters', 'Meta Tags');
    if (desc.length > 160) add('desc-long', 'warning', `Meta description too long (${desc.length} chars, max 160)`, 'Shorten the meta description to 160 characters', 'Meta Tags');
  }

  // 3. Canonical
  const canonical = canonicalTag ? decodeEntities(canonicalTag.href) : null;
  if (!canonical) {
    add('missing-canonical', 'critical', 'Page is missing a canonical URL', `Add <link rel="canonical"> with the absolute ${SITE_URL}/… URL`, 'Meta Tags');
  } else if (!/^https?:\/\//i.test(canonical)) {
    add('relative-canonical', 'warning', 'Canonical URL is relative, should be absolute', `Use the full absolute URL starting with ${SITE_URL}`, 'Meta Tags');
  } else if (normalizePath(canonical) !== path && isOwnHost(hostOf(canonical))) {
    add('canonical-other-page', 'warning', `Canonical points to a different page (${normalizePath(canonical)})`, 'Make sure the canonical URL is this page, unless it is an intentional duplicate', 'Meta Tags');
  }

  // 3b. Famies: absolute URLs must use the canonical host (www does not serve HTTPS)
  const wrongHost = [
    ['canonical', canonical],
    ['og:url', meta(html, 'og:url')],
    ['og:image', meta(html, 'og:image')],
  ].filter(([, v]) => v && /^https?:\/\//i.test(v) && isOwnHost(hostOf(v)) && (hostOf(v) !== SITE_HOST || /^http:/i.test(v)));
  if (wrongHost.length) {
    const origin = (() => {
      try {
        return new URL(wrongHost[0][1]).origin;
      } catch {
        return wrongHost[0][1];
      }
    })();
    add('wrong-host', 'warning', `${wrongHost.map(([k]) => k).join(', ')} point${wrongHost.length === 1 ? 's' : ''} to ${origin} instead of ${SITE_URL}`, `Point every absolute URL at ${SITE_URL} (check metadataBase in the root layout) — www.${BARE_HOST} does not serve HTTPS`, 'Meta Tags');
  }

  // 4. Open Graph
  if (!meta(html, 'og:title')) add('missing-og-title', 'warning', 'Missing og:title meta tag', 'Add og:title for social sharing', 'Open Graph');
  if (!meta(html, 'og:description')) add('missing-og-desc', 'warning', 'Missing og:description meta tag', 'Add og:description for social sharing', 'Open Graph');
  if (!meta(html, 'og:image')) add('missing-og-image', 'warning', 'Missing og:image meta tag', 'Add og:image (set a featured image) for social sharing previews', 'Open Graph');
  if (!meta(html, 'og:url')) add('missing-og-url', 'info', 'Missing og:url meta tag', 'Add og:url with the canonical URL', 'Open Graph');
  if (!meta(html, 'og:type')) add('missing-og-type', 'info', 'Missing og:type meta tag', 'Add og:type "article" or "website"', 'Open Graph');

  // 5. Twitter cards
  if (!meta(html, 'twitter:card')) add('missing-twitter-card', 'warning', 'Missing twitter:card meta tag', 'Add twitter:card "summary_large_image"', 'Twitter Cards');
  if (!meta(html, 'twitter:title')) add('missing-twitter-title', 'info', 'Missing twitter:title meta tag', 'Add twitter:title', 'Twitter Cards');
  if (!meta(html, 'twitter:description')) add('missing-twitter-desc', 'info', 'Missing twitter:description meta tag', 'Add twitter:description', 'Twitter Cards');
  if (!meta(html, 'twitter:image')) add('missing-twitter-image', 'info', 'Missing twitter:image meta tag', 'Add twitter:image for the share preview', 'Twitter Cards');

  // 6. Headings
  const h1s = extractTag(html, 'h1');
  if (h1s.length === 0) {
    add('missing-h1', 'critical', 'Page is missing an H1 heading', 'Add exactly one H1 with the primary keyword', 'Headings');
  } else if (h1s.length > 1) {
    add('multiple-h1', 'warning', `Page has ${h1s.length} H1 tags (should be exactly 1)`, 'Use only one H1 per page — change extra H1s in the content to H2', 'Headings');
  }
  if (extractTag(html, 'h2').length === 0 && isContentPage) {
    add('missing-h2', 'warning', 'Page has no H2 headings for content structure', 'Add H2 headings to break up the content', 'Headings');
  }
  const skip = firstHeadingSkip(headingLevels(html));
  if (skip) {
    add('heading-skip', 'warning', `Heading hierarchy skips a level (h${skip[0]} → h${skip[1]})`, 'Use sequential heading levels without skipping (h1 → h2 → h3)', 'Headings');
  }

  // 7. Images
  const imgs = extractImages(html);
  const noAlt = imgs.filter((i) => i.alt === null);
  const emptyAlt = imgs.filter((i) => i.alt !== null && !i.alt.trim());
  if (noAlt.length) add('img-missing-alt', 'critical', `${noAlt.length} image(s) missing alt attribute`, 'Add descriptive alt text to every image', 'Images');
  if (emptyAlt.length) add('img-empty-alt', 'warning', `${emptyAlt.length} image(s) have empty alt text`, 'Use meaningful alt text unless the image is purely decorative', 'Images');

  // 8. Technical
  const hasViewport = metas.some((t) => t.key === 'viewport');
  const hasCharset = metas.some((t) => t.charset != null || t.httpEquiv === 'content-type');
  const hasFavicon = links.some((l) => ['icon', 'shortcut icon', 'apple-touch-icon'].includes(l.rel));
  if (!hasViewport) add('missing-viewport', 'critical', 'Missing viewport meta tag', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">', 'Technical');
  if (!hasCharset) add('missing-charset', 'critical', 'Missing charset declaration', 'Add <meta charset="utf-8"> in <head>', 'Technical');
  if (!hasLang(html)) add('missing-lang', 'warning', 'HTML tag missing lang attribute', 'Add lang="sv" to the <html> tag', 'Technical');
  if (!hasFavicon) add('missing-favicon', 'warning', 'No favicon link found in HTML', 'Add <link rel="icon"> in <head>', 'Technical');
  if (/noindex/i.test(robots)) add('has-noindex', 'critical', 'Page has a noindex directive — it will not appear in search results', 'Remove noindex from the robots meta tag if this page should be indexed', 'Technical');

  // 9. Structured data
  const jsonLds = extractJsonLd(html);
  if (jsonLds.length === 0) {
    add('missing-jsonld', 'warning', 'No JSON-LD structured data found on this page', 'Add JSON-LD schema (Article, FAQPage, Organization…) so Google understands the page', 'Structured Data');
  } else {
    const { types, invalid } = parseJsonLd(jsonLds);
    if (invalid) add('invalid-jsonld', 'critical', 'JSON-LD structured data contains invalid JSON', 'Fix the JSON syntax — Google ignores invalid structured data', 'Structured Data');
    const GLOBAL_TYPES = new Set(['Organization', 'WebSite', 'BreadcrumbList']);
    const counts = {};
    for (const t of types) if (!GLOBAL_TYPES.has(t)) counts[t] = (counts[t] || 0) + 1;
    const dups = Object.entries(counts).filter(([, n]) => n > 1);
    if (dups.length) {
      add('duplicate-schema', 'critical', `Duplicate schema @type on this page: ${dups.map(([t, n]) => `${t} (×${n})`).join(', ')}`, 'Remove the extra blocks — use the Custom Schema field to replace the default schema instead of adding a second one', 'Structured Data');
    }
    if (jsonLds.length > 3) {
      add('too-many-jsonld', 'warning', `Page has ${jsonLds.length} JSON-LD script tags (recommended: 1–2)`, 'Consolidate structured data into a single @graph block', 'Structured Data');
    }
  }

  // 10. Duplicate meta descriptions
  const descCount = metas.filter((t) => t.key === 'description').length;
  if (descCount > 1) add('duplicate-description-tag', 'warning', `Found ${descCount} meta descriptions (should be 1)`, 'Remove duplicate meta description tags', 'Meta Tags');

  // 11. Page size
  const sizeKb = Math.round(html.length / 1024);
  if (sizeKb > 2048) {
    add('page-too-large', 'critical', `Page size is ${(sizeKb / 1024).toFixed(1)}MB — exceeds the 2MB limit Google indexes`, 'Reduce page size below 2MB (inline CSS/SVG, huge content, embedded data)', 'Performance');
  } else if (sizeKb > 1500) {
    add('page-size-warning', 'warning', `Page size is ${(sizeKb / 1024).toFixed(1)}MB — approaching the 2MB limit`, 'Reduce page size to stay safely under 2MB', 'Performance');
  } else if (sizeKb > 500) {
    add('large-html', 'info', `HTML is ${sizeKb}KB (recommended < 500KB)`, 'Reduce HTML size by removing unused markup or lazy-loading content', 'Performance');
  }

  // 12. Internal links (in the main content area, not the global nav/footer)
  const hostRe = `(?:https?:)?\\/\\/(?:www\\.)?${escapeRe(BARE_HOST)}`;
  const linkRe = new RegExp(`<a\\s[^>]*href\\s*=\\s*["'](\\/(?!\\/)[^"'#]*|${hostRe}[^"']*)["'][^>]*>`, 'gi');
  const internal = mainRegion(html).match(linkRe) || [];
  if (isContentPage && internal.length < 5) {
    add('low-internal-links', 'warning', `Only ${internal.length} internal link(s) in the main content (recommended: 5+)`, 'Link to related articles and pages for better crawlability', 'Internal Links');
  }

  return { issues, title: title || '', description: desc || '', canonical: canonical || '' };
}

async function scanUrl(url) {
  const path = normalizePath(url) === '/' ? '/' : new URL(url).pathname;
  try {
    const start = Date.now();
    const res = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': USER_AGENT },
    });
    const loadTime = Date.now() - start;
    const html = await res.text();
    const base = { url, path, status: res.status, loadTime, htmlSize: html.length };

    if (res.status >= 400) {
      return {
        ...base,
        title: '',
        description: '',
        issues: [{ check: 'http-error', severity: 'critical', message: `Page returned HTTP ${res.status}`, fix: 'Fix the page or remove it from the sitemap', category: 'Technical' }],
        score: 0,
      };
    }

    const { issues, title, description, canonical } = checkPage(html, url);

    if (res.redirected && normalizePath(res.url) !== normalizePath(url)) {
      issues.push({ check: 'redirected', severity: 'warning', message: `URL redirects to ${res.url}`, fix: 'List and link the final URL instead of a redirecting one', category: 'Technical' });
    }
    const xRobots = res.headers.get('x-robots-tag') || '';
    if (/noindex/i.test(xRobots)) {
      issues.push({ check: 'x-robots-noindex', severity: 'critical', message: 'X-Robots-Tag header contains noindex', fix: 'Remove the noindex header for pages that should be indexed', category: 'Technical' });
    }
    if (loadTime > 5000) {
      issues.push({ check: 'slow-load', severity: 'warning', message: `Page took ${(loadTime / 1000).toFixed(1)}s to load (max 5s)`, fix: 'Optimize server response time and reduce blocking resources', category: 'Performance' });
    }

    return { ...base, title, description, canonical, issues, score: score(issues, PAGE_MAX) };
  } catch {
    return {
      url,
      path,
      status: 0,
      loadTime: 0,
      htmlSize: 0,
      title: '',
      description: '',
      issues: [{ check: 'unreachable', severity: 'critical', message: 'Page is unreachable or timed out', fix: 'Check that the page is deployed and responds within 8 seconds', category: 'Technical' }],
      score: 0,
    };
  }
}

async function scanUrls(urls) {
  const out = [];
  for (let i = 0; i < urls.length; i += SCAN_PARALLEL) {
    out.push(...(await Promise.all(urls.slice(i, i + SCAN_PARALLEL).map(scanUrl))));
  }
  return out;
}

/* ─────────────────────── 3. Site-wide checks ─────────────────────── */

async function timed(url, init = {}) {
  return fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000), headers: { 'User-Agent': USER_AGENT }, ...init });
}

async function globalChecks(db) {
  const checks = [];
  const push = (check, severity, passed, message, fix) => checks.push({ check, severity, passed, message, fix });

  // robots.txt
  try {
    const res = await timed(`${SITE_URL}/robots.txt`);
    const txt = res.ok ? await res.text() : '';
    push('robots-txt', 'critical', res.ok, res.ok ? 'robots.txt is accessible' : `robots.txt returned ${res.status}`, 'Serve a robots.txt at the site root (src/app/robots.js)');
    if (res.ok) {
      // Disallow: / inside a "User-agent: *" group blocks the whole site.
      let star = false;
      let blocksAll = false;
      for (const line of txt.split(/\r?\n/)) {
        const l = line.replace(/#.*/, '').trim();
        if (/^user-agent\s*:/i.test(l)) star = /^user-agent\s*:\s*\*\s*$/i.test(l);
        else if (star && /^disallow\s*:\s*\/\s*$/i.test(l)) blocksAll = true;
      }
      push('robots-allows-crawling', 'critical', !blocksAll, blocksAll ? 'robots.txt blocks the whole site (Disallow: /)' : 'robots.txt allows crawling', 'Remove "Disallow: /" from the User-agent: * group');
      const hasSitemap = /^\s*sitemap\s*:/im.test(txt);
      push('robots-sitemap', 'info', hasSitemap, hasSitemap ? 'robots.txt references the sitemap' : 'robots.txt does not reference the sitemap', `Add "Sitemap: ${SITE_URL}/sitemap.xml" to robots.txt`);
    }
  } catch {
    push('robots-txt', 'critical', false, 'robots.txt is unreachable', 'Serve a robots.txt at the site root');
  }

  // sitemap.xml + coverage of live posts
  const sitemap = await getSitemapUrls({ timeout: 8000 });
  push('sitemap-xml', 'critical', sitemap.ok, sitemap.ok ? `sitemap.xml is accessible (${sitemap.urls.length} URLs)` : `sitemap.xml ${sitemap.status ? `returned ${sitemap.status}` : 'is unreachable'}`, 'Serve a sitemap.xml and submit it in Google Search Console');
  if (sitemap.ok) {
    try {
      const expected = await getPublicUrls(db);
      const inSitemap = new Set(sitemap.urls.map(normalizePath));
      const expectedSet = new Set(expected.map((e) => normalizePath(e.path)));
      const missing = expected.filter((e) => !inSitemap.has(normalizePath(e.path)));
      const extra = [...inSitemap].filter((p) => !expectedSet.has(p));
      push(
        'sitemap-complete',
        'warning',
        missing.length === 0,
        missing.length === 0 ? 'Every live post and static page is in the sitemap' : `${missing.length} live page(s) missing from sitemap.xml: ${missing.slice(0, 3).map((m) => m.path).join(', ')}${missing.length > 3 ? ' …' : ''}`,
        'Make sure the sitemap lists the homepage, static pages and every live post'
      );
      push(
        'sitemap-only-live',
        'warning',
        extra.length === 0,
        extra.length === 0 ? 'The sitemap lists only live pages' : `${extra.length} sitemap URL(s) are not live pages: ${extra.slice(0, 3).join(', ')}${extra.length > 3 ? ' …' : ''}`,
        'Remove drafts, deleted posts and redirects from the sitemap'
      );
    } catch {
      /* DB read failed — skip the coverage comparison */
    }
  }

  // favicon.ico
  try {
    const res = await timed(`${SITE_URL}/favicon.ico`);
    push('favicon-ico', 'warning', res.ok, res.ok ? 'favicon.ico exists' : 'favicon.ico not found at site root', 'Place a favicon.ico in src/app or public/');
  } catch {
    push('favicon-ico', 'warning', false, 'favicon.ico unreachable', 'Place a favicon.ico in src/app or public/');
  }

  // HTTP → HTTPS redirect
  try {
    const res = await timed(`http://${SITE_HOST}/`, { redirect: 'manual' });
    const loc = res.headers.get('location') || '';
    const ok = res.status >= 300 && res.status < 400 && /^https:\/\//i.test(loc);
    push('http-redirects', 'critical', ok, ok ? `http:// redirects to HTTPS (${res.status})` : `http://${SITE_HOST}/ does not redirect to HTTPS (status ${res.status})`, 'Redirect all HTTP traffic to HTTPS (Coolify: Domains → Redirect HTTP to HTTPS)');
  } catch {
    push('http-redirects', 'info', false, 'Could not check the HTTP → HTTPS redirect', 'Redirect all HTTP traffic to HTTPS');
  }

  // Security headers (homepage)
  try {
    const res = await timed(SITE_URL, { method: 'HEAD' });
    const present = ['strict-transport-security', 'x-frame-options', 'x-content-type-options'].filter((h) => !!res.headers.get(h));
    push('security-headers', 'info', present.length >= 2, present.length >= 2 ? `${present.length}/3 security headers present` : `Only ${present.length}/3 security headers found`, 'Add HSTS, X-Frame-Options and X-Content-Type-Options headers (next.config.mjs → headers())');
  } catch {
    push('security-headers', 'info', false, 'Could not check security headers', 'Make sure security headers are configured');
  }

  return checks;
}

/* ───────────────────────────── Handler ───────────────────────────── */

export async function POST(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const action = body?.action || 'content';

  try {
    if (action === 'content') {
      const result = await contentAudit(db);
      return NextResponse.json({ ...result, scannedAt: new Date().toISOString() });
    }

    if (action === 'urls') {
      const [dbUrls, sitemap] = await Promise.all([getPublicUrls(db), getSitemapUrls()]);
      const byPath = new Map(dbUrls.map((u) => [normalizePath(u.path), u]));
      const list = [...dbUrls];
      for (const url of filterOwnUrls(sitemap.urls)) {
        const key = normalizePath(url);
        if (byPath.has(key)) continue;
        const entry = { url, path: new URL(url).pathname, kind: 'sitemap', postId: null, title: null };
        byPath.set(key, entry);
        list.push(entry);
      }
      return NextResponse.json({ urls: list, total: list.length, sitemapOk: sitemap.ok, siteUrl: SITE_URL });
    }

    if (action === 'scan') {
      const urls = filterOwnUrls(Array.isArray(body.urls) ? body.urls : []).slice(0, SCAN_LIMIT);
      if (!urls.length) return NextResponse.json({ error: 'No valid URLs provided' }, { status: 400 });
      const pages = await scanUrls(urls);
      return NextResponse.json({ pages, scannedAt: new Date().toISOString() });
    }

    if (action === 'global') {
      const checks = await globalChecks(db);
      return NextResponse.json({ globalChecks: checks, scannedAt: new Date().toISOString() });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'SEO audit failed' }, { status: 500 });
  }
}
