/**
 * Every text on the homepage (and the Coming Soon page), editable in
 * /admin/homepage → "Homepage text". Saved as one JSON value in
 * site_settings.homepage_text; anything not saved there falls back to the
 * defaults below, which are the original designed copy.
 *
 * Formatting inside a text (see src/components/FormattedText.js):
 *   *word*    → pink brand gradient
 *   **words** → bold
 *   new line  → line break
 *
 * Client-safe: no database imports, so the admin editor can use it too.
 */

export const HOMEPAGE_TEXT_KEY = 'homepage_text';

export const HOMEPAGE_TEXT_DEFAULTS = {
  hero: {
    eyebrow: 'Byggd av föräldrar, för föräldrar',
    title: 'Vill du veta vad\nfamiljer *nära dig*\nhittar på?',
    subtitle: '**Aktiviteter, event och skoj. Tillsammans.**\nDelat av familjer i närheten.',
    demoLabel: 'Se 30-sek demo',
    demoVideoUrl: 'https://www.youtube.com/watch?v=p7zK0D5D1uM',
    trustTitle: '10 000+ familjer',
    trustText: 'laddat ner redan',
    rating: '4.8',
    ratingLabel: '/ App Store',
    card1Emoji: '🎪',
    card1Title: 'Lördag • Familjemys',
    card1Text: '1,2 km från dig',
    card2Title: 'Valt åt dig',
    card2Text: 'baserat på era barn',
    imageAlt: 'Famies app, hem-flöde med evenemang nära dig',
  },
  buttons: {
    appStoreSmall: 'Ladda ner för',
    appStoreBig: 'App Store',
    googlePlaySmall: 'Hämta på',
    googlePlayBig: 'Google Play',
  },
  pain: {
    show: true,
    badge: 'Lansering pågår · Stockholm 2026',
    title: 'Missa *inte.*',
    subtitle: 'Lokala tips, event och svar. På ett ställe.',
    cards: [
      { title: 'Tipsen från andra familjer i närheten', body: 'Platser och idéer från familjer som är som din.' },
      { title: 'Eventet som händer runt hörnet', body: 'Aktiviteter nära er, anpassat efter barnens ålder.' },
      { title: 'Svaret från någon som redan vet', body: 'Fråga, få svar från andra föräldrar i närheten.' },
      { title: 'Familjerna i samma situation', body: 'Skapa eller hitta gruppen med samma vardag och intressen som du.' },
    ],
    outro: 'Så vi byggde ett enklare sätt. *↓*',
  },
  how: {
    show: true,
    badge: 'Så enkelt är det',
    title: 'Från *"vad ska vi göra?"*\ntill "vi kör."',
    subtitle: 'Tre steg. Ingen scroll-ångest. Inget konto innan du vill.',
    steps: [
      { title: 'Ladda ner appen', body: 'Gratis på iOS och Android. Öppna, inget konto behövs för att börja titta.' },
      { title: 'Berätta vilka ni är', body: 'Barnens åldrar och var ni bor. Klart på 30 sekunder. Vi gör resten.' },
      { title: 'Få idéer varje dag', body: 'Utvalt flöde med evenemang, tips och platser som faktiskt passar er familj. Nära dig.' },
    ],
  },
  features: {
    show: true,
    badge: 'Därför älskar föräldrar Famies',
    title: 'Allt *ni behöver*.\nIngenting ni inte behöver.',
    subtitle:
      'Ingen app för listor. Ingen app för kalendrar. Ett flöde som svarar på en fråga: **"Vad ska vi göra idag?"**',
    items: [
      {
        eyebrow: 'Slipp söka',
        title: 'Tips från familjer som är som din.',
        description:
          'Upptäck platser, aktiviteter och upplevelser som andra familjer redan testat, smart utvalda så du slipper googla.',
        image: '/feature1.png',
      },
      {
        eyebrow: 'Nära dig',
        title: 'Famies följer med dit du är.',
        description: 'Se vad som finns där ni bor, eller där ni råkar vara. Allt lokalt, inget filler.',
        image: '/feature2.png',
      },
      {
        eyebrow: 'Ingen idétorka',
        title: 'Hitta något på 10 sekunder.',
        description:
          'Öppna appen. Få förslag. Klart. Ingen oändlig scroll, ingen googling, inget bortkastat lördagsförmiddag.',
        image: '/feature3.png',
      },
      {
        eyebrow: 'Vardag + helg',
        title: 'Byggt för hela familjelivet.',
        description: 'Från småbarnsåren till tonåren, flödet följer med och ändras när era behov ändras.',
        image: '/feature4.png',
      },
      {
        eyebrow: 'Alltid något nytt',
        title: 'Nya tips varje vecka.',
        description:
          'Färska evenemang och idéer från 270+ källor, uppdaterat för ditt område. Du öppnar, det är redan där.',
        image: '/feature5.png',
      },
    ],
  },
  reviews: {
    show: true,
    stats: [
      { value: '10 000+', label: 'nedladdningar' },
      { value: '500+', label: 'evenemang i flödet' },
      { value: '270+', label: 'kurerade källor' },
      { value: '4.8', label: 'snitt i App Store' },
    ],
    badge: 'Vad föräldrar säger',
    title: 'Familjer gör *mer*.\nLetar *mindre*.',
    testimonials: [
      {
        name: 'Anna, 34',
        role: 'mamma till 3 & 6 år',
        city: 'Stockholm',
        quote:
          'Äntligen en app som bara visar det som passar oss. Jag brukade googla i en halvtimme varje lördag. Nu öppnar jag Famies och vi är ute innan klockan tio.',
      },
      {
        name: 'Markus, 41',
        role: 'pappa till två',
        city: 'Solna',
        quote:
          'Det är som att ha en kompis som alltid vet vad som händer. Sparar oss så mycket tid, och vi upptäcker saker precis runt hörnet som vi aldrig sett.',
      },
      {
        name: 'Linnea, 29',
        role: 'förstagångsförälder',
        city: 'Nacka',
        quote:
          'Som ny förälder har jag inte energi att leta. Famies gör det åt mig. Flödet är lugnt, tips passar oss, och det känns inte som reklam.',
      },
      {
        name: 'Sofia & Erik',
        role: 'familj med 4 barn',
        city: 'Upplands Väsby',
        quote:
          'Vi har testat allt: kalendrar, listor, grupper på Facebook. Famies är det första som faktiskt känns gjort för föräldrar.',
      },
      {
        name: 'Johan, 37',
        role: 'pappa till 2 & 5 år',
        city: 'Södermalm',
        quote:
          'Brevlådan med kortnotiser är min favorit. Jag kollar en gång om dagen och vet exakt vad som är på gång. Klart.',
      },
      {
        name: 'Emma, 32',
        role: 'mamma till tvillingar',
        city: 'Täby',
        quote:
          'Det bästa är att appen följer med när barnen växer. Förra året var det småbarnsaktiviteter. Nu är det andra grejer. Samma app.',
      },
    ],
  },
  download: {
    show: true,
    badge: 'iOS + Android • Gratis',
    title: 'Mindre skärmtid.\n*Mer familjetid.*',
    text: 'Ladda ner Famies. Ge era barn en bättre lördag, **innan ni hinner bråka om vad ni ska hitta på.**',
    benefits: [{ text: 'Gratis för alltid' }, { text: 'Inget kreditkort' }, { text: '30 sek att komma igång' }],
    rating: '4.8',
    ratingText: 'från 10k+ familjer',
    imageAlt: 'Famies app-flöde',
  },
  articles: {
    show: true,
    eyebrow: 'Inspiration',
    title: 'Senaste *artiklar* & tips.',
    readMore: 'Läs mer',
    viewAll: 'Se alla artiklar',
    fallbackCategory: 'Artikel',
  },
  newsletter: {
    show: true,
    badge: 'VECKOBREV',
    title: 'Lås upp exklusiva\n*familjetips.*',
    text: 'Gör som över 10 000 föräldrar, få våra utvalda evenemang och veckans bästa tips direkt i inkorgen.',
    placeholder: 'namn@exempel.se',
    button: 'Gå med',
    success: 'Du står nu på listan!',
    error: 'Något gick fel. Försök igen.',
    note: 'Ingen spam. Avsluta när du vill.',
  },
  comingSoon: {
    title: 'Där familjer hittar',
    titleAccent: 'nästa upplevelse.',
    subtitle: 'Hitta aktiviteter, event och andra familjer i närheten.',
    badge: 'Lansering pågår',
    note: 'Tillgänglig nu i App Store och Google Play.',
    storeLabel: 'Ladda ner på',
    footer: 'Famies. Skapar bättre familjerelationer.',
  },
  seo: {
    title: 'Famies – Familjeaktiviteter nära dig',
    description: 'Vad tipsar andra familjer nära dig om? Upptäck aktiviteter, event och nya favoriter. 💛',
  },
};

