'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, Calendar, Clock, ChevronRight } from 'lucide-react';
import { formatText } from '@/components/FormattedText';
import { HOMEPAGE_TEXT_DEFAULTS } from '@/lib/homepage-text';

const formatDate = (post) =>
  new Date(post.published_at || post.scheduled_at || post.created_at).toLocaleDateString('sv-SE');

// `posts` are the latest live articles, loaded on the server by the homepage.
export default function BlogSlider({ posts = [], text = HOMEPAGE_TEXT_DEFAULTS.articles }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Slide logic
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  const visibleCards = isDesktop ? 3 : 1;
  const maxIndex = posts.length > visibleCards ? posts.length - visibleCards : 0;

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? maxIndex : prev - 1));
  };

  // Auto-play every 3.5 s, paused while hovered
  useEffect(() => {
    if (paused || posts.length <= 3) return;
    const id = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, 3500);
    return () => clearInterval(id);
  }, [paused, posts.length, maxIndex]);

  if (posts.length === 0) return null;

  return (
    <section
      className="py-20 md:py-28 overflow-hidden relative section"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            {text.eyebrow && (
              <span className="text-primary font-bold tracking-wider uppercase text-sm mb-2 block">{text.eyebrow}</span>
            )}
            {text.title && (
              <h2 className="text-4xl md:text-5xl font-black text-ink-900 dark:text-white leading-tight">
                {formatText(text.title)}
              </h2>
            )}
          </motion.div>

          {/* Controls */}
          <div className="hidden md:flex gap-3">
            <button onClick={prevSlide} className="p-4 rounded-full border border-gray-200 dark:border-gray-800 transition-all hover:bg-primary hover:text-white hover:border-primary active:scale-95 group">
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform"/>
            </button>
            <button onClick={nextSlide} className="p-4 rounded-full border border-gray-200 dark:border-gray-800 transition-all hover:bg-primary hover:text-white hover:border-primary active:scale-95 group">
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform"/>
            </button>
          </div>
        </div>

        {/* --- Slider Track --- */}
        <div className="overflow-hidden py-4 -mx-4 px-4">
          <motion.div 
            className="flex gap-6 md:gap-8"
            animate={{ 
              x: `-${currentIndex * (isDesktop ? 34.5 : 100)}%` 
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ width: '100%' }} 
          >
            {posts.map((post) => (
              <motion.div 
                key={post.id}
                className="
                  flex-shrink-0 
                  w-full 
                  md:w-[calc(33.333%-22px)] 
                  group
                "
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="bg-white dark:bg-gray-900 rounded-[2rem] overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 h-full flex flex-col">
                  
                  {/* Image */}
                  <div className="relative h-64 overflow-hidden">
                    {post.featured_image ? (
                      <img src={post.featured_image} alt={post.title} loading="lazy" className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/50" />
                    )}
                    <div className="absolute top-4 left-4 bg-white/95 dark:bg-black/95 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-primary shadow-lg">
                      {post.category || text.fallbackCategory}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-7 flex flex-col flex-grow">
                    <div className="flex items-center gap-4 text-xs text-gray-500 font-bold uppercase tracking-wide mb-4">
                      <span className="flex items-center gap-1.5"><Calendar size={14} className="text-primary"/> {formatDate(post)}</span>
                      <span className="flex items-center gap-1.5"><Clock size={14} className="text-primary"/> {post.read_time || '5 min'}</span>
                    </div>

                    <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-3 line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                      <Link href={post.slug}>{post.title}</Link>
                    </h3>

                    <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-6 flex-grow leading-relaxed font-medium">
                      {post.excerpt}
                    </p>

                    <Link href={post.slug} className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary transition-all group-hover:gap-3 mt-auto">
                      {text.readMore} <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* --- View All Button --- */}
        {text.viewAll && (
          <div className="mt-14 text-center">
            <Link href="/inspiration">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="press px-10 py-4 rounded-full bg-primary hover:bg-primary-500 text-white font-extrabold text-lg shadow-pink flex items-center gap-3 mx-auto transition-all"
              >
                {text.viewAll} <ChevronRight size={20} className="stroke-[3px]" />
              </motion.button>
            </Link>
          </div>
        )}

      </div>
    </section>
  );
}