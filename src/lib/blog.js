/**
 * Public, server-side reads of blog_posts (articles + standalone pages).
 *
 * "Live" means published, or scheduled with scheduled_at in the past — the
 * same rule as the RLS policy — so a scheduled post appears on time even
 * before the cron job flips its status. All reads are cached under the
 * 'posts' tag, which every write path revalidates.
 */
import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';

// Card/list fields — never pull full article HTML for listings.
export const LIST_FIELDS =
  'id, title, slug, excerpt, featured_image, category, read_time, views, author_name, published_at, scheduled_at, created_at, updated_at, status';

function liveFilter(query) {
  // Rounded to the minute: the timestamp is part of the request URL, i.e.
  // the data-cache key, so a per-millisecond value would never hit cache.
  const now = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  return query.or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${now})`);
}

/** Effective publish date for display + sorting. */
export function publishedDate(post) {
  return post?.published_at || post?.scheduled_at || post?.created_at || null;
}

function byNewest(a, b) {
  return new Date(publishedDate(b) || 0) - new Date(publishedDate(a) || 0);
}

export const getLivePosts = cache(async function getLivePosts(limit = 500) {
  const supabase = createPublicClient({ tags: ['posts'] });
  if (!supabase) return [];
  try {
    const { data, error } = await liveFilter(supabase.from('blog_posts').select(LIST_FIELDS))
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) {
      console.error('[blog] list error:', error.message);
      return [];
    }
    return (data ?? []).sort(byNewest);
  } catch (err) {
    console.error('[blog] list unexpected error:', err?.message || err);
    return [];
  }
});

export const getPostBySlug = cache(async function getPostBySlug(slug) {
  const supabase = createPublicClient({ tags: ['posts'] });
  if (!supabase || !slug) return null;
  try {
    const { data, error } = await liveFilter(supabase.from('blog_posts').select('*').eq('slug', slug))
      .maybeSingle();
    if (error) {
      console.error('[blog] post error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[blog] post unexpected error:', err?.message || err);
    return null;
  }
});

/** View counts for a list of slugs → { slug: views }. */
export const getViewCounts = cache(async function getViewCounts(slugs) {
  const supabase = createPublicClient({ tags: ['views'], revalidate: 300 });
  if (!supabase || !slugs?.length) return {};
  try {
    const { data } = await supabase.from('page_views').select('slug, views').in('slug', slugs);
    const map = {};
    for (const row of data ?? []) map[row.slug] = row.views || 0;
    return map;
  } catch {
    return {};
  }
});
