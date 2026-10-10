'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Apple, Play, PlayCircle, X, Sparkles, MapPin, Star } from 'lucide-react';
import { formatText } from '@/components/FormattedText';
import { HOMEPAGE_TEXT_DEFAULTS, videoEmbedUrl } from '@/lib/homepage-text';

const DEFAULT_APP_STORE_URL = 'https://apps.apple.com/se/app/famies/id6450005701';
const DEFAULT_GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.famapdirectory.apps&hl=en';

/**
 * Homepage hero. All texts come from /admin/homepage → Homepage text
 * (src/lib/homepage-text.js holds the original copy as defaults).
 */
export default function Hero({
  text = HOMEPAGE_TEXT_DEFAULTS.hero,
  buttons = HOMEPAGE_TEXT_DEFAULTS.buttons,
  appStoreUrl,
  googlePlayUrl,
} = {}) {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const videoSrc = videoEmbedUrl(text.demoVideoUrl);

  return (
    <section className="relative w-full min-h-[92vh] flex items-center justify-center overflow-hidden pt-32 pb-20 section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center relative z-10 w-full">

        {/* LEFT, copy */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center lg:text-left"
        >
          {/* Badge */}
          {text.eyebrow && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 mb-7 rounded-full glass shadow-soft"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-100">
                {text.eyebrow}
              </span>
            </motion.div>
          )}

          {/* Headline, curiosity-driven question. Never empty: it is the page's H1. */}
          <h1 className="text-[2.4rem] sm:text-[3.25rem] lg:text-[4rem] leading-[1.05] font-black tracking-tight text-ink-900 dark:text-white mb-6">
            {formatText(text.title.trim() || HOMEPAGE_TEXT_DEFAULTS.hero.title)}
          </h1>

          {/* Subtitle, what + by whom */}
          {text.subtitle && (
            <p className="text-lg md:text-xl text-ink-500 dark:text-ink-300 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
              {formatText(text.subtitle)}
            </p>
          )}

          {/* CTAs, native store buttons, the real conversion */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
            <Link
              href={appStoreUrl || DEFAULT_APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="press group flex items-center gap-3 px-6 py-4 rounded-2xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 font-bold shadow-soft hover:shadow-pink transition-all"
            >
              <Apple size={26} fill="currentColor" />
              <span className="flex flex-col leading-none text-left">
                <span className="text-[10px] uppercase opacity-70 tracking-wider">{buttons.appStoreSmall}</span>
                <span className="text-base font-extrabold">{buttons.appStoreBig}</span>
              </span>
            </Link>

            <Link
              href={googlePlayUrl || DEFAULT_GOOGLE_PLAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="press group flex items-center gap-3 px-6 py-4 rounded-2xl bg-white dark:bg-ink-900 border border-ink-100 dark:border-ink-700 text-ink-900 dark:text-white font-bold shadow-soft hover:shadow-mint transition-all"
            >
              <Play size={24} fill="currentColor" className="text-primary" />
              <span className="flex flex-col leading-none text-left">
                <span className="text-[10px] uppercase opacity-70 tracking-wider">{buttons.googlePlaySmall}</span>
                <span className="text-base font-extrabold">{buttons.googlePlayBig}</span>
              </span>
            </Link>

            {videoSrc && text.demoLabel && (
              <button
                onClick={() => setIsVideoOpen(true)}
                className="press group flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-transparent text-ink-900 dark:text-white font-bold underline-offset-4 hover:underline"
              >
                <PlayCircle size={22} className="text-primary group-hover:scale-110 transition" />
                {text.demoLabel}
              </button>
            )}
          </div>

          {/* Trust strip */}
          <div className="flex flex-wrap items-center gap-6 justify-center lg:justify-start">
            {(text.trustTitle || text.trustText) && (
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-ink-900 bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-black text-white"
                    >
                      {['A', 'L', 'M', 'S'][i]}
                    </div>
                  ))}
                </div>
                <div className="text-sm">
                  <div className="font-bold text-ink-900 dark:text-white">{text.trustTitle}</div>
                  <div className="text-ink-500 dark:text-ink-300 text-xs">{text.trustText}</div>
                </div>
              </div>
            )}
            {(text.trustTitle || text.trustText) && text.rating && (
              <div className="h-10 w-px bg-ink-100 dark:bg-ink-700 hidden sm:block" />
            )}
            {text.rating && (
              <div className="flex items-center gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} size={18} className="fill-primary text-primary" />
                ))}
                <span className="ml-2 text-sm font-bold text-ink-900 dark:text-white">{text.rating}</span>
                <span className="text-sm text-ink-500 dark:text-ink-300">{text.ratingLabel}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* RIGHT, phone + floating cards */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto"
        >
          {/* Aura behind phone */}
          <div className="absolute inset-0 -z-10 flex items-center justify-center">
            <div className="w-[420px] h-[420px] rounded-full bg-radial-pink blur-3xl opacity-80" />
          </div>

          {/* Phone */}
          <div className="relative w-[280px] sm:w-[320px] h-[580px] sm:h-[660px] mx-auto">
            <div className="relative w-full h-full bg-ink-900 rounded-[3rem] border-[10px] border-ink-900 shadow-2xl overflow-hidden rotate-[-4deg] hover:rotate-0 transition-transform duration-700">
              <div className="relative w-full h-full rounded-[2.2rem] overflow-hidden bg-white">
                <Image
                  src="/app-screenshot.png"
                  alt={text.imageAlt}
                  fill
                  className="object-cover"
                  priority
                  sizes="320px"
                />
              </div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-ink-900 rounded-b-3xl z-10" />
            </div>
          </div>

          {/* Floating card 1, top */}
          {text.card1Title && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="absolute top-12 -left-2 sm:-left-8 glass rounded-2xl p-3 pr-5 shadow-pink animate-float-y"
            >
              <div className="flex items-center gap-3">
                {text.card1Emoji && (
                  <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center text-2xl">
                    {text.card1Emoji}
                  </div>
                )}
                <div>
                  <p className="font-bold text-sm text-ink-900 dark:text-white leading-tight">
                    {text.card1Title}
                  </p>
                  {text.card1Text && (
                    <p className="text-xs text-ink-500 dark:text-ink-300 flex items-center gap-1">
                      <MapPin size={11} /> {text.card1Text}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Floating card 2, bottom */}
          {text.card2Title && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="absolute bottom-16 -right-2 sm:-right-10 glass rounded-2xl p-3 pr-4 shadow-mint animate-float-y-slow"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-secondary/50 flex items-center justify-center">
                  <Sparkles size={20} className="text-green-700" />
                </div>
                <div>
                  <p className="font-bold text-sm text-ink-900 dark:text-white leading-tight">
                    {text.card2Title}
                  </p>
                  {text.card2Text && (
                    <p className="text-xs text-ink-500 dark:text-ink-300">
                      {text.card2Text}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Demo video modal */}
      <AnimatePresence>
        {isVideoOpen && videoSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
            onClick={() => setIsVideoOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              className="relative w-full max-w-4xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsVideoOpen(false)}
                className="absolute top-4 right-4 text-white hover:text-primary z-10 bg-black/60 hover:bg-white rounded-full p-2 transition"
                aria-label="Stäng video"
              >
                <X size={22} />
              </button>
              <iframe
                width="100%"
                height="100%"
                src={videoSrc}
                title="Famies Demo Video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