const FORMAT_HINT = '*word* = pink gradient, **words** = bold, Enter = new line.';

/**
 * Layout of the admin editor. Field types: text (default), textarea, image,
 * list (repeatable cards with their own `fields`). `half` puts two fields
 * side by side; `preview` shows the formatted result under the field.
 */
export const HOMEPAGE_TEXT_SECTIONS = [
  {
    key: 'hero',
    label: 'Hero',
    description: 'The very top of the homepage: badge, headline, text, buttons and the floating cards.',
    fields: [
      { key: 'eyebrow', label: 'Badge above the headline' },
      { key: 'title', label: 'Headline (H1)', type: 'textarea', rows: 3, preview: true, hint: `Keep it under ~70 characters. ${FORMAT_HINT}` },
      { key: 'subtitle', label: 'Text under the headline', type: 'textarea', rows: 3, preview: true, hint: FORMAT_HINT },
      { key: 'demoLabel', label: 'Demo video button', half: true },
      { key: 'demoVideoUrl', label: 'Demo video (YouTube link)', half: true, hint: 'Empty = no demo button.' },
      { key: 'trustTitle', label: 'Downloads, bold line', half: true },
      { key: 'trustText', label: 'Downloads, small line', half: true },
      { key: 'rating', label: 'Star rating', half: true },
      { key: 'ratingLabel', label: 'Text after the rating', half: true },
      { key: 'card1Emoji', label: 'Top floating card, emoji', half: true },
      { key: 'card1Title', label: 'Top floating card, title', half: true },
      { key: 'card1Text', label: 'Top floating card, distance line', half: true },
      { key: 'card2Title', label: 'Bottom floating card, title', half: true },
      { key: 'card2Text', label: 'Bottom floating card, small line', half: true },
      { key: 'imageAlt', label: 'Phone picture description (for Google)', half: true },
    ],
  },
  {
    key: 'buttons',
    label: 'App buttons',
    description: 'The App Store and Google Play buttons in the hero and in the download section. The links themselves are in Footer Settings.',
    fields: [
      { key: 'appStoreSmall', label: 'App Store, small line', half: true },
      { key: 'appStoreBig', label: 'App Store, big line', half: true },
      { key: 'googlePlaySmall', label: 'Google Play, small line', half: true },
      { key: 'googlePlayBig', label: 'Google Play, big line', half: true },
    ],
  },
  {
    key: 'pain',
    label: 'Missa inte',
    description: 'The section right after the hero, with four cards.',
    canHide: true,
    fields: [
      { key: 'badge', label: 'Badge' },
      { key: 'title', label: 'Heading', type: 'textarea', rows: 2, preview: true, hint: FORMAT_HINT },
      { key: 'subtitle', label: 'Text under the heading', type: 'textarea', rows: 2 },
      {
        key: 'cards',
        label: 'Cards',
        type: 'list',
        itemLabel: 'Card',
        max: 8,
        fields: [
          { key: 'title', label: 'Title' },
          { key: 'body', label: 'Text', type: 'textarea', rows: 2 },
        ],
      },
      { key: 'outro', label: 'Line under the cards', preview: true, hint: FORMAT_HINT },
    ],
  },
  {
    key: 'how',
    label: 'Så enkelt är det',
    description: 'The numbered steps.',
    canHide: true,
    fields: [
      { key: 'badge', label: 'Badge' },
      { key: 'title', label: 'Heading', type: 'textarea', rows: 2, preview: true, hint: FORMAT_HINT },
      { key: 'subtitle', label: 'Text under the heading', type: 'textarea', rows: 2 },
      {
        key: 'steps',
        label: 'Steps',
        type: 'list',
        itemLabel: 'Step',
        max: 6,
        fields: [
          { key: 'title', label: 'Title' },
          { key: 'body', label: 'Text', type: 'textarea', rows: 2 },
        ],
      },
    ],
  },
  {
    key: 'features',
    label: 'Features',
    description: 'The phone that changes picture while you scroll past the feature cards.',
    canHide: true,
    fields: [
      { key: 'badge', label: 'Badge' },
      { key: 'title', label: 'Heading', type: 'textarea', rows: 2, preview: true, hint: FORMAT_HINT },
      { key: 'subtitle', label: 'Text under the heading', type: 'textarea', rows: 3, preview: true, hint: FORMAT_HINT },
      {
        key: 'items',
        label: 'Feature cards',
        type: 'list',
        itemLabel: 'Feature',
        max: 8,
        fields: [
          { key: 'eyebrow', label: 'Small label', half: true },
          { key: 'title', label: 'Title', half: true },
          { key: 'description', label: 'Text', type: 'textarea', rows: 3 },
          { key: 'image', label: 'Phone screenshot', type: 'image', hint: 'A tall phone screenshot (about 9:19).' },
        ],
      },
    ],
  },
  {
    key: 'reviews',
    label: 'Numbers & reviews',
    description: 'The number strip and the parent reviews.',
    canHide: true,
    fields: [
      {
        key: 'stats',
        label: 'Numbers',
        type: 'list',
        itemLabel: 'Number',
        max: 6,
        hint: 'Remove all numbers to hide the strip.',
        fields: [
          { key: 'value', label: 'Number', half: true },
          { key: 'label', label: 'Label', half: true },
        ],
      },
      { key: 'badge', label: 'Badge' },
      { key: 'title', label: 'Heading', type: 'textarea', rows: 2, preview: true, hint: FORMAT_HINT },
      {
        key: 'testimonials',
        label: 'Reviews',
        type: 'list',
        itemLabel: 'Review',
        max: 12,
        fields: [
          { key: 'name', label: 'Name', half: true },
          { key: 'city', label: 'City', half: true },
          { key: 'role', label: 'Who (e.g. mamma till två)' },
          { key: 'quote', label: 'Review text', type: 'textarea', rows: 3 },
        ],
      },
    ],
  },
  {
    key: 'download',
    label: 'Download',
    description: 'The big download box near the end of the page.',
    canHide: true,
    fields: [
      { key: 'badge', label: 'Badge' },
      { key: 'title', label: 'Heading', type: 'textarea', rows: 2, preview: true, hint: FORMAT_HINT },
      { key: 'text', label: 'Text', type: 'textarea', rows: 3, preview: true, hint: FORMAT_HINT },
      {
        key: 'benefits',
        label: 'Ticks under the buttons',
        type: 'list',
        itemLabel: 'Tick',
        max: 6,
        fields: [{ key: 'text', label: 'Text' }],
      },
      { key: 'rating', label: 'Rating card, number', half: true },
      { key: 'ratingText', label: 'Rating card, text', half: true },
      { key: 'imageAlt', label: 'Phone picture description (for Google)' },
    ],
  },
  {
    key: 'articles',
    label: 'Articles',
    description: 'The slider with the latest articles. It only appears when at least one article is published.',
    canHide: true,
    fields: [
      { key: 'eyebrow', label: 'Small label', half: true },
      { key: 'title', label: 'Heading', half: true, preview: true, hint: FORMAT_HINT },
      { key: 'readMore', label: '"Read more" link', half: true },
      { key: 'viewAll', label: '"See all" button', half: true },
      { key: 'fallbackCategory', label: 'Category label when an article has none' },
    ],
  },
  {
    key: 'newsletter',
    label: 'Newsletter',
    description: 'The newsletter sign-up at the bottom of the page.',
    canHide: true,
    fields: [
      { key: 'badge', label: 'Badge' },
      { key: 'title', label: 'Heading', type: 'textarea', rows: 2, preview: true, hint: FORMAT_HINT },
      { key: 'text', label: 'Text', type: 'textarea', rows: 3 },
      { key: 'placeholder', label: 'Email field placeholder', half: true },
      { key: 'button', label: 'Button', half: true },
      { key: 'success', label: 'Message after signing up', half: true },
      { key: 'error', label: 'Message when something fails', half: true },
      { key: 'note', label: 'Small line under the form' },
    ],
  },
  {
    key: 'comingSoon',
    label: 'Coming Soon page',
    description: 'Shown instead of the homepage while Coming Soon mode is on (Dashboard).',
    fields: [
      { key: 'title', label: 'Headline, white line', half: true },
      { key: 'titleAccent', label: 'Headline, pink line', half: true },
      { key: 'subtitle', label: 'Text under the headline', type: 'textarea', rows: 2 },
      { key: 'badge', label: 'Badge', half: true },
      { key: 'note', label: 'Line under the badge', half: true },
      { key: 'storeLabel', label: 'Small line on the store buttons', half: true },
      { key: 'footer', label: 'Footer text (after © year)', half: true },
    ],
  },
  {
    key: 'seo',
    label: 'Google (SEO)',
    description: 'The title and description Google shows for the homepage.',
    fields: [
      { key: 'title', label: 'SEO title', hint: 'About 50–60 characters.' },
      { key: 'description', label: 'Meta description', type: 'textarea', rows: 3, hint: 'About 140–160 characters.' },
    ],
  },
];

