'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { Sparkles, MapPin, User, Mail, Baby, Check, Loader2, ArrowRight, Send, Heart, Users, Camera, ArrowDown } from 'lucide-react';
import { submitForm } from '@/lib/forms';

// --- Animated Counter Component ---
function Counter({ value }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const springValue = useSpring(0, { bounce: 0, duration: 2500 }); // 2.5s duration

  useEffect(() => {
    if (inView) {
      springValue.set(value);
    }
  }, [inView, value, springValue]);

  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      setDisplayValue(Math.round(latest));
    });
  }, [springValue]);

  return <span ref={ref}>{displayValue}</span>;
}

export default function EarlyAccess() {
  const formRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen w-full bg-white dark:bg-black relative overflow-hidden font-sans selection:bg-primary selection:text-white">
      
      {/* --- Global Animated Background (Fixed) --- */}
      <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <motion.div 
           animate={{ scale: [1, 1.5, 1], rotate: [0, 90, 0], opacity: [0.2, 0.4, 0.2] }}
           transition={{ duration: 20, repeat: Infinity }}
           className="absolute -top-[20%] -left-[10%] w-[800px] h-[800px] bg-primary/20 rounded-full blur-[150px]"
        />
        <motion.div 
           animate={{ scale: [1.2, 1, 1.2], x: [0, 100, 0], opacity: [0.2, 0.5, 0.2] }}
           transition={{ duration: 15, repeat: Infinity }}
           className="absolute top-[40%] right-[-20%] w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-[150px]"
        />
        <motion.div 
           animate={{ y: [0, -50, 0], opacity: [0.1, 0.3, 0.1] }}
           transition={{ duration: 10, repeat: Infinity }}
           className="absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] bg-pink-400/20 rounded-full blur-[120px]"
        />
      </div>

      {/* ================= HERO SECTION ================= */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-md border border-white/20 mb-8 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Beta-ansökan är öppen</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight tracking-tight">
            "Vad ska vi <br/> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">göra idag?"</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Varje familj känner igen frågan. Famies hjälper dig att hitta roliga aktiviteter, träffa andra föräldrar och upptäcka nya lokala smultronställen.
            <br/><span className="font-semibold text-primary">Mindre skärmtid, mer familjetid.</span>
          </p>

          <button 
            onClick={scrollToForm}
            className="bg-black dark:bg-white text-white dark:text-black px-10 py-5 rounded-full font-bold text-lg shadow-xl hover:scale-105 transition-transform flex items-center gap-2 mx-auto"
          >
            Ansök om tillgång <ArrowDown size={20} />
          </button>
        </motion.div>
      </section>

      {/* ================= FEATURES SECTION ================= */}
      <section className="relative z-10 py-32 px-4">
        <div className="max-w-6xl mx-auto text-center mb-20">
          <h2 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">Allt du behöver som förälder</h2>
          <p className="text-gray-500 text-lg">Vi samlar allt det roliga på ett ställe.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <FeatureCard 
            icon={<MapPin className="text-white" size={32} />} 
            title="Upptäck lokala pärlor"
            desc="Få tips om lekparker, barnvänliga caféer och dolda smultronställen nära dig."
            color="bg-pink-500"
          />
          <FeatureCard 
            icon={<Users className="text-white" size={32} />} 
            title="Bygg gemenskap"
            desc="Hitta andra föräldrar med barn i samma ålder. Skapa lekgrupper enkelt."
            color="bg-purple-500"
          />
          <FeatureCard 
            icon={<Camera className="text-white" size={32} />} 
            title="Skapa minnen"
            desc="Samla era bästa stunder och dela dem säkert med nära och kära."
            color="bg-orange-500"
          />
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="relative z-10 py-32 bg-white/50 dark:bg-black/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6">Hur fungerar det?</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">Det är enkelt att komma igång. Följ bara dessa tre steg.</p>
          </div>

          <div className="space-y-8">
            <StepCard 
              number="1" 
              title="Upptäck" 
              desc="Få personliga tips på aktiviteter nära dig, anpassat efter dina och barnens ålder och intressen." 
            />
            <StepCard 
              number="2" 
              title="Matcha" 
              desc="Bli inspirerad och hitta andra familjer som gillar samma saker, eller låt Famies föreslå er perfekta match." 
            />
            <StepCard 
              number="3" 
              title="Upplev" 
              desc="Gör något kul tillsammans. Mindre planering, mer familjetid." 
            />
          </div>
          
          <div className="text-center mt-12">
             <button onClick={scrollToForm} className="text-primary font-bold hover:underline text-lg">Ansök om tidigt tillgång &rarr;</button>
          </div>
        </div>
      </section>

      {/* ================= STATS / QUEUE ================= */}
      <section className="relative z-10 py-24 text-center px-4">
        <motion.div 
           initial={{ scale: 0.5, opacity: 0 }}
           whileInView={{ scale: 1, opacity: 1 }}
           className="inline-block"
        >
          {/* 🔥 Updated: Animated Counter */}
          <h2 className="text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-primary to-pink-200 opacity-50 flex items-center justify-center">
            <Counter value={1767} />+
          </h2>
        </motion.div>
        <h3 className="text-3xl font-bold text-gray-900 dark:text-white -mt-4 md:-mt-8 relative z-20">familjer står redan i kö</h3>
        <p className="text-gray-500 mt-4 max-w-md mx-auto">Vi öppnar snart för din kommun, vill du vara en av dem?</p>
        
        <div className="mt-8">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold uppercase tracking-wider">
            🔥 Högt tryck just nu
          </span>
        </div>
      </section>

      {/* ================= FORM SECTION (The Main Box) ================= */}
      <section ref={formRef} id="apply-form" className="relative z-10 py-20 px-4 flex justify-center">
         <ApplicationForm />
      </section>

      {/* ================= MISSION STATEMENT ================= */}
      <section className="relative z-10 py-32 px-4 text-center bg-gradient-to-b from-transparent to-primary/5">
        <div className="max-w-3xl mx-auto">
          <Heart className="w-16 h-16 text-primary mx-auto mb-8 animate-pulse" />
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white leading-relaxed">
            "Vi tror att världen behöver mer lek, skratt och gemenskap. Famies är för familjer som vill göra livet lite mer verkligt, tillsammans."
          </h2>
        </div>
      </section>

      {/* Footer is handled globally by layout.js */}
    </div>
  );
}

