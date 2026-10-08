/**
 * Public, server-side reads of blog_posts (articles + standalone pages).
 *
 * "Live" means published, or scheduled with scheduled_at in the past, so a
 * scheduled post appears on time (within the 60s cache window) even before
 * the cron job flips its status. Reads are cached under the 'posts' tag,
 * which every write path revalidates.
 */
import { cache } from 'react';
import { cachedRead } from '@/lib/db/cached';

// Card/list fields — never pull full article HTML for listings.
export const LIST_FIELDS =
  'id, title, slug, excerpt, featured_image, category, read_time, views, author_name, published_at, scheduled_at, created_at, updated_at, status';

function liveFilter(query) {
  return query.or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${new Date().toISOString()})`);
}

/** Effective publish date for display + sorting. */
export function publishedDate(post) {
  return post?.published_at || post?.scheduled_at || post?.created_at || null;
}

function byNewest(a, b) {
  return new Date(publishedDate(b) || 0) - new Date(publishedDate(a) || 0);
}

const loadLivePosts = cachedRead(
  async (db, limit) => {
    const { data, error } = await liveFilter(db.from('blog_posts').select(LIST_FIELDS))
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).sort(byNewest);
  },
  ['posts', 'live'],
  { tags: ['posts'] }
);

export const getLivePosts = cache(async function getLivePosts(limit = 500) {
  return (await loadLivePosts(limit)) ?? [];
});

const loadPostBySlug = cachedRead(
  async (db, slug) => {
    const { data, error } = await liveFilter(db.from('blog_posts').select('*').eq('slug', slug)).maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  },
  ['posts', 'by-slug'],
  { tags: ['posts'] }
);

export const getPostBySlug = cache(async function getPostBySlug(slug) {
  if (!slug) return null;
  return (await loadPostBySlug(slug)) ?? null;
});

const loadViewCounts = cachedRead(
  async (db, slugs) => {
    const { data, error } = await db.from('page_views').select('slug, views').in('slug', slugs);
    if (error) throw new Error(error.message);
    const map = {};
    for (const row of data ?? []) map[row.slug] = row.views || 0;
    return map;
  },
  ['views'],
  { tags: ['views'], revalidate: 300 }
);

/** View counts for a list of slugs → { slug: views }. */
export const getViewCounts = cache(async function getViewCounts(slugs) {
  if (!slugs?.length) return {};
  return (await loadViewCounts(slugs)) ?? {};
});