const MAX_TEXT = 5000;
const MAX_ITEMS = 30;

const asText = (v) => (typeof v === 'string' ? v.slice(0, MAX_TEXT) : null);

function resolveList(saved, defaults) {
  if (!Array.isArray(saved)) return defaults.map((item) => ({ ...item }));
  const keys = Object.keys(defaults[0] || {});
  return saved
    .filter((item) => item && typeof item === 'object')
    .slice(0, MAX_ITEMS)
    .map((item) => Object.fromEntries(keys.map((k) => [k, asText(item[k]) ?? ''])));
}

/**
 * Saved texts on top of the defaults. A saved string is used as-is, even
 * when empty (that hides the element); a missing one falls back to the
 * default. Saved lists replace the default list.
 */
export function resolveHomepageText(saved) {
  const src = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const out = {};
  for (const [section, defaults] of Object.entries(HOMEPAGE_TEXT_DEFAULTS)) {
    const s = src[section] && typeof src[section] === 'object' ? src[section] : {};
    const merged = {};
    for (const [key, def] of Object.entries(defaults)) {
      if (Array.isArray(def)) merged[key] = resolveList(s[key], def);
      else if (typeof def === 'boolean') merged[key] = typeof s[key] === 'boolean' ? s[key] : def;
      else merged[key] = asText(s[key]) ?? def;
    }
    out[section] = merged;
  }
  return out;
}

/** The homepage texts from the site_settings map (see getSiteContent). */
export function homepageTextFromSettings(settings = {}) {
  let saved = {};
  try {
    const raw = settings?.[HOMEPAGE_TEXT_KEY];
    if (raw) saved = JSON.parse(raw);
  } catch {
    saved = {};
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};

  // Hero text saved before the full editor existed (hero_* settings).
  if (!saved.hero) {
    const legacy = {};
    for (const [field, key] of [['eyebrow', 'hero_eyebrow'], ['title', 'hero_title'], ['subtitle', 'hero_subtitle']]) {
      const v = settings?.[key];
      if (typeof v === 'string' && v.trim()) legacy[field] = v;
    }
    saved = { ...saved, hero: legacy };
  }
  return resolveHomepageText(saved);
}

/** YouTube watch / share / shorts link → embed URL; other https URLs pass through. */
export function videoEmbedUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  const m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1`;
  return /^https:\/\//i.test(u) ? u : '';
}