// --- SUB COMPONENTS ---

function FeatureCard({ icon, title, desc, color }) {
  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className="p-8 rounded-[2rem] bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-lg text-left"
    >
      <div className={`w-16 h-16 ${color} rounded-2xl flex items-center justify-center mb-6 shadow-md`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{desc}</p>
    </motion.div>
  );
}

function StepCard({ number, title, desc }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="flex items-center gap-6 p-6 md:p-8 rounded-3xl bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-800 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-bl-full -mr-10 -mt-10" />
      
      <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-primary to-pink-500 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg z-10">
        {number}
      </div>
      <div className="z-10">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}.</h3>
        <p className="text-gray-600 dark:text-gray-400">{desc}</p>
      </div>
    </motion.div>
  );
}

// --- MAIN FORM COMPONENT ---
function ApplicationForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    municipality: '',
    email: '',
    childrenAge: '',
    wantsFeedback: false
  });

  const ageOptions = ["0-1 år", "2-3 år", "4-6 år", "7-9 år", "10-12 år", "13+ år"];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await submitForm('early-access', {
        name: formData.name,
        municipality: formData.municipality,
        email: formData.email,
        children_age: formData.childrenAge,
        wants_feedback: formData.wantsFeedback
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error) {
      alert('Something went wrong! Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="relative w-full max-w-2xl bg-white/70 dark:bg-gray-900/70 backdrop-blur-3xl border border-white/50 dark:border-white/10 rounded-[2.5rem] shadow-2xl p-8 md:p-12 overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50" />

        {!success ? (
          <>
            <div className="text-center mb-10">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-16 h-16 mx-auto bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mb-6 rotate-3">
                <Sparkles className="text-white w-8 h-8" />
              </motion.div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3 leading-tight">
                Famies växer kommun för kommun. <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">Ansök om beta-access.</span>
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-lg">Vi släpper in nya familjer varje vecka. 🚀</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Namn - Updated Placeholder */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Namn</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                    <input 
                      name="name" 
                      required 
                      onChange={handleChange} 
                      type="text" 
                      placeholder="Anna Andersson" // ✨ প্লেসহোল্ডার যোগ করা হয়েছে
                      className="w-full bg-white/50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-primary/50 outline-none transition-all placeholder:text-gray-400" 
                    />
                  </div>
                </div>

                {/* Kommun - Updated Placeholder */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Kommun</label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                    <input 
                      name="municipality" 
                      required 
                      onChange={handleChange} 
                      type="text" 
                      placeholder="Stockholm, Sweden" // ✨ প্লেসহোল্ডার যোগ করা হয়েছে
                      className="w-full bg-white/50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-primary/50 outline-none transition-all placeholder:text-gray-400" 
                    />
                  </div>
                </div>
              </div>

              {/* Email - Updated Placeholder */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">E-post</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                  <input 
                    name="email" 
                    required 
                    onChange={handleChange} 
                    type="email" 
                    placeholder="anna@exempel.se" // ✨ প্লেসহোল্ডার যোগ করা হয়েছে
                    className="w-full bg-white/50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-primary/50 outline-none transition-all placeholder:text-gray-400" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Barnens ålder</label>
                <div className="relative group">
                  <Baby className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                  <select name="childrenAge" required onChange={handleChange} defaultValue="" className="w-full bg-white/50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-primary/50 outline-none transition-all appearance-none cursor-pointer text-gray-700 dark:text-gray-300">
                    <option value="" disabled>Välj ålder</option>
                    {ageOptions.map((age) => <option key={age} value={age} className="text-black bg-white">{age}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                <input name="wantsFeedback" onChange={handleChange} type="checkbox" id="feedback" className="mt-1 h-5 w-5 cursor-pointer accent-primary" />
                <label htmlFor="feedback" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">Jag är intresserad av att ge feedback för att vara med och forma framtidens sociala nätverk för familjer.</label>
              </div>

              <button disabled={loading} className="w-full bg-gradient-to-r from-gray-900 to-black dark:from-white dark:to-gray-200 text-white dark:text-black font-bold py-4 rounded-xl shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" /> : <>Anmäl mig till betan <Send size={18} /></>}
              </button>
            </form>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><Check className="text-green-600 w-12 h-12" strokeWidth={3} /></div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Tack för din ansökan! 🎉</h2>
            <p className="text-gray-600 dark:text-gray-300 text-lg mb-8">Vi har mottagit dina uppgifter. Håll utkik i din inkorg!</p>
            <button onClick={() => setSuccess(false)} className="text-primary font-bold hover:underline flex items-center justify-center gap-2 mx-auto">Tillbaka till startsidan <ArrowRight size={16} /></button>
          </motion.div>
        )}
      </motion.div>
  );
}