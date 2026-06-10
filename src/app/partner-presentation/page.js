'use client';
import { motion } from 'framer-motion';
import { Briefcase, Mail, ArrowRight } from 'lucide-react';

// Google Drive embed URL. Source file:
//   https://drive.google.com/file/d/1OG3W7yDrt20pSoNtDl06_WutDnhIRfei/view
// The /preview variant renders inline in iframes when the file is
// shared as "Anyone with the link can view".
const DRIVE_EMBED_URL =
  'https://drive.google.com/file/d/1OG3W7yDrt20pSoNtDl06_WutDnhIRfei/preview';

export default function PartnerPresentation() {
  return (
    <div className="min-h-screen w-full relative overflow-hidden pb-16 section selection:bg-primary selection:text-white">
      {/* HERO */}
      <section className="relative z-10 pt-32 md:pt-36 pb-8 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full glass shadow-soft text-xs font-bold uppercase tracking-wider text-primary">
            <Briefcase size={14} />
            För partners
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-ink-900 dark:text-white mb-5 leading-[1.05]">
            Famies <span className="text-brand-gradient">partnerpresentation.</span>
          </h1>

          <p className="text-lg md:text-xl text-ink-500 dark:text-ink-300 font-medium max-w-2xl mx-auto">
            Hur Famies hjälper familjer hitta nästa upplevelse, och hur du
            kan vara en del av det.
          </p>
        </motion.div>
      </section>

      {/* PRESENTATION EMBED */}
      <section className="relative z-10 px-4 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          {/* Soft brand glow behind the deck */}
          <div className="absolute -inset-4 rounded-[3rem] bg-brand-gradient-soft blur-3xl opacity-60 pointer-events-none" />

          <div className="relative glass rounded-[2rem] md:rounded-[2.4rem] shadow-soft overflow-hidden">
            <div className="relative w-full aspect-video bg-ink-900">
              <iframe
                src={DRIVE_EMBED_URL}
                title="Famies partnerpresentation"
                className="absolute inset-0 w-full h-full"
                allow="autoplay; fullscreen"
                allowFullScreen
                loading="lazy"
              />
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="mt-12 md:mt-16 max-w-3xl mx-auto text-center"
        >
          <h2 className="text-2xl md:text-3xl font-black text-ink-900 dark:text-white mb-4">
            Vill ni vara med och bygga något bra för familjer?
          </h2>
          <p className="text-base md:text-lg text-ink-500 dark:text-ink-300 mb-7 font-medium">
            Vi pratar gärna med kommuner, kulturinstitutioner, arrangörer
            och varumärken som vill nå familjer på ett ärligt sätt.
          </p>

          <a
            href="mailto:partner@famies.app?subject=Partnerskap%20med%20Famies"
            className="press inline-flex items-center gap-2.5 px-7 py-4 rounded-2xl bg-primary text-white font-extrabold shadow-pink hover:shadow-glow-pink transition-all"
          >
            <Mail size={18} />
            Kontakta partner@famies.app
            <ArrowRight size={16} />
          </a>
        </motion.div>
      </section>
    </div>
  );
}
