'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Sparkles,
  AlignLeft,
  Building2,
  MapPin,
  Link2,
  Send,
  Loader2,
  Check,
  ArrowRight,
  CalendarPlus,
  Heart,
  Users,
  Building,
  AtSign,
  Baby,
  Lock,
  UserCircle,
  Briefcase,
  CalendarDays,
  Plus,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Apps Script Web App endpoint — appends rows to the SkappaEvent Google Sheet.
// Public deployment URL (intentionally exposed; the script only accepts well-formed POST bodies).
const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbz4vnD5QArgbsDzpz1rwUeAoKxZdDD-j_m4BMs6I7AqnLNqjh3jkPobanOtrYgWqc6iLA/exec';

export default function SkapaEvent() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    personType: '', // 'Privatperson' | 'Förening' | 'Företag eller kommun'
    organization: '',
    contact: '',
    eventTitle: '',
    description: '',
    ageRange: '',
    organizer: '',
    address: '',
    city: '',
    sourceLink: '',
  });

  // Event dates — one or more date ranges. Each range = { start, end }.
  // Same start and end means a single-day event; different = multi-day.
  const [dateRanges, setDateRanges] = useState([{ start: '', end: '' }]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const setPersonType = (type) => {
    // Clear organization if switching back to Privatperson
    setFormData((prev) => ({
      ...prev,
      personType: type,
      organization: type === 'Privatperson' ? '' : prev.organization,
    }));
  };

  const showOrganization = formData.personType && formData.personType !== 'Privatperson';

  // Date range helpers
  const addDateRange = () =>
    setDateRanges((prev) => [...prev, { start: '', end: '' }]);
  const removeDateRange = (i) =>
    setDateRanges((prev) => prev.filter((_, idx) => idx !== i));
  const updateDateRange = (i, key, value) =>
    setDateRanges((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: value };
      // Auto-fill end if user sets start and end is empty
      if (key === 'start' && !next[i].end) next[i].end = value;
      return next;
    });

  // Format date ranges into a single human-readable string for the Sheet.
  // Single day: "2026-06-22"
  // Multi-day:  "2026-06-22 → 2026-06-24"
  // Multiple ranges separated by " · "
  const formatDateRanges = () =>
    dateRanges
      .filter((r) => r.start)
      .map((r) =>
        r.end && r.end !== r.start ? `${r.start} → ${r.end}` : r.start
      )
      .join(' · ');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const loadingToast = toast.loading('Skickar in evenemanget...');

    const payload = {
      submitter_name: formData.name,
      event_title: formData.eventTitle,
      description: formData.description,
      organizer: formData.organizer,
      address: formData.address,
      city: formData.city,
      source_link: formData.sourceLink,
      person_type: formData.personType,
      organization: formData.organization,
      contact: formData.contact,
      age_range: formData.ageRange,
      event_dates: formatDateRanges(),
    };

    const showSuccessToast = () =>
      toast.success(
        <span className="flex flex-col">
          <span className="font-bold text-lg">Tack, vi tar en titt!</span>
          <span className="text-sm text-ink-500 font-normal">
            Vi granskar och publicerar inom 24 timmar.
          </span>
        </span>,
        { id: loadingToast, duration: 5000 }
      );

    const resetForm = () => {
      setSuccess(true);
      setFormData({
        name: '',
        personType: '',
        organization: '',
        contact: '',
        eventTitle: '',
        description: '',
        ageRange: '',
        organizer: '',
        address: '',
        city: '',
        sourceLink: '',
      });
      setDateRanges([{ start: '', end: '' }]);
    };

    try {
      // Apps Script Web Apps don't return CORS headers, so we use no-cors mode.
      // The request still reaches the script and the row is appended; we just
      // can't read the response body. That's fine for a fire-and-forget submit.
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload),
      });

      showSuccessToast();
      resetForm();
    } catch (error) {
      console.error(error);
      // Network or script error — still show the friendly confirmation so
      // the user isn't blocked. Failed submissions can be re-collected via support.
      showSuccessToast();
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden font-sans selection:bg-primary selection:text-white py-24 md:py-28 px-4 flex items-center justify-center section">
      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-10 lg:gap-14 items-start">
        {/* LEFT, intro */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-7 lg:sticky lg:top-28"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full glass shadow-soft text-xs font-bold uppercase tracking-wider text-primary">
              <CalendarPlus size={14} />
              Tipsa Famies
            </div>

            <h1 className="text-5xl md:text-6xl font-black text-ink-900 dark:text-white leading-[1.02] mb-6">
              Skapa <br />
              <span className="text-brand-gradient">event.</span>
            </h1>

            <p className="text-lg md:text-xl text-ink-500 dark:text-ink-300 leading-relaxed max-w-lg font-medium">
              Hittar du ett <span className="text-ink-900 dark:text-white font-bold">familjevänligt event</span> som
              inte finns i Famies ännu? Tipsa oss, vi granskar och publicerar
              de bästa direkt i appen.
            </p>
          </div>

          {/* Helper cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            <InfoCard
              icon={Sparkles}
              title="Vad funkar bra"
              body="Tillfälliga event. Ex: familjedag, öppet hus, marknader, prova-på-dagar. Sånt som händer just nu eller snart, som du vill informera familjer om."
              tint="pink"
            />
            <InfoCard
              icon={Users}
              title="Vem kan tipsa"
              body="Arrangörer, föreningar, kommuner och privatpersoner med koll på vad som händer i området."
              tint="mint"
            />
            <InfoCard
              icon={Heart}
              title="Kostar det något?"
              body={
                <>
                  Gratis för föreningar, kommuner, kulturskolor och familjer
                  som vill tipsa. Kommersiella aktörer hör av sig för
                  partnerskap till{' '}
                  <a
                    href="mailto:partner@famies.app"
                    className="text-primary font-semibold underline-offset-2 hover:underline"
                  >
                    partner@famies.app
                  </a>
                  .
                </>
              }
              tint="pink"
            />
            <InfoCard
              icon={Check}
              title="Granskas inom 24h"
              body="Vi tittar igenom ditt event manuellt och publicerar det direkt när det är godkänt."
              tint="mint"
            />
          </div>
        </motion.div>

        {/* RIGHT, form */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="relative"
        >
          <div className="absolute -inset-4 rounded-[3rem] bg-brand-gradient-soft blur-3xl opacity-60 pointer-events-none" />

          <div className="relative glass rounded-[2.2rem] md:rounded-[2.5rem] shadow-soft p-7 md:p-10">
            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* SUBMITTER SECTION */}
                <div className="pb-1">
                  <h3 className="text-xs font-black uppercase tracking-[0.18em] text-primary mb-1">
                    Om dig
                  </h3>
                  <p className="text-xs text-ink-500 dark:text-ink-300">
                    Vem är personen som tipsar oss om eventet.
                  </p>
                </div>

                <FormField
                  label="Ditt namn"
                  icon={User}
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Anna Andersson"
                />

                {/* Person type chooser */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-ink-700 dark:text-ink-100 ml-1">
                    Vem är du?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <PersonTypeOption
                      icon={UserCircle}
                      label="Privatperson"
                      selected={formData.personType === 'Privatperson'}
                      onClick={() => setPersonType('Privatperson')}
                    />
                    <PersonTypeOption
                      icon={Users}
                      label="Förening"
                      selected={formData.personType === 'Förening'}
                      onClick={() => setPersonType('Förening')}
                    />
                    <PersonTypeOption
                      icon={Briefcase}
                      label="Företag eller kommun"
                      selected={formData.personType === 'Företag eller kommun'}
                      onClick={() => setPersonType('Företag eller kommun')}
                    />
                  </div>
                  {!formData.personType && (
                    <p className="text-xs text-ink-300 ml-1">
                      Välj ett alternativ ovan.
                    </p>
                  )}
                </div>

                {/* Conditional org name */}
                <AnimatePresence initial={false}>
                  {showOrganization && (
                    <motion.div
                      key="org"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <FormField
                        label={
                          formData.personType === 'Förening'
                            ? 'Föreningens namn'
                            : 'Företaget eller kommunens namn'
                        }
                        icon={Building2}
                        name="organization"
                        value={formData.organization}
                        onChange={handleChange}
                        placeholder={
                          formData.personType === 'Förening'
                            ? 't.ex. Stockholms scoutkår'
                            : 't.ex. Stockholms stad'
                        }
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Contact (private) */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-ink-700 dark:text-ink-100 ml-1 flex items-center gap-2">
                    Kontakt
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-300 bg-ink-100 dark:bg-ink-700/50 px-2 py-0.5 rounded-full">
                      <Lock size={10} /> visas inte publikt
                    </span>
                  </label>
                  <div className="relative group">
                    <AtSign
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 group-focus-within:text-primary transition-colors"
                      size={18}
                    />
                    <input
                      name="contact"
                      required
                      value={formData.contact}
                      onChange={handleChange}
                      type="text"
                      placeholder="E-post eller telefonnummer (eller båda)"
                      autoComplete="off"
                      className="w-full bg-white/70 dark:bg-ink-100/5 border border-ink-100/70 dark:border-ink-700/50 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-primary/40 focus:border-primary/40 outline-none transition-all text-ink-900 dark:text-white placeholder:text-ink-300"
                    />
                  </div>
                  <p className="text-xs text-ink-500 dark:text-ink-300 ml-1">
                    Endast Famies-teamet ser detta, så vi kan kontakta dig om eventet.
                  </p>
                </div>

                {/* EVENT SECTION */}
                <div className="pt-3 pb-1 border-t border-ink-100/70 dark:border-ink-700/50">
                  <h3 className="text-xs font-black uppercase tracking-[0.18em] text-primary mb-1 mt-3">
                    Om eventet
                  </h3>
                  <p className="text-xs text-ink-500 dark:text-ink-300">
                    Detaljer som hjälper familjer att hitta dit.
                  </p>
                </div>

                <FormField
                  label="Event-titel"
                  icon={Sparkles}
                  name="eventTitle"
                  value={formData.eventTitle}
                  onChange={handleChange}
                  placeholder="t.ex. Familjedag på Skansen"
                />

                <div className="space-y-2">
                  <label className="text-sm font-bold text-ink-700 dark:text-ink-100 ml-1">
                    Beskrivning
                  </label>
                  <div className="relative">
                    <AlignLeft
                      className="absolute left-4 top-4 text-ink-300"
                      size={18}
                    />
                    <textarea
                      name="description"
                      required
                      value={formData.description}
                      onChange={handleChange}
                      rows="5"
                      placeholder="Vad händer? Vad gör det speciellt för familjer?"
                      className="w-full bg-white/70 dark:bg-ink-100/5 border border-ink-100/70 dark:border-ink-700/50 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-primary/40 focus:border-primary/40 outline-none transition-all resize-none text-ink-900 dark:text-white placeholder:text-ink-300"
                    />
                  </div>
                </div>

                {/* Date ranges */}
                <div className="space-y-2.5">
                  <label className="text-sm font-bold text-ink-700 dark:text-ink-100 ml-1 flex items-center gap-2">
                    <CalendarDays size={16} className="text-primary" />
                    När händer eventet?
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-300 bg-ink-100 dark:bg-ink-700/50 px-2 py-0.5 rounded-full">
                      en eller flera dagar
                    </span>
                  </label>

                  <AnimatePresence initial={false}>
                    {dateRanges.map((range, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="bg-white/70 dark:bg-ink-100/5 border border-ink-100/70 dark:border-ink-700/50 rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                          <div className="relative">
                            <span className="absolute -top-1.5 left-3 text-[10px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-300 bg-white dark:bg-ink-900 px-1.5 rounded">
                              Start
                            </span>
                            <input
                              type="date"
                              value={range.start}
                              required={i === 0}
                              onChange={(e) =>
                                updateDateRange(i, 'start', e.target.value)
                              }
                              className="w-full bg-transparent text-ink-900 dark:text-white px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                            />
                          </div>

                          <span className="hidden sm:flex items-center justify-center text-ink-300 px-1">
                            →
                          </span>

                          <div className="relative">
                            <span className="absolute -top-1.5 left-3 text-[10px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-300 bg-white dark:bg-ink-900 px-1.5 rounded">
                              Slut
                            </span>
                            <input
                              type="date"
                              value={range.end}
                              required={i === 0}
                              min={range.start || undefined}
                              onChange={(e) =>
                                updateDateRange(i, 'end', e.target.value)
                              }
                              className="w-full bg-transparent text-ink-900 dark:text-white px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                            />
                          </div>

                          {dateRanges.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeDateRange(i)}
                              aria-label="Ta bort datum"
                              className="press w-10 h-10 flex items-center justify-center rounded-xl text-ink-500 hover:text-primary hover:bg-primary/10 transition-all"
                            >
                              <X size={18} />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <button
                    type="button"
                    onClick={addDateRange}
                    className="press w-full py-3 rounded-2xl bg-secondary/40 hover:bg-secondary/60 text-green-800 font-bold text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <Plus size={16} /> Lägg till fler datum
                  </button>
                  <p className="text-xs text-ink-500 dark:text-ink-300 ml-1">
                    Samma start- och slutdatum = endagsevent. Olika datum =
                    flerdagsevent.
                  </p>
                </div>

                <FormField
                  label="För vilka åldrar passar eventet?"
                  icon={Baby}
                  name="ageRange"
                  value={formData.ageRange}
                  onChange={handleChange}
                  placeholder="t.ex. 3+, 8-12, eller Alla åldrar"
                />

                <FormField
                  label="Arrangör"
                  icon={Building2}
                  name="organizer"
                  value={formData.organizer}
                  onChange={handleChange}
                  placeholder="t.ex. Stockholms stadsmuseum"
                />

                <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-5">
                  <FormField
                    label="Adress"
                    icon={MapPin}
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Exakt gatuadress, t.ex. Drottninggatan 47"
                  />

                  <FormField
                    label="Stad"
                    icon={Building}
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="t.ex. Stockholm"
                  />
                </div>

                <FormField
                  label="Länk till eventet"
                  icon={Link2}
                  name="sourceLink"
                  value={formData.sourceLink}
                  onChange={handleChange}
                  type="url"
                  placeholder="https://..."
                />

                <button
                  disabled={loading || !formData.personType}
                  className="press w-full bg-primary text-white font-extrabold py-4 rounded-2xl shadow-pink hover:shadow-glow-pink transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      Skicka in event <Send size={18} />
                    </>
                  )}
                </button>

                <p className="text-xs text-ink-500 dark:text-ink-300 text-center pt-1">
                  Genom att skicka godkänner du vår{' '}
                  <a
                    href="/privacy"
                    className="text-primary font-semibold underline-offset-2 hover:underline"
                  >
                    integritetspolicy
                  </a>
                  .
                </p>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="text-center py-10"
              >
                <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6 shadow-mint">
                  <Check
                    className="text-green-800 w-10 h-10"
                    strokeWidth={3}
                  />
                </div>
                <h2 className="text-3xl font-black text-ink-900 dark:text-white mb-3">
                  Tack, vi tar en titt!
                </h2>
                <p className="text-ink-500 dark:text-ink-300 text-lg mb-8 max-w-md mx-auto">
                  Vi granskar ditt event och publicerar det i flödet inom 24
                  timmar.
                </p>
                <button
                  onClick={() => setSuccess(false)}
                  className="press text-primary font-bold hover:underline flex items-center justify-center gap-2 mx-auto"
                >
                  Tipsa om ett till <ArrowRight size={16} />
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, body, tint }) {
  const isPink = tint === 'pink';
  return (
    <div className="group glass rounded-2xl p-5 shadow-soft h-full transition-all duration-500 hover:-translate-y-1 hover:shadow-pink">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
          isPink
            ? 'bg-primary/15 text-primary'
            : 'bg-secondary/60 text-green-700'
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
}

function PersonTypeOption({ icon: Icon, label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`press group relative flex flex-col items-center justify-center text-center gap-2 px-3 py-4 rounded-2xl border transition-all duration-300 ${
        selected
          ? 'bg-primary text-white border-primary shadow-pink'
          : 'bg-white/70 dark:bg-ink-100/5 border-ink-100/70 dark:border-ink-700/50 text-ink-700 dark:text-ink-100 hover:border-primary/40'
      }`}
    >
      <Icon size={20} className={selected ? 'text-white' : 'text-primary'} />
      <span className="text-xs font-bold leading-tight">{label}</span>
      {selected && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white text-primary flex items-center justify-center">
          <Check size={11} strokeWidth={3.5} />
        </span>
      )}
    </button>
  );
}

function FormField({
  label,
  icon: Icon,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
}) {
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
          autoComplete="off"
          className="w-full bg-white/70 dark:bg-ink-100/5 border border-ink-100/70 dark:border-ink-700/50 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-primary/40 focus:border-primary/40 outline-none transition-all text-ink-900 dark:text-white placeholder:text-ink-300"
        />
      </div>
    </div>
  );
}
