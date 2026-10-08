'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Droplet, Save, Check, RotateCcw, Palette, Sparkles, Wand2, AlertTriangle, MapPin } from 'lucide-react';
import { PageHeader, Card, Button, Notice, LoadingBlock, Textarea } from '@/components/admin/ui';
import { useModal } from '@/components/admin/AdminModal';
import { THEME_KEYS, toRgbChannels } from '@/lib/theme-colors';
import { cn } from '@/lib/utils';

/**
 * Theme Colors (site_settings keys theme_accent, theme_accent_hover,
 * theme_mint, theme_bg, theme_text). Empty = use the stock brand color
 * from globals.css / tailwind.config.js. The public site turns these into
 * CSS variables via buildThemeCSS() in src/lib/theme-colors.js.
 */

// Stock values from globals.css / tailwind.config.js.
const DEFAULTS = {
  theme_accent: '#FF8FAF',
  theme_accent_hover: '#ff6f99',
  theme_mint: '#CCFAD6',
  theme_bg: '#ffffff',
  theme_text: '#0c0a13',
};

const ACCENT_SWATCHES = [
  '#FF8FAF', '#ff6f99', '#f472b6', '#ec4899', '#fb7185', '#f43f5e', '#f97316', '#f59e0b',
  '#a78bfa', '#8b5cf6', '#60a5fa', '#3b82f6', '#2dd4bf', '#14b8a6', '#22c55e', '#0c0a13',
];
const HOVER_SWATCHES = [
  '#ff6f99', '#ef4f7f', '#db2777', '#e11d48', '#ea580c', '#d97706', '#7c3aed', '#2563eb', '#0d9488', '#16a34a', '#2b2540',
];
const MINT_SWATCHES = [
  '#CCFAD6', '#a8f0ba', '#e9fdef', '#bbf7d0', '#99f6e4', '#bae6fd', '#ddd6fe', '#fbcfe8', '#fde68a', '#fed7aa', '#efecf2',
];
const TEXT_SWATCHES = ['#0c0a13', '#2b2540', '#111827', '#1f2937', '#0f172a', '#27272a', '#3f3f46', '#1c1917'];

const BG_PRESETS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Blush', value: 'linear-gradient(145deg, #fff4f8 0%, #ffffff 50%, #f4fef6 100%)' },
  { label: 'Soft pink', value: 'linear-gradient(145deg, #fff4f8 0%, #ffe1ec 100%)' },
  { label: 'Mint', value: 'linear-gradient(145deg, #f4fef6 0%, #e9fdef 100%)' },
  { label: 'Lavender', value: 'linear-gradient(145deg, #faf5ff 0%, #f3e8ff 50%, #fff4f8 100%)' },
  { label: 'Sky', value: 'linear-gradient(145deg, #f0f9ff 0%, #e0f2fe 50%, #f4fef6 100%)' },
  { label: 'Pearl', value: 'linear-gradient(145deg, #f8f9fc 0%, #eef1f8 43%, #e4e9f4 73%, #f8f9fc 100%)' },
  { label: 'Cream', value: 'linear-gradient(145deg, #fdf7ec 0%, #fbeed5 43%, #fae6c2 73%, #fdf7ec 100%)' },
];

const EMPTY = Object.fromEntries(THEME_KEYS.map((k) => [k, '']));

/** Any color toRgbChannels understands → "#rrggbb", else null. */
function toHex(value) {
  const ch = toRgbChannels(value);
  if (!ch) return null;
  return `#${ch
    .split(' ')
    .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Darken a color by lowering its HSL lightness. Returns "#rrggbb" or null. */
function darken(value, amount = 0.08) {
  const ch = toRgbChannels(value);
  if (!ch) return null;
  const [r, g, b] = ch.split(' ').map((n) => Math.min(255, Number(n)) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  l = Math.max(0, l - amount);
  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let out;
  if (s === 0) out = [l, l, l];
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    out = [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
  }
  return `#${out.map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`;
}

function cssSupports(prop, value) {
  if (typeof window === 'undefined' || !window.CSS?.supports) return true;
  return window.CSS.supports(prop, value);
}

