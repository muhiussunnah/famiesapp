import ComingSoon from "@/components/ComingSoon";
import HomeContent from "@/components/HomeContent";
import { getSiteContent, isComingSoon, setting } from "@/lib/site-content";
import { getHomepageBlocks } from "@/lib/homepage-blocks";
import { getLivePosts } from "@/lib/blog";
import { HOMEPAGE_TEXT_DEFAULTS, homepageTextFromSettings } from "@/lib/homepage-text";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Admin edits also refresh it instantly via revalidatePath().
export const revalidate = 60;

/** Title and description from /admin/homepage → Homepage text → Google (SEO). */
export async function generateMetadata() {
  const { settings } = await getSiteContent();
  const { seo } = homepageTextFromSettings(settings);
  const title = seo.title.trim() || HOMEPAGE_TEXT_DEFAULTS.seo.title;
  const description = seo.description.trim() || HOMEPAGE_TEXT_DEFAULTS.seo.description;

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: '/',
      types: { 'application/rss+xml': [{ url: '/feed.xml', title: 'Famies Inspiration' }] },
    },
    // Page-level openGraph/twitter replace the layout's, so they are complete here.
    openGraph: {
      title,
      description,
      url: SITE_URL,
      siteName: SITE_NAME,
      locale: 'sv_SE',
      type: 'website',
      images: [{ url: '/logo-black.webp', width: 512, height: 512, alt: 'Famies' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/logo-black.webp'],
    },
  };
}

/**
 * Homepage. Shows the Coming Soon landing while "Coming Soon mode" is on
 * (admin Dashboard switch, or LIVE = false in src/lib/siteConfig.js),
 * otherwise the full site. Every text on both comes from
 * /admin/homepage → Homepage text; the homepage blocks and the latest
 * articles are added below.
 */
export default async function Home() {
  const { settings } = await getSiteContent();
  const text = homepageTextFromSettings(settings);
  const appStoreUrl = setting(settings, 'app_store_url') || undefined;
  const googlePlayUrl = setting(settings, 'google_play_url') || undefined;

  if (isComingSoon(settings)) {
    return <ComingSoon appStoreUrl={appStoreUrl} googlePlayUrl={googlePlayUrl} text={text.comingSoon} />;
  }

  const [blocks, posts] = await Promise.all([getHomepageBlocks(), getLivePosts(9)]);

  return (
    <HomeContent
      text={text}
      blocks={blocks}
      posts={posts}
      appStoreUrl={appStoreUrl}
      googlePlayUrl={googlePlayUrl}
    />
  );
}
