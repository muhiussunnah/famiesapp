import { CATEGORIES, DEFAULT_CATEGORY } from '@/lib/site';
import { slugify } from '@/lib/content-helpers';

/**
 * Writerfy's UI sends a category's slug (e.g. "mat-och-mums"), but a
 * display name ("Mat & Mums") or any case/spacing variant also resolves.
 * Unknown values fall back to the default category.
 */
export function resolveCategory(input) {
  if (typeof input !== 'string' || !input.trim()) return DEFAULT_CATEGORY;
  const raw = input.trim();
  if (CATEGORIES.includes(raw)) return raw;
  const wanted = slugify(raw);
  return CATEGORIES.find((c) => slugify(c) === wanted) || DEFAULT_CATEGORY;
}

// First path segments owned by real routes — a post can't take these.
const RESERVED = new Set([
  'admin', 'api', 'inspiration', 'contact', 'privacy', 'terms', 'deletion', 'skapa-event',
  'partnerpresentation', 'login', 'early-access', 'auth', 'sitemap.xml', 'robots.txt',
  'feed.xml', 'indexnow-key', '_next', 'favicon.ico',
]);

export function isReservedSlug(slug) {
  const first = String(slug || '').replace(/^\/+/, '').split('/')[0];
  return RESERVED.has(first);
}
