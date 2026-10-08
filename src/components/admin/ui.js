'use client';
/**
 * Small UI kit shared by every /admin page so the panel looks consistent:
 * white cards on a soft background, ink text, Famies pink accents.
 */
import { forwardRef } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PageHeader({ icon: Icon, title, description, actions, className }) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary-700 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" />
            </div>
          )}
          <h1 className="text-2xl md:text-[28px] font-black tracking-tight text-ink-900">{title}</h1>
        </div>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-500 leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, actions, children, className, bodyClassName }) {
  return (
    <section className={cn('rounded-2xl bg-white border border-ink-100 shadow-[0_1px_2px_rgba(12,10,19,0.04)]', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-bold text-ink-900">{title}</h2>}
            {description && <p className="mt-1 text-[13px] text-ink-500 leading-relaxed">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-ink-900 text-white hover:bg-ink-700 shadow-sm',
  accent: 'bg-primary text-white hover:bg-primary-500 shadow-pink',
  secondary: 'bg-white text-ink-700 border border-ink-100 hover:border-ink-200 hover:bg-ink-50',
  danger: 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100',
  ghost: 'text-ink-500 hover:text-ink-900 hover:bg-ink-50',
};

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-[13px] gap-2 rounded-xl',
  lg: 'h-12 px-6 text-sm gap-2 rounded-xl',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, className, children, disabled, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon ? <Icon className="w-4 h-4" /> : null}
      {children}
    </button>
  );
});

export function Field({ label, hint, htmlFor, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-[12px] font-bold uppercase tracking-wide text-ink-500">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-[12px] text-ink-300 leading-relaxed">{hint}</p>}
    </div>
  );
}

const inputBase =
  'w-full rounded-xl bg-white border border-ink-100 px-3.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-ink-50';

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputBase, 'h-10', className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, mono = false, ...props }, ref) {
  return <textarea ref={ref} className={cn(inputBase, 'py-2.5 min-h-[96px]', mono && 'font-mono text-[13px]', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(inputBase, 'h-10 pr-8', className)} {...props}>
      {children}
    </select>
  );
});

export function Toggle({ checked, onChange, label, disabled, className }) {
  return (
    <label className={cn('inline-flex items-center gap-2.5 select-none', disabled ? 'opacity-50' : 'cursor-pointer', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-emerald-500' : 'bg-ink-200'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5'
          )}
        />
      </button>
      {label && <span className="text-sm font-medium text-ink-700">{label}</span>}
    </label>
  );
}

const BADGE_TONES = {
  gray: 'bg-ink-50 text-ink-500 border-ink-100',
  pink: 'bg-primary/10 text-primary-700 border-primary/20',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  red: 'bg-red-50 text-red-600 border-red-100',
  blue: 'bg-sky-50 text-sky-700 border-sky-100',
  violet: 'bg-violet-50 text-violet-700 border-violet-100',
};

export function Badge({ tone = 'gray', className, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold', BADGE_TONES[tone], className)}>
      {children}
    </span>
  );
}

const NOTICE_TONES = {
  error: { cls: 'bg-red-50 border-red-100 text-red-700', Icon: AlertCircle },
  success: { cls: 'bg-emerald-50 border-emerald-100 text-emerald-700', Icon: CheckCircle2 },
  warning: { cls: 'bg-amber-50 border-amber-100 text-amber-800', Icon: AlertTriangle },
  info: { cls: 'bg-sky-50 border-sky-100 text-sky-800', Icon: Info },
};

export function Notice({ tone = 'info', title, children, className }) {
  const { cls, Icon } = NOTICE_TONES[tone] || NOTICE_TONES.info;
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] leading-relaxed', cls, className)}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, hint, tone = 'pink' }) {
  const tones = {
    pink: 'bg-primary/10 text-primary-700',
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="rounded-2xl bg-white border border-ink-100 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-wide text-ink-500">{label}</p>
        {Icon && (
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', tones[tone])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <p className="mt-3 text-[28px] font-black tracking-tight text-ink-900 leading-none">{value}</p>
      {hint && <p className="mt-2 text-[12px] text-ink-300">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary-700 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <p className="font-bold text-ink-900">{title}</p>
      {text && <p className="mt-1 text-sm text-ink-500 max-w-sm">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label = 'Loading…', className }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-16 text-sm text-ink-500', className)}>
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
      {label}
    </div>
  );
}
