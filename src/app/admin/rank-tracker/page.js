'use client';
/**
 * /admin/rank-tracker — Google positions of famies.app for target
 * keywords (Google Sweden via SerpAPI). Data: /api/admin/rank-tracker.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Trophy, Search, Plus, Trash2, Play, Loader2, TrendingUp, TrendingDown, Minus, Target,
  Clock, X, Zap, ArrowUpDown, ArrowUp, ArrowDown, KeyRound,
} from 'lucide-react';
import {
  PageHeader, Card, Button, Input, Badge, Notice, StatCard, EmptyState, LoadingBlock,
} from '@/components/admin/ui';
import { useModal } from '@/components/admin/AdminModal';
import { cn } from '@/lib/utils';

// ── helpers ──────────────────────────────────────────────────────────

/** 1200 → "1.2K", 54000 → "54K" */
function fmtVol(v) {
  if (!v) return '—';
  if (v >= 1000000) return `${(v / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(v);
}

/** "Apr 1" in UTC, matching SerpAPI's reset moment. */
function formatResetDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function daysUntil(iso) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

function timeAgo(iso) {
  if (!iso) return 'Never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function api(method, body) {
  const res = await fetch('/api/admin/rank-tracker', {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

const QUOTA_ERROR = /search(es)?\s+(ran|run)\s+out|exceeded|out of (search|credit)|monthly\s+limit|account\s+ran|over\s+the\s+limit|hourly\s+searches|not configured/i;

// ── pieces ───────────────────────────────────────────────────────────

function QuotaDonut({ used, limit }) {
  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct < 50 ? '#10b981' : pct < 80 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90" aria-hidden="true">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#efecf2" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-ink-900">{remaining}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-300">remaining</span>
      </div>
    </div>
  );
}

const POSITION_TIERS = [
  { max: 3, label: 'Top 3', cls: 'bg-gradient-to-br from-amber-300 to-amber-500 text-ink-900' },
  { max: 10, label: '4–10', cls: 'bg-gradient-to-br from-emerald-300 to-emerald-500 text-ink-900' },
  { max: 30, label: '11–30', cls: 'bg-gradient-to-br from-sky-400 to-sky-600 text-white' },
  { max: 50, label: '31–50', cls: 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' },
  { max: Infinity, label: '50+', cls: 'bg-gradient-to-br from-red-400 to-red-500 text-white' },
];

function PositionBadge({ position }) {
  if (position == null) {
    return (
      <div className="w-12 h-12 rounded-2xl bg-ink-50 border border-ink-100 flex items-center justify-center" title="Not in the top 100">
        <span className="text-[11px] font-bold text-ink-300">N/A</span>
      </div>
    );
  }
  const tier = POSITION_TIERS.find((t) => position <= t.max);
  return (
    <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm', tier.cls)}>
      <span className="text-base font-black">#{position}</span>
    </div>
  );
}

function ChangeIndicator({ change }) {
  if (change == null) return <span className="text-xs text-ink-300">—</span>;
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold">
        <TrendingUp className="w-3.5 h-3.5" /> +{change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 text-xs font-bold">
        <TrendingDown className="w-3.5 h-3.5" /> {change}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-ink-300 text-xs">
      <Minus className="w-3.5 h-3.5" /> 0
    </span>
  );
}

function SortHeader({ col, sortBy, sortDir, onSort, children }) {
  const active = sortBy === col;
  const Icon = active ? (sortDir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink-900"
      title={`Sort by ${col}`}
    >
      {children}
      <Icon className={cn('w-3 h-3', !active && 'opacity-40')} />
    </button>
  );
}

// ── page ─────────────────────────────────────────────────────────────

export default function RankTrackerPage() {
  const { showConfirm } = useModal();

  const [keywords, setKeywords] = useState([]);
  const [quota, setQuota] = useState(null);
  const [meta, setMeta] = useState({ configured: true, locale: null, domain: 'famies.app' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [error, setError] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [adding, setAdding] = useState(false);

  const [progress, setProgress] = useState(null); // { done, total } while "Run check" runs
  const [checkingId, setCheckingId] = useState(null);
  const [editingVol, setEditingVol] = useState(null);
  const [volInput, setVolInput] = useState('');
  const [sortBy, setSortBy] = useState(null); // 'volume' | 'position' | null
  const [sortDir, setSortDir] = useState('desc');

  const applyData = useCallback((data) => {
    setKeywords(data.keywords || []);
    setQuota(data.quota || null);
    setMeta({
      configured: data.configured !== false,
      locale: data.locale || null,
      domain: data.domain || 'famies.app',
    });
    setLoadError('');
  }, []);

  const reload = useCallback(async () => {
    try {
      applyData(await api('GET'));
    } catch (err) {
      setLoadError(err.message);
    }
  }, [applyData]);

  useEffect(() => {
    let cancelled = false;
    api('GET')
      .then((data) => {
        if (!cancelled) applyData(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyData]);

  const toggleSort = (col) => {
    if (sortBy === col) {
      if (sortDir === 'desc') setSortDir('asc');
      else {
        setSortBy(null); // third click resets
        setSortDir('desc');
      }
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const sortedKeywords = useMemo(() => {
    if (!sortBy) return keywords;
    return [...keywords].sort((a, b) => {
      const aVal = sortBy === 'volume' ? a.volume ?? 0 : a.position ?? 999;
      const bVal = sortBy === 'volume' ? b.volume ?? 0 : b.position ?? 999;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [keywords, sortBy, sortDir]);

  // ── actions ──

  const handleAdd = async () => {
    if (!newKeyword.trim()) return;
    setAdding(true);
    setError('');
    try {
      const { keyword } = await api('POST', { action: 'add', keyword: newKeyword.trim() });
      setKeywords((prev) => [...prev, keyword]);
      setNewKeyword('');
      setShowInput(false);
      toast.success(`Tracking “${keyword.keyword}”`);
    } catch (err) {
      setError(err.message);
    }
    setAdding(false);
  };

  const handleDelete = async (kw) => {
    const ok = await showConfirm('Remove keyword?', `“${kw.keyword}” and its ranking data will be removed.`, 'danger', {
      confirmText: 'Remove',
    });
    if (!ok) return;
    try {
      await api('DELETE', { id: kw.id });
      setKeywords((prev) => prev.filter((k) => k.id !== kw.id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  /** Check one keyword; returns true on success, throws on failure. */
  const checkOne = async (id) => {
    const { result } = await api('POST', { action: 'check_single', id });
    if (result) {
      setKeywords((prev) =>
        prev.map((k) =>
          k.id === id
            ? {
                ...k,
                position: result.position,
                prev_position: result.prev_position,
                change: result.change,
                rank_url: result.rank_url,
                checked_at: result.checked_at || new Date().toISOString(),
              }
            : k
        )
      );
    }
  };

  const handleRunSingle = async (id) => {
    setCheckingId(id);
    setError('');
    try {
      await checkOne(id);
    } catch (err) {
      setError(err.message);
    }
    setCheckingId(null);
    reload(); // refresh quota
  };

  // Keywords are checked one request at a time, so a long list never hits
  // the serverless time limit and the progress is real.
  const handleRunCheck = async () => {
    if (keywords.length === 0) return;
    const list = [...keywords];
    setError('');
    setProgress({ done: 0, total: list.length });
    let failures = 0;
    for (let i = 0; i < list.length; i++) {
      setCheckingId(list[i].id);
      try {
        await checkOne(list[i].id);
      } catch (err) {
        failures += 1;
        if (QUOTA_ERROR.test(err.message)) {
          setError(`Stopped after ${i} of ${list.length}: ${err.message}`);
          break;
        }
        setError(`“${list[i].keyword}”: ${err.message}`);
      }
      setProgress({ done: i + 1, total: list.length });
    }
    setCheckingId(null);
    setProgress(null);
    await reload();
    if (failures === 0) toast.success(`Checked ${list.length} keyword${list.length === 1 ? '' : 's'}`);
  };

  const handleVolSave = async (id) => {
    const vol = volInput.trim() ? parseInt(volInput.replace(/[^0-9]/g, ''), 10) || null : null;
    setEditingVol(null);
    setVolInput('');
    try {
      await api('POST', { action: 'update_volume', id, volume: vol });
      setKeywords((prev) => prev.map((k) => (k.id === id ? { ...k, volume: vol } : k)));
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── derived ──

  const checking = progress !== null;
  const ranked = keywords.filter((k) => k.position != null);
  const top10 = ranked.filter((k) => k.position <= 10).length;
  const avgPos = ranked.length
    ? Math.round((ranked.reduce((a, k) => a + k.position, 0) / ranked.length) * 10) / 10
    : 0;
  const lastChecked = keywords.reduce((latest, k) => (k.checked_at && (!latest || k.checked_at > latest) ? k.checked_at : latest), null);
  const locale = meta.locale || { label: 'Google Sweden', flag: '🇸🇪', google_domain: 'google.se', hl: 'sv' };
  const domainRe = new RegExp(`^https?://(www\\.)?${meta.domain.replace(/\./g, '\\.')}`, 'i');

  if (loading) return <LoadingBlock label="Loading rank tracker…" />;

  return (
    <div>
      <PageHeader
        icon={Trophy}
        title="Rank Tracker"
        description={`Google positions of ${meta.domain} for your target keywords — ${locale.label} (${locale.google_domain}, language ${locale.hl}), top 100 results.`}
      />

      {loadError && (
        <Notice tone="error" title="Could not load the rank tracker" className="mb-4">
          {loadError}
        </Notice>
      )}

      {!meta.configured && (
        <Notice tone="warning" title="SerpAPI not configured" className="mb-6">
          Rank checks need a SerpAPI key. Set <code className="font-bold">SERPAPI_KEY</code> in Coolify → Environment Variables (free plan: 250
          searches / 30 days at serpapi.com). Optional: <code className="font-bold">SERPAPI_KEY_BACKUP</code> for a second
          account (pooled 500 / 30 days with automatic failover), and{' '}
          <code className="font-bold">SERPAPI_ACCOUNT_CREATED_AT</code> /{' '}
          <code className="font-bold">SERPAPI_ACCOUNT_CREATED_AT_BACKUP</code> (ISO date of each account&apos;s signup) for
          exact refill dates. You can already add keywords.
        </Notice>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="col-span-2 lg:col-span-1 lg:row-span-2 rounded-2xl bg-white border border-ink-100 p-6 flex flex-col items-center justify-center text-center">
          {meta.configured && quota ? (
            <>
              <QuotaDonut used={quota.used} limit={quota.limit} />
              <p className="text-xs mt-3 font-semibold text-ink-500">
                {quota.used} / {quota.limit} searches used
              </p>
              <p className="text-[10px] mt-1 text-ink-300">Current 30-day cycle{quota.planName ? ` · ${quota.planName}` : ''}</p>
              {quota.resetAt && (
                <span className="mt-3" title={`Refills on ${new Date(quota.resetAt).toUTCString()}`}>
                  <Badge tone="green">
                    <Clock className="w-3 h-3" /> Refills {formatResetDate(quota.resetAt)} · in {daysUntil(quota.resetAt)}d
                  </Badge>
                </span>
              )}
              <span
                className="mt-2"
                title={
                  quota.keyCount >= 2
                    ? 'Primary + backup SerpAPI keys are both live. Failover ready.'
                    : quota.keysConfigured >= 2
                      ? 'Two keys are set but one did not answer the SerpAPI account API — check that it is valid.'
                      : 'Only the primary SerpAPI key is loaded. Add SERPAPI_KEY_BACKUP to enable failover (pooled 500 / 30 days).'
                }
              >
                <Badge tone={quota.keyCount >= 2 ? 'green' : 'amber'}>
                  <KeyRound className="w-3 h-3" /> {quota.keyCount} key{quota.keyCount === 1 ? '' : 's'} loaded
                </Badge>
              </span>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-ink-50 text-ink-300 flex items-center justify-center">
                <KeyRound className="w-6 h-6" />
              </div>
              <p className="mt-3 text-sm font-bold text-ink-900">No SerpAPI quota</p>
              <p className="mt-1 text-[12px] text-ink-500">Set SERPAPI_KEY in Coolify → Environment Variables.</p>
            </>
          )}
        </div>

        <StatCard label="Keywords" value={keywords.length} icon={Target} tone="violet" hint="tracked" />
        <StatCard label="Top 10" value={top10} icon={Trophy} tone="amber" hint="keywords on page 1" />
        <StatCard label="Avg position" value={avgPos > 0 ? `#${avgPos}` : '—'} icon={TrendingUp} tone="green" hint="of ranking keywords" />
        <StatCard
          label="Ranking"
          value={
            <>
              {ranked.length}
              <span className="text-lg text-ink-300">/{keywords.length}</span>
            </>
          }
          icon={Zap}
          tone="blue"
          hint="found in top 100"
        />
        <StatCard
          label="Last check"
          value={<span className="text-xl">{timeAgo(lastChecked)}</span>}
          icon={Clock}
          tone="pink"
          hint={keywords.length > 0 ? `a full check uses ${keywords.length}–${keywords.length * 10} searches` : 'add keywords first'}
        />
      </div>

      {/* ── Action bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {!showInput ? (
          <Button variant="secondary" icon={Plus} onClick={() => setShowInput(true)}>
            Add keyword
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setShowInput(false);
              }}
              placeholder="t.ex. aktiviteter för barn"
              autoFocus
              className="w-64 max-w-full"
            />
            <Button variant="accent" onClick={handleAdd} loading={adding} disabled={!newKeyword.trim()}>
              Add
            </Button>
            <Button
              variant="ghost"
              aria-label="Cancel"
              onClick={() => {
                setShowInput(false);
                setNewKeyword('');
                setError('');
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        <Button
          variant="accent"
          size="lg"
          onClick={handleRunCheck}
          disabled={checking || keywords.length === 0 || !meta.configured || checkingId !== null}
          icon={checking ? Loader2 : Play}
          className={cn(checking && '[&>svg]:animate-spin')}
        >
          {checking ? `Checking ${progress.done}/${progress.total}…` : 'Run check'}
        </Button>
      </div>

      {checking && (
        <div className="mb-4 h-1.5 rounded-full bg-ink-100 overflow-hidden" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
          <div
            className="h-full rounded-full bg-primary-600 transition-all duration-300"
            style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
          />
        </div>
      )}

      {error && (
        <Notice tone="error" className="mb-4">
          {error}
        </Notice>
      )}

      {/* ── Keywords table ── */}
      {keywords.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="No keywords yet"
            text="Add the Swedish search terms you want famies.app to rank for, then run a check."
            action={
              <Button variant="accent" icon={Plus} onClick={() => setShowInput(true)}>
                Add your first keyword
              </Button>
            }
          />
        </Card>
      ) : (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-[11px] font-bold uppercase tracking-wide text-ink-500">
                  <th className="text-left pl-5 pr-2 py-3 w-10">#</th>
                  <th className="text-left px-3 py-3">Keyword</th>
                  <th className="text-center px-3 py-3 w-24">
                    <SortHeader col="volume" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>Volume</SortHeader>
                  </th>
                  <th className="text-center px-3 py-3 w-28">
                    <SortHeader col="position" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>
                      <span className="text-sm leading-none normal-case">{locale.flag}</span> Position
                    </SortHeader>
                  </th>
                  <th className="text-center px-3 py-3 w-20">Change</th>
                  <th className="text-left px-3 py-3">Ranking URL</th>
                  <th className="text-center px-3 py-3 w-24">Checked</th>
                  <th className="pr-5 pl-2 py-3 w-24" />
                </tr>
              </thead>
              <tbody>
                {sortedKeywords.map((kw, idx) => (
                  <tr key={kw.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50 transition-colors">
                    <td className="pl-5 pr-2 py-3 font-mono text-xs text-ink-300">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-ink-900 break-words">{kw.keyword}</p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {editingVol === kw.id ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          value={volInput}
                          onChange={(e) => setVolInput(e.target.value)}
                          onBlur={() => handleVolSave(kw.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleVolSave(kw.id);
                            if (e.key === 'Escape') {
                              setEditingVol(null);
                              setVolInput('');
                            }
                          }}
                          autoFocus
                          placeholder="0"
                          aria-label="Monthly search volume"
                          className="w-20 text-center text-xs px-1.5 py-1 rounded-lg border border-ink-100 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVol(kw.id);
                            setVolInput(kw.volume ? String(kw.volume) : '');
                          }}
                          className={cn(
                            'text-xs font-semibold px-2 py-1 rounded-lg hover:bg-primary/10',
                            kw.volume ? 'text-ink-900' : 'text-ink-300'
                          )}
                          title="Click to edit monthly search volume"
                        >
                          {fmtVol(kw.volume)}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-center">
                        <PositionBadge position={kw.position} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <ChangeIndicator change={kw.change} />
                    </td>
                    <td className="px-3 py-3 max-w-[280px]">
                      {kw.rank_url ? (
                        <a
                          href={kw.rank_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-xs font-medium text-primary-700 hover:underline"
                          title={kw.rank_url}
                        >
                          {kw.rank_url.replace(domainRe, '') || '/'}
                        </a>
                      ) : (
                        <span className="text-xs text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-ink-500 whitespace-nowrap">{timeAgo(kw.checked_at)}</td>
                    <td className="pr-5 pl-2 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleRunSingle(kw.id)}
                          disabled={checkingId !== null || checking || !meta.configured}
                          className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Check this keyword"
                          aria-label={`Check ${kw.keyword}`}
                        >
                          {checkingId === kw.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" fill="currentColor" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(kw)}
                          disabled={checkingId === kw.id}
                          className="p-2 rounded-lg text-ink-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                          title="Remove keyword"
                          aria-label={`Remove ${kw.keyword}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Legend ── */}
      {keywords.length > 0 && (
        <div className="flex items-center justify-center gap-x-6 gap-y-2 mt-6 flex-wrap">
          {POSITION_TIERS.map((t) => (
            <div key={t.label} className="flex items-center gap-2">
              <span className={cn('w-3 h-3 rounded-full', t.cls)} />
              <span className="text-xs text-ink-500">{t.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-ink-100 border border-ink-200" />
            <span className="text-xs text-ink-500">Not in top 100</span>
          </div>
        </div>
      )}
    </div>
  );
}
