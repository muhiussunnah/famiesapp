import Hero from "@/components/Hero";
import PainPoints from "@/components/PainPoints";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import SocialProof from "@/components/SocialProof";
import DownloadSection from "@/components/DownloadSection";
import BlogSlider from "@/components/BlogSlider";
import Newsletter from "@/components/Newsletter";
import HomepageBlocks from "@/components/HomepageBlocks";

/**
 * The full Famies home page (shown when Coming Soon mode is off).
 * `blocks` are the admin-managed sections from /admin/homepage; they sit
 * between Features and the reviews.
 */
export default function HomeContent({ hero, blocks = [], posts = [] }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between">
      <Hero {...hero} />
      <section id="pain"><PainPoints /></section>
      <section id="how"><HowItWorks /></section>
      <section id="features"><Features /></section>
      {blocks.length > 0 && (
        <section id="more" className="w-full"><HomepageBlocks blocks={blocks} /></section>
      )}
      <section id="reviews"><SocialProof /></section>
      <DownloadSection />
      <BlogSlider posts={posts} />
      <Newsletter />
    </div>
  );
}
