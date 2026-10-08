/**
 * A small query builder over PostgreSQL that mirrors the subset of the
 * supabase-js / PostgREST API this codebase uses, so data-access code reads
 * the same as before:
 *
 *   const { data, error, count } = await db
 *     .from('blog_posts')
 *     .select('id, title', { count: 'exact' })
 *     .eq('status', 'published')
 *     .order('published_at', { ascending: false })
 *     .range(0, 24);
 *
 * Supported: select (columns, count 'exact', head), insert, update, upsert
 * (onConflict), delete, returning via .select(); filters eq, neq, gt, gte,
 * lt, lte, like, ilike, is, in, or (PostgREST filter syntax incl. nested
 * and()/or()); order, range, limit, single, maybeSingle; rpc().
 * Every value is sent as a bind parameter; identifiers are validated.
 */

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Primary keys for upserts without an explicit onConflict.
const PRIMARY_KEYS = { site_settings: 'key', indexing_cache: 'url', page_views: 'slug' };

function ident(name) {
  if (typeof name !== 'string' || !IDENT.test(name)) {
    throw new Error(`Invalid identifier: ${JSON.stringify(name)}`);
  }
  return `"${name}"`;
}

function columnList(cols) {
  const raw = (cols ?? '*').trim();
  if (raw === '' || raw === '*') return '*';
  return raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => (c === '*' ? '*' : ident(c)))
    .join(', ');
}

/** JS value → bind parameter (objects/arrays are stored as JSON). */
function toParam(v) {
  if (v === undefined) return null;
  if (v === null || v instanceof Date || Buffer.isBuffer(v)) return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'ILIKE' };

function dbError(err) {
  return {
    message: err?.message || String(err),
    code: err?.code,
    details: err?.detail ?? null,
    hint: err?.hint ?? null,
  };
}

/* ── PostgREST or()/and() filter-string parser ─────────────────────── */

// Split on commas that are not inside parentheses or double quotes.
function splitTopLevel(s) {
  const parts = [];
  let depth = 0;
  let quoted = false;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && s[i - 1] !== '\\') quoted = !quoted;
    else if (!quoted && ch === '(') depth++;
    else if (!quoted && ch === ')') depth--;
    if (ch === ',' && depth === 0 && !quoted) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function unquote(v) {
  const t = v.trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1).replace(/\\"/g, '"') : t;
}

