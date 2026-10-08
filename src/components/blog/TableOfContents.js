'use client';
import { useEffect, useState } from 'react';
import { List, ChevronDown } from 'lucide-react';

/**
 * Collapsible "Innehåll" card placed after the article intro. Highlights
 * the section currently on screen. `items` = [{ id, text, level }].
 */
export default function TableOfContents({ items }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

  useEffect(() => {
    if (!items?.length) return;
    const headings = items.map((i) => document.getElementById(i.id)).filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: '-100px 0px -70% 0px' }
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  if (!items?.length) return null;
  const sections = items.filter((i) => i.level === 2).length;

  return (
    <nav aria-label="Innehåll" className="not-prose my-8 rounded-3xl glass shadow-soft border border-primary/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <span className="w-9 h-9 rounded-xl bg-primary/15 text-primary-700 flex items-center justify-center">
          <List size={18} />
        </span>
        <span className="font-black text-ink-900 dark:text-white">Innehåll</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-secondary/60 text-green-800">
          {sections || items.length} avsnitt
        </span>
        <ChevronDown size={18} className={`ml-auto text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ol className="px-5 pb-5 space-y-1.5 border-t border-ink-100/70 pt-4">
          {items.map((item) => (
            <li key={item.id} className={item.level === 3 ? 'pl-5' : ''}>
              <a
                href={`#${item.id}`}
                className={`block text-sm leading-snug py-1 transition-colors hover:text-primary ${
                  active === item.id ? 'text-primary font-bold' : item.level === 2 ? 'text-ink-900 font-semibold' : 'text-ink-500'
                }`}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}
