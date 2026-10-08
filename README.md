# Famies — famies.app

Website for the Famies family-activities app: Next.js 16 + PostgreSQL, self-hosted on the Hetzner server with Coolify (`docker-compose.yml`).

- **Public site** — homepage, `/inspiration` (articles), article pages at `/<slug>`, contact, skapa-event, legal pages, `sitemap.xml`, `robots.txt`, `feed.xml`.
- **Admin panel** — `/admin` (login at `/login`, admin emails only). Same sections as mushroomidentifiers.com minus Subscriptions and Adify:
  Dashboard (+ Coming Soon switch) · Pages (articles/pages editor, scheduling) · Homepage · Rank Tracker · SEO Health · Indexing Report · Header Scripts · External Links · Menus · Footer Content · Theme Colors · Custom CSS.
- **Writerify API** — publish articles straight from the Writerify desktop app (`/api/writerify/*`).

There are no public user accounts (no signup, no user dashboard).

## How it fits together

| Part | Where |
|---|---|
| Database | PostgreSQL 16 (`db` service in `docker-compose.yml`). Schema: `db/schema.sql`, applied automatically on every app start by `scripts/migrate.mjs` (idempotent). |
| Data access | `src/lib/db/` — `getDb()` returns a small query builder (`db.from('blog_posts').select(…).eq(…)`); public pages read through `cachedRead()` with cache tags that the admin API revalidates on every save. |
| Admin login | `src/lib/auth.js` — `ADMIN_EMAIL` + `ADMIN_PASSWORD`, HttpOnly signed session cookie (`SESSION_SECRET`), rate-limited. |
| Images | Saved on disk in `UPLOAD_DIR` (Docker volume `famies-uploads`) and served at `/uploads/…`. |
| Public forms | `POST /api/forms/{contact,newsletter,early-access}` |

## Coming Soon page

The Coming Soon landing (logo + App Store / Google Play badges) is kept in `src/components/ComingSoon.js`.

- **No deploy:** `/admin` → Dashboard → *Coming Soon mode* ON/OFF (stored in `site_settings.coming_soon`).
- **In code:** `LIVE` in `src/lib/siteConfig.js` is the default when the admin switch has never been used.

## Deploying on Coolify

1. Coolify → project → **New Resource** → GitHub repository `muhiussunnah/famiesapp`, branch `main`, **Build Pack: Docker Compose** (`/docker-compose.yml`).
2. Coolify generates every secret itself (`SERVICE_PASSWORD_*`): the database password, `SESSION_SECRET`, the admin password (`SERVICE_PASSWORD_ADMIN`) and the Writerify token (`SERVICE_PASSWORD_64_WRITERFY`). Read them in the resource's **Environment Variables** tab.
3. Set the domain of the **app** service (e.g. `https://famies.app,https://www.famies.app`) and deploy. Point the domain's DNS A record to the server IP; Coolify issues the SSL certificate.
4. Optional: a Coolify **Scheduled Task** on the app container, daily, command `wget -qO- --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/publish-scheduled` (scheduled posts already go live on time without it; the job only tidies their status).

Data lives in the Docker volumes `famies-db` (database) and `famies-uploads` (images) — back these up.

## Publishing from Writerify

In Writerify → Sites → add a Next.js site:

| Field | Value |
|---|---|
| SITE NAME | Famies |
| PUBLISHING MODE | Custom API |
| API ENDPOINT URL | `https://famies.app/api/writerify/publish` |
| API TOKEN (BEARER) | the value of `WRITERFY_API_TOKEN` (Coolify → Environment Variables → `SERVICE_PASSWORD_64_WRITERFY`) |
| IMAGE UPLOAD URL | `https://famies.app/api/writerify/upload-image` |
| CATEGORIES ENDPOINT URL | `https://famies.app/api/writerify/categories` |
| DRAFTS ENDPOINT URL | `https://famies.app/api/writerify/drafts` |
| SCHEDULE ENDPOINT URL | `https://famies.app/api/writerify/schedule` |
| SITEMAP URL | `https://famies.app/sitemap.xml` |

The `/api/writerfy/*` spelling (as on mushroomidentifiers.com) serves the same handlers.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/writerify/publish/health` | GET | "Test connection" — 200 only if the token is right and the database is configured |
| `/api/writerify/publish` | POST | Create/update an article (Markdown or HTML; Writerify's `frontmatter` featuredImage / authorName / schemaJsonLd are used; `?overwrite=true` to replace an existing slug) |
| `/api/writerify/categories` | GET | Famies categories (Swedish) |
| `/api/writerify/drafts` | GET | Draft list for scheduling |
| `/api/writerify/schedule` | POST | `{ id, scheduledAt }` — publish a draft at a future time |
| `/api/writerify/upload-image` | POST | Multipart image upload (stored in `UPLOAD_DIR`, or Vercel Blob if `BLOB_READ_WRITE_TOKEN` is set) |

All requests need `Authorization: Bearer <WRITERFY_API_TOKEN>`. Incoming HTML is sanitised (scripts, event handlers and `javascript:` links are removed).

```bash
curl https://famies.app/api/writerify/publish/health -H "Authorization: Bearer $WRITERFY_API_TOKEN"
```

## Development

```bash
npm install
npm run db:migrate
npm run dev
```

Copy `.env.example` to `.env.local` and point `DATABASE_URL` at a local PostgreSQL. Without `DATABASE_URL` the public site still renders with its built-in texts and menus; the admin needs the database.
