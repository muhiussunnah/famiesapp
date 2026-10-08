'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, FileText, Home as HomeIcon, Trophy, ShieldCheck, Globe, Code,
  ExternalLink, ListOrdered, Palette, Droplet, Paintbrush, ChevronRight, Menu, X,
  LogOut, ArrowUpRight,
} from 'lucide-react';
import { AdminModalProvider } from '@/components/admin/AdminModal';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

// Same sections as the mushroomidentifiers.com admin, minus Subscriptions
// and Adify (Famies has neither paid plans nor ads).
export const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/pages', label: 'Pages', icon: FileText },
  { href: '/admin/homepage', label: 'Homepage', icon: HomeIcon },
  { href: '/admin/rank-tracker', label: 'Rank Tracker', icon: Trophy },
  { href: '/admin/seo-health', label: 'SEO Health', icon: ShieldCheck },
  { href: '/admin/indexing-report', label: 'Indexing Report', icon: Globe },
  { href: '/admin/header-scripts', label: 'Header Scripts', icon: Code },
  { href: '/admin/external-links', label: 'External Links', icon: ExternalLink },
  { href: '/admin/menus', label: 'Menus', icon: ListOrdered },
  { href: '/admin/footer-settings', label: 'Footer Content', icon: Palette },
  { href: '/admin/theme', label: 'Theme Colors', icon: Droplet },
  { href: '/admin/custom-css', label: 'Custom CSS', icon: Paintbrush },
];

function NavLinks({ isActive, onNavigate }) {
  return ADMIN_NAV.map(({ href, label, icon: Icon }) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-colors',
          active ? 'bg-primary/15 text-primary-700' : 'text-ink-500 hover:text-ink-900 hover:bg-ink-50'
        )}
      >
        <Icon className="w-[18px] h-[18px]" />
        {label}
        {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
      </Link>
    );
  });
}

export default function AdminShell({ children, userEmail }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const isActive = (href) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const brand = (
    <Link href="/admin" className="flex items-center gap-2.5">
      <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-soft">
        <Image src="/logo-black.webp" alt="Famies" fill sizes="36px" className="object-cover" />
      </div>
      <div className="leading-none">
        <span className="text-[16px] font-black tracking-tight text-ink-900">famies</span>
        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary-700 font-bold align-middle">ADMIN</span>
      </div>
    </Link>
  );

  return (
    <AdminModalProvider>
      <div className="min-h-screen flex bg-[#f6f5f9] text-ink-900">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex flex-col w-[260px] shrink-0 border-r border-ink-100 bg-white sticky top-0 h-screen">
          <div className="px-5 py-5 border-b border-ink-100">{brand}</div>
          <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-300">Menu</p>
            <NavLinks isActive={isActive} />
          </nav>
          <div className="px-4 py-4 border-t border-ink-100">
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary-700 flex items-center justify-center text-xs font-black">
                {(userEmail?.[0] || 'A').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold truncate">{userEmail}</p>
                <p className="text-[10px] font-semibold text-ink-300">Administrator</p>
              </div>
            </div>
            <Link href="/" target="_blank" className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold text-ink-500 hover:text-ink-900 hover:bg-ink-50">
              <ArrowUpRight className="w-3.5 h-3.5" /> View website
            </Link>
            <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold text-red-500 hover:bg-red-50">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </aside>

        {/* Mobile header */}
        <div className="lg:hidden fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 h-14 border-b border-ink-100 bg-white/95 backdrop-blur">
          {brand}
          <button onClick={() => setOpen(!open)} aria-label="Menu" className="p-1.5 text-ink-500">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <div className="lg:hidden fixed inset-0 z-40 pt-14 bg-white overflow-y-auto">
            <nav className="px-4 py-4 space-y-1">
              <NavLinks isActive={isActive} onNavigate={() => setOpen(false)} />
              <div className="pt-4 mt-4 border-t border-ink-100 space-y-1">
                <Link href="/" className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-ink-500">
                  <ArrowUpRight className="w-4 h-4" /> View website
                </Link>
                <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-red-500">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            </nav>
          </div>
        )}

        <main className="flex-1 min-w-0 pt-14 lg:pt-0">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">{children}</div>
        </main>
      </div>
    </AdminModalProvider>
  );
}
