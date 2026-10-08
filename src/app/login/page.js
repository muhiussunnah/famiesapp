'use client';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, ArrowLeft, Loader2, Sparkles, Heart } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Det gick inte att logga in');

      toast.success('Välkommen tillbaka!');
      // Full reload so the server sees the new session cookie.
      const next = new URLSearchParams(window.location.search).get('next');
      const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/admin';
      setTimeout(() => {
        window.location.href = target;
      }, 600);
    } catch (error) {
      toast.error(error.message || 'Det gick inte att logga in');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center overflow-hidden relative py-24 px-4 section">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 z-10 relative items-center">
        {/* LEFT, welcome panel (hidden on mobile) */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:flex flex-col justify-center relative"
        >
          <div className="absolute -inset-6 rounded-[3rem] bg-brand-gradient-soft blur-3xl opacity-70 pointer-events-none" />

          <div className="relative glass rounded-[2.5rem] p-10 shadow-soft overflow-hidden">
            {/* Decorative blob */}
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-primary/25 blur-3xl animate-float-y" />
            <div className="absolute -bottom-10 -left-10 w-56 h-56 rounded-full bg-secondary/40 blur-3xl animate-float-y-slow" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass shadow-soft text-xs font-bold uppercase tracking-wider text-primary mb-6">
                <Heart size={12} className="fill-current" /> Välkommen tillbaka
              </div>

              <h2 className="text-4xl md:text-5xl font-black text-ink-900 dark:text-white leading-[1.05] mb-5">
                Logga in. <br />
                <span className="text-brand-gradient">Fortsätt upptäck.</span>
              </h2>

              <p className="text-lg text-ink-500 dark:text-ink-200 leading-relaxed mb-8">
                Fortsätt där du slutade, nya evenemang, sparade tips och
                familjeidéer nära dig.
              </p>

              {/* Float logo */}
              <div className="relative w-full h-56 glass rounded-3xl flex items-center justify-center shadow-soft">
                <div className="relative w-28 h-28 rounded-3xl overflow-hidden ring-1 ring-black/10 animate-float-y shadow-pink">
                  <Image
                    src="/logo-black.webp"
                    fill
                    className="object-cover"
                    alt="Famies logo"
                  />
                </div>

                {/* Floating badges */}
                <div className="absolute top-6 right-6 glass px-3 py-1.5 rounded-full text-xs font-bold text-ink-900 dark:text-white flex items-center gap-1.5 shadow-pink animate-float-y-slow">
                  <Sparkles size={12} className="text-primary" />
                  10 000+ familjer
                </div>
                <div className="absolute bottom-6 left-6 glass px-3 py-1.5 rounded-full text-xs font-bold text-ink-900 dark:text-white flex items-center gap-1.5 shadow-mint animate-float-y">
                  ⭐ 4.8 / 5
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* RIGHT, form */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="absolute -inset-4 rounded-[3rem] bg-brand-gradient-soft blur-3xl opacity-60 pointer-events-none" />

          <div className="relative glass rounded-[2.2rem] md:rounded-[2.5rem] shadow-soft p-7 md:p-10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 dark:text-ink-300 hover:text-primary mb-6 transition-colors"
            >
              <ArrowLeft size={15} /> Tillbaka till startsidan
            </Link>

            <h3 className="text-3xl md:text-4xl font-black text-ink-900 dark:text-white mb-2 leading-tight">
              Logga in
            </h3>
            <p className="text-ink-500 dark:text-ink-300 text-sm mb-7">
              Inloggning för Famies-teamet (admin).
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-ink-700 dark:text-ink-100 ml-1">
                  E-postadress
                </label>
                <div className="relative group">
                  <Mail
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 group-focus-within:text-primary transition-colors"
                    size={18}
                  />
                  <input
                    name="email"
                    onChange={handleChange}
                    type="email"
                    required
                    placeholder="anna@exempel.se"
                    className="w-full bg-white/70 dark:bg-ink-100/5 border border-ink-100/70 dark:border-ink-700/50 rounded-2xl py-3.5 pl-12 pr-4 text-ink-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-ink-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-ink-700 dark:text-ink-100 ml-1">
                  Lösenord
                </label>
                <div className="relative group">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 group-focus-within:text-primary transition-colors"
                    size={18}
                  />
                  <input
                    name="password"
                    onChange={handleChange}
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full bg-white/70 dark:bg-ink-100/5 border border-ink-100/70 dark:border-ink-700/50 rounded-2xl py-3.5 pl-12 pr-4 text-ink-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-ink-300"
                  />
                </div>
              </div>

              <button
                disabled={loading}
                className="press w-full bg-primary text-white font-extrabold py-4 rounded-2xl shadow-pink hover:shadow-glow-pink transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    Logga in <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
