import { revalidatePath, revalidateTag } from 'next/cache';
import { BLOG_PATH } from '@/lib/site';

/** Every data-cache tag used by cachedRead() loaders (src/lib/db/cached.js). */
export const CACHE_TAGS = [
  'posts',
  'site-content',
  'menus',
  'site-scripts',
  'homepage-blocks',
  'nofollow-rules',
  'views',
];

/**
 * Refresh everything that lists or renders posts after a create / update /
 * delete. Pass the post's slug(s) to refresh the article page itself.
 */
export function revalidatePosts(...slugs) {
  revalidateTag('posts', 'max');
  for (const slug of slugs) if (slug) revalidatePath(slug);
  revalidatePath(BLOG_PATH);
  revalidatePath('/sitemap.xml');
  revalidatePath('/feed.xml');
  revalidatePath('/');
}

/** Refresh a site-wide data tag and every page under the root layout. */
export function revalidateSite(tag) {
  if (tag) revalidateTag(tag, 'max');
  revalidatePath('/', 'layout');
}
