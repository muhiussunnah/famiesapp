'use client';
import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, CheckCircle, Mail, Heart } from 'lucide-react';

/**
 * Famies Coming Soon landing, dark, minimal, brand-pure.
 * Matches the client mock: logo + bold message + launch date +
 * beta sign-up. Pink (#FF8FAF) + Mint (#CCFAD6) accents only.
 */
export default function ComingSoon() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Simple, no-backend submission, show a warm Swedish thank-you.
  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    // tiny delay so the loading state feels real
    await new Promise((r) => setTimeout(r, 450));
    setDone(true);
    setLoading(false);
  };

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

      {/* CENTER, headline + form */}
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
            Bli en av de första att testa beta-versionen.
          </p>
        </motion.div>

        {/* Beta sign-up form / thank-you state */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.65 }}
          className="mt-7 w-full max-w-md"
        >
          <AnimatePresence mode="wait">
            {!done ? (
              <motion.form
                key="form"
                onSubmit={handleSubscribe}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <div className="relative group">
                  <Mail
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-[#FF8FAF] transition-colors"
                    size={18}
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="din@epost.se"
                    autoComplete="email"
                    className="w-full bg-white/[0.05] backdrop-blur-md ring-1 ring-white/10 focus:ring-2 focus:ring-[#FF8FAF]/40 rounded-2xl py-3.5 pl-12 pr-36 text-white placeholder:text-white/30 outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="press absolute right-1.5 top-1.5 bottom-1.5 px-5 rounded-xl bg-[#FF8FAF] text-white font-extrabold text-sm flex items-center gap-2 shadow-[0_8px_24px_-6px_rgba(255,143,175,0.6)] hover:shadow-[0_12px_32px_-6px_rgba(255,143,175,0.8)] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <>
                        Anmäl <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-3 text-center text-[11px] text-white/40">
                  Ingen spam. Vi mejlar bara när det är dags att testa.
                </p>
              </motion.form>
            ) : (
              <motion.div
                key="thanks"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="relative rounded-2xl px-6 py-7 text-center bg-white/[0.05] backdrop-blur-md ring-1 ring-[#FF8FAF]/30 shadow-[0_20px_60px_-20px_rgba(255,143,175,0.45)] overflow-hidden"
              >
                {/* soft glow */}
                <div
                  aria-hidden
                  className="absolute -inset-10 rounded-full pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 30%, rgba(255,143,175,0.18), transparent 60%)',
                  }}
                />

                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.05, type: 'spring', damping: 14, stiffness: 220 }}
                  className="relative mx-auto mb-3 w-12 h-12 rounded-full bg-[#FF8FAF] flex items-center justify-center shadow-[0_0_28px_rgba(255,143,175,0.65)]"
                >
                  <CheckCircle className="text-white" size={24} strokeWidth={3} />
                </motion.div>

                <h3 className="relative text-xl sm:text-2xl font-black text-white leading-tight">
                  Tack för din anmälan!
                </h3>
                <p className="relative mt-1.5 text-sm text-white/65 font-medium">
                  Vi hör av oss så snart beta-versionen är redo.
                </p>
                <p className="relative mt-3 text-[11px] uppercase tracking-[0.18em] font-bold text-[#FF8FAF] flex items-center justify-center gap-1.5">
                  <Heart size={11} className="fill-current" /> Välkommen till Famies-familjen
                </p>
              </motion.div>
            )}
          </AnimatePresence>
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
