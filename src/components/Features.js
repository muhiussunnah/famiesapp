'use client';
import React, { useState, useRef, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import Image from 'next/image';
import {
  Compass,
  MapPin,
  Zap,
  Calendar,
  Heart,
} from 'lucide-react';
import WaveDivider from './WaveDivider';
import { formatText, plainText } from '@/components/FormattedText';
import { HOMEPAGE_TEXT_DEFAULTS } from '@/lib/homepage-text';

// Each feature is framed as a SOLUTION to a parent pain point. Texts and
// screenshots come from the admin; icons and tints follow the position.
const ICONS = [Compass, MapPin, Zap, Calendar, Heart];

export default function Features({ text = HOMEPAGE_TEXT_DEFAULTS.features }) {
  const [activeFeature, setActiveFeature] = useState(0);
  const features = text.items.map((item, i) => ({
    id: i + 1,
    eyebrow: item.eyebrow,
    title: item.title,
    description: item.description,
    icon: ICONS[i % ICONS.length],
    tint: i % 2 === 0 ? 'pink' : 'mint',
    image: item.image || `/feature${(i % 5) + 1}.png`,
  }));

  return (
    <>
      <WaveDivider variant="mint-to-pink" height={90} />
      <section className="relative w-full py-20 md:py-28 section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16 md:mb-24 max-w-3xl mx-auto">
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
            {text.subtitle && (
              <p className="text-lg md:text-xl text-ink-500 dark:text-ink-300 font-medium">
                {formatText(text.subtitle, { strongClassName: 'text-ink-900 dark:text-white font-bold' })}
              </p>
            )}
          </div>

          {/* Sticky phone + scrolling copy */}
          <div className="flex flex-col lg:flex-row items-start relative gap-10">
            {/* LEFT, sticky phone */}
            <div className="hidden lg:flex w-full lg:w-1/2 sticky top-28 h-[80vh] items-center justify-center gap-10">
              <div className="relative w-[320px] h-[650px]">
                {/* Aura */}
                <div className="absolute inset-0 -m-8 rounded-full bg-radial-pink blur-3xl opacity-70 pointer-events-none" />

                {/* Phone */}
                <div className="relative w-full h-full bg-ink-900 rounded-[3.2rem] border-[11px] border-ink-900 shadow-2xl overflow-hidden">
                  {features.map((feature, index) => (
                    <motion.div
                      key={feature.id}
                      initial={false}
                      animate={{
                        opacity: activeFeature === index ? 1 : 0,
                        scale: activeFeature === index ? 1 : 1.05,
                      }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-0 bg-white flex items-center justify-center"
                    >
                      <div className="relative w-full h-full bg-white">
                        <Image
                          src={feature.image}
                          alt={plainText(feature.title)}
                          fill
                          // Pasted links to other sites skip the optimizer (no remotePatterns needed).
                          unoptimized={!feature.image.startsWith('/')}
                          className="object-cover"
                          priority={index < 2}
                          sizes="320px"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/5" />
                      </div>
                    </motion.div>
                  ))}

                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-ink-900 rounded-b-3xl z-20" />
                </div>
              </div>

              {/* Side indicators */}
              <div className="flex flex-col gap-3 justify-center h-full">
                {features.map((f, index) => {
                  const isActive = activeFeature === index;
                  const bar = f.tint === 'pink' ? 'bg-primary' : 'bg-secondary';
                  return (
                    <button
                      key={index}
                      onClick={() => setActiveFeature(index)}
                      aria-label={`Gå till: ${plainText(f.title)}`}
                      className={`w-2 rounded-full transition-all duration-500 ease-in-out ${
                        isActive ? `h-14 ${bar}` : 'h-2 bg-ink-100 dark:bg-ink-700'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* RIGHT, cards */}
            <div className="w-full lg:w-1/2 flex flex-col pt-4 lg:pt-0 pl-0 lg:pl-10">
              {features.map((feature, index) => (
                <FeatureItem
                  key={feature.id}
                  feature={feature}
                  index={index}
                  activeFeature={activeFeature}
                  setActiveFeature={setActiveFeature}
                />
              ))}
              <div className="h-[20vh]" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function FeatureItem({ feature, index, activeFeature, setActiveFeature }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { margin: '-50% 0px -50% 0px' });
  const isActive = activeFeature === index;
  const Icon = feature.icon;
  const isPink = feature.tint === 'pink';

  useEffect(() => {
    if (isInView) setActiveFeature(index);
  }, [isInView, index, setActiveFeature]);

  return (
    <div
      ref={ref}
      className="flex flex-row min-h-[55vh] mb-4 group relative items-center"
    >
      <div
        className={`flex flex-col justify-center flex-1 p-7 lg:p-10 rounded-[2rem] transition-all duration-500 ${
          isActive
            ? 'glass shadow-soft opacity-100 scale-100'
            : 'bg-transparent opacity-30 scale-95'
        }`}
      >
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-soft transition-all duration-500 ${
            isPink
              ? 'bg-primary text-white'
              : 'bg-secondary text-green-900'
          }`}
        >
          <Icon size={26} strokeWidth={2.25} />
        </div>

        <div
          className={`text-xs uppercase tracking-[0.18em] font-bold mb-3 ${
            isPink ? 'text-primary' : 'text-green-700'
          }`}
        >
          {feature.eyebrow}
        </div>

        <h3
          className={`text-2xl md:text-[2rem] font-black mb-4 leading-tight transition-colors duration-300 ${
            isActive ? 'text-ink-900 dark:text-white' : 'text-ink-300'
          }`}
        >
          {formatText(feature.title)}
        </h3>

        <p
          className={`text-lg leading-relaxed mb-6 transition-colors duration-300 ${
            isActive ? 'text-ink-500 dark:text-ink-100' : 'text-ink-300'
          }`}
        >
          {formatText(feature.description)}
        </p>

        {isActive && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mt-auto"
          >
            <span
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-black shadow-sm ${
                isPink ? 'bg-primary text-white' : 'bg-secondary text-green-900'
              }`}
            >
              {index + 1}
            </span>
            <div className="h-1 w-16 bg-ink-100 dark:bg-ink-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 0.8 }}
                className={`h-full ${isPink ? 'bg-primary' : 'bg-secondary'}`}
              />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