/** Warning for a field value, or null when the site will use it as-is. */
function validate(key, raw) {
  const value = (raw || '').trim();
  if (!value) return null;
  if (key === 'theme_bg') {
    if (/[{};]/.test(value)) return 'Remove ";", "{" and "}". Enter only the value, e.g. #ffffff or linear-gradient(…).';
    if (!cssSupports('background', value)) return 'This is not a valid CSS background, so the browser will ignore it.';
    return null;
  }
  if (key === 'theme_text') {
    if (/[{};]/.test(value) || !cssSupports('color', value)) return 'This is not a valid CSS color, so the browser will ignore it.';
    return null;
  }
  // Accent / hover / mint feed Tailwind's RGB variables: hex or rgb() only.
  if (!toRgbChannels(value)) return 'Use a hex (#ff8faf) or rgb(255, 143, 175) value. Other formats are ignored by the site.';
  return null;
}

function FieldWarning({ text }) {
  if (!text) return null;
  return (
    <p className="mt-2 flex items-start gap-1.5 text-[12px] font-medium text-amber-700">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {text}
    </p>
  );
}

function ResetButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-ink-50 px-2 py-1 text-[11px] font-semibold text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
    >
      <RotateCcw className="h-3 w-3" /> Reset to default
    </button>
  );
}

