'use client';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Apple, Play, Mail } from 'lucide-react';
import { DEFAULT_MENUS } from '@/lib/menu-defaults';

// Built-in footer texts; every one can be overridden in /admin/footer-settings.
const DEFAULTS = {
  footer_description:
    'Byggd av föräldrar, för föräldrar. Få utvalda evenemang, tips och idéer, nära dig. Mindre skärmtid, mer familjetid.',
  contact_email: 'support@famies.app',
  app_store_url: 'https://apps.apple.com/se/app/famies/id6450005701',
  google_play_url: 'https://play.google.com/store/apps/details?id=com.famapdirectory.apps&hl=en',
  footer_explore_heading: 'Utforska',
  footer_company_heading: 'Support',
  footer_app_heading: 'Hämta appen',
  footer_app_text: 'Öppna Famies på din mobil, gratis, alltid.',
  copyright_text: '© {year} FAM MAP AB • Famies. All rights reserved.',
  footer_tagline: 'Gjort med ♥ i Stockholm',
};

// Shown until social links are managed in the admin.
const DEFAULT_SOCIALS = [
  {
    id: 'youtube',
    label: 'YouTube',
    href: 'https://www.youtube.com/@TheFamies',
    icon_svg:
      '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
  },
];

const SocialLink = ({ link }) => (
  <motion.a
    href={link.href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={link.label}
    title={link.label}
    whileHover={{ scale: 1.1, y: -3 }}
    style={link.bg_color ? { backgroundColor: link.bg_color, color: link.icon_color } : undefined}
    className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 hover:!text-primary [&_svg]:w-5 [&_svg]:h-5"
    dangerouslySetInnerHTML={{ __html: link.icon_svg }}
  />
);

function FooterLinks({ items }) {
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.url}
            target={item.target === '_blank' ? '_blank' : undefined}
            className="text-ink-500 dark:text-ink-300 hover:text-primary transition-colors text-sm"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Badges({ badges }) {
  if (!badges?.length) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      {badges.map((b) => (
        <a key={b.id} href={b.link_url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.image_url} alt={b.alt_text || ''} width={b.width} height={b.height || undefined} loading="lazy" />
        </a>
      ))}
    </div>
  );
}

export default function Footer({ menus = DEFAULT_MENUS, siteContent }) {
  const settings = { ...DEFAULTS };
  for (const [k, v] of Object.entries(siteContent?.settings || {})) {
    if (k in DEFAULTS && typeof v === 'string' && v.trim()) settings[k] = v;
  }
  const socials = siteContent?.socialLinks?.length ? siteContent.socialLinks : DEFAULT_SOCIALS;
  const badges = siteContent?.footerBadges || {};
  const copyright = settings.copyright_text.replace(/\{year\}/g, String(new Date().getFullYear()));

  return (
    <footer className="relative pt-20 pb-10 border-t border-ink-100/80 dark:border-ink-700/50 overflow-hidden section">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/30 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">

          {/* Brand + socials */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-6">
              <div className="relative w-11 h-11 rounded-2xl overflow-hidden shadow-soft">
                <Image
                  src="/logo-black.webp"
                  alt="Famies logo"
                  width={44}
                  height={44}
                  className="object-cover w-full h-full"
                />
              </div>
              <span className="text-2xl font-black text-ink-900 dark:text-white tracking-tight">Famies</span>
            </Link>
            <p className="text-ink-500 dark:text-ink-300 text-sm leading-relaxed mb-6">
              {settings.footer_description}
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              {socials.map((link) => <SocialLink key={link.id} link={link} />)}
            </div>
          </div>

          {/* Explore column */}
          <div>
            <h4 className="font-bold text-ink-900 dark:text-white mb-6">{settings.footer_explore_heading}</h4>
            <FooterLinks items={menus.footerExplore} />
            <Badges badges={badges.footerExplore} />
          </div>

          {/* Support column */}
          <div>
            <h4 className="font-bold text-ink-900 dark:text-white mb-6">{settings.footer_company_heading}</h4>
            <ul className="space-y-4 mb-4">
              <li>
                <a href={`mailto:${settings.contact_email}`} className="flex items-center gap-2 text-ink-500 dark:text-ink-300 hover:text-primary transition-colors text-sm font-medium">
                  <Mail size={16} />
                  {settings.contact_email}
                </a>
              </li>
            </ul>
            <FooterLinks items={menus.footerCompany} />
            <Badges badges={badges.footerCompany} />
          </div>

          {/* Get the App */}
          <div id="download-footer">
            <h4 className="font-bold text-ink-900 dark:text-white mb-6">{settings.footer_app_heading}</h4>
            <p className="text-ink-500 dark:text-ink-300 text-sm mb-4">
              {settings.footer_app_text}
            </p>
            <div className="flex flex-col gap-3">

              <a href={settings.app_store_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl hover:border-gray-400 dark:hover:border-gray-500 transition shadow-sm hover:shadow-md group">
                <Apple size={24} className="text-gray-900 dark:text-white group-hover:scale-110 transition-transform" />
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] uppercase opacity-60">Download on the</span>
                  <span className="text-sm font-bold">App Store</span>
                </div>
              </a>

              <a href={settings.google_play_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl hover:border-gray-400 dark:hover:border-gray-500 transition shadow-sm hover:shadow-md group">
                <Play size={22} className="ml-0.5 text-gray-900 dark:text-white group-hover:scale-110 transition-transform" />
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] uppercase opacity-60">Get it on</span>
                  <span className="text-sm font-bold">Google Play</span>
                </div>
              </a>

            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-ink-100/70 dark:border-ink-700/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-ink-500 dark:text-ink-300 text-sm">
            {copyright}
          </p>
          {menus.footerBottom?.length > 0 && (
            <div className="flex items-center gap-4">
              {menus.footerBottom.map((item) => (
                <Link key={item.id} href={item.url} className="text-ink-500 dark:text-ink-300 hover:text-primary text-xs">
                  {item.label}
                </Link>
              ))}
            </div>
          )}
          <p className="text-ink-500 dark:text-ink-300 text-xs">
            {settings.footer_tagline.split('♥').map((part, i) => (
              <span key={i}>{i > 0 && <span className="text-primary">♥</span>}{part}</span>
            ))}
          </p>
        </div>

      </div>
    </footer>
  );
}
