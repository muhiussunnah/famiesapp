'use client';
import { motion } from 'framer-motion';
import { Download, MapPin, Sparkles, ArrowRight } from 'lucide-react';
import { formatText } from '@/components/FormattedText';
import { HOMEPAGE_TEXT_DEFAULTS } from '@/lib/homepage-text';

// Numbers, icons and tints follow the step's position (texts come from the admin).
const ICONS = [Download, MapPin, Sparkles];

export default function HowItWorks({ text = HOMEPAGE_TEXT_DEFAULTS.how }) {
  const steps = text.steps.map((step, i) => ({
    n: String(i + 1).padStart(2, '0'),
    icon: ICONS[i % ICONS.length],
    title: step.title,
    body: step.body,
    tint: i % 2 === 0 ? 'pink' : 'mint',
  }));

  return (
    <section className="relative w-full py-20 md:py-28 section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16 md:mb-20 max-w-3xl mx-auto">
          {text.badge && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-block px-4 py-1.5 mb-5 rounded-full glass shadow-soft text-xs font-bold uppercase tracking-wider text-primary"
            >
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

        {/* Steps, connected with dashed line on desktop */}
        <div className="relative grid md:grid-cols-3 gap-6 md:gap-5">
          {/* Connector line behind cards */}
          <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          {steps.map((s, i) => {
            const Icon = s.icon;
            const isPink = s.tint === 'pink';
            return (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                className="relative"
              >
                {/* Number medallion */}
                <div className="flex justify-center mb-5">
                  <div
                    className={`relative w-20 h-20 rounded-full flex items-center justify-center font-black text-2xl ${
                      isPink
                        ? 'bg-primary text-white shadow-pink'
                        : 'bg-secondary text-green-900 shadow-mint'
                    }`}
                  >
                    {s.n}
                    {i < steps.length - 1 && (
                      <ArrowRight
                        className="absolute -right-4 md:hidden text-ink-300"
                        size={20}
                      />
                    )}
                  </div>
                </div>

                {/* Card */}
                <div className="glass rounded-3xl p-7 md:p-8 text-center h-full transition-all duration-500 hover:-translate-y-1 hover:shadow-pink">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5 ${
                      isPink ? 'bg-primary/15 text-primary' : 'bg-secondary/50 text-green-700'
                    }`}
                  >
                    <Icon size={22} />
                  </div>
                  <h3 className="text-xl md:text-2xl font-extrabold text-ink-900 dark:text-white mb-3">
                    {formatText(s.title)}
                  </h3>
                  <p className="text-ink-500 dark:text-ink-300 leading-relaxed">
                    {formatText(s.body)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
