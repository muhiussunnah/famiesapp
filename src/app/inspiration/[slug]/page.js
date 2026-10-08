import { permanentRedirect } from 'next/navigation';

/**
 * Articles used to live at /inspiration/<slug>; they now live at /<slug>
 * (same structure as mushroomidentifiers.com). Old links and indexed
 * URLs get a permanent (308) redirect.
 */
export default async function LegacyArticleRedirect({ params }) {
  const { slug } = await params;
  permanentRedirect(`/${encodeURIComponent(decodeURIComponent(slug))}`);
}
