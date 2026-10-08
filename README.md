# Famies — famies.app

Website for the Famies family-activities app (Next.js 16 + Supabase, deployed on Vercel from the `main` branch).

- **Public site** — homepage, `/inspiration` (articles), article pages at `/<slug>`, contact, skapa-event, legal pages, `sitemap.xml`, `robots.txt`, `feed.xml`.
- **Admin panel** — `/admin` (login at `/login`, admin emails only). Same sections as mushroomidentifiers.com minus Subscriptions and Adify:
  Dashboard (+ Coming Soon switch) · Pages (articles/pages editor, scheduling) · Homepage · Rank Tracker · SEO Health · Indexing Report · Header Scripts · External Links · Menus · Footer Content · Theme Colors · Custom CSS.
- **Writerfy API** — publish articles straight from the Writerify desktop app (`/api/writerfy/*`).

There are no public user accounts (no signup, no user dashboard).

## Coming Soon page

The Coming Soon landing (logo + App Store / Google Play badges) is kept in `src/components/ComingSoon.js`.

- **No deploy:** `/admin` → Dashboard → *Coming Soon mode* ON/OFF (stored in `site_settings.coming_soon`).
- **In code:** `LIVE` in `src/lib/siteConfig.js` is the default when the admin switch has never been used.

## First-time setup

1. **Supabase** — create (or restore) the project, then open *SQL Editor* and run `supabase/famies-setup.sql` once. It creates every table, policy and the `images` storage bucket, and is safe to re-run.
2. **Admin login** — Supabase → Authentication → Users → *Add user* with an admin email (`itsinjamul@gmail.com`, or add more via `ADMIN_EMAILS`). Then Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".
3. **Environment variables** — copy `.env.example`; set the same keys in Vercel (Project → Settings → Environment Variables) and redeploy. Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Writerfy needs `WRITERFY_API_TOKEN`; scheduled publishing needs `CRON_SECRET`; Google/SerpAPI/IndexNow keys are optional and each admin page shows what is missing.

## Publishing from Writerify (Writerfy API)

In Writerify → Sites → add a **Next.js site**:

- URL: `https://famies.app`
- Token: the value of `WRITERFY_API_TOKEN`

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/writerfy/publish` | GET | Connection test |
| `/api/writerfy/publish` | POST | Create/update an article (Markdown or HTML; `?overwrite=true` to replace an existing slug) |
| `/api/writerfy/categories` | GET | Famies categories (Swedish) |
| `/api/writerfy/drafts` | GET | Draft list for scheduling |
| `/api/writerfy/schedule` | POST | `{ id, scheduledAt }` — publish a draft at a future time |
| `/api/writerfy/upload-image` | POST | Multipart image upload (Vercel Blob if configured, else Supabase Storage) |

All requests need `Authorization: Bearer <WRITERFY_API_TOKEN>`. Incoming HTML is sanitised (scripts, event handlers and `javascript:` links are removed).

```bash
curl https://famies.app/api/writerfy/publish -H "Authorization: Bearer $WRITERFY_API_TOKEN"
```

## Development

```bash
npm install
npm run dev
```

Without Supabase env vars the public site still renders with its built-in texts and menus; the admin needs Supabase.
