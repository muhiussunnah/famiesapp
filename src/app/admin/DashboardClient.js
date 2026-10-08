'use client';
/**
 * Admin Dashboard UI (rendered by ./page.js):
 *   1. Site mode — the Coming Soon switch (site_settings.coming_soon)
 *   2. Content   — posts / views / form submissions from the database
 *   3. Traffic   — Google Analytics 4 + Search Console, or a
 *                  "not configured" card when the env vars are missing
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Rocket, Construction, Eye, FileText, PenLine, Clock, Users, Calendar,
  TrendingUp, Activity, Layers, Globe, Search, MousePointerClick, Share2, Mail, Newspaper,
  Sparkles, ArrowUpRight, Plus, BarChart3, CheckCircle2, XCircle, Percent, Settings2,
} from 'lucide-react';
import {
  PageHeader, Card, Toggle, Badge, Notice, StatCard, EmptyState, LoadingBlock, Select,
} from '@/components/admin/ui';
import { useModal } from '@/components/admin/AdminModal';
import ClearCacheButton from '@/components/admin/ClearCacheButton';
import { SITE_URL, absoluteUrl } from '@/lib/site';
import { cn } from '@/lib/utils';

// ── helpers ──────────────────────────────────────────────────────────

const PERIODS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: '365d', label: 'Last 365 days' },
  { value: 'lifetime', label: 'Lifetime' },
];

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'));

function timeAgo(iso) {
  if (!iso) return '—';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function shortDate(ymd, unit = 'day') {
  if (!ymd) return '';
  if (unit === 'month') {
    return new Date(`${ymd}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * GET a JSON admin endpoint. Results are kept per URL, so switching back
 * to an already-loaded period shows it instantly while it refreshes.
 */
function useAdminJson(url) {
  const [results, setResults] = useState({});

  useEffect(() => {
    let cancelled = false;
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
        return json;
      })
      .then((data) => {
        if (!cancelled) setResults((r) => ({ ...r, [url]: { data } }));
      })
      .catch((err) => {
        if (!cancelled) setResults((r) => ({ ...r, [url]: { error: err.message || 'Request failed' } }));
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return results[url] || { loading: true };
}

function LinkButton({ href, icon: Icon, children, variant = 'secondary', external }) {
  const cls = cn(
    'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-colors',
    variant === 'accent'
      ? 'bg-primary text-white hover:bg-primary-500 shadow-pink'
      : 'bg-white text-ink-700 border border-ink-100 hover:border-ink-200 hover:bg-ink-50'
  );
  const content = (
    <>
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{content}</a>
  ) : (
    <Link href={href} className={cls}>{content}</Link>
  );
}

// ── 1. Site mode ─────────────────────────────────────────────────────

function SiteModeCard({ siteMode }) {
  const { showConfirm } = useModal();
  const [comingSoon, setComingSoon] = useState(siteMode.comingSoon);
  const [saved, setSaved] = useState(siteMode.saved);
  const [saving, setSaving] = useState(false);
  const unknown = comingSoon === null;

  async function change(next) {
    const ok = await showConfirm(
      next ? 'Turn on Coming Soon mode?' : 'Switch to the full website?',
      next
        ? 'The homepage will show the Coming Soon landing with the App Store and Google Play badges.\nArticles, /inspiration and every other page stay reachable.'
        : 'The homepage will show the full Famies website again (hero, features, reviews, blog, newsletter …).',
      'warning',
      { confirmText: next ? 'Turn on Coming Soon' : 'Show full website' }
    );
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ key: 'coming_soon', value: next ? 'true' : 'false' }] }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not save the site mode');
      setComingSoon(next);
      setSaved(true);
      toast.success(next ? 'Coming Soon mode is ON' : 'The full website is live');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      className={cn(
        'mb-6 border-2',
        unknown ? 'border-ink-100' : comingSoon ? 'border-amber-200 bg-amber-50/40' : 'border-emerald-200 bg-emerald-50/30'
      )}
      title="Site mode"
      description="What visitors see on the homepage of famies.app."
      actions={
        unknown ? (
          <Badge tone="gray">Unknown</Badge>
        ) : comingSoon ? (
          <Badge tone="amber"><Construction className="w-3 h-3" /> Coming Soon</Badge>
        ) : (
          <Badge tone="green"><Rocket className="w-3 h-3" /> Full website live</Badge>
        )
      }
    >
      {siteMode.error && (
        <Notice tone="error" title="Could not read the site mode" className="mb-4">
          {siteMode.error}
        </Notice>
      )}

      <div className="flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex-1 grid sm:grid-cols-2 gap-3 text-[13px] leading-relaxed">
          <div className={cn('rounded-xl border p-3.5', comingSoon ? 'border-amber-200 bg-white' : 'border-ink-100 bg-white/60')}>
            <p className="font-bold text-ink-900 flex items-center gap-1.5">
              <Construction className="w-4 h-4 text-amber-600" /> ON — Coming Soon
            </p>
            <p className="mt-1 text-ink-500">
              The homepage shows the Coming Soon landing with the store badges. Everything else
              (articles, /inspiration, contact, legal pages) stays reachable.
            </p>
          </div>
          <div className={cn('rounded-xl border p-3.5', comingSoon === false ? 'border-emerald-200 bg-white' : 'border-ink-100 bg-white/60')}>
            <p className="font-bold text-ink-900 flex items-center gap-1.5">
              <Rocket className="w-4 h-4 text-emerald-600" /> OFF — Full website
            </p>
            <p className="mt-1 text-ink-500">
              The homepage shows the full Famies site: hero, features, reviews, blog and newsletter.
            </p>
          </div>
        </div>

        <div className="md:w-56 shrink-0 flex flex-col items-start md:items-end gap-2">
          <Toggle
            checked={!!comingSoon}
            onChange={change}
            disabled={unknown || saving}
            label={saving ? 'Saving…' : 'Coming Soon mode'}
          />
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary-700 hover:underline"
          >
            Open homepage <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
      </div>

      {!unknown && !saved && (
        <p className="mt-4 text-[12px] text-ink-300">
          Not saved in the database yet — the current mode comes from the LIVE constant in
          src/lib/siteConfig.js. Flipping the switch stores it in site settings.
        </p>
      )}
    </Card>
  );
}