function parseCondition(cond, params) {
  const group = cond.match(/^(not\.)?(and|or)\((.*)\)$/s);
  if (group) {
    const inner = splitTopLevel(group[3]).map((c) => parseCondition(c, params));
    const joined = `(${inner.join(group[2] === 'and' ? ' AND ' : ' OR ')})`;
    return group[1] ? `NOT ${joined}` : joined;
  }

  const m = cond.match(/^([A-Za-z_][A-Za-z0-9_]*)\.(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.(.*)$/s);
  if (!m) throw new Error(`Unsupported filter: ${cond}`);
  const [, col, not, op, rawValue] = m;
  let sql;
  if (op === 'is') {
    const v = rawValue.trim().toLowerCase();
    if (!['null', 'true', 'false'].includes(v)) throw new Error(`Unsupported is value: ${rawValue}`);
    sql = `${ident(col)} IS ${v.toUpperCase()}`;
  } else if (op === 'in') {
    const list = rawValue.trim().replace(/^\(/, '').replace(/\)$/, '');
    const values = splitTopLevel(list).map(unquote);
    if (!values.length) sql = 'FALSE';
    else {
      const ph = values.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      sql = `${ident(col)} IN (${ph.join(', ')})`;
    }
  } else {
    let value = unquote(rawValue);
    if (op === 'like' || op === 'ilike') value = value.replace(/\*/g, '%');
    params.push(value);
    sql = `${ident(col)} ${OPS[op]} $${params.length}`;
  }
  return not ? `NOT (${sql})` : sql;
}

/* ── Builder ───────────────────────────────────────────────────────── */

class QueryBuilder {
  constructor(pool, table) {
    this.pool = pool;
    this.table = table;
    this.op = 'select';
    this.columns = '*';
    this.countMode = null;
    this.head = false;
    this.filters = []; // functions (params) => sql
    this.orders = [];
    this.limitN = null;
    this.offsetN = null;
    this.returning = null;
    this.values = null;
    this.onConflict = null;
    this.ignoreDuplicates = false;
    this.resultMode = 'many'; // 'many' | 'single' | 'maybe'
  }

  select(columns = '*', opts = {}) {
    if (this.op === 'select') {
      this.columns = columns;
      this.countMode = opts.count || null;
      this.head = !!opts.head;
    } else {
      this.returning = columns || '*';
    }
    return this;
  }

  insert(values) {
    this.op = 'insert';
    this.values = values;
    return this;
  }

  upsert(values, opts = {}) {
    this.op = 'upsert';
    this.values = values;
    this.onConflict = opts.onConflict || PRIMARY_KEYS[this.table] || 'id';
    this.ignoreDuplicates = !!opts.ignoreDuplicates;
    return this;
  }

  update(values) {
    this.op = 'update';
    this.values = values;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  _cmp(col, op, value) {
    this.filters.push((params) => {
      params.push(toParam(value));
      return `${ident(col)} ${OPS[op]} $${params.length}`;
    });
    return this;
  }

  eq(col, v) { return v === null ? this.is(col, null) : this._cmp(col, 'eq', v); }
  neq(col, v) { return this._cmp(col, 'neq', v); }
  gt(col, v) { return this._cmp(col, 'gt', v); }
  gte(col, v) { return this._cmp(col, 'gte', v); }
  lt(col, v) { return this._cmp(col, 'lt', v); }
  lte(col, v) { return this._cmp(col, 'lte', v); }
  like(col, v) { return this._cmp(col, 'like', v); }
  ilike(col, v) { return this._cmp(col, 'ilike', v); }

  is(col, v) {
    const word = v === null ? 'NULL' : v === true ? 'TRUE' : v === false ? 'FALSE' : null;
    if (!word) throw new Error(`Unsupported is() value: ${v}`);
    this.filters.push(() => `${ident(col)} IS ${word}`);
    return this;
  }

  in(col, values) {
    const list = Array.isArray(values) ? values : [];
    this.filters.push((params) => {
      if (!list.length) return 'FALSE';
      const ph = list.map((v) => {
        params.push(toParam(v));
        return `$${params.length}`;
      });
      return `${ident(col)} IN (${ph.join(', ')})`;
    });
    return this;
  }

  or(filterString) {
    this.filters.push((params) => {
      const parts = splitTopLevel(filterString).map((c) => parseCondition(c, params));
      return parts.length ? `(${parts.join(' OR ')})` : 'TRUE';
    });
    return this;
  }

  order(col, opts = {}) {
    const dir = opts.ascending === false ? 'DESC' : 'ASC';
    const nulls = opts.nullsFirst === true ? ' NULLS FIRST' : opts.nullsFirst === false ? ' NULLS LAST' : '';
    this.orders.push(`${ident(col)} ${dir}${nulls}`);
    return this;
  }

  limit(n) {
    this.limitN = Number(n);
    return this;
  }

  range(from, to) {
    this.offsetN = Number(from);
    this.limitN = Number(to) - Number(from) + 1;
    return this;
  }

  single() {
    this.resultMode = 'single';
    return this;
  }

  maybeSingle() {
    this.resultMode = 'maybe';
    return this;
  }

  _where(params) {
    if (!this.filters.length) return '';
    return ' WHERE ' + this.filters.map((f) => f(params)).join(' AND ');
  }

  _rows() {
    const rows = Array.isArray(this.values) ? this.values : [this.values];
    return rows.filter((r) => r && typeof r === 'object');
  }

  _build() {
    const params = [];
    const table = ident(this.table);
    const returning = this.returning ? ` RETURNING ${columnList(this.returning)}` : '';

    if (this.op === 'select') {
      const where = this._where(params);
      let text = `SELECT ${columnList(this.columns)} FROM ${table}${where}`;
      if (this.orders.length) text += ` ORDER BY ${this.orders.join(', ')}`;
      if (this.limitN != null) text += ` LIMIT ${Math.max(0, this.limitN | 0)}`;
      if (this.offsetN != null) text += ` OFFSET ${Math.max(0, this.offsetN | 0)}`;
      const countParams = [];
      const countText = this.countMode ? `SELECT count(*)::int AS count FROM ${table}${this._where(countParams)}` : null;
      return { text, params, countText, countParams };
    }

    if (this.op === 'insert' || this.op === 'upsert') {
      const rows = this._rows();
      if (!rows.length) throw new Error('No rows to insert');
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      cols.forEach(ident);
      const tuples = rows.map((r) =>
        '(' +
        cols
          .map((c) => {
            if (!(c in r) || r[c] === undefined) return 'DEFAULT';
            params.push(toParam(r[c]));
            return `$${params.length}`;
          })
          .join(', ') +
        ')'
      );
      let text = `INSERT INTO ${table} (${cols.map(ident).join(', ')}) VALUES ${tuples.join(', ')}`;
      if (this.op === 'upsert') {
        const conflict = this.onConflict.split(',').map((c) => c.trim());
        const target = conflict.map(ident).join(', ');
        const updates = cols.filter((c) => !conflict.includes(c));
        text +=
          this.ignoreDuplicates || !updates.length
            ? ` ON CONFLICT (${target}) DO NOTHING`
            : ` ON CONFLICT (${target}) DO UPDATE SET ${updates.map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`).join(', ')}`;
      }
      return { text: text + returning, params };
    }

    if (this.op === 'update') {
      const entries = Object.entries(this.values || {}).filter(([, v]) => v !== undefined);
      if (!entries.length) throw new Error('No columns to update');
      const set = entries
        .map(([c, v]) => {
          params.push(toParam(v));
          return `${ident(c)} = $${params.length}`;
        })
        .join(', ');
      if (!this.filters.length) throw new Error('Refusing to update without a filter');
      return { text: `UPDATE ${table} SET ${set}${this._where(params)}${returning}`, params };
    }

    if (this.op === 'delete') {
      if (!this.filters.length) throw new Error('Refusing to delete without a filter');
      return { text: `DELETE FROM ${table}${this._where(params)}${returning}`, params };
    }

    throw new Error(`Unknown operation ${this.op}`);
  }

  async _execute() {
    try {
      const { text, params, countText, countParams } = this._build();
      let count = null;
      let rows = [];

      if (this.op === 'select' && this.head) {
        const r = await this.pool.query(countText || `SELECT count(*)::int AS count FROM (${text}) t`, countText ? countParams : params);
        return { data: null, error: null, count: r.rows[0]?.count ?? 0, status: 200 };
      }

      const [res, countRes] = await Promise.all([
        this.pool.query(text, params),
        countText ? this.pool.query(countText, countParams) : null,
      ]);
      rows = res.rows;
      if (countRes) count = countRes.rows[0]?.count ?? 0;

      const returnsRows = this.op === 'select' || !!this.returning;
      if (!returnsRows) return { data: null, error: null, count, status: this.op === 'insert' ? 201 : 204 };

      if (this.resultMode === 'single') {
        if (rows.length !== 1) {
          return {
            data: null,
            error: { message: `JSON object requested, multiple (or no) rows returned (${rows.length})`, code: 'PGRST116' },
            count,
            status: 406,
          };
        }
        return { data: rows[0], error: null, count, status: 200 };
      }
      if (this.resultMode === 'maybe') {
        if (rows.length > 1) {
          return { data: null, error: { message: 'Multiple rows returned', code: 'PGRST116' }, count, status: 406 };
        }
        return { data: rows[0] ?? null, error: null, count, status: 200 };
      }
      return { data: rows, error: null, count, status: 200 };
    } catch (err) {
      return { data: null, error: dbError(err), count: null, status: 500 };
    }
  }

  then(resolve, reject) {
    if (!this._promise) this._promise = this._execute();
    return this._promise.then(resolve, reject);
  }
}

/** db.rpc('fn', { arg: value }) → calls the SQL function with named args. */
async function rpc(pool, fn, args = {}) {
  try {
    const entries = Object.entries(args);
    const params = entries.map(([, v]) => toParam(v));
    const argSql = entries.map(([k], i) => `${ident(k)} => $${i + 1}`).join(', ');
    const res = await pool.query(`SELECT ${ident(fn)}(${argSql}) AS result`, params);
    return { data: res.rows[0]?.result ?? null, error: null };
  } catch (err) {
    return { data: null, error: dbError(err) };
  }
}

export function createQueryClient(pool, storage) {
  return {
    from: (table) => {
      ident(table);
      return new QueryBuilder(pool, table);
    },
    rpc: (fn, args) => rpc(pool, fn, args),
    query: (text, params) => pool.query(text, params),
    storage,
  };
}

// Exported for unit tests.
export const __test = { splitTopLevel, parseCondition, columnList };
