'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, Send, Loader2, CheckCircle, Sparkles, Lock } from 'lucide-react';
import { submitForm } from '@/lib/forms';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    setStatus(null);

    try {
      const { error } = await submitForm('newsletter', { email });
      if (error) throw error;
      setStatus('success');
      setEmail('');
    } catch (error) {
      console.error(error);
      setStatus('error');
      alert(error.message || 'Something went wrong!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="w-full py-20 md:py-28 px-4 relative overflow-hidden flex items-center justify-center section">
      <div className="absolute inset-0 w-full h-full pointer-events-none">
         <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, 45, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/25 rounded-full blur-[120px]"
         />
         <motion.div
            animate={{ scale: [1.2, 1, 1.2], rotate: [0, -45, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/40 rounded-full blur-[120px]"
         />
      </div>

      {/* --- মেইন গ্লাস কার্ড --- */}
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-5xl"
      >
        <div className="relative bg-white/40 dark:bg-black/40 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-[2.5rem] p-8 md:p-14 shadow-2xl overflow-hidden group">
          
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />

          <div className="flex flex-col md:flex-row items-center justify-between gap-10">
            
            {/* বাম পাশ: টেক্সট */}
            <div className="text-center md:text-left md:w-1/2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/50 dark:bg-black/20 border border-white/40 backdrop-blur-md mb-6 shadow-sm">
                <Sparkles size={16} className="text-primary" />
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide">VECKOBREV</span>
              </div>
              
              <h2 className="text-4xl md:text-5xl font-black text-ink-900 dark:text-white leading-tight mb-4">
                Lås upp exklusiva<br/>
                <span className="text-brand-gradient">familjetips.</span>
              </h2>

              <p className="text-lg text-ink-500 dark:text-ink-200 leading-relaxed">
                Gör som över 10 000 föräldrar, få våra utvalda evenemang och veckans bästa tips direkt i inkorgen.
              </p>
            </div>

            {/* ডান পাশ: ফর্ম */}
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-end">
              
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="mb-8 w-20 h-20 bg-gradient-to-br from-white to-pink-50 rounded-2xl shadow-xl flex items-center justify-center border border-white/60 relative"
              >
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                  <Mail className="text-primary relative z-10" size={40} />
              </motion.div>

              <form onSubmit={handleSubscribe} className="w-full relative group/input">
                <div className="relative flex items-center">
                   <Mail className="absolute left-5 text-gray-400 group-focus-within/input:text-primary transition-colors" size={20} />
                   
                   <input 
                    type="email" 
                    placeholder="namn@exempel.se" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-14 pr-36 py-4 rounded-2xl bg-white dark:bg-gray-800 border border-white/40 dark:border-gray-700 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                    required
                    data-lpignore="true"  
                    autoComplete="off"
                   />

                   <button 
                    disabled={loading || status === 'success'}
                    className="absolute right-2 top-2 bottom-2 bg-gray-900 dark:bg-white text-white dark:text-black px-6 rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                   >
                     {loading ? (
                       <Loader2 className="animate-spin" size={18} />
                     ) : status === 'success' ? (
                       <CheckCircle size={18} />
                     ) : (
                       <>Gå med <ArrowRight size={18} /></>
                     )}
                   </button>
                </div>
              </form>

              {status === 'success' && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 text-sm text-green-600 font-medium flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full border border-green-100"
                >
                  <CheckCircle size={14} /> Du står nu på listan!
                </motion.p>
              )}
              
              {/* ✅ FIXED TEXT: Short & Clear */}
              <div className="mt-4 flex items-center justify-center md:justify-end gap-1.5 w-full text-xs font-semibold text-gray-500 dark:text-gray-400">
                <Lock size={12} className="text-green-500" />
                <span>Ingen spam. Avsluta när du vill.</span>
              </div>

            </div>

          </div>
        </div>
      </motion.div>
    </section>
  );
}