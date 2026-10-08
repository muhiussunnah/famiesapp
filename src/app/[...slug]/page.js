import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Calendar, Clock, Eye } from 'lucide-react';
import '../article.css';
import TableOfContents from '@/components/blog/TableOfContents';
import ViewTracker from '@/components/blog/ViewTracker';
import ShareButton from '@/components/blog/ShareButton';
import ArticleSidebar from '@/components/blog/ArticleSidebar';
import RelatedPosts from '@/components/blog/RelatedPosts';
import { getPostBySlug, getLivePosts, getViewCounts, publishedDate } from '@/lib/blog';
import { getNofollowRules, applyNofollowRules } from '@/lib/external-links';
import { getSiteContent, setting } from '@/lib/site-content';
import { addHeadingIds, splitAtFirstH2, classifyTableBadges } from '@/lib/article-html';
import { resolveFeaturedImage, dedupeProductHeadings, normalizeSlug } from '@/lib/content-helpers';
import { SITE_URL, SITE_NAME, BLOG_PATH, absoluteUrl } from '@/lib/site';

/**
 * Public page for every post/page created in /admin/pages or via Writerfy.
 * URL = the stored slug, e.g. famies.app/hostlov-i-stockholm.
 * Rendered on first request and cached; every admin/Writerfy write
 * revalidates the path, and the data cache refreshes at most every 60s.
 */
export const revalidate = 60;

export async function generateStaticParams() {
  return [];
}

async function loadPost(params) {
  const { slug } = await params;
  const path = normalizeSlug((slug || []).map(decodeURIComponent).join('/'));
  return path ? getPostBySlug(path) : null;
}

function toAbsoluteImage(src) {
  const s = (src || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  return absoluteUrl(s);
}

export async function generateMetadata({ params }) {
  const post = await loadPost(params);
  if (!post) return { title: 'Sidan hittades inte' };

  const title = post.meta_title || post.title;
  const description = post.meta_description || post.excerpt || '';
  const image = toAbsoluteImage(resolveFeaturedImage(post.featured_image, post.content));

  return {
    // meta_title is the full SEO title — skip the "· Famies" template for it.
    title: post.meta_title ? { absolute: post.meta_title } : post.title,
    description,
    alternates: { canonical: post.slug },
    openGraph: {
      title,
      description,
      url: post.slug,
      type: 'article',
      locale: 'sv_SE',
      siteName: SITE_NAME,
      publishedTime: publishedDate(post),
      modifiedTime: post.updated_at || publishedDate(post),
      section: post.category || undefined,
      images: image ? [{ url: image, alt: title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

function buildSchema(post, image) {
  if (post.custom_schema?.trim()) {
    try {
      return JSON.stringify(JSON.parse(post.custom_schema));
    } catch {
      // Invalid custom JSON-LD — fall back to the default schema.
    }
  }
  const url = absoluteUrl(post.slug);
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: post.meta_title || post.title,
        description: post.meta_description || post.excerpt || '',
        image: image || undefined,
        inLanguage: 'sv-SE',
        articleSection: post.category || undefined,
        author: { '@type': 'Person', name: post.author_name || SITE_NAME },
        publisher: { '@id': `${SITE_URL}/#organization` },
        mainEntityOfPage: url,
        datePublished: publishedDate(post),
        dateModified: post.updated_at || publishedDate(post),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Hem', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Inspiration', item: absoluteUrl(BLOG_PATH) },
          { '@type': 'ListItem', position: 3, name: post.title, item: url },
        ],
      },
    ],
  });
}

