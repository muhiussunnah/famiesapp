import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Info, Sparkles, TriangleAlert } from 'lucide-react';

/**
 * Renders the admin-managed homepage blocks (table homepage_blocks, edited
 * at /admin/homepage) in the Famies look. Server-renderable; also used by
 * the admin for its live preview.
 *
 *   <HomepageBlocks blocks={await getHomepageBlocks()} />
 *
 * Block data shapes (block.data):
 *   heading       { eyebrow, title, subtitle, level: 'h2'|'h3', align: 'center'|'left' }
 *   rich-text     { html }
 *   image         { src, alt, caption, credit, maxHeight, rounded }
 *   two-column    { html, imageSrc, imageAlt, imageCaption, reverse }
 *   visual-break  { src, alt, credit, height }
 *   cta-box       { variant: 'accent'|'info'|'success'|'warning'|'danger', heading, text, buttonText, buttonHref }
 *   feature-grid  { title, columns: 2|3|4, items: [{ title, description (HTML), image }] }
 *
 * HTML fields are sanitised by /api/admin/homepage-blocks on save.
 */
export default function HomepageBlocks({ blocks }) {
  const list = Array.isArray(blocks) ? blocks.filter((b) => b && RENDERERS[b.block_type]) : [];
  if (list.length === 0) return null;

  return (
    <section className="relative w-full py-16 md:py-24 section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-12 md:gap-16">
        {list.map((block, i) => {
          const Block = RENDERERS[block.block_type];
          return <Block key={block.id ?? i} data={block.data && typeof block.data === 'object' ? block.data : {}} />;
        })}
      </div>
    </section>
  );
}

/* ─── helpers ───────────────────────────────────────────────────────── */

// The project has no typography plugin, so admin-written HTML is styled
// with arbitrary variants here.
const RICH = [
  'text-ink-700 dark:text-ink-100 leading-relaxed break-words',
  '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  '[&_h2]:text-3xl md:[&_h2]:text-4xl [&_h2]:font-black [&_h2]:leading-tight [&_h2]:text-ink-900 dark:[&_h2]:text-white [&_h2]:mt-10 [&_h2]:mb-4',
  '[&_h3]:text-2xl [&_h3]:font-extrabold [&_h3]:leading-snug [&_h3]:text-ink-900 dark:[&_h3]:text-white [&_h3]:mt-8 [&_h3]:mb-3',
  '[&_h4]:text-xl [&_h4]:font-bold [&_h4]:text-ink-900 dark:[&_h4]:text-white [&_h4]:mt-6 [&_h4]:mb-2',
  '[&_strong]:font-bold [&_strong]:text-ink-900 dark:[&_strong]:text-white',
  '[&_a]:font-semibold [&_a]:text-primary-600 [&_a]:underline [&_a]:decoration-primary/40 [&_a]:underline-offset-4 [&_a:hover]:decoration-primary',
  '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_ul]:my-4 [&_ol]:my-4 [&_li]:my-1.5 [&_li]:pl-1 marker:text-primary',
  '[&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-5 [&_blockquote]:italic [&_blockquote]:text-ink-500',
  '[&_img]:my-6 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-2xl',
  '[&_table]:my-6 [&_table]:w-full [&_table]:text-sm [&_table]:border-collapse [&_th]:p-3 [&_th]:text-left [&_th]:font-bold [&_th]:bg-primary-50 [&_td]:p-3 [&_td]:border-t [&_td]:border-ink-100',
  '[&_hr]:my-8 [&_hr]:border-ink-100',
].join(' ');

function hasContent(html) {
  if (typeof html !== 'string') return false;
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '' || /<(img|iframe|video|table|hr)\b/i.test(html);
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(n, min), max) : fallback;
}

