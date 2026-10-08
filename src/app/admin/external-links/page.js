'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ExternalLink, Plus, Trash2, Pencil, Check, X, Globe, Link2, Info } from 'lucide-react';
import {
  PageHeader, Card, Button, Field, Input, Select, Toggle, Badge, Notice, EmptyState, LoadingBlock,
} from '@/components/admin/ui';
import { useModal } from '@/components/admin/AdminModal';

/** Same heuristic as the API: scheme, slash or query string → exact URL. */
function inferMatchType(pattern) {
  const p = pattern.trim();
  return /^https?:\/\//i.test(p) || p.includes('/') || p.includes('?') ? 'url' : 'domain';
}

function TypeBadge({ type }) {
  return type === 'domain' ? (
    <Badge tone="green">
      <Globe className="h-3 w-3" /> Domain
    </Badge>
  ) : (
    <Badge tone="blue">
      <Link2 className="h-3 w-3" /> URL
    </Badge>
  );
}

export default function ExternalLinksPage() {
  const { showConfirm } = useModal();

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [pattern, setPattern] = useState('');
  const [matchType, setMatchType] = useState('auto');
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState(null);

  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({ pattern: '', match_type: 'domain', note: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/external-links', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load rules');
      setRules(json.rules ?? []);
      setLoadError(null);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function request(method, body) {
    const res = await fetch('/api/admin/external-links', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!pattern.trim()) return;
    setAdding(true);
    setFormError(null);
    try {
      await request('POST', {
        pattern: pattern.trim(),
        match_type: matchType === 'auto' ? undefined : matchType,
        note: note.trim() || undefined,
      });
      toast.success('Rule added');
      setPattern('');
      setNote('');
      setMatchType('auto');
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function toggleEnabled(rule) {
    const next = !rule.enabled;
    setRules((list) => list.map((r) => (r.id === rule.id ? { ...r, enabled: next } : r)));
    try {
      await request('PATCH', { id: rule.id, enabled: next });
      toast.success(next ? 'Rule enabled' : 'Rule disabled');
      await load();
    } catch (err) {
      setRules((list) => list.map((r) => (r.id === rule.id ? { ...r, enabled: rule.enabled } : r)));
      toast.error(err.message);
    }
  }

  async function handleDelete(rule) {
    const ok = await showConfirm('Delete rule', `Stop adding nofollow to links matching "${rule.pattern}"?`, 'danger');
    if (!ok) return;
    try {
      await request('DELETE', { id: rule.id });
      toast.success('Rule deleted');
      if (editId === rule.id) setEditId(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function startEdit(rule) {
    setEditId(rule.id);
    setDraft({ pattern: rule.pattern, match_type: rule.match_type, note: rule.note ?? '' });
  }

  async function saveEdit() {
    if (!draft.pattern.trim()) {
      toast.error('Pattern is required');
      return;
    }
    setSavingEdit(true);
    try {
      await request('PATCH', {
        id: editId,
        pattern: draft.pattern.trim(),
        match_type: draft.match_type,
        note: draft.note,
      });
      toast.success('Rule updated');
      setEditId(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  // Show what the rule will do BEFORE the admin submits it.
  const effectiveType = matchType === 'auto' ? inferMatchType(pattern) : matchType;
  const activeCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        icon={ExternalLink}
        title="External Links"
        description={
          <>
            Add a domain to make every outbound link to that domain (and its subdomains){' '}
            <code className="rounded bg-primary/10 px-1.5 py-0.5 text-[12px] text-primary-700">rel=&quot;nofollow&quot;</code>, or add a
            specific URL to nofollow only that exact link. Useful for affiliate or partner links (e.g. <strong>amazon.se</strong>) that
            should pass no SEO value. Rules apply to every article instantly; no need to re-save posts.
          </>
        }
      />

      {/* Add form */}
      <Card title="Add a rule">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_170px_1fr]">
            <Field label="Domain or URL" htmlFor="rule-pattern">
              <Input
                id="rule-pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="amazon.se  or  https://amazon.se/dp/B0XXXX"
                className="font-mono text-[13px]"
              />
            </Field>
            <Field label="Match" htmlFor="rule-type">
              <Select id="rule-type" value={matchType} onChange={(e) => setMatchType(e.target.value)}>
                <option value="auto">Auto-detect</option>
                <option value="domain">Domain</option>
                <option value="url">Exact URL</option>
              </Select>
            </Field>
            <Field label="Note (optional)" htmlFor="rule-note">
              <Input id="rule-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Affiliate partner" />
            </Field>
          </div>

          {pattern.trim() && (
            <p className="flex items-center gap-1.5 text-[12px] text-ink-500">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>
                {matchType === 'auto' ? 'Detected as a ' : 'Saved as a '}
                <strong className={effectiveType === 'domain' ? 'text-emerald-700' : 'text-sky-700'}>
                  {effectiveType === 'domain' ? 'domain' : 'URL'}
                </strong>{' '}
                rule.{' '}
                {effectiveType === 'domain'
                  ? 'Every link to this hostname (and its subdomains) will become nofollow.'
                  : 'Only this exact URL will become nofollow.'}
              </span>
            </p>
          )}

          {formError && <Notice tone="error">{formError}</Notice>}

          <div className="flex justify-end">
            <Button type="submit" variant="accent" icon={Plus} loading={adding} disabled={!pattern.trim()}>
              Add rule
            </Button>
          </div>
        </form>
      </Card>

      {/* Existing rules */}
      <Card
        title="Nofollow rules"
        description={rules.length ? `${rules.length} ${rules.length === 1 ? 'rule' : 'rules'} · ${activeCount} active` : undefined}
        bodyClassName="p-0 pt-3"
      >
        {loading ? (
          <LoadingBlock label="Loading rules…" />
        ) : loadError ? (
          <div className="p-5">
            <Notice tone="error" title="Could not load rules">
              {loadError}
            </Notice>
          </div>
        ) : rules.length === 0 ? (
          <EmptyState icon={ExternalLink} title="No nofollow rules yet" text="Add a domain or URL above to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-y border-ink-100 bg-ink-50/60 text-left text-[11px] font-bold uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3">Pattern</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Note</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) =>
                  editId === rule.id ? (
                    <tr key={rule.id} className="border-b border-ink-100 bg-primary-50/40 align-top">
                      <td className="px-5 py-3">
                        <Input
                          value={draft.pattern}
                          onChange={(e) => setDraft({ ...draft, pattern: e.target.value })}
                          className="h-9 font-mono text-[12.5px]"
                          aria-label="Pattern"
                          autoFocus
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={draft.match_type}
                          onChange={(e) => setDraft({ ...draft, match_type: e.target.value })}
                          className="h-9 min-w-[110px] text-[13px]"
                          aria-label="Match type"
                        >
                          <option value="domain">Domain</option>
                          <option value="url">Exact URL</option>
                        </Select>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <Input
                          value={draft.note}
                          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                          placeholder="Note"
                          className="h-9 text-[13px]"
                          aria-label="Note"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={rule.enabled ? 'green' : 'gray'}>{rule.enabled ? 'Active' : 'Disabled'}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="accent" icon={Check} loading={savingEdit} onClick={saveEdit}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditId(null)} disabled={savingEdit} aria-label="Cancel">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={rule.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/50">
                      <td className="px-5 py-3">
                        <p className="max-w-[360px] truncate font-mono text-[12.5px] font-medium text-ink-900" title={rule.pattern}>
                          {rule.pattern}
                        </p>
                        {rule.note && <p className="mt-0.5 text-[11px] text-ink-500 lg:hidden">{rule.note}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={rule.match_type} />
                      </td>
                      <td className="hidden px-4 py-3 text-[12px] text-ink-500 lg:table-cell">{rule.note || '—'}</td>
                      <td className="px-4 py-3">
                        <Toggle
                          checked={rule.enabled}
                          onChange={() => toggleEnabled(rule)}
                          label={<span className="text-[12px]">{rule.enabled ? 'Active' : 'Disabled'}</span>}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(rule)} title="Edit rule" aria-label="Edit rule">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(rule)}
                            title="Delete rule"
                            aria-label="Delete rule"
                            className="text-red-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
