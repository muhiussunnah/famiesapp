-- ============================================================
-- Famies — PostgreSQL schema
-- ============================================================
-- Applied automatically on every app start by scripts/migrate.mjs
-- (idempotent: creates what is missing, seeds empty tables once).
-- Can also be run by hand: psql "$DATABASE_URL" -f db/schema.sql
-- ============================================================
-- Everything the website, the admin panel (/admin) and the Writerfy API
-- need: articles, view counts, site settings, menus, header scripts,
-- homepage blocks, footer content, external-link rules, rank tracker,
-- indexing report cache and the public form tables. Uploaded images live
-- on disk (UPLOAD_DIR), not in the database.
-- ============================================================

-- Shared trigger function: keep updated_at current on every UPDATE.
create or replace function public.famies_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── 1. BLOG POSTS (articles + standalone pages) ──────────────
-- slug is stored WITH a leading slash ("/my-article") and served at
-- https://famies.app/my-article by src/app/[slug]/page.js.
-- status lifecycle: draft → scheduled (scheduled_at) → published.
create table if not exists public.blog_posts (
  id               serial primary key,
  title            text not null,
  slug             text not null unique,
  excerpt          text,
  content          text,                       -- HTML
  featured_image   text,
  category         text default 'Familjeliv & Pepp',
  views            integer not null default 0,
  read_time        text default '5 min',
  status           text not null default 'draft'
                     check (status in ('draft', 'scheduled', 'published')),
  author_name      text default 'Famies redaktion',
  author_role      text default 'Familjetips från Famies',
  meta_title       text,
  meta_description text,
  layout           text not null default 'with-sidebar'
                     check (layout in ('with-sidebar', 'full-page')),
  custom_css       text,
  custom_schema    text,                       -- JSON-LD, replaces default schema
  scheduled_at     timestamptz,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_blog_posts_status    on public.blog_posts (status);
create index if not exists idx_blog_posts_published on public.blog_posts (published_at desc);
create index if not exists idx_blog_posts_scheduled on public.blog_posts (scheduled_at) where status = 'scheduled';

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.famies_touch_updated_at();

-- ── 2. PAGE VIEWS ────────────────────────────────────────────
create table if not exists public.page_views (
  slug       text primary key,
  views      integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Atomic +1 used by /api/views (no read-then-write race).
create or replace function public.increment_page_view(p_slug text)
returns integer as $$
declare
  new_count integer;
begin
  insert into public.page_views (slug, views) values (p_slug, 1)
  on conflict (slug) do update
    set views = public.page_views.views + 1, updated_at = now()
  returning views into new_count;

  update public.blog_posts set views = views + 1 where slug = p_slug;
  return new_count;
end;
$$ language plpgsql;

-- ── 3. SITE SETTINGS (key → value) ───────────────────────────
create table if not exists public.site_settings (
  key         text primary key,
  value       text,
  type        text not null default 'text'
                check (type in ('text', 'textarea', 'url', 'email', 'image', 'number', 'boolean')),
  group_name  text not null default 'general',
  label       text,
  description text,
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now()
);

create index if not exists idx_site_settings_group on public.site_settings (group_name, sort_order);

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.famies_touch_updated_at();

insert into public.site_settings (key, value, type, group_name, label, description, sort_order) values
  -- Site mode
  ('coming_soon', 'false', 'boolean', 'site', 'Coming Soon mode',
   'true = the homepage shows the Coming Soon landing (store badges only). false = the full website.', 1),

  -- Homepage hero
  -- Empty = the built-in designed hero text is used.
  ('hero_eyebrow', '', 'text', 'hero', 'Hero eyebrow badge',
   'Small pill above the headline. Empty = "Byggd av föräldrar, för föräldrar".', 1),
  ('hero_title', '', 'text', 'hero', 'Hero title (H1)',
   'The big homepage headline. Wrap words in *asterisks* to give them the pink gradient. Empty = built-in headline.', 2),
  ('hero_subtitle', '', 'textarea', 'hero', 'Hero subtitle',
   'The paragraph under the headline. Empty = built-in text.', 3),

  -- Brand / footer
  ('footer_description', 'Byggd av föräldrar, för föräldrar. Få utvalda evenemang, tips och idéer, nära dig. Mindre skärmtid, mer familjetid.', 'textarea', 'brand', 'Footer description', null, 1),
  ('contact_email', 'support@famies.app', 'email', 'brand', 'Contact email', null, 2),
  ('app_store_url', 'https://apps.apple.com/se/app/fam-map/id6450005701', 'url', 'brand', 'App Store URL', null, 3),
  ('google_play_url', 'https://play.google.com/store/apps/details?id=com.famapdirectory.apps', 'url', 'brand', 'Google Play URL', null, 4),
  ('footer_explore_heading', 'Utforska', 'text', 'columns', 'First link column heading', null, 1),
  ('footer_company_heading', 'Support', 'text', 'columns', 'Second link column heading', null, 2),
  ('footer_app_heading', 'Hämta appen', 'text', 'columns', 'App column heading', null, 3),
  ('footer_app_text', 'Öppna Famies på din mobil, gratis, alltid.', 'text', 'columns', 'App column text', null, 4),
  ('copyright_text', '© {year} FAM MAP AB • Famies. All rights reserved.', 'text', 'bottom', 'Copyright text',
   '{year} is replaced with the current year.', 1),
  ('footer_tagline', 'Gjort med ♥ i Stockholm', 'text', 'bottom', 'Bottom-right tagline', null, 2),

  -- Styling
  ('global_custom_css', '', 'textarea', 'styling', 'Global Custom CSS',
   'Injected into every page''s <head> after the site stylesheet, so these rules win.', 1),
  ('theme_accent', '', 'text', 'theme', 'Accent color',
   'Brand pink used for buttons, links and highlights. Hex like #FF8FAF. Empty = default.', 1),
  ('theme_accent_hover', '', 'text', 'theme', 'Accent hover color',
   'Darker accent for hover states. Empty = default.', 2),
  ('theme_mint', '', 'text', 'theme', 'Secondary (mint) color',
   'Soft secondary color. Empty = default.', 3),
  ('theme_bg', '', 'textarea', 'theme', 'Page background',
   'Solid color or gradient, e.g. #ffffff or linear-gradient(145deg,#fff4f8,#f4fef6). Empty = default.', 4),
  ('theme_text', '', 'text', 'theme', 'Text color', 'Main text color. Empty = default.', 5)
on conflict (key) do nothing;

-- ── 4. SOCIAL LINKS (footer icons) ───────────────────────────
create table if not exists public.social_links (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  href       text not null,
  icon_svg   text not null,
  bg_color   text not null default '#f3f4f6',
  icon_color text not null default '#4b5563',
  sort_order integer not null default 0,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_social_links_updated_at on public.social_links;
create trigger trg_social_links_updated_at
  before update on public.social_links
  for each row execute function public.famies_touch_updated_at();

insert into public.social_links (label, href, icon_svg, bg_color, icon_color, sort_order)
select * from (values
  ('Instagram', 'https://www.instagram.com/famies.app/',
   '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>',
   '#f3f4f6', '#4b5563', 1),
  ('TikTok', 'https://www.tiktok.com/@famies.app',
   '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z"/></svg>',
   '#f3f4f6', '#4b5563', 2),
  ('YouTube', 'https://www.youtube.com/@TheFamies',
   '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
   '#f3f4f6', '#4b5563', 3)
) as seed(label, href, icon_svg, bg_color, icon_color, sort_order)
where not exists (select 1 from public.social_links);

-- ── 5. FOOTER BADGES (partner / award images) ────────────────
create table if not exists public.footer_badges (
  id         uuid primary key default gen_random_uuid(),
  location   text not null check (location in ('footer_explore', 'footer_company')),
  image_url  text not null,
  link_url   text not null,
  alt_text   text,
  width      integer not null default 120,
  height     integer,
  sort_order integer not null default 0,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_footer_badges_updated_at on public.footer_badges;
create trigger trg_footer_badges_updated_at
  before update on public.footer_badges
  for each row execute function public.famies_touch_updated_at();

-- ── 6. MENUS ─────────────────────────────────────────────────
create table if not exists public.menu_items (
  id         uuid primary key default gen_random_uuid(),
  location   text not null check (location in ('header', 'footer_explore', 'footer_company', 'footer_bottom')),
  label      text not null,
  url        text not null,
  target     text not null default '_self' check (target in ('_self', '_blank')),
  sort_order integer not null default 0,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_menu_items_sort on public.menu_items (location, sort_order);

drop trigger if exists trg_menu_items_updated_at on public.menu_items;
create trigger trg_menu_items_updated_at
  before update on public.menu_items
  for each row execute function public.famies_touch_updated_at();

insert into public.menu_items (location, label, url, sort_order)
select * from (values
  ('header', 'Hem', '/', 1),
  ('header', 'Inspiration', '/inspiration', 2),
  ('header', 'Skapa event', '/skapa-event', 3),
  ('header', 'Kontakt', '/contact', 4),
  ('footer_explore', 'Hem', '/', 1),
  ('footer_explore', 'Så funkar det', '/#how', 2),
  ('footer_explore', 'Funktioner', '/#features', 3),
  ('footer_explore', 'Recensioner', '/#reviews', 4),
  ('footer_explore', 'Inspiration', '/inspiration', 5),
  ('footer_explore', 'Skapa event', '/skapa-event', 6),
  ('footer_company', 'Kontakt', '/contact', 1),
  ('footer_company', 'Privacy Policy', '/privacy', 2),
  ('footer_company', 'Terms of Use', '/terms', 3),
  ('footer_company', 'Account Deletion Manual', '/deletion', 4),
  ('footer_bottom', 'Privacy', '/privacy', 1),
  ('footer_bottom', 'Terms', '/terms', 2)
) as seed(location, label, url, sort_order)
where not exists (select 1 from public.menu_items);

-- ── 7. HEADER SCRIPTS (GA, Search Console, pixels …) ─────────
create table if not exists public.site_scripts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text not null,
  position   text not null default 'head' check (position in ('head', 'body_start', 'body_end')),
  enabled    boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_site_scripts_updated_at on public.site_scripts;
create trigger trg_site_scripts_updated_at
  before update on public.site_scripts
  for each row execute function public.famies_touch_updated_at();

-- ── 8. HOMEPAGE BLOCKS ───────────────────────────────────────
create table if not exists public.homepage_blocks (
  id          uuid primary key default gen_random_uuid(),
  order_index integer not null default 0,
  block_type  text not null,
  data        jsonb not null default '{}'::jsonb,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_homepage_blocks_order on public.homepage_blocks (order_index) where visible = true;

drop trigger if exists trg_homepage_blocks_updated_at on public.homepage_blocks;
create trigger trg_homepage_blocks_updated_at
  before update on public.homepage_blocks
  for each row execute function public.famies_touch_updated_at();

-- ── 9. EXTERNAL LINKS — nofollow rules ───────────────────────
create table if not exists public.external_links_nofollow (
  id         uuid primary key default gen_random_uuid(),
  pattern    text not null,
  match_type text not null check (match_type in ('domain', 'url')),
  note       text,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists external_links_nofollow_pattern_type_idx
  on public.external_links_nofollow (lower(pattern), match_type);

drop trigger if exists trg_external_links_nofollow_updated_at on public.external_links_nofollow;
create trigger trg_external_links_nofollow_updated_at
  before update on public.external_links_nofollow
  for each row execute function public.famies_touch_updated_at();

-- ── 10. RANK TRACKER ─────────────────────────────────────────
create table if not exists public.rank_keywords (
  id            serial primary key,
  keyword       text not null unique,
  position      integer,
  prev_position integer,
  change        integer,
  volume        integer,
  rank_url      text,
  checked_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- ── 11. INDEXING REPORT CACHE ────────────────────────────────
create table if not exists public.indexing_cache (
  url                   text primary key,
  status                text,
  coverage_state        text,
  last_crawl_time       timestamptz,
  indexing_state        text,
  page_fetch_state      text,
  robots_txt_state      text,
  checked_at            timestamptz,
  index_requested_at    timestamptz,
  indexnow_requested_at timestamptz
);

-- ── 12. PUBLIC FORMS (contact / newsletter / early access) ───
create table if not exists public.contact_messages (
  id         bigserial primary key,
  name       text,
  email      text,
  subject    text,
  message    text,
  created_at timestamptz not null default now()
);

create table if not exists public.newsletter (
  id         bigserial primary key,
  email      text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.early_access (
  id             bigserial primary key,
  name           text,
  municipality   text,
  email          text,
  children_age   text,
  wants_feedback boolean,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- Done.
-- ============================================================