/** Usable image src, or '' (next/image throws on relative paths without a leading slash). */
function normalizeSrc(src) {
  const s = typeof src === 'string' ? src.trim() : '';
  if (!s) return '';
  if (/^(https?:)?\/\//i.test(s) || s.startsWith('/') || /^(data|blob):/i.test(s)) return s;
  return '/' + s;
}

/**
 * next/image without an images.remotePatterns config: remote and
 * query-string URLs are served as-is, local files go through the optimizer.
 */
function BlockImage({ src, alt, ...props }) {
  const unoptimized = !src.startsWith('/') || src.startsWith('//') || src.includes('?');
  return <Image src={src} alt={alt || ''} unoptimized={unoptimized} {...props} />;
}

function Credit({ text }) {
  return (
    <div className="absolute inset-x-0 bottom-0 px-5 py-3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
      <p className="text-xs text-white/85">{text}</p>
    </div>
  );
}

function SmartLink({ href, className, children }) {
  const external = /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?famies\.app(\/|$)/i.test(href);
  if (external || /^(mailto|tel):/i.test(href)) {
    return (
      <a href={href} className={className} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/* ─── heading ───────────────────────────────────────────────────────── */
function HeadingBlock({ data }) {
  if (!data.title && !data.eyebrow && !data.subtitle) return null;
  const left = data.align === 'left';
  const Tag = data.level === 'h3' ? 'h3' : 'h2';

  return (
    <div className={left ? 'max-w-3xl' : 'max-w-3xl mx-auto text-center'}>
      {data.eyebrow && (
        <div className="inline-block px-4 py-1.5 mb-5 rounded-full glass shadow-soft text-xs font-bold uppercase tracking-wider text-primary">
          {data.eyebrow}
        </div>
      )}
      {data.title && (
        <Tag
          className={
            Tag === 'h2'
              ? 'text-4xl md:text-5xl lg:text-6xl font-black text-ink-900 dark:text-white leading-[1.05]'
              : 'text-2xl md:text-4xl font-extrabold text-ink-900 dark:text-white leading-tight'
          }
        >
          {data.title}
        </Tag>
      )}
      {data.subtitle && (
        <p className="mt-5 text-lg md:text-xl text-ink-500 dark:text-ink-300 font-medium leading-relaxed whitespace-pre-line">
          {data.subtitle}
        </p>
      )}
    </div>
  );
}

/* ─── rich-text ─────────────────────────────────────────────────────── */
function RichTextBlock({ data }) {
  if (!hasContent(data.html)) return null;
  return (
    <div
      className={`w-full max-w-3xl mx-auto text-lg [&_p]:my-4 ${RICH}`}
      dangerouslySetInnerHTML={{ __html: data.html }}
    />
  );
}

/* ─── image ─────────────────────────────────────────────────────────── */
function ImageBlock({ data }) {
  const src = normalizeSrc(data.src);
  if (!src) return null;
  const maxHeight = clampNumber(data.maxHeight, 500, 120, 1600);
  const rounded = data.rounded !== false;

  return (
    <figure className="w-full max-w-5xl mx-auto">
      <div className={`relative overflow-hidden shadow-soft bg-white/60 group ${rounded ? 'rounded-[2rem]' : ''}`}>
        <BlockImage
          src={src}
          alt={data.alt}
          width={1600}
          height={Math.round(maxHeight)}
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="block w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          style={{ maxHeight }}
        />
        {data.credit && <Credit text={data.credit} />}
      </div>
      {data.caption && (
        <figcaption className="mt-3 text-center text-sm text-ink-500 dark:text-ink-300">{data.caption}</figcaption>
      )}
    </figure>
  );
}

/* ─── two-column ────────────────────────────────────────────────────── */
function TwoColumnBlock({ data }) {
  const imageSrc = normalizeSrc(data.imageSrc);
  const html = hasContent(data.html) ? data.html : '';
  if (!imageSrc && !html) return null;

  return (
    <div className="relative glass rounded-[2rem] shadow-soft overflow-hidden">
      <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-secondary/40 blur-3xl pointer-events-none" />

      <div className={`relative grid gap-8 lg:gap-14 items-center p-6 sm:p-10 lg:p-14 ${imageSrc && html ? 'md:grid-cols-2' : ''}`}>
        {html && (
          <div
            className={`text-lg [&_p]:my-4 ${RICH} ${imageSrc && data.reverse ? 'md:order-2' : ''}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
        {imageSrc && (
          <figure className="w-full">
            <div className="relative mx-auto max-w-[560px] rounded-[1.5rem] overflow-hidden shadow-soft bg-white/70">
              <BlockImage
                src={imageSrc}
                alt={data.imageAlt}
                width={1000}
                height={760}
                sizes="(min-width: 768px) 560px, 100vw"
                className="block w-full h-auto max-h-[460px] object-contain"
              />
            </div>
            {data.imageCaption && (
              <figcaption className="mt-3 text-center text-sm text-ink-500 dark:text-ink-300">{data.imageCaption}</figcaption>
            )}
          </figure>
        )}
      </div>
    </div>
  );
}

/* ─── visual-break ──────────────────────────────────────────────────── */
function VisualBreakBlock({ data }) {
  const src = normalizeSrc(data.src);
  if (!src) return null;
  const height = clampNumber(data.height, 400, 120, 1200);

  return (
    <div className="relative rounded-[2rem] overflow-hidden shadow-soft group">
      <BlockImage
        src={src}
        alt={data.alt}
        width={1600}
        height={Math.round(height)}
        sizes="(min-width: 1280px) 1216px, 100vw"
        className="block w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.015]"
        style={{ maxHeight: height }}
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/15 via-transparent to-secondary/20 pointer-events-none" />
      {data.credit && <Credit text={data.credit} />}
    </div>
  );
}

/* ─── cta-box ───────────────────────────────────────────────────────── */
const CTA_VARIANTS = {
  accent: {
    icon: Sparkles,
    card: 'bg-brand-gradient-soft border-primary/25',
    badge: 'bg-primary text-white shadow-pink',
    button: 'bg-primary text-white shadow-pink hover:shadow-glow-pink',
    blobs: true,
  },
  info: {
    icon: Info,
    card: 'glass',
    badge: 'bg-primary/15 text-primary-700',
    button: 'bg-ink-900 text-white hover:bg-ink-700 dark:bg-white dark:text-ink-900',
  },
  success: {
    icon: CheckCircle2,
    card: 'bg-secondary-50 border-secondary-300/70 dark:bg-secondary-900/20 dark:border-secondary-700/40',
    badge: 'bg-secondary text-green-900 shadow-mint',
    button: 'bg-ink-900 text-white hover:bg-ink-700 dark:bg-white dark:text-ink-900',
  },
  warning: {
    icon: TriangleAlert,
    card: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30',
    badge: 'bg-amber-100 text-amber-700',
    button: 'bg-amber-500 text-white hover:bg-amber-600',
  },
  danger: {
    icon: TriangleAlert,
    card: 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30',
    badge: 'bg-red-100 text-red-600',
    button: 'bg-red-500 text-white hover:bg-red-600',
  },
};

function CtaBoxBlock({ data }) {
  const v = CTA_VARIANTS[data.variant] || CTA_VARIANTS.accent;
  const Icon = v.icon;
  const showButton = data.buttonText && data.buttonHref;
  if (!data.heading && !data.text && !showButton) return null;

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className={`relative overflow-hidden rounded-[2rem] border shadow-soft p-7 sm:p-10 lg:p-12 ${v.card}`}>
        {v.blobs && (
          <>
            <div className="absolute -top-20 -left-16 w-64 h-64 rounded-full bg-primary/25 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-10 w-72 h-72 rounded-full bg-secondary/40 blur-3xl pointer-events-none" />
          </>
        )}
        <div className="relative flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
          <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center ${v.badge}`}>
            <Icon size={26} strokeWidth={2.25} />
          </div>
          <div className="flex-1 min-w-0">
            {data.heading && (
              <h3 className="text-2xl md:text-3xl font-black leading-tight text-ink-900 dark:text-white mb-2">
                {data.heading}
              </h3>
            )}
            {data.text && (
              <p className="text-base md:text-lg text-ink-500 dark:text-ink-300 leading-relaxed whitespace-pre-line">
                {data.text}
              </p>
            )}
          </div>
          {showButton && (
            <SmartLink
              href={data.buttonHref}
              className={`press shrink-0 self-start md:self-center inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all ${v.button}`}
            >
              {data.buttonText}
              <ArrowRight size={18} />
            </SmartLink>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── feature-grid ──────────────────────────────────────────────────── */
function FeatureGridBlock({ data }) {
  const items = (Array.isArray(data.items) ? data.items : []).filter(
    (item) => item && (item.title || item.image || hasContent(item.description))
  );
  if (items.length === 0) return null;

  const cols = Number(data.columns) || 3;
  const grid =
    cols === 2 ? 'md:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3';

  return (
    <div>
      {data.title && (
        <h2 className="max-w-3xl mx-auto mb-10 md:mb-14 text-center text-3xl md:text-5xl font-black text-ink-900 dark:text-white leading-[1.05]">
          {data.title}
        </h2>
      )}
      <div className={`grid gap-5 md:gap-6 ${grid}`}>
        {items.map((item, i) => {
          const pink = i % 2 === 0;
          const image = normalizeSrc(item.image);
          return (
            <div
              key={i}
              className="group glass rounded-[2rem] p-6 md:p-7 flex flex-col transition-all duration-500 hover:-translate-y-1 hover:shadow-pink"
            >
              {image ? (
                <div className="relative mb-6 aspect-[16/10] rounded-[1.5rem] overflow-hidden bg-white/70">
                  <BlockImage
                    src={image}
                    alt={item.title}
                    fill
                    sizes="(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div
                  className={`w-12 h-12 mb-5 rounded-2xl flex items-center justify-center font-black ${
                    pink ? 'bg-primary text-white shadow-pink' : 'bg-secondary text-green-900 shadow-mint'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
              )}
              {item.title && (
                <h3 className="text-xl md:text-2xl font-extrabold leading-snug text-ink-900 dark:text-white mb-3">
                  {item.title}
                </h3>
              )}
              {hasContent(item.description) && (
                <div
                  className={`text-base [&_p]:my-2 ${RICH}`}
                  dangerouslySetInnerHTML={{ __html: item.description }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const RENDERERS = {
  heading: HeadingBlock,
  'rich-text': RichTextBlock,
  image: ImageBlock,
  'two-column': TwoColumnBlock,
  'visual-break': VisualBreakBlock,
  'cta-box': CtaBoxBlock,
  'feature-grid': FeatureGridBlock,
};
