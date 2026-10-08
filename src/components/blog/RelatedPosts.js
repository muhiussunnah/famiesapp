import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BLOG_PATH } from '@/lib/site';

/** "Du kanske också gillar" — up to three cards, same category first. */
export default function RelatedPosts({ posts = [] }) {
  if (posts.length === 0) return null;

  return (
    <section className="mt-16 pt-12 border-t border-ink-100/70">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-ink-900 dark:text-white mb-1">Du kanske också gillar</h2>
          <p className="text-ink-500">Fler artiklar utvalda för dig.</p>
        </div>
        <Link
          href={BLOG_PATH}
          className="hidden md:inline-flex text-sm font-bold text-white bg-ink-900 px-5 py-2.5 rounded-full items-center gap-2 hover:opacity-80 transition-all"
        >
          Visa alla <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((item) => (
          <Link
            key={item.id}
            href={item.slug}
            className="group glass rounded-[2rem] overflow-hidden shadow-soft hover:shadow-pink hover:-translate-y-1 transition-all duration-500 flex flex-col"
          >
            <div className="relative h-44 overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/50">
              {item.featured_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.featured_image} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              )}
              {item.category && (
                <span className="absolute top-3 left-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-primary-700 shadow-soft">
                  {item.category}
                </span>
              )}
            </div>
            <div className="p-5 flex flex-col flex-1">
              <h3 className="font-extrabold text-lg text-ink-900 dark:text-white mb-2 line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              {item.excerpt && <p className="text-ink-500 text-sm line-clamp-2 mb-4 flex-1">{item.excerpt}</p>}
              <span className="text-primary font-extrabold text-sm inline-flex items-center gap-2 group-hover:gap-3 transition-all mt-auto">
                Läs mer <ArrowRight size={16} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
