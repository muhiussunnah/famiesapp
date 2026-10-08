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
  'feed.xml', 'indexnow-key', '_next', 'favicon.ico', 'uploads', 'dashboard', 'register', 'settings', 'blog',
]);

export function isReservedSlug(slug) {
  const first = String(slug || '').replace(/^\/+/, '').split('/')[0];
  return RESERVED.has(first);
}

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/**
 * The Writerify desktop app sends `{ title, slug, excerpt, content,
 * category, status, frontmatter }`, with the article's extra metadata in
 * `frontmatter` (featuredImage, authorName, schemaJsonLd, draft …). Other
 * clients follow the spec and send flat fields. Merge both, flat fields
 * winning, into one normalised shape.
 */
export function readPublishFields(body) {
  const fm = body?.frontmatter && typeof body.frontmatter === 'object' ? body.frontmatter : {};
  return {
    featured_image: str(body.featured_image) || str(fm.featuredImage) || str(fm.featured_image) || str(fm.image) || str(fm.cover),
    excerpt: str(body.excerpt) || str(fm.excerpt),
    category: str(body.category) || str(fm.category),
    meta_title: str(body.meta_title) || str(fm.meta_title) || str(fm.seoTitle),
    meta_description: str(body.meta_description) || str(fm.meta_description) || str(fm.description),
    author_name: str(body.author_name) || str(fm.authorName) || str(fm.author),
    author_role: str(body.author_role) || str(fm.authorRole),
    custom_schema: str(body.custom_schema) || extractExtraSchema(fm.schemaJsonLd),
    status: body.status === 'published' && fm.draft !== true ? 'published' : 'draft',
  };
}

const ARTICLE_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle']);

export function isArticleNode(node) {
  const types = [].concat(node?.['@type'] ?? []);
  return types.some((t) => ARTICLE_TYPES.has(t));
}

/** Flatten a JSON-LD value (object, array or @graph wrapper) into nodes. */
export function schemaNodes(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(schemaNodes);
  if (typeof value === 'object' && Array.isArray(value['@graph'])) return value['@graph'].flatMap(schemaNodes);
  return typeof value === 'object' ? [value] : [];
}

/**
 * Writerify's `frontmatter.schemaJsonLd` is one or more
 * <script type="application/ld+json"> tags: Article + FAQPage + Review /
 * ItemList. The article page builds its own Article schema (with the real
 * URL), so keep only the extra nodes, as a JSON string for custom_schema.
 */
export function extractExtraSchema(scripts) {
  if (typeof scripts !== 'string' || !scripts.includes('{')) return undefined;
  const blocks = [...scripts.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const nodes = [];
  for (const block of blocks.length ? blocks : [scripts]) {
    try {
      nodes.push(...schemaNodes(JSON.parse(block)));
    } catch {
      // Skip a malformed block, keep the rest.
    }
  }
  const extra = nodes.filter((n) => !isArticleNode(n)).map(({ '@context': _ctx, ...rest }) => rest);
  return extra.length ? JSON.stringify(extra) : undefined;
}