export default async function PostPage({ params }) {
  const post = await loadPost(params);
  if (!post) notFound();

  const [nofollowRules, allPosts, siteContent, views] = await Promise.all([
    getNofollowRules(),
    getLivePosts(),
    getSiteContent(),
    getViewCounts([post.slug]),
  ]);

  const others = allPosts.filter((p) => p.id !== post.id);
  const sameCategory = others.filter((p) => p.category && p.category === post.category);
  const related = [...sameCategory, ...others.filter((p) => !sameCategory.includes(p))].slice(0, 3);

  const processed = applyNofollowRules(
    classifyTableBadges(dedupeProductHeadings(post.content || '')),
    nofollowRules
  );
  const { html, toc } = addHeadingIds(processed);
  const [intro, body] = splitAtFirstH2(html);

  const featured = resolveFeaturedImage(post.featured_image, post.content);
  // Skip the hero image when the article body already opens with it.
  const showHero = !!post.featured_image && !(post.content || '').includes(post.featured_image);

  const date = publishedDate(post);
  const viewCount = views[post.slug] ?? post.views ?? 0;
  const fullPage = post.layout === 'full-page';
  const settings = siteContent.settings;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildSchema(post, toAbsoluteImage(featured)) }} />
      {post.custom_css && <style data-post-custom-css="" dangerouslySetInnerHTML={{ __html: post.custom_css }} />}
      <ViewTracker slug={post.slug} />

      <div className="min-h-screen pt-28 md:pt-32 pb-20 section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex gap-12 items-start ${fullPage ? 'justify-center' : ''}`}>
            <article className={`min-w-0 flex-1 ${fullPage ? 'max-w-4xl mx-auto' : 'max-w-3xl'}`}>
              {/* Breadcrumb */}
              <nav aria-label="Brödsmulor" className="flex items-center gap-2 text-sm text-ink-500 mb-6 overflow-x-auto whitespace-nowrap">
                <Link href="/" className="hover:text-primary transition-colors">Hem</Link>
                <ChevronRight size={14} />
                <Link href={BLOG_PATH} className="hover:text-primary transition-colors">Inspiration</Link>
                {post.category && (
                  <>
                    <ChevronRight size={14} />
                    <Link
                      href={`${BLOG_PATH}?category=${encodeURIComponent(post.category)}`}
                      className="text-primary-700 font-bold bg-primary/10 px-3 py-1 rounded-full hover:bg-primary/20 transition-colors"
                    >
                      {post.category}
                    </Link>
                  </>
                )}
              </nav>

              <h1 className="text-3xl md:text-5xl font-black text-ink-900 dark:text-white leading-[1.1] tracking-tight mb-6">
                {post.title}
              </h1>

              {/* Author + meta */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-500 font-medium mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-primary to-secondary-400 flex items-center justify-center text-white font-black shadow-soft">
                    {(post.author_name || 'F').charAt(0).toUpperCase()}
                  </div>
                  <div className="leading-tight">
                    <p className="font-bold text-ink-900 dark:text-white">{post.author_name || 'Famies redaktion'}</p>
                    {post.author_role && <p className="text-xs">{post.author_role}</p>}
                  </div>
                </div>
                {date && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={16} />
                    <time dateTime={date}>{new Date(date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })}</time>
                  </span>
                )}
                <span className="flex items-center gap-1.5"><Clock size={16} /> {post.read_time || '5 min'} läsning</span>
                {viewCount > 0 && <span className="flex items-center gap-1.5"><Eye size={16} /> {viewCount.toLocaleString('sv-SE')} visningar</span>}
              </div>

              {showHero && (
                <div className="relative w-full aspect-video rounded-[2rem] overflow-hidden mb-10 shadow-soft border border-ink-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover" fetchPriority="high" />
                </div>
              )}

              <div className="rich-content">
                {intro && <div dangerouslySetInnerHTML={{ __html: intro }} />}
                {toc.length >= 2 && <TableOfContents items={toc} />}
                {body && <div dangerouslySetInnerHTML={{ __html: body }} />}
              </div>

              <div className="mt-14 pt-8 border-t border-ink-100/70 flex flex-wrap items-center justify-between gap-4">
                <Link href={BLOG_PATH} className="text-sm font-bold text-ink-500 hover:text-primary transition-colors">
                  ← Fler artiklar
                </Link>
                <ShareButton title={post.title} url={absoluteUrl(post.slug)} />
              </div>

              <RelatedPosts posts={related} />
            </article>

            {!fullPage && (
              <ArticleSidebar
                posts={others}
                appStoreUrl={setting(settings, 'app_store_url', 'https://apps.apple.com/se/app/famies/id6450005701')}
                googlePlayUrl={setting(settings, 'google_play_url', 'https://play.google.com/store/apps/details?id=com.famapdirectory.apps')}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
