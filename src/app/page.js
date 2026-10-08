import ComingSoon from "@/components/ComingSoon";
import HomeContent from "@/components/HomeContent";
import { getSiteContent, isComingSoon, setting } from "@/lib/site-content";
import { getHomepageBlocks } from "@/lib/homepage-blocks";
import { getLivePosts } from "@/lib/blog";

// Admin edits also refresh it instantly via revalidatePath().
export const revalidate = 60;

export const metadata = {
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': [{ url: '/feed.xml', title: 'Famies Inspiration' }] },
  },
};

/**
 * Homepage. Shows the Coming Soon landing while "Coming Soon mode" is on
 * (admin Dashboard switch, or LIVE = false in src/lib/siteConfig.js),
 * otherwise the full site with admin-managed hero text, homepage blocks
 * and the latest articles.
 */
export default async function Home() {
  const { settings } = await getSiteContent();

  if (isComingSoon(settings)) {
    return (
      <ComingSoon
        appStoreUrl={setting(settings, 'app_store_url') || undefined}
        googlePlayUrl={setting(settings, 'google_play_url') || undefined}
      />
    );
  }

  const [blocks, posts] = await Promise.all([getHomepageBlocks(), getLivePosts(9)]);

  return (
    <HomeContent
      hero={{
        eyebrow: setting(settings, 'hero_eyebrow'),
        title: setting(settings, 'hero_title'),
        subtitle: setting(settings, 'hero_subtitle'),
        appStoreUrl: setting(settings, 'app_store_url'),
        googlePlayUrl: setting(settings, 'google_play_url'),
      }}
      blocks={blocks}
      posts={posts}
    />
  );
}
