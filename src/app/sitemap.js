import { getLivePosts, publishedDate } from '@/lib/blog';
import { absoluteUrl, BLOG_PATH } from '@/lib/site';

export const revalidate = 300;

// Public, indexable static pages.
const STATIC_PAGES = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: BLOG_PATH, priority: 0.9, changeFrequency: 'daily' },
  { path: '/skapa-event', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/partnerpresentation', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/deletion', priority: 0.3, changeFrequency: 'yearly' },
];

export default async function sitemap() {
  const posts = await getLivePosts();
  const newest = posts[0] ? new Date(publishedDate(posts[0])) : new Date();

  return [
    ...STATIC_PAGES.map((p) => ({
      url: absoluteUrl(p.path),
      lastModified: p.path === BLOG_PATH || p.path === '/' ? newest : undefined,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })),
    ...posts.map((post) => ({
      url: absoluteUrl(post.slug),
      lastModified: new Date(post.updated_at || publishedDate(post)),
      changeFrequency: 'monthly',
      priority: 0.8,
    })),
  ];
}
