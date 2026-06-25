'use client';
import Image from 'next/image';
import { motion } from 'framer-motion';

/**
 * Famies Coming Soon landing, dark, minimal, brand-pure.
 * Matches the client mock: logo + bold message + launch date +
 * official-style App Store and Google Play download badges.
 * Pink (#FF8FAF) + Mint (#CCFAD6) accents only.
 */

// Replace the placeholder hrefs once the apps are listed on the
// respective stores. Keeping them inert (#) prevents broken-link
// pages from confusing pre-launch visitors.
const GOOGLE_PLAY_URL = '#';
const APP_STORE_URL = '#';

function GooglePlayIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="gpGreen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00C170" />
          <stop offset="100%" stopColor="#00A95C" />
        </linearGradient>
        <linearGradient id="gpYellow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFD814" />
          <stop offset="100%" stopColor="#FFB400" />
        </linearGradient>
        <linearGradient id="gpRed" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF5252" />
          <stop offset="100%" stopColor="#E62117" />
        </linearGradient>
        <linearGradient id="gpBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00C2FF" />
          <stop offset="100%" stopColor="#007EE5" />
        </linearGradient>
      </defs>
      <path
        d="M70 40 L70 472 L300 256 Z"
        fill="url(#gpBlue)"
      />
      <path
        d="M70 40 L300 256 L390 168 L120 18 Q90 4 70 40 Z"
        fill="url(#gpGreen)"
      />
      <path
        d="M70 472 L300 256 L390 344 L120 494 Q90 508 70 472 Z"
        fill="url(#gpRed)"
      />
      <path
        d="M300 256 L390 168 L470 220 Q500 244 500 256 Q500 268 470 292 L390 344 Z"
        fill="url(#gpYellow)"
      />
    </svg>
  );
}

function AppleIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 384 512"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM256.6 105.1c29.3-34.8 26.6-66.4 25.7-77.8-25.8 1.5-55.6 17.6-72.6 37.4-18.7 21.2-29.7 47.4-27.3 76.6 27.9 2.1 53.3-12.2 74.2-36.2z"
      />
    </svg>
  );
}

function StoreBadge({ href, label, store, icon }) {
  return (
    <a
      href={href}
      aria-label={`${label} ${store}`}
      className="press group flex items-center gap-3 px-5 py-3 rounded-2xl bg-black/55 backdrop-blur-md ring-1 ring-white/15 hover:ring-[#FF8FAF]/50 hover:bg-black/75 transition-all w-full sm:w-auto justify-center min-w-[170px] sm:min-w-[180px]"
    >
      {icon}
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[10px] sm:text-[11px] text-white/65 font-medium tracking-wide">
          {label}
        </span>
        <span className="text-base sm:text-lg font-extrabold text-white -mt-0.5">
          {store}
        </span>
      </div>
    </a>
  );
}

export default function ComingSoon() {
  return (
    <main
      className="fixed inset-0 z-[200] min-h-screen w-full overflow-hidden flex flex-col items-center justify-between text-white"
      style={{
        background:
          'radial-gradient(ellipse 100% 60% at 50% 0%, rgba(255,143,175,0.16) 0%, transparent 55%), ' +
          'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(204,250,214,0.10) 0%, transparent 55%), ' +
          'linear-gradient(180deg, #0a0810 0%, #0c0a13 100%)',
      }}
    >
      {/* Subtle drifting brand blobs */}
      <div
        aria-hidden
        className="absolute top-[12%] left-[-10%] w-[520px] h-[520px] rounded-full blob-drift-1 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, rgba(255,143,175,0.28), transparent 60%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-[8%] right-[-12%] w-[600px] h-[600px] rounded-full blob-drift-2 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 70% 50%, rgba(204,250,214,0.22), transparent 60%)',
          filter: 'blur(90px)',
        }}
      />

      {/* Faint grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage:
            'radial-gradient(ellipse at center, black 0%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 0%, transparent 75%)',
        }}
      />

      {/* TOP, logo */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 pt-8 sm:pt-10 flex flex-col items-center"
      >
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 mb-3 rounded-2xl overflow-hidden ring-1 ring-white/15 animate-float-y-slow shadow-[0_8px_28px_rgba(255,143,175,0.35)]">
          <Image
            src="/logo-black.webp"
            alt="Famies logotyp"
            fill
            className="object-cover"
            priority
          />
        </div>
        <span className="text-xl sm:text-2xl font-black tracking-tight text-white">
          famies
        </span>
      </motion.header>

      {/* CENTER, headline + download badges */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 max-w-2xl mx-auto w-full">
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="text-center font-black leading-[1.05] tracking-tight"
        >
          <span className="block text-[2.4rem] sm:text-5xl md:text-6xl text-white">
            Där familjer hittar
          </span>
          <span className="block text-[2.4rem] sm:text-5xl md:text-6xl mt-1 sm:mt-2 text-[#FF8FAF]">
            nästa upplevelse.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mt-7 sm:mt-9 max-w-md text-center text-base sm:text-lg text-white/70 leading-relaxed font-medium"
        >
          Hitta aktiviteter, event och andra familjer i närheten.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-10 sm:mt-12 flex flex-col items-center gap-3"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] backdrop-blur-md ring-1 ring-white/10">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#FF8FAF] opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF8FAF]" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/85">
              Lanseras juni 2026
            </span>
          </div>
          <p className="text-sm text-white/55 font-medium">
            Ladda ner appen så snart den släpps.
          </p>
        </motion.div>

        {/* Store download badges */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.65 }}
          className="mt-7 sm:mt-9 w-full max-w-md flex flex-col sm:flex-row items-stretch justify-center gap-3 sm:gap-4"
        >
          <StoreBadge
            href={GOOGLE_PLAY_URL}
            label="Ladda ner på"
            store="Google Play"
            icon={<GooglePlayIcon className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />}
          />
          <StoreBadge
            href={APP_STORE_URL}
            label="Ladda ner på"
            store="App Store"
            icon={<AppleIcon className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 text-white" />}
          />
        </motion.div>
      </section>

      {/* BOTTOM, footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.85 }}
        className="relative z-10 py-6 px-6 text-center"
      >
        <p className="text-xs text-white/40 font-medium">
          © {new Date().getFullYear()} Famies. Skapar bättre familjerelationer.
        </p>
      </motion.footer>
    </main>
  );
}
