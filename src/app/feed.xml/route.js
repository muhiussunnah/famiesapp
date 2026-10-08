import { getLivePosts, publishedDate } from '@/lib/blog';
import { SITE_URL, BLOG_PATH, absoluteUrl } from '@/lib/site';

export const revalidate = 300;

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** RSS 2.0 feed of the 50 newest articles. */
export async function GET() {
  const posts = (await getLivePosts()).slice(0, 50);

  const items = posts
    .map((post) => {
      const url = absoluteUrl(post.slug);
      const date = publishedDate(post);
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      ${date ? `<pubDate>${new Date(date).toUTCString()}</pubDate>` : ''}
      ${post.category ? `<category>${escapeXml(post.category)}</category>` : ''}
      <description>${escapeXml(post.excerpt)}</description>
      ${post.featured_image ? `<enclosure url="${escapeXml(post.featured_image)}" type="image/${/\.png(\?|$)/i.test(post.featured_image) ? 'png' : /\.webp(\?|$)/i.test(post.featured_image) ? 'webp' : 'jpeg'}" length="0" />` : ''}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Famies Inspiration</title>
    <link>${absoluteUrl(BLOG_PATH)}</link>
    <description>Tips, guider och familjeidéer från Famies.</description>
    <language>sv-SE</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
