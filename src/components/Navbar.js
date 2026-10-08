'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Menu, X } from 'lucide-react';
import { DEFAULT_MENUS } from '@/lib/menus';

// Header links come from /admin/menus ("header"); these are the fallback.
export default function Navbar({ links = DEFAULT_MENUS.header }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (href) => pathname === href || (href !== '/' && pathname?.startsWith(href + '/'));

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-500 ease-in-out ${
        scrolled
          ? "glass h-20 shadow-soft"
          : "bg-transparent border-transparent h-24 md:h-28"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between items-center h-full">

          {/* Logo */}
          <div className="flex-shrink-0 transition-transform duration-300 hover:scale-105">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-2xl overflow-hidden flex items-center justify-center shadow-soft transition-all duration-300">
                <Image
                  src="/logo-black.webp"
                  alt="Famies logo"
                  width={48}
                  height={48}
                  className="object-cover w-full h-full"
                />
              </div>

              <span className="text-2xl md:text-[26px] font-black tracking-tight text-ink-900 dark:text-white leading-none pb-0.5">
                famies
              </span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden lg:flex space-x-8 items-center">
            {links.map((item) => (
              <Link
                key={item.id}
                href={item.url}
                target={item.target === '_blank' ? '_blank' : undefined}
                rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
                className={`text-lg font-medium transition-colors duration-300 hover:text-primary ${
                  isActive(item.url)
                    ? 'text-primary font-bold'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right Side Buttons */}
          <div className="flex items-center space-x-6">
            <Link
              href="/#download"
              className="press hidden md:flex items-center gap-2 text-white px-6 py-3 rounded-full font-bold transition-all duration-300 bg-primary hover:bg-primary-500 shadow-pink"
            >
              <Download size={18} />
              Ladda ner
            </Link>

            <button
              className="lg:hidden p-2 text-gray-900 dark:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Stäng meny' : 'Öppna meny'}
            >
               {mobileMenuOpen ? <X size={30} /> : <Menu size={30} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white dark:bg-black border-b border-gray-100 dark:border-gray-800 overflow-hidden shadow-xl"
          >
             <div className="flex flex-col p-6 space-y-4">
               {links.map((link) => (
                 <Link
                   key={link.id}
                   href={link.url}
                   target={link.target === '_blank' ? '_blank' : undefined}
                   onClick={() => setMobileMenuOpen(false)}
                   className="text-xl font-medium text-gray-900 dark:text-white hover:text-primary"
                 >
                   {link.label}
                 </Link>
               ))}
               <hr className="border-gray-100 dark:border-gray-800 my-2"/>
               <Link
                 href="/#download"
                 onClick={() => setMobileMenuOpen(false)}
                 className="text-primary font-bold text-xl flex items-center gap-2"
               >
                 <Download size={20} /> Ladda ner appen
               </Link>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
