import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/Providers";
import LayoutShell from "@/components/LayoutShell";
import { Toaster } from 'react-hot-toast';
import { getSiteContent, isComingSoon } from "@/lib/site-content";
import { getMenus } from "@/lib/menus";
import { getEnabledScripts, groupByPosition } from "@/lib/site-scripts";
import { renderHeadScript, renderBodySnippet, splitHeadSnippets } from "@/lib/render-head-script";
import { buildThemeCSS } from "@/lib/theme-colors";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { HOMEPAGE_TEXT_KEY } from "@/lib/homepage-text";

// Pages are prerendered at build time without the database (it is not
// reachable during the Docker build), so re-render them at most every 60s
// to pick up menus, footer texts, header scripts and theme from the DB.
export const revalidate = 60;

// Satoshi, served from the local .otf files
const satoshi = localFont({
  src: [
    {
      path: './fonts/Satoshi-Light.otf',
      weight: '300',
      style: 'normal',
    },
    {
      path: './fonts/Satoshi-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/Satoshi-Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/Satoshi-Bold.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/Satoshi-Black.otf',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: "--font-satoshi", // used by Tailwind's font-sans
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Famies – Familjeaktiviteter nära dig',
    template: '%s · Famies',
  },
  description:
    'Vad tipsar andra familjer nära dig om? Upptäck aktiviteter, event och nya favoriter. 💛',
  keywords: [
    'familjeapp', 'aktiviteter för barn', 'familjeevenemang Stockholm',
    'vad göra med barn', 'utflykter barn', 'familjeliv', 'föräldra-app', 'Famies',
  ],
  icons: { icon: '/logo-black.webp', apple: '/logo-black.webp' },
  // No canonical here: it would be inherited by every page. Pages set their own.
  alternates: {
    types: { 'application/rss+xml': [{ url: '/feed.xml', title: 'Famies Inspiration' }] },
  },
  openGraph: {
    title: 'Famies – Familjeaktiviteter nära dig',
    description:
      'Vad tipsar andra familjer nära dig om? Upptäck aktiviteter, event och nya favoriter. 💛',
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'sv_SE',
    type: 'website',
    images: [{ url: '/logo-black.webp', width: 512, height: 512, alt: 'Famies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Famies – Familjeaktiviteter nära dig',
    description:
      'Vad tipsar andra familjer nära dig om? Upptäck aktiviteter, event och nya favoriter. 💛',
    images: ['/logo-black.webp'],
  },
};

const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/logo-black.webp`,
      email: 'support@famies.app',
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      inLanguage: 'sv-SE',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
};

export default async function RootLayout({ children }) {
  const [siteContent, menus, scripts] = await Promise.all([
    getSiteContent(),   // texts, Coming Soon switch, theme, custom CSS, footer
    getMenus(),         // header + footer menus
    getEnabledScripts(), // admin-managed GA / verification / pixels
  ]);
  const { head, bodyStart, bodyEnd } = groupByPosition(scripts);
  const themeCSS = buildThemeCSS(siteContent.settings);
  const customCSS = siteContent.settings.global_custom_css;
  // The homepage text is only read by the homepage itself; keep the JSON
  // out of the client payload of every other page.
  const { [HOMEPAGE_TEXT_KEY]: _homepageText, ...shellSettings } = siteContent.settings;
  const shellContent = { ...siteContent, settings: shellSettings };

  return (
    <html lang="sv" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }}
        />
        {/* Admin-managed <head> snippets, each rendered as a real head element */}
        {head.flatMap((s) =>
          splitHeadSnippets(s.code).map((code, i) => renderHeadScript(code, `${s.id}-${i}`))
        )}
        {/* Admin theme colors, then global custom CSS last so it wins */}
        {themeCSS && <style data-site-theme="" dangerouslySetInnerHTML={{ __html: themeCSS }} />}
        {customCSS && <style data-site-custom-css="" dangerouslySetInnerHTML={{ __html: customCSS }} />}
      </head>
      <body className={`${satoshi.variable} font-sans antialiased relative`}>
        {bodyStart.flatMap((s) => renderBodySnippet(s.code, s.id))}
        <Providers>
          <LayoutShell
            comingSoon={isComingSoon(siteContent.settings)}
            menus={menus}
            siteContent={shellContent}
          >
            {children}
          </LayoutShell>

          {/* Glossy toast */}
          <Toaster
            position="top-center"
            reverseOrder={false}
            toastOptions={{
              className: '',
              style: {
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '16px',
                color: '#333',
                borderRadius: '16px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                fontSize: '14px',
                fontWeight: '600',
              },
              success: {
                iconTheme: { primary: '#FF8FAF', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#ff4b4b', secondary: '#fff' },
              },
            }}
          />
        </Providers>
        {bodyEnd.flatMap((s) => renderBodySnippet(s.code, s.id))}
      </body>
    </html>
  );
}
