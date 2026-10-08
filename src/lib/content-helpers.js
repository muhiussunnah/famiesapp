/**
 * Shared helpers for article content: slugs, excerpts, read time,
 * featured-image fallback and Writerfy clean-up.
 */

/** Strip Swedish/other diacritics so "Höstlov på Skansen" → "hostlov-pa-skansen". */
export function slugify(input, maxLength = 80) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' och ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/**
 * Normalise a slug for storage: always one leading slash, no trailing
 * slash, lowercase path segments. Returns '' when nothing usable remains.
 */
export function normalizeSlug(input) {
  const raw = String(input || '').trim().replace(/^https?:\/\/[^/]+/i, '');
  const parts = raw
    .split('/')
    .map((p) => slugify(p, 120))
    .filter(Boolean);
  return parts.length ? '/' + parts.join('/') : '';
}

export function plainText(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** ~155-char excerpt cut on a word boundary. */
export function autoExcerpt(htmlOrText, max = 155) {
  const text = plainText(htmlOrText);
  if (text.length <= max) return text;
  return text.slice(0, max - 3).replace(/\s+\S*$/, '') + '…';
}

export function truncate(s, max) {
  if (!s) return s;
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

export function readTime(html) {
  const words = plainText(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200)) + ' min';
}

/** `src` of the first <img> in an HTML blob, or null. */
export function extractFirstImage(html) {
  if (!html || typeof html !== 'string') return null;
  const match = html.match(/<img[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  const src = match?.[1]?.trim();
  return src || null;
}

/** Explicit featured image if set, otherwise the first image in the body. */
export function resolveFeaturedImage(featuredImage, content) {
  const explicit = (featuredImage || '').trim();
  if (explicit) return explicit;
  return extractFirstImage(content) || '';
}

/**
 * Dedupe Writerfy product-heading duplicates.
 *
 * Writerfy's AI sometimes writes a markdown heading immediately before the
 * verbatim `<hN class="writerify-product-heading">` block with the same
 * text, so the product title would render twice. Drop the plain heading
 * when its text matches (exactly, or ≥80% shared tokens). Idempotent, and
 * a no-op when no product heading is present.
 */
export function dedupeProductHeadings(html) {
  if (!html || typeof html !== 'string') return html || '';
  if (!html.includes('writerify-product-heading')) return html;

  const norm = (s) =>
    s
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/^\s*\d+\.\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const pattern =
    /<h([2-4])\b(?![^>]*\bwriterify-product-heading\b)[^>]*>([\s\S]*?)<\/h\1>(\s*(?:<p[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>\s*)*)(<h([2-4])\b[^>]*\bwriterify-product-heading\b[^>]*>([\s\S]*?)<\/h\5>)/gi;

  return html.replace(pattern, (full, _level, firstInner, between, productEl, _pLevel, productInner) => {
    const a = norm(firstInner);
    const b = norm(productInner);
    if (!a || !b) return full;
    if (a === b) return between + productEl;
    const tokens = (s) => new Set(s.split(/\s+/).filter(Boolean));
    const ta = tokens(a);
    const tb = tokens(b);
    if (ta.size === 0 || tb.size === 0) return full;
    const small = ta.size < tb.size ? ta : tb;
    const large = ta.size < tb.size ? tb : ta;
    let shared = 0;
    for (const t of small) if (large.has(t)) shared++;
    if (shared / small.size >= 0.8 && small.size >= 2) return between + productEl;
    return full;
  });
}
