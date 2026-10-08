'use client';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Search,
  Clock,
  ChevronRight,
  ChevronLeft,
  Tag,
  ArrowRight,
  BookOpen,
  Calendar,
  Star,
} from 'lucide-react';
import { CATEGORIES } from '@/lib/site';

const ARTICLES_PER_PAGE = 9; // 3x3 below the featured hero
const ALL = 'Alla';

const postDate = (a) => a.published_at || a.scheduled_at || a.created_at;

/**
 * Inspiration (blog) listing. Articles are loaded on the server and passed
 * in, so the page is fully indexable; search / category / paging run here.
 */
export default function BlogPageClient({ articles = [], initialCategory = ALL }) {
  const startCategory = [ALL, ...CATEGORIES].includes(initialCategory) ? initialCategory : ALL;

  const [searchInput, setSearchInput] = useState('');
  const [activeCategory, setActiveCategory] = useState(startCategory);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState({ query: '', category: startCategory });

  // Only offer categories that actually have articles (plus "Alla").
  const categories = useMemo(() => {
    const used = new Set(articles.map((a) => a.category));
    return [ALL, ...CATEGORIES.filter((c) => used.has(c))];
  }, [articles]);

  const filtered = useMemo(() => {
    const q = activeFilters.query.toLowerCase();
    return articles.filter((a) => {
      const matchQ =
        !q ||
        a.title?.toLowerCase().includes(q) ||
        (a.excerpt || '').toLowerCase().includes(q);
      const matchCat = activeFilters.category === ALL || a.category === activeFilters.category;
      return matchQ && matchCat;
    });
  }, [articles, activeFilters]);

  // Featured = newest article, shown only on page 1 without filters.
  const noFilters = activeFilters.query === '' && activeFilters.category === ALL;
  const featured = noFilters && currentPage === 1 ? articles[0] : null;

  const gridSource = featured ? filtered.filter((a) => a.id !== featured.id) : filtered;

  const totalPages = Math.max(1, Math.ceil(gridSource.length / ARTICLES_PER_PAGE));
  const pageItems = gridSource.slice(
    (currentPage - 1) * ARTICLES_PER_PAGE,
    currentPage * ARTICLES_PER_PAGE
  );

  const applyFilters = (category = activeCategory) => {
    setActiveFilters({ query: searchInput, category });
    setCurrentPage(1);
  };

  const handlePage = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 200, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    if (totalPages <= 6) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, 4, '...', totalPages];
    if (currentPage >= totalPages - 2)
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden pb-24 section selection:bg-primary selection:text-white">
      {/* HERO */}
      <section className="relative z-10 pt-32 md:pt-36 pb-10 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full glass shadow-soft">
            <BookOpen size={14} className="text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-100">
              Famies Magasinet
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-ink-900 dark:text-white mb-5 leading-[1.02]">
            Tips, guider & <span className="text-brand-gradient">familjeidéer.</span>
          </h1>

          <p className="text-lg md:text-xl text-ink-500 dark:text-ink-300 font-medium max-w-2xl mx-auto">
            Riktiga tips från riktiga familjer. Plocka upp något nytt att göra,
            eller något nytt att tänka på.
          </p>
        </motion.div>
      </section>

      <div className="relative z-10 px-4 max-w-7xl mx-auto">
        {/* SEARCH + FILTER BAR */}
        <div className="glass rounded-3xl p-4 md:p-5 shadow-soft mb-6">
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
            <div className="relative flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none"
                size={18}
              />
              <input
                type="text"
                placeholder="Sök artiklar efter titel eller ämne..."
                aria-label="Sök artiklar"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="w-full bg-white/70 dark:bg-ink-100/5 border border-ink-100/70 dark:border-ink-700/50 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 text-ink-900 dark:text-white placeholder:text-ink-300"
              />
            </div>

            <div className="relative">
              <Tag
                className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none"
                size={16}
              />
              <select
                value={activeCategory}
                aria-label="Kategori"
                onChange={(e) => {
                  setActiveCategory(e.target.value);
                  applyFilters(e.target.value);
                }}
                className="w-full appearance-none bg-white/70 dark:bg-ink-100/5 border border-ink-100/70 dark:border-ink-700/50 rounded-2xl pl-11 pr-10 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 text-ink-900 dark:text-white font-medium cursor-pointer md:min-w-[220px]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronRight
                className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-ink-300 pointer-events-none"
                size={16}
              />
            </div>

            <button
              onClick={() => applyFilters()}
              className="press flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-extrabold text-sm shadow-pink hover:shadow-glow-pink transition-all whitespace-nowrap"
            >
              <Search size={16} /> Sök
            </button>
          </div>
        </div>

        {/* Results count */}
        {filtered.length > 0 && (
          <p className="text-sm text-ink-500 dark:text-ink-300 mb-8 px-1">
            Visar{' '}
            <strong className="text-ink-900 dark:text-white">{pageItems.length + (featured ? 1 : 0)}</strong>{' '}
            av <strong className="text-ink-900 dark:text-white">{filtered.length}</strong> artiklar
          </p>
        )}

        {filtered.length === 0 ? (
          <EmptyState hasFilters={!noFilters} />
        ) : (
          <>
            {featured && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="mb-10"
              >
                <FeaturedCard article={featured} />
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="wait">
                {pageItems.map((article, index) => (
                  <motion.div
                    key={article.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ delay: (index % 9) * 0.05, duration: 0.45 }}
                  >
                    <ArticleCard article={article} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {totalPages > 1 && (
              <nav aria-label="Sidor" className="flex items-center justify-center gap-2 mt-16 flex-wrap">
                <button
                  onClick={() => handlePage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="press flex items-center gap-1.5 px-4 py-2.5 rounded-xl glass shadow-soft text-sm font-bold text-ink-900 dark:text-white disabled:opacity-30 transition-all"
                >
                  <ChevronLeft size={16} /> Föregående
                </button>

                {getPageNumbers().map((page, i) =>
                  page === '...' ? (
                    <span key={`e-${i}`} className="w-10 h-10 flex items-center justify-center text-ink-300">
                      …
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePage(page)}
                      aria-current={currentPage === page ? 'page' : undefined}
                      className={`press w-10 h-10 rounded-xl text-sm font-black transition-all ${
                        currentPage === page
                          ? 'bg-primary text-white shadow-pink'
                          : 'glass text-ink-900 dark:text-white hover:-translate-y-0.5'
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  onClick={() => handlePage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="press flex items-center gap-1.5 px-4 py-2.5 rounded-xl glass shadow-soft text-sm font-bold text-ink-900 dark:text-white disabled:opacity-30 transition-all"
                >
                  Nästa <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatDate(article, opts) {
  const d = postDate(article);
  return d ? new Date(d).toLocaleDateString('sv-SE', opts) : '';
}

/* ───────── FEATURED CARD (full width, 2 columns on md+) ───────── */
function FeaturedCard({ article }) {
  const date = formatDate(article, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Link
      href={article.slug}
      className="group relative grid md:grid-cols-[1.1fr_1fr] glass rounded-[2rem] md:rounded-[2.2rem] overflow-hidden shadow-soft hover:shadow-pink transition-all duration-500 hover:-translate-y-1"
    >
      <div className="absolute top-5 left-5 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-[10px] font-black uppercase tracking-wider shadow-pink">
        <Star size={12} className="fill-current" /> Senaste
      </div>

      <div className="relative h-64 md:h-[26rem] overflow-hidden">
        {article.featured_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.featured_image}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-brand-gradient-soft flex items-center justify-center">
            <BookOpen size={48} className="text-primary/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/30 via-transparent to-transparent pointer-events-none" />
      </div>

      <div className="p-7 md:p-10 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold">
            {article.category || 'Artikel'}
          </span>
        </div>

        <h2 className="text-3xl md:text-4xl font-black text-ink-900 dark:text-white leading-tight mb-4 group-hover:text-primary transition-colors">
          {article.title}
        </h2>

        <p className="text-ink-500 dark:text-ink-300 text-base leading-relaxed mb-6 line-clamp-3">
          {article.excerpt}
        </p>

        <div className="flex items-center gap-4 text-xs text-ink-500 dark:text-ink-300 font-semibold mb-6">
          <span className="flex items-center gap-1">
            <Clock size={13} /> {article.read_time || '5 min'}
          </span>
          {date && (
            <span className="flex items-center gap-1">
              <Calendar size={13} /> {date}
            </span>
          )}
        </div>

        <span className="inline-flex items-center gap-2 text-primary font-bold text-sm group-hover:gap-3 transition-all">
          Läs artikeln <ArrowRight size={16} />
        </span>
      </div>
    </Link>
  );
}

/* ───────── GRID ARTICLE CARD ───────── */
function ArticleCard({ article }) {
  const date = formatDate(article, { day: 'numeric', month: 'short' });

  return (
    <Link
      href={article.slug}
      className="group relative glass rounded-3xl overflow-hidden shadow-soft h-full flex flex-col hover:-translate-y-1 hover:shadow-pink transition-all duration-500"
    >
      <div className="relative h-52 overflow-hidden">
        {article.featured_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.featured_image}
            alt={article.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 bg-brand-gradient-soft flex items-center justify-center">
            <BookOpen size={40} className="text-primary/40" />
          </div>
        )}

        <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-[10px] font-black uppercase tracking-wider text-ink-900 shadow-soft">
          {article.category || 'Artikel'}
        </span>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-lg font-extrabold text-ink-900 dark:text-white leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {article.title}
        </h3>

        <p className="text-ink-500 dark:text-ink-300 text-sm leading-relaxed line-clamp-2 mb-4 flex-1">
          {article.excerpt}
        </p>

        <div className="flex items-center justify-between text-xs pt-3 border-t border-ink-100/70 dark:border-ink-700/50 text-ink-500 dark:text-ink-300 font-semibold">
          <span className="flex items-center gap-1">
            <Clock size={12} /> {article.read_time || '5 min'}
          </span>
          <span>{date}</span>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-sm font-bold text-primary group-hover:gap-2.5 transition-all">
          Läs mer <ArrowRight size={14} />
        </div>
      </div>
    </Link>
  );
}

/* ───────── EMPTY STATE ───────── */
function EmptyState({ hasFilters }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-3xl glass flex items-center justify-center mb-5 shadow-soft">
        <BookOpen className="text-primary" size={28} />
      </div>
      <h3 className="text-2xl md:text-3xl font-black text-ink-900 dark:text-white mb-3">
        {hasFilters ? 'Inga artiklar matchade' : 'Artiklar är på väg'}
      </h3>
      <p className="text-ink-500 dark:text-ink-300 max-w-md leading-relaxed">
        {hasFilters
          ? 'Prova en annan kategori, sökterm eller rensa filtren.'
          : 'Våra redaktörer skriver nytt innehåll varje vecka, titta in snart igen.'}
      </p>
    </div>
  );
}
