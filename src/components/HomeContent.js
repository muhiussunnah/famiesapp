import Hero from "@/components/Hero";
import PainPoints from "@/components/PainPoints";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import SocialProof from "@/components/SocialProof";
import DownloadSection from "@/components/DownloadSection";
import BlogSlider from "@/components/BlogSlider";
import Newsletter from "@/components/Newsletter";
import HomepageBlocks from "@/components/HomepageBlocks";
import { HOMEPAGE_TEXT_DEFAULTS } from "@/lib/homepage-text";

/**
 * The full Famies home page (shown when Coming Soon mode is off).
 * `text` holds every heading and text (/admin/homepage → Homepage text,
 * including which sections are shown). `blocks` are the extra admin-built
 * sections; they sit between Features and the reviews.
 */
export default function HomeContent({
  text = HOMEPAGE_TEXT_DEFAULTS,
  blocks = [],
  posts = [],
  appStoreUrl,
  googlePlayUrl,
}) {
  const links = { appStoreUrl, googlePlayUrl };
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between">
      <Hero text={text.hero} buttons={text.buttons} {...links} />
      {text.pain.show && <section id="pain"><PainPoints text={text.pain} /></section>}
      {text.how.show && <section id="how"><HowItWorks text={text.how} /></section>}
      {text.features.show && <section id="features"><Features text={text.features} /></section>}
      {blocks.length > 0 && (
        <section id="more" className="w-full"><HomepageBlocks blocks={blocks} /></section>
      )}
      {text.reviews.show && <section id="reviews"><SocialProof text={text.reviews} /></section>}
      {text.download.show && <DownloadSection text={text.download} buttons={text.buttons} {...links} />}
      {text.articles.show && <BlogSlider posts={posts} text={text.articles} />}
      {text.newsletter.show && <Newsletter text={text.newsletter} />}
    </div>
  );
}
