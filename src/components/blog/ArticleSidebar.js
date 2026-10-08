import Link from 'next/link';
import { Clock, Download, Sparkles } from 'lucide-react';
import { BLOG_PATH } from '@/lib/site';

/**
 * Sticky article sidebar: latest articles, categories and an app CTA.
 * `posts` = live posts (list fields), already excluding the current one.
 */
export default function ArticleSidebar({ posts = [], appStoreUrl, googlePlayUrl }) {
  const recent = posts.slice(0, 5);
  const counts = {};
  for (const p of posts) if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
  const categories = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <aside className="hidden lg:block w-[340px] shrink-0">
      <div className="sticky top-28 space-y-6">
        {recent.length > 0 && (
          <div className="glass rounded-[2rem] p-6 shadow-soft">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1.5 h-7 bg-primary rounded-full" />
              <h2 className="font-black text-lg text-ink-900 dark:text-white">Senaste artiklar</h2>
            </div>
            <div className="space-y-5">
              {recent.map((item) => (
                <Link href={item.slug} key={item.id} className="flex gap-4 group">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-gradient-to-br from-primary/20 to-secondary/50">
                    {item.featured_image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.featured_image} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    )}
                  </div>
                  <div className="flex flex-col justify-center min-w-0">
                    <h3 className="font-bold text-sm text-ink-900 dark:text-white line-clamp-2 group-hover:text-primary transition-colors leading-snug mb-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-ink-500 font-medium flex items-center gap-1">
                      <Clock size={12} /> {item.read_time || '5 min'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {categories.length > 0 && (
          <div className="glass rounded-[2rem] p-6 shadow-soft">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1.5 h-7 bg-secondary-500 rounded-full" />
              <h2 className="font-black text-lg text-ink-900 dark:text-white">Kategorier</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(([name, n]) => (
                <Link
                  key={name}
                  href={`${BLOG_PATH}?category=${encodeURIComponent(name)}`}
                  className="px-3 py-1.5 rounded-full bg-white/70 border border-ink-100 text-xs font-bold text-ink-700 hover:border-primary hover:text-primary transition-colors"
                >
                  {name} <span className="text-ink-300">{n}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-[2rem] p-7 bg-gradient-to-br from-primary to-primary-500 text-white shadow-pink relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/20 blur-2xl" />
          <Sparkles size={22} className="mb-3" />
          <p className="text-xl font-black leading-tight mb-2">Hitta fler familjeaktiviteter nära dig</p>
          <p className="text-sm text-white/85 mb-5">Ladda ner Famies, gratis för iPhone och Android.</p>
          <div className="flex flex-col gap-2">
            <a href={appStoreUrl} target="_blank" rel="noopener noreferrer" className="press flex items-center justify-center gap-2 rounded-xl bg-white text-ink-900 font-bold text-sm py-2.5">
              <Download size={16} /> App Store
            </a>
            <a href={googlePlayUrl} target="_blank" rel="noopener noreferrer" className="press flex items-center justify-center gap-2 rounded-xl bg-ink-900 text-white font-bold text-sm py-2.5">
              <Download size={16} /> Google Play
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
