'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Mail,
  MessageSquare,
  User,
  Send,
  Sparkles,
  PenTool,
  Check,
  Loader2,
  ArrowRight,
  Clock,
  Heart,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

// Apps Script Web App endpoint — appends rows to the "Contact" tab of the
// Famies Google Sheet. Source: google-apps-script/contact-form.gs
const CONTACT_SHEET_URL = 
  'https://script.google.com/macros/s/AKfycbyq16q7an0PgYXiZHyPnM7kWO8BYiaZN7wTnu7M5yQ4Crz-OTx8ODHhdh0FoGNSt5ncTQ/exec';

export default function Contact() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const loadingToast = toast.loading('Skickar ditt meddelande...');

    try {
      // Google Sheet ("Contact" tab) is the primary inbox; Supabase is a backup.
      // Apps Script has no CORS headers, so no-cors: the row is appended but
      // the response is opaque. Only a network failure makes fetch throw.
      const [sheetResult, dbResult] = await Promise.allSettled([
        fetch(CONTACT_SHEET_URL, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify(formData),
        }),
        supabase.from('contact_messages').insert([formData]),
      ]);

      const dbError =
        dbResult.status === 'rejected' ? dbResult.reason : dbResult.value.error;
      if (dbError) console.error(dbError);
      if (sheetResult.status === 'rejected' && dbError) {
        throw sheetResult.reason;
      }

      toast.success(
        <span className="flex flex-col">
          <span className="font-bold text-lg">Meddelande skickat</span>
          <span className="text-sm text-ink-500 font-normal">
            Vi återkommer så fort vi bara kan.
          </span>
        </span>,
        { id: loadingToast, duration: 5000 }
      );

      setSuccess(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      console.error(error);
      toast.error(
        <span className="flex flex-col">
          <span className="font-bold">Det gick inte att skicka</span>
          <span className="text-xs text-ink-500 font-normal mt-1">
            {error.message || 'Något blev fel'}
          </span>
        </span>,
        { id: loadingToast }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden font-sans selection:bg-primary selection:text-white py-24 md:py-32 px-4 flex items-center justify-center section">
      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-14 items-center">
        {/* LEFT */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-8"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full glass shadow-soft text-xs font-bold uppercase tracking-wider text-primary">
              <MessageSquare size={14} />
              Hör av dig
            </div>

            <h1 className="text-5xl md:text-6xl font-black text-ink-900 dark:text-white leading-[1.02] mb-6">
              Prata med <br />
              <span className="text-brand-gradient">Famies.</span>
            </h1>

            <p className="text-lg md:text-xl text-ink-500 dark:text-ink-300 leading-relaxed max-w-lg font-medium">
              Fråga, ge feedback, eller tipsa oss om ett evenemang. Vi läser
              varje meddelande själva.
            </p>
          </div>

          {/* Info cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            <InfoCard
              icon={Mail}
              title="Mejla direkt"
              body="support@famies.app"
              href="mailto:support@famies.app"
              tint="pink"
            />
            <InfoCard
              icon={Clock}
              title="Svarstid"
              body="Vi återkommer så fort vi bara kan."
              tint="mint"
            />
            <InfoCard
              icon={Sparkles}
              title="Förslag & önskemål"
              body="Saknar du något? Säg till, vi bygger gärna det ni behöver."
              tint="pink"
            />
            <InfoCard
              icon={Heart}
              title="Gratis, alltid"
              body="Famies är gratis för familjer. För alltid."
              tint="mint"
            />
          </div>
        </motion.div>

        {/* RIGHT, form */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="relative"
        >
          {/* soft card glow */}
          <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] rounded-[3rem] blur-3xl bg-brand-gradient-soft opacity-70" />

          <div className="relative glass rounded-[2.2rem] md:rounded-[2.5rem] shadow-soft p-7 md:p-10">
            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField
                    label="Ditt namn"
                    icon={User}
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    type="text"
                    placeholder="Anna Andersson"
                  />
                  <FormField
                    label="E-postadress"
                    icon={Mail}
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    type="email"
                    placeholder="anna@exempel.se"
                  />
                </div>

                <FormField
                  label="Ämne"
                  icon={PenTool}
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  type="text"
                  placeholder="Vad handlar det om?"
                />

                <div className="space-y-2">
                  <label className="text-sm font-bold text-ink-700 dark:text-ink-100 ml-1">
                    Meddelande
                  </label>
                  <textarea
                    name="message"
                    required
                    value={formData.message}
                    onChange={handleChange}
                    rows="5"
                    placeholder="Berätta mer..."
                    className="w-full bg-white/70 dark:bg-ink-100/5 border border-ink-100/70 dark:border-ink-700/50 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-primary/40 focus:border-primary/40 outline-none transition-all resize-none text-ink-900 dark:text-white placeholder:text-ink-300"
                  />
                </div>

                <button
                  disabled={loading}
                  className="press w-full bg-primary text-white font-extrabold py-4 rounded-2xl shadow-pink hover:shadow-glow-pink transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      Skicka meddelande <Send size={18} />
                    </>
                  )}
                </button>

                <p className="text-xs text-ink-500 dark:text-ink-300 text-center pt-1">
                  Genom att skicka godkänner du vår{' '}
                  <a href="/privacy" className="text-primary font-semibold underline-offset-2 hover:underline">
                    integritetspolicy
                  </a>
                  .
                </p>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="text-center py-10"
              >
                <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6 shadow-mint">
                  <Check className="text-green-800 w-10 h-10" strokeWidth={3} />
                </div>
                <h2 className="text-3xl font-black text-ink-900 dark:text-white mb-3">
                  Meddelande skickat
                </h2>
                <p className="text-ink-500 dark:text-ink-300 text-lg mb-8 max-w-md mx-auto">
                  Vi återkommer så fort vi bara kan.
                </p>
                <button
                  onClick={() => setSuccess(false)}
                  className="press text-primary font-bold hover:underline flex items-center justify-center gap-2 mx-auto"
                >
                  Skicka ett till <ArrowRight size={16} />
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, body, href, tint }) {
  const isPink = tint === 'pink';
  const content = (
    <div className="group glass rounded-2xl p-5 shadow-soft h-full transition-all duration-500 hover:-translate-y-1 hover:shadow-pink">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
          isPink ? 'bg-primary/15 text-primary' : 'bg-secondary/60 text-green-700'
        }`}
      >
        <Icon size={18} />
      </div>
      <h3 className="font-extrabold text-ink-900 dark:text-white mb-1 text-[15px]">
        {title}
      </h3>
      <p className="text-ink-500 dark:text-ink-300 text-sm leading-snug">
        {body}
      </p>
    </div>
  );

  return href ? <a href={href}>{content}</a> : content;
}

function FormField({ label, icon: Icon, name, value, onChange, type, placeholder }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-ink-700 dark:text-ink-100 ml-1">
        {label}
      </label>
      <div className="relative group">
        <Icon
          className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 group-focus-within:text-primary transition-colors"
          size={18}
        />
        <input
          name={name}
          required
          value={value}
          onChange={onChange}
          type={type}
          placeholder={placeholder}
          className="w-full bg-white/70 dark:bg-ink-100/5 border border-ink-100/70 dark:border-ink-700/50 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-primary/40 focus:border-primary/40 outline-none transition-all text-ink-900 dark:text-white placeholder:text-ink-300"
        />
      </div>
    </div>
  );
}
