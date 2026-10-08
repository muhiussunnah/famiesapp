'use client';
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, CheckCircle, X, Info, Trash2, ImageIcon, Link2, TableIcon, Type } from 'lucide-react';

/**
 * Promise-based replacements for window.confirm / alert / prompt inside
 * the admin panel:
 *
 *   const { showConfirm, showAlert, showPrompt } = useModal();
 *   if (await showConfirm('Delete post?', 'This cannot be undone.')) { … }
 *   const url = await showPrompt('Image URL', 'Paste a link', { placeholder: 'https://…', icon: 'image' });
 *
 * icon: 'danger' | 'warning' | 'success' | 'info' | 'image' | 'link' | 'table' | 'text'
 */
const ModalContext = createContext(null);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within AdminModalProvider');
  return ctx;
}

const ICONS = {
  danger: { Icon: Trash2, cls: 'bg-red-50 text-red-500' },
  warning: { Icon: AlertTriangle, cls: 'bg-amber-50 text-amber-500' },
  success: { Icon: CheckCircle, cls: 'bg-emerald-50 text-emerald-500' },
  image: { Icon: ImageIcon, cls: 'bg-primary/10 text-primary-600' },
  link: { Icon: Link2, cls: 'bg-sky-50 text-sky-500' },
  table: { Icon: TableIcon, cls: 'bg-violet-50 text-violet-500' },
  text: { Icon: Type, cls: 'bg-primary/10 text-primary-600' },
  info: { Icon: Info, cls: 'bg-sky-50 text-sky-500' },
};

function ModalIcon({ icon }) {
  const { Icon, cls } = ICONS[icon] || ICONS.info;
  return (
    <div className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center ${cls}`}>
      <Icon className="w-5 h-5" />
    </div>
  );
}

export function AdminModalProvider({ children }) {
  const [modal, setModal] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [closing, setClosing] = useState(false);
  const resolveRef = useRef(null);
  const inputRef = useRef(null);
  const idRef = useRef(0);

  const close = useCallback((result) => {
    setClosing(true);
    setTimeout(() => {
      resolveRef.current?.(result);
      resolveRef.current = null;
      setModal(null);
      setClosing(false);
      setInputValue('');
    }, 150);
  }, []);

  useEffect(() => {
    if (modal?.type === 'prompt') setTimeout(() => inputRef.current?.focus(), 50);
  }, [modal]);

  useEffect(() => {
    if (!modal) return;
    const handler = (e) => {
      if (e.key === 'Escape') close(modal.type === 'confirm' ? false : modal.type === 'prompt' ? null : undefined);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modal, close]);

  const showConfirm = useCallback((title, message, icon = 'danger', opts = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModal({ type: 'confirm', title, message, icon, confirmText: opts.confirmText, id: ++idRef.current });
    });
  }, []);

  const showAlert = useCallback((title, message, icon = 'warning') => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModal({ type: 'alert', title, message, icon, id: ++idRef.current });
    });
  }, []);

  const showPrompt = useCallback((title, message, opts = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setInputValue(opts.defaultValue || '');
      setModal({
        type: 'prompt',
        title,
        message,
        icon: opts.icon || 'text',
        placeholder: opts.placeholder || '',
        id: ++idRef.current,
      });
    });
  }, []);

  const handleConfirm = () => {
    if (modal?.type === 'confirm') close(true);
    else if (modal?.type === 'alert') close(undefined);
    else if (modal?.type === 'prompt') close(inputValue || null);
  };

  const handleCancel = () => {
    if (modal?.type === 'confirm') close(false);
    else if (modal?.type === 'prompt') close(null);
    else close(undefined);
  };

  const confirmLabel =
    modal?.confirmText ||
    (modal?.type === 'confirm' ? (modal.icon === 'danger' ? 'Delete' : 'Confirm') : modal?.type === 'alert' ? 'OK' : 'Save');

  return (
    <ModalContext.Provider value={{ showConfirm, showAlert, showPrompt }}>
      {children}

      {modal && (
        <div
          className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm transition-opacity duration-150 ${closing ? 'opacity-0' : 'opacity-100'}`}
          onClick={handleCancel}
        >
          <div
            role="dialog"
            aria-modal="true"
            className={`w-full max-w-md rounded-2xl bg-white border border-ink-100 shadow-2xl transition-all duration-150 ${closing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5 px-5 pt-5">
              <ModalIcon icon={modal.icon} />
              <div className="flex-1 min-w-0 pt-1">
                <h3 className="text-[15px] font-bold text-ink-900 leading-tight">{modal.title}</h3>
                {modal.message && <p className="text-[13px] text-ink-500 mt-1 leading-relaxed whitespace-pre-line">{modal.message}</p>}
              </div>
              <button onClick={handleCancel} aria-label="Close" className="p-1.5 rounded-lg text-ink-300 hover:text-ink-900 hover:bg-ink-50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modal.type === 'prompt' && (
              <div className="px-5 pt-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                  placeholder={modal.placeholder || 'Type here…'}
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-ink-50 border border-ink-100 text-ink-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-ink-300"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 p-5">
              {modal.type !== 'alert' && (
                <button onClick={handleCancel} className="px-4 py-2 rounded-xl text-[13px] font-semibold text-ink-500 hover:text-ink-900 hover:bg-ink-50 border border-ink-100 transition-colors">
                  Cancel
                </button>
              )}
              <button
                onClick={handleConfirm}
                className={`px-5 py-2 rounded-xl text-[13px] font-bold text-white transition-colors ${
                  modal.icon === 'danger' && modal.type === 'confirm' ? 'bg-red-500 hover:bg-red-600' : 'bg-ink-900 hover:bg-ink-700'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}