// ── 2. Content ───────────────────────────────────────────────────────

const STATUS_TONE = { published: 'green', draft: 'gray', scheduled: 'blue' };

function PostRow({ post, right }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3 border-b border-ink-50 last:border-0">
      <div className="min-w-0 flex-1">
        <Link
          href={`/admin/pages/edit?id=${post.id}`}
          className="block text-[13px] font-semibold text-ink-900 truncate hover:text-primary-700"
        >
          {post.title || '(untitled)'}
        </Link>
        <p className="text-[12px] text-ink-300 truncate">{post.slug}</p>
      </div>
      {right}
    </li>
  );
}

function ContentSection() {
  const { data, error, loading } = useAdminJson('/api/admin/stats');

  if (loading) return <LoadingBlock label="Loading content stats…" />;
  if (error) {
    return (
      <Notice tone="error" title="Could not load content stats" className="mb-6">
        {error}
      </Notice>
    );
  }

  const { posts, views, forms, topPosts, recentPosts, upcoming, latestMessages } = data;
  const maxViews = topPosts[0]?.views || 1;
  const weekHint = (f) => (f?.last7d ? `+${fmt(f.last7d)} in the last 7 days` : f?.latestAt ? `Latest ${timeAgo(f.latestAt)}` : 'None yet');

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Published" value={fmt(posts.published)} icon={FileText} tone="green" hint={`${fmt(posts.total)} posts in total`} />
        <StatCard label="Drafts" value={fmt(posts.draft)} icon={PenLine} tone="amber" />
        <StatCard
          label="Scheduled"
          value={fmt(posts.scheduled)}
          icon={Clock}
          tone="blue"
          hint={upcoming[0]?.scheduled_at ? `Next: ${new Date(upcoming[0].scheduled_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : undefined}
        />
        <StatCard label="Total views" value={fmt(views.total)} icon={Eye} tone="pink" hint={views.pages != null ? `On-site counter · ${fmt(views.pages)} pages` : undefined} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Contact messages" value={fmt(forms.contact.total)} icon={Mail} tone="violet" hint={weekHint(forms.contact)} />
        <StatCard label="Newsletter" value={fmt(forms.newsletter.total)} icon={Newspaper} tone="pink" hint={weekHint(forms.newsletter)} />
        <StatCard label="Early access" value={fmt(forms.earlyAccess.total)} icon={Sparkles} tone="amber" hint={weekHint(forms.earlyAccess)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card title="Most viewed articles" description="On-site view counter (page_views)." bodyClassName="p-0 pt-3">
          {topPosts.length === 0 ? (
            <EmptyState icon={Eye} title="No views yet" text="Views are counted when visitors open an article." />
          ) : (
            <ol>
              {topPosts.map((p, i) => (
                <PostRow
                  key={p.id}
                  post={p}
                  right={
                    <div className="w-32 shrink-0">
                      <div className="flex items-center justify-end gap-1.5 text-[13px] font-bold text-ink-900">
                        <span className="text-[11px] font-semibold text-ink-300 mr-auto">#{i + 1}</span>
                        {fmt(p.views)}
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-ink-100 overflow-hidden">
                        <div className="h-full rounded-full bg-primary-600" style={{ width: `${(p.views / maxViews) * 100}%` }} />
                      </div>
                    </div>
                  }
                />
              ))}
            </ol>
          )}
        </Card>

        <Card
          title="Recently updated"
          actions={<Link href="/admin/pages" className="text-[12px] font-semibold text-primary-700 hover:underline">All pages</Link>}
          bodyClassName="p-0 pt-3"
        >
          {recentPosts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No articles yet"
              action={<LinkButton href="/admin/pages/new" icon={Plus} variant="accent">Write the first article</LinkButton>}
            />
          ) : (
            <ul>
              {recentPosts.map((p) => (
                <PostRow
                  key={p.id}
                  post={p}
                  right={
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge tone={STATUS_TONE[p.status] || 'gray'}>{p.status}</Badge>
                      <span className="text-[12px] text-ink-300 w-16 text-right">{timeAgo(p.updated_at)}</span>
                    </div>
                  }
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {(latestMessages.length > 0 || upcoming.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {latestMessages.length > 0 && (
            <Card title="Latest contact messages" description="Newest submissions of the contact form." bodyClassName="p-0 pt-3">
              <ul>
                {latestMessages.map((m) => (
                  <li key={m.id} className="px-5 py-3 border-b border-ink-50 last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-semibold text-ink-900 truncate">
                        {m.subject || '(no subject)'}
                      </p>
                      <span className="text-[12px] text-ink-300 shrink-0">{timeAgo(m.created_at)}</span>
                    </div>
                    <p className="text-[12px] text-ink-500 truncate">
                      {m.name || 'Anonymous'}
                      {m.email && (
                        <>
                          {' · '}
                          <a href={`mailto:${m.email}`} className="text-primary-700 hover:underline">{m.email}</a>
                        </>
                      )}
                    </p>
                    {m.message && <p className="mt-1 text-[12px] text-ink-500 line-clamp-2">{m.message}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {upcoming.length > 0 && (
            <Card title="Scheduled to publish" bodyClassName="p-0 pt-3">
              <ul>
                {upcoming.map((p) => (
                  <PostRow
                    key={p.id}
                    post={p}
                    right={
                      <span className="text-[12px] font-semibold text-sky-700 shrink-0">
                        {p.scheduled_at
                          ? new Date(p.scheduled_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
                          : '—'}
                      </span>
                    }
                  />
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

// ── 3. Traffic (GA4 + Search Console) ────────────────────────────────

const SERIES = {
  users: { key: 'users', name: 'Visitors', bar: 'bg-primary-600' },
  pageViews: { key: 'pageViews', name: 'Pageviews', bar: 'bg-primary-600' },
  clicks: { key: 'clicks', name: 'Search clicks', bar: 'bg-sky-600' },
};

const CHARTS = {
  users: { label: 'Visitors', series: [SERIES.users], needs: 'ga' },
  pageViews: { label: 'Pageviews', series: [SERIES.pageViews], needs: 'ga' },
  clicks: { label: 'Search clicks', series: [SERIES.clicks], needs: 'gsc' },
  both: { label: 'Visitors vs search clicks', series: [SERIES.users, SERIES.clicks], needs: 'both' },
};

/** Long ranges are summed into weeks (> 92 days) or months (> 400 days). */
function bucketDaily(daily) {
  if (daily.length <= 92) return { unit: 'day', rows: daily };
  const unit = daily.length > 400 ? 'month' : 'week';
  const groups = new Map();
  daily.forEach((d, i) => {
    const key = unit === 'month' ? d.date.slice(0, 7) : daily[i - (i % 7)].date;
    const g = groups.get(key) || { date: key, users: 0, pageViews: 0, clicks: 0, impressions: 0 };
    g.users += d.users;
    g.pageViews += d.pageViews;
    g.clicks += d.clicks;
    g.impressions += d.impressions;
    groups.set(key, g);
  });
  return { unit, rows: [...groups.values()] };
}

function DailyChart({ daily, chart }) {
  const { unit, rows } = bucketDaily(daily);
  const { series } = CHARTS[chart];
  const max = Math.max(1, ...rows.flatMap((r) => series.map((s) => r[s.key] || 0)));
  const total = (key) => rows.reduce((s, r) => s + (r[key] || 0), 0);

  if (rows.length === 0) {
    return <div className="h-44 flex items-center justify-center text-sm text-ink-300">No data for this period</div>;
  }

  const unitLabel = unit === 'day' ? 'Daily' : unit === 'week' ? 'Weekly' : 'Monthly';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3 text-[12px] text-ink-500">
        <span className="font-semibold text-ink-300">{unitLabel} totals</span>
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cn('w-2.5 h-2.5 rounded-sm', s.bar)} />
            {s.name} <span className="font-bold text-ink-900">{fmt(total(s.key))}</span>
          </span>
        ))}
      </div>

      <div className="relative">
        {/* recessive grid: max + half */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          <div className="border-t border-dashed border-ink-100" />
          <div className="border-t border-dashed border-ink-100" />
          <div className="border-t border-ink-200" />
        </div>
        <span className="absolute -top-2 left-0 text-[10px] text-ink-300 bg-white pr-1">{fmt(max)}</span>

        <div
          className="relative flex items-end gap-[2px] h-44"
          role="img"
          aria-label={`${unitLabel} ${series.map((s) => `${s.name}: ${fmt(total(s.key))}`).join(', ')}`}
        >
          {rows.map((r, i) => {
            const align = i < rows.length / 3 ? 'left-0' : i > (rows.length * 2) / 3 ? 'right-0' : 'left-1/2 -translate-x-1/2';
            const label = unit === 'week' ? `Week of ${shortDate(r.date)}` : shortDate(r.date, unit);
            return (
              <div key={r.date} className="group relative flex-1 h-full flex items-end justify-center gap-[1px] hover:bg-ink-50/80 rounded-t">
                {series.map((s) => (
                  <div
                    key={s.key}
                    className={cn('flex-1 max-w-[28px] rounded-t-[4px]', s.bar)}
                    style={{ height: `${((r[s.key] || 0) / max) * 100}%` }}
                  />
                ))}
                <div className={cn('absolute -top-2 -translate-y-full z-10 hidden group-hover:block pointer-events-none', align)}>
                  <div className="rounded-lg border border-ink-100 bg-white shadow-soft px-2.5 py-1.5 text-[11px] whitespace-nowrap">
                    <p className="font-bold text-ink-900">{label}</p>
                    {series.map((s) => (
                      <p key={s.key} className="flex items-center gap-1.5 text-ink-500">
                        <span className={cn('w-2 h-2 rounded-sm', s.bar)} />
                        {s.name}: <span className="font-semibold text-ink-900">{fmt(r[s.key])}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between mt-2 text-[10px] text-ink-300">
        <span>{shortDate(rows[0].date, unit)}</span>
        <span>{shortDate(rows[rows.length - 1].date, unit)}</span>
      </div>
    </div>
  );
}

function BarList({ items, empty, accent = 'bg-primary-600', render }) {
  if (!items.length) return <p className="px-5 py-10 text-center text-sm text-ink-300">{empty}</p>;
  const max = items[0].value || 1;
  return (
    <ol className="max-h-[440px] overflow-y-auto">
      {items.map((it, i) => (
        <li key={it.key} className="px-5 py-2.5 border-b border-ink-50 last:border-0">
          <div className="flex items-center gap-3">
            <span className={cn('w-6 shrink-0 text-[11px] font-bold', i < 3 ? 'text-ink-900' : 'text-ink-300')}>#{i + 1}</span>
            <div className="min-w-0 flex-1">{render(it)}</div>
            <span className="text-[13px] font-bold text-ink-900 shrink-0">{fmt(it.value)}</span>
          </div>
          <div className="ml-9 mt-1.5 h-1 rounded-full bg-ink-100 overflow-hidden">
            <div className={cn('h-full rounded-full', accent)} style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function SearchTable({ rows, firstLabel, first, showCtr }) {
  return (
    <div className="max-h-[440px] overflow-auto">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-ink-100 text-[10px] font-bold uppercase tracking-wide text-ink-300">
            <th className="text-left pl-5 pr-2 py-2.5">#</th>
            <th className="text-left px-2 py-2.5">{firstLabel}</th>
            <th className="text-right px-2 py-2.5">Clicks</th>
            <th className="text-right px-2 py-2.5">Impr.</th>
            {showCtr && <th className="text-right px-2 py-2.5">CTR</th>}
            <th className="text-right pl-2 pr-5 py-2.5">Pos.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-ink-50 last:border-0">
              <td className="pl-5 pr-2 py-2.5 font-bold text-ink-300">{i + 1}</td>
              <td className="px-2 py-2.5 text-ink-900 max-w-[240px] truncate">{first(r)}</td>
              <td className="px-2 py-2.5 text-right font-bold text-ink-900">{fmt(r.clicks)}</td>
              <td className="px-2 py-2.5 text-right text-ink-500">{fmt(r.impressions)}</td>
              {showCtr && <td className="px-2 py-2.5 text-right text-ink-500">{r.ctr}%</td>}
              <td className="pl-2 pr-5 py-2.5 text-right text-ink-500">{r.position}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceStatus({ label, src }) {
  if (!src.configured) return <Badge tone="gray"><Settings2 className="w-3 h-3" /> {label}: not configured</Badge>;
  if (src.connected) return <Badge tone="green"><CheckCircle2 className="w-3 h-3" /> {label}</Badge>;
  return <Badge tone="red"><XCircle className="w-3 h-3" /> {label}: error</Badge>;
}

function NotConfiguredCard({ missing }) {
  return (
    <Card title="Google Analytics & Search Console — not configured" className="mb-6">
      <div className="text-[13px] text-ink-500 leading-relaxed space-y-3">
        <p>
          Set these in <strong className="text-ink-900">Vercel → Project → Settings → Environment Variables</strong>, then redeploy:
        </p>
        <ul className="space-y-1.5">
          {[
            ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'the service account e-mail (…@….iam.gserviceaccount.com)'],
            ['GOOGLE_PRIVATE_KEY', 'the service account private key (\\n line breaks are fine)'],
            ['GA4_PROPERTY_ID', 'numeric GA4 property id (GA4 → Admin → Property details)'],
            ['GSC_SITE_URL', `optional — Search Console property, default ${SITE_URL}/ (use sc-domain:famies.app for a domain property)`],
          ].map(([key, text]) => (
            <li key={key} className="flex flex-wrap items-baseline gap-2">
              <code className={cn('px-1.5 py-0.5 rounded-md text-[12px] font-bold', missing.includes(key) ? 'bg-red-50 text-red-600' : 'bg-ink-50 text-ink-700')}>
                {key}
              </code>
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <p>
          Then add the service account e-mail as a <strong className="text-ink-900">Viewer</strong> in GA4
          (Admin → Property access management) and as a <strong className="text-ink-900">user</strong> in
          Search Console (Settings → Users and permissions).
        </p>
      </div>
    </Card>
  );
}

function TrafficSection() {
  const [period, setPeriod] = useState('30d');
  const [chart, setChart] = useState('users');
  const { data, error, loading } = useAdminJson(`/api/admin/analytics?period=${period}`);
  const periodLabel = PERIODS.find((p) => p.value === period)?.label;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 className="text-lg font-black tracking-tight text-ink-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary-700" /> Traffic
        </h2>
        <p className="text-[13px] text-ink-500">Google Analytics 4 and Google Search Console.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {data && <SourceStatus label="GA4" src={data.ga} />}
        {data && <SourceStatus label="Search Console" src={data.gsc} />}
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-auto" aria-label="Period">
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
      </div>
    </div>
  );

  if (loading) {
    return (
      <section>
        {header}
        <LoadingBlock label="Loading analytics…" />
      </section>
    );
  }
  if (error) {
    return (
      <section>
        {header}
        <Notice tone="error" title="Could not load analytics">{error}</Notice>
      </section>
    );
  }

  const { ga, gsc, overview, daily, topPages, topCountries, topSources, topKeywords, topSearchPages, searchTotals } = data;

  if (!ga.configured && !gsc.configured) {
    return (
      <section>
        {header}
        <NotConfiguredCard missing={[...new Set([...ga.missing, ...gsc.missing])]} />
      </section>
    );
  }

  const available = Object.entries(CHARTS).filter(([, c]) =>
    c.needs === 'ga' ? ga.connected : c.needs === 'gsc' ? gsc.connected : ga.connected && gsc.connected
  );
  const activeChart = available.some(([k]) => k === chart) ? chart : available[0]?.[0];

  return (
    <section>
      {header}

      {!ga.configured && (
        <Notice tone="warning" title="Google Analytics 4 — not configured" className="mb-4">
          Set {ga.missing.join(', ')} in Vercel env to show visitors, pageviews, pages, sources and countries.
        </Notice>
      )}
      {ga.configured && ga.error && (
        <Notice tone="error" title="Google Analytics 4 error" className="mb-4">
          {ga.error} — check GA4_PROPERTY_ID and that the service account is a Viewer on the property.
        </Notice>
      )}
      {!gsc.configured && (
        <Notice tone="warning" title="Search Console — not configured" className="mb-4">
          Set {gsc.missing.join(', ')} in Vercel env to show search clicks and keywords.
        </Notice>
      )}
      {gsc.configured && gsc.error && (
        <Notice tone="error" title="Search Console error" className="mb-4">
          {gsc.error} — property “{gsc.siteUrl}”. Add the service account as a user in Search Console, or set
          GSC_SITE_URL (e.g. sc-domain:famies.app).
        </Notice>
      )}

      {ga.connected && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
          <StatCard label={`Visitors · ${periodLabel}`} value={fmt(overview.users)} icon={Users} tone="pink" />
          <StatCard label="Visitors · 7 days" value={fmt(overview.users7d)} icon={Calendar} tone="green" />
          <StatCard label="Visitors · today" value={fmt(overview.usersToday)} icon={Clock} tone="violet" />
          <StatCard label="New visitors" value={fmt(overview.newUsers)} icon={TrendingUp} tone="amber" />
          <StatCard label="Sessions" value={fmt(overview.sessions)} icon={Activity} tone="blue" />
          <StatCard label="Pageviews" value={fmt(overview.pageViews)} icon={Layers} tone="pink" />
        </div>
      )}

      {gsc.connected && searchTotals && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatCard label="Search clicks" value={fmt(searchTotals.clicks)} icon={MousePointerClick} tone="blue" hint="Google Search Console" />
          <StatCard label="Impressions" value={fmt(searchTotals.impressions)} icon={Eye} tone="violet" />
          <StatCard label="Avg. CTR" value={`${searchTotals.ctr}%`} icon={Percent} tone="green" />
        </div>
      )}

      {activeChart && (
        <Card
          className="mb-6"
          title={`${CHARTS[activeChart].label} — ${periodLabel}`}
          actions={
            available.length > 1 && (
              <Select value={activeChart} onChange={(e) => setChart(e.target.value)} className="h-8 text-xs w-auto" aria-label="Chart">
                {available.map(([k, c]) => (
                  <option key={k} value={k}>{c.label}</option>
                ))}
              </Select>
            )
          }
        >
          <DailyChart daily={daily} chart={activeChart} />
        </Card>
      )}

      {ga.connected && (
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
          <Card title="Top pages" description="By pageviews." bodyClassName="p-0 pt-3">
            <BarList
              items={topPages.map((p) => ({ ...p, key: `${p.slug}|${p.title}`, value: p.views }))}
              empty="No page data"
              render={(p) => (
                <>
                  <p className="text-[13px] font-semibold text-ink-900 truncate">{p.title}</p>
                  <a href={absoluteUrl(p.slug)} target="_blank" rel="noopener noreferrer" className="block text-[12px] text-ink-300 truncate hover:text-primary-700">
                    {p.slug}
                  </a>
                </>
              )}
            />
          </Card>
          <Card title="Traffic sources" description="Sessions by source / medium." bodyClassName="p-0 pt-3">
            <BarList
              items={topSources.map((s) => ({ ...s, key: `${s.source}|${s.medium}`, value: s.sessions }))}
              empty="No source data"
              accent="bg-sky-600"
              render={(s) => (
                <>
                  <p className="text-[13px] font-semibold text-ink-900 truncate flex items-center gap-1.5">
                    <Share2 className="w-3 h-3 text-ink-300 shrink-0" /> {s.source}
                  </p>
                  <p className="text-[12px] text-ink-300 truncate">{s.medium} · {fmt(s.users)} visitors</p>
                </>
              )}
            />
          </Card>
          <Card title="Countries" description="By active visitors." bodyClassName="p-0 pt-3">
            <BarList
              items={topCountries.map((c) => ({ ...c, key: c.country, value: c.users }))}
              empty="No country data"
              accent="bg-emerald-600"
              render={(c) => (
                <p className="text-[13px] font-semibold text-ink-900 truncate flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-ink-300 shrink-0" /> {c.country}
                </p>
              )}
            />
          </Card>
        </div>
      )}

      {gsc.connected && (
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <Card title="Top search keywords" description="Google Search Console, by clicks." bodyClassName="p-0 pt-3">
            {topKeywords.length ? (
              <SearchTable rows={topKeywords} firstLabel="Keyword" first={(r) => r.keyword} showCtr />
            ) : (
              <EmptyState icon={Search} title="No keyword data yet" text="Search Console needs a few days of impressions." />
            )}
          </Card>
          <Card title="Top search pages" description="Pages that get clicks from Google." bodyClassName="p-0 pt-3">
            {topSearchPages.length ? (
              <SearchTable
                rows={topSearchPages}
                firstLabel="Page"
                first={(r) => (
                  <a href={r.url || absoluteUrl(r.page)} target="_blank" rel="noopener noreferrer" className="hover:text-primary-700">
                    {r.page}
                  </a>
                )}
              />
            ) : (
              <EmptyState icon={MousePointerClick} title="No search page data yet" />
            )}
          </Card>
        </div>
      )}
    </section>
  );
}

// ── page ─────────────────────────────────────────────────────────────

export default function DashboardClient({ siteMode }) {
  return (
    <div>
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description="Site mode, content and traffic for famies.app at a glance."
        actions={
          <>
            <LinkButton href="/admin/pages/new" icon={Plus} variant="accent">New article</LinkButton>
            <LinkButton href="/" icon={ArrowUpRight} external>View site</LinkButton>
            <ClearCacheButton />
          </>
        }
      />

      <SiteModeCard siteMode={siteMode} />

      <h2 className="text-lg font-black tracking-tight text-ink-900 flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-primary-700" /> Content
      </h2>
      <ContentSection />

      <TrafficSection />
    </div>
  );
}
