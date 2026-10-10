'use client';
import { motion } from 'framer-motion';
import { Lightbulb, Calendar, MessageCircle, Users } from 'lucide-react';
import WaveDivider from './WaveDivider';
import { formatText } from '@/components/FormattedText';
import { HOMEPAGE_TEXT_DEFAULTS } from '@/lib/homepage-text';

// Card icons and accents follow the card's position (texts come from the admin).
const ICONS = [Lightbulb, Calendar, MessageCircle, Users];

export default function PainPoints({ text = HOMEPAGE_TEXT_DEFAULTS.pain }) {
  const pains = text.cards.map((card, i) => ({
    quote: card.title,
    body: card.body,
    icon: ICONS[i % ICONS.length],
    accent: i % 2 === 0 ? 'pink' : 'mint',
  }));

  return (
    <>
      <WaveDivider variant="pink-to-mint" height={90} />
      <section className="relative w-full py-20 md:py-28 section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-14 md:mb-20 max-w-3xl mx-auto">
            {text.badge && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 rounded-full glass shadow-soft text-xs font-bold uppercase tracking-wider text-primary"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                {text.badge}
              </motion.div>
            )}

            {text.title && (
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl md:text-6xl font-black text-ink-900 dark:text-white leading-[1.05] mb-6"
              >
                {formatText(text.title)}
              </motion.h2>
            )}

            {text.subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg md:text-xl text-ink-500 dark:text-ink-300 font-medium"
              >
                {formatText(text.subtitle)}
              </motion.p>
            )}
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-2 gap-5 md:gap-6 max-w-5xl mx-auto">
            {pains.map((p, i) => {
              const Icon = p.icon;
              const accentBg = p.accent === 'pink'
                ? 'bg-primary/15'
                : 'bg-secondary/50';
              const accentRing = p.accent === 'pink'
                ? 'ring-primary/20 group-hover:shadow-pink'
                : 'ring-secondary/40 group-hover:shadow-mint';
              const accentIcon = p.accent === 'pink'
                ? 'text-primary'
                : 'text-green-700';

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                  className={`group relative glass rounded-3xl p-7 md:p-8 ring-1 ${accentRing} transition-all duration-500 hover:-translate-y-1`}
                >
                  <div className={`w-12 h-12 rounded-2xl ${accentBg} flex items-center justify-center mb-5`}>
                    <Icon className={accentIcon} size={22} />
                  </div>
                  <p className="text-xl md:text-2xl font-extrabold text-ink-900 dark:text-white mb-3 leading-snug">
                    {formatText(p.quote)}
                  </p>
                  <p className="text-ink-500 dark:text-ink-300 leading-relaxed">
                    {formatText(p.body)}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* Transition line */}
          {text.outro && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mt-14 md:mt-20 text-2xl md:text-3xl font-black text-ink-900 dark:text-white"
            >
              {formatText(text.outro)}
            </motion.p>
          )}
        </div>
      </section>
    </>
  );
}
