'use client';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ScrollToTop from '@/components/ScrollToTop';
import ProgressBar from '@/components/ProgressBar';
import BackgroundBlobs from '@/components/BackgroundBlobs';

/**
 * Decides which site chrome a route gets:
 *   /admin/*                → none (the admin panel has its own shell)
 *   /  in Coming Soon mode  → none (the landing covers the full viewport)
 *   everything else         → blobs, progress bar, navbar, footer, scroll-to-top
 */
export default function LayoutShell({ children, comingSoon, menus, siteContent }) {
  const pathname = usePathname() || '/';

  if (pathname.startsWith('/admin')) return children;
  if (comingSoon && pathname === '/') return <main className="min-h-screen relative">{children}</main>;

  return (
    <>
      <BackgroundBlobs />
      <ProgressBar />
      <Navbar links={menus.header} />
      <main className="min-h-screen relative">{children}</main>
      <Footer menus={menus} siteContent={siteContent} />
      <ScrollToTop />
    </>
  );
}
