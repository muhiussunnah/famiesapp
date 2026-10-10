'use client';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { formatText } from '@/components/FormattedText';
import { HOMEPAGE_TEXT_DEFAULTS } from '@/lib/homepage-text';

// Full class names so Tailwind keeps them in the CSS build.
const STAT_COLUMNS = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
};

export default function SocialProof({ text = HOMEPAGE_TEXT_DEFAULTS.reviews }) {
  const stats = text.stats.map((s) => ({ n: s.value, label: s.label }));
  const testimonials = text.testimonials;

  return (
    <section className="relative w-full py-20 md:py-28 section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats strip */}
        {stats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass rounded-3xl md:rounded-[2rem] shadow-soft p-8 md:p-10 mb-20 md:mb-24"
        >
          <div className={`grid grid-cols-2 ${STAT_COLUMNS[Math.min(stats.length, 6)] || 'md:grid-cols-4'} gap-6 md:gap-4 text-center`}>
            {stats.map((s, i) => (
              <div key={i} className="relative">
                <div className="text-4xl md:text-5xl font-black text-brand-gradient mb-2">
                  {s.n}
                </div>
                <div className="text-sm md:text-base font-medium text-ink-500 dark:text-ink-300">
                  {s.label}
                </div>
                {i < stats.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-2 -translate-y-1/2 h-10 w-px bg-ink-100 dark:bg-ink-700" />
                )}
              </div>
            ))}
          </div>
        </motion.div>
        )}

        {/* Testimonials header */}
        {(text.badge || text.title) && (
          <div className="text-center mb-14 md:mb-16 max-w-3xl mx-auto">
            {text.badge && (
              <div className="inline-block px-4 py-1.5 mb-5 rounded-full glass shadow-soft text-xs font-bold uppercase tracking-wider text-primary">
                {text.badge}
              </div>
            )}
            {text.title && (
              <h2 className="text-4xl md:text-6xl font-black text-ink-900 dark:text-white leading-[1.05] mb-6">
                {formatText(text.title)}
              </h2>
            )}
          </div>
        )}

        {/* Testimonial grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: (i % 3) * 0.08 }}
              className="group relative glass rounded-3xl p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-pink"
            >
              <Quote
                className="absolute top-6 right-6 text-primary/30 group-hover:text-primary/60 transition-colors"
                size={32}
              />

              {/* Stars */}
              <div className="flex items-center gap-1 mb-4">
                {[0, 1, 2, 3, 4].map((s) => (
                  <Star key={s} size={15} className="fill-primary text-primary" />
                ))}
              </div>

              <p className="text-ink-700 dark:text-ink-100 leading-relaxed mb-6 text-[15px] md:text-base">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-ink-100/70 dark:border-ink-700/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary text-white font-black flex items-center justify-center">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-ink-900 dark:text-white text-sm leading-tight">
                    {t.name}
                  </div>
                  <div className="text-xs text-ink-500 dark:text-ink-300">
                    {[t.role, t.city].filter(Boolean).join(' • ')}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