function ColorCard({ fieldKey, label, hint, value, onChange, swatches, extra }) {
  const defaultValue = DEFAULTS[fieldKey];
  const effective = value.trim() && !validate(fieldKey, value) ? value.trim() : defaultValue;
  const pickerValue = toHex(effective) || toHex(defaultValue);
  const effectiveHex = toHex(effective)?.toLowerCase();
  const inputId = `theme-${fieldKey}`;

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="h-4 w-4 shrink-0 rounded border border-ink-200" style={{ background: effective }} />
            <label htmlFor={inputId} className="text-[14px] font-bold text-ink-900">
              {label}
            </label>
            {!value.trim() && <span className="text-[11px] font-semibold text-ink-300">Default</span>}
          </div>
          <p className="text-[12px] text-ink-500">{hint}</p>
        </div>
        {value.trim() && <ResetButton onClick={() => onChange('')} />}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-ink-100 bg-white p-1"
          title="Pick a color"
          aria-label={`${label} picker`}
        />
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`${defaultValue} (default)`}
          spellCheck={false}
          className="h-10 w-full rounded-xl border border-ink-100 bg-white px-3.5 font-mono text-[13px] text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {extra}
      </div>
      <FieldWarning text={validate(fieldKey, value)} />

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-semibold text-ink-500">Quick swatches</p>
        <div className="flex flex-wrap gap-1.5">
          {swatches.map((hex) => {
            const active = effectiveHex === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                onClick={() => onChange(hex)}
                className={cn(
                  'h-7 w-7 rounded-md border transition-transform hover:scale-110',
                  active ? 'border-white ring-2 ring-ink-900' : 'border-ink-100'
                )}
                style={{ background: hex }}
                title={hex}
                aria-label={`Use ${hex}`}
              />
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function LivePreview({ colors }) {
  const accentRgb = toRgbChannels(colors.theme_accent) || toRgbChannels(DEFAULTS.theme_accent);
  const mintRgb = toRgbChannels(colors.theme_mint) || toRgbChannels(DEFAULTS.theme_mint);

  return (
    <div
      className="min-h-[420px] p-5"
      style={{
        background: colors.theme_bg,
        color: colors.theme_text,
        '--pv-accent': colors.theme_accent,
        '--pv-hover': colors.theme_accent_hover,
        '--pv-mint': colors.theme_mint,
      }}
    >
      {/* Mini navbar */}
      <div className="mb-6 flex items-center justify-between">
        <span className="text-[15px] font-black tracking-tight">
          famies<span className="text-[var(--pv-accent)]">.</span>
        </span>
        <div className="flex items-center gap-3 text-[11px] font-semibold">
          <span className="text-[var(--pv-accent)]">Hem</span>
          <span className="opacity-70">Inspiration</span>
          <span className="opacity-70">Kontakt</span>
        </div>
      </div>

      {/* Hero */}
      <span
        className="inline-block rounded-full px-2.5 py-1 text-[10px] font-bold"
        style={{ background: `rgb(${accentRgb} / 0.14)`, color: colors.theme_text }}
      >
        Familjeappen för hela Sverige
      </span>
      <h4 className="mt-3 text-[22px] font-black leading-tight tracking-tight">Där familjer hittar nästa upplevelse.</h4>
      <p className="mt-2 text-[13px] leading-relaxed opacity-75">
        Hitta aktiviteter, event och andra familjer i närheten.{' '}
        <a
          href="#preview"
          onClick={(e) => e.preventDefault()}
          className="font-semibold text-[var(--pv-accent)] underline underline-offset-2 transition-colors hover:text-[var(--pv-hover)]"
        >
          Läs mer om Famies
        </a>
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full bg-[var(--pv-accent)] px-5 py-2.5 text-[13px] font-extrabold text-white transition-colors hover:bg-[var(--pv-hover)]"
          style={{ boxShadow: `0 12px 30px -12px rgb(${accentRgb} / 0.6)` }}
        >
          Ladda ner appen
        </button>
        <button
          type="button"
          className="rounded-full bg-[var(--pv-mint)] px-5 py-2.5 text-[13px] font-extrabold transition-opacity hover:opacity-80"
          style={{ color: colors.theme_text }}
        >
          Så funkar det
        </button>
      </div>

      {/* Card */}
      <div className="mt-6 rounded-2xl border border-black/5 bg-white p-4 shadow-[0_12px_40px_-12px_rgba(12,10,19,0.12)]">
        <div className="flex items-center gap-2">
          <span
            className="rounded-full bg-[var(--pv-mint)] px-2 py-0.5 text-[10px] font-bold"
            style={{ color: colors.theme_text }}
          >
            Utomhus
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold text-[var(--pv-hover)]"
            style={{ background: `rgb(${accentRgb} / 0.12)` }}
          >
            Nytt
          </span>
        </div>
        <p className="mt-2 text-[14px] font-bold" style={{ color: colors.theme_text }}>
          Picknick i Hagaparken
        </p>
        <p className="mt-1 flex items-center gap-1 text-[12px] opacity-70" style={{ color: colors.theme_text }}>
          <MapPin className="h-3 w-3" /> Solna · lördag 10:00
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[12px] font-bold text-[var(--pv-accent)]">Läs mer →</span>
          <span className="h-6 w-6 rounded-full" style={{ background: `rgb(${mintRgb} / 0.6)` }} />
        </div>
      </div>
    </div>
  );
}

export default function ThemePage() {
  const { showConfirm } = useModal();

  const [values, setValues] = useState(EMPTY);
  const [original, setOriginal] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState(null);
  const savedTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/site-settings?group=theme', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Failed to load');
        const next = { ...EMPTY };
        for (const row of json.settings || []) {
          if (THEME_KEYS.includes(row.key)) next[row.key] = row.value ?? '';
        }
        if (cancelled) return;
        setValues(next);
        setOriginal(next);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(savedTimer.current);
    };
  }, []);

  const dirty = useMemo(() => THEME_KEYS.some((k) => values[k] !== original[k]), [values, original]);
  const hasCustom = THEME_KEYS.some((k) => values[k].trim());

  // What the site will actually render: valid custom value, else default.
  const effective = useMemo(() => {
    const out = {};
    for (const k of THEME_KEYS) {
      const v = values[k].trim();
      out[k] = v && !validate(k, v) ? v : DEFAULTS[k];
    }
    return out;
  }, [values]);

  function update(key, v) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: THEME_KEYS.map((key) => ({ key, value: values[key].trim() })) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      const saved = Object.fromEntries(THEME_KEYS.map((k) => [k, values[k].trim()]));
      setValues(saved);
      setOriginal(saved);
      setJustSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 3000);
      toast.success('Theme colors saved');
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetAll() {
    const ok = await showConfirm(
      'Reset all theme colors?',
      'Every field goes back to the default Famies colors. You still need to press Save afterwards.',
      'warning',
      { confirmText: 'Reset all' }
    );
    if (ok) setValues({ ...EMPTY });
  }

  function deriveHover() {
    const hex = darken(effective.theme_accent);
    if (hex) update('theme_accent_hover', hex);
  }

  if (loading) return <LoadingBlock label="Loading theme colors…" />;

  const bgWarning = validate('theme_bg', values.theme_bg);
  const issues = THEME_KEYS.filter((k) => validate(k, values[k])).length;

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        icon={Droplet}
        title="Theme Colors"
        description={
          <>
            Customize the Famies brand colors used across the public site: accent (pink), hover, secondary (mint), page background
            and text. Empty fields use the default. The background also accepts a full{' '}
            <code className="rounded bg-ink-50 px-1.5 py-0.5 text-[12px] text-ink-700">linear-gradient(…)</code>.
          </>
        }
        actions={
          <>
            {dirty && <span className="text-[12px] font-semibold text-amber-600">Unsaved changes</span>}
            <Button variant="danger" icon={RotateCcw} onClick={resetAll} disabled={saving || !hasCustom}>
              Reset all
            </Button>
            <Button variant="accent" icon={justSaved && !dirty ? Check : Save} loading={saving} onClick={save} disabled={!dirty}>
              {saving ? 'Saving…' : justSaved && !dirty ? 'Saved' : 'Save colors'}
            </Button>
          </>
        }
      />

      {error && (
        <Notice tone="error" title="Something went wrong">
          {error}
        </Notice>
      )}
      {issues > 0 && (
        <Notice tone="warning">
          {issues === 1 ? 'One field has' : `${issues} fields have`} a value the site can&apos;t use. Those fields fall back to the default
          color until you fix them (the preview shows the fallback).
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        {/* Editors */}
        <div className="space-y-4">
          <ColorCard
            fieldKey="theme_accent"
            label="Accent color"
            hint="Brand pink: buttons, links, highlights and active states."
            value={values.theme_accent}
            onChange={(v) => update('theme_accent', v)}
            swatches={ACCENT_SWATCHES}
          />
          <ColorCard
            fieldKey="theme_accent_hover"
            label="Accent hover color"
            hint="Darker accent shown when hovering buttons and links."
            value={values.theme_accent_hover}
            onChange={(v) => update('theme_accent_hover', v)}
            swatches={HOVER_SWATCHES}
            extra={
              <Button variant="secondary" size="md" icon={Wand2} onClick={deriveHover} title="Darken the accent color" className="shrink-0">
                From accent
              </Button>
            }
          />
          <ColorCard
            fieldKey="theme_mint"
            label="Secondary (mint) color"
            hint="Soft secondary color for badges, chips and secondary buttons."
            value={values.theme_mint}
            onChange={(v) => update('theme_mint', v)}
            swatches={MINT_SWATCHES}
          />
          <ColorCard
            fieldKey="theme_text"
            label="Text color"
            hint="Main text color for headings and body copy."
            value={values.theme_text}
            onChange={(v) => update('theme_text', v)}
            swatches={TEXT_SWATCHES}
          />

          {/* Background: solid color or gradient */}
          <Card>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary-600" />
                  <label htmlFor="theme-theme_bg" className="text-[14px] font-bold text-ink-900">
                    Page background
                  </label>
                  {!values.theme_bg.trim() && <span className="text-[11px] font-semibold text-ink-300">Default</span>}
                </div>
                <p className="text-[12px] text-ink-500">
                  Solid color or gradient, e.g. <code className="rounded bg-ink-50 px-1 text-[11px]">#ffffff</code> or{' '}
                  <code className="rounded bg-ink-50 px-1 text-[11px]">linear-gradient(145deg, #fff4f8, #f4fef6)</code>.
                </p>
              </div>
              {values.theme_bg.trim() && <ResetButton onClick={() => update('theme_bg', '')} />}
            </div>

            <Textarea
              id="theme-theme_bg"
              mono
              rows={3}
              spellCheck={false}
              value={values.theme_bg}
              onChange={(e) => update('theme_bg', e.target.value)}
              placeholder={`${DEFAULTS.theme_bg} (default)`}
              className="min-h-[72px] text-[12px]"
            />
            <FieldWarning text={bgWarning} />

            <p className="mb-2 mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-ink-500">
              <Wand2 className="h-3 w-3" /> Quick presets
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BG_PRESETS.map((p) => {
                const active = values.theme_bg.trim() === p.value;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => update('theme_bg', p.value)}
                    className={cn(
                      'relative h-14 overflow-hidden rounded-xl border transition-transform hover:scale-[1.02]',
                      active ? 'border-primary ring-2 ring-primary/30' : 'border-ink-100'
                    )}
                    style={{ background: p.value }}
                    title={p.value}
                  >
                    <span className="absolute bottom-1 left-1.5 rounded bg-ink-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgba(12,10,19,0.04)]">
            <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50 px-4 py-2.5">
              <Palette className="h-3.5 w-3.5 text-ink-500" />
              <span className="text-[12px] font-semibold text-ink-500">Live preview</span>
            </div>
            <LivePreview colors={effective} />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
            Hover the pink button and link to see the hover color. The preview uses your current values and falls back to the defaults
            for empty or invalid fields. Changes go live on the site as soon as you save.
          </p>
        </div>
      </div>
    </div>
  );
}
