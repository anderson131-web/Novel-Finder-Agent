// Manga, manhwa, manhua, light novels, and web novels — via AniList's
// public GraphQL API (https://anilist.co/graphiql), which is free, needs
// no API key for search queries, and explicitly documents itself for
// third-party use like this.
//
// AniList doesn't separate these into different content types the way
// you'd expect — they're all `type: MANGA` under the hood, distinguished
// by `format` (MANGA vs NOVEL vs ONE_SHOT) and `countryOfOrigin` (JP vs
// KR vs CN). formatLabel() below turns that back into the label you'd
// actually recognize: Manga, Manhwa, Manhua, Light Novel, Web Novel.
//
// Unlike Open Library/Google Books' literal keyword search, AniList has
// real structured genre/tag filters — so instead of the query-fan-out
// trick in keywords.mjs (built for APIs that only do literal text
// search), this queries genre_in/tag_in directly from the extracted
// signals, with a text search over the leftover keywords as a fallback.
// One request covers everything; no fan-out needed here.
import { withRetry, stripHtml } from './http.mjs';

const ANILIST_URL = 'https://graphql.anilist.co';

// AniList's real genre vocabulary (https://anilist.co, GenreCollection
// query) — only the ones with an unambiguous match to a term we extract.
const GENRE_MAP = {
  action: 'Action',
  fantasy: 'Fantasy',
  romance: 'Romance',
  mystery: 'Mystery',
  thriller: 'Thriller',
  horror: 'Horror',
  scifi: 'Sci-Fi',
  'science fiction': 'Sci-Fi',
  adventure: 'Adventure',
};

// AniList's real tag vocabulary (MediaTagCollection query) — again, only
// confirmed exact names, not guesses.
const TAG_MAP = {
  'found family': ['Found Family'],
  'love triangle': ['Love Triangle'],
  'coming of age': ['Coming of Age'],
  'time travel': ['Time Loop', 'Time Manipulation', 'Time Skip'],
  'fake dating': ['Fake Relationship'],
  'anti hero': ['Anti-Hero'],
  revenge: ['Revenge'],
  isekai: ['Isekai'],
  reincarnation: ['Reincarnation'],
  regression: ['Age Regression'],
  cultivation: ['Cultivation'],
  'martial arts': ['Martial Arts'],
  dungeon: ['Dungeon'],
  villainess: ['Villainess'],
  chuunibyou: ['Chuunibyou'],
  school: ['School'],
  academy: ['School'],
  zombie: ['Zombie'],
  dragon: ['Dragons'],
  demon: ['Demons'],
  vampire: ['Vampire'],
  elf: ['Elf'],
  harem: ['Female Harem', 'Male Harem', 'Mixed Gender Harem'],
  yandere: ['Yandere'],
  swordsman: ['Swordplay'],
  assassin: ['Assassins'],
  war: ['War'],
  military: ['Military'],
  pirate: ['Pirates'],
  ghost: ['Ghost'],
  monster: ['Monster Boy', 'Monster Girl'],
};

// Excluded unconditionally, on every search — a fixed content preference
// rather than something derived from a query. AniList's real tag name is
// "Boys' Love" (their catch-all for BL/yaoi-categorized titles).
const EXCLUDED_TAGS = ["Boys' Love"];

// Genre-ish words in keywords.mjs that describe the *format*, not
// content — used to bias which format AniList returns rather than as a
// genre/tag filter (AniList has no "manhwa" genre; it's a country+format
// combination). See formatLabel().
const FORMAT_HINTS = {
  manga: { format: 'MANGA', country: 'JP' },
  manhwa: { format: 'MANGA', country: 'KR' },
  manhua: { format: 'MANGA', country: 'CN' },
  'light novel': { format: 'NOVEL', country: 'JP' },
  'web novel': { format: 'NOVEL' },
  webnovel: { format: 'NOVEL' },
  wuxia: { format: 'NOVEL', country: 'CN' },
  xianxia: { format: 'NOVEL', country: 'CN' },
};

const QUERY = `
  query ($page: Int, $perPage: Int, $genres: [String], $tags: [String], $tagsExcluded: [String], $search: String, $format: MediaFormat, $country: CountryCode) {
    Page(page: $page, perPage: $perPage) {
      media(
        type: MANGA
        genre_in: $genres
        tag_in: $tags
        tag_not_in: $tagsExcluded
        search: $search
        format: $format
        countryOfOrigin: $country
        sort: POPULARITY_DESC
      ) {
        title { romaji english }
        format
        countryOfOrigin
        genres
        tags { name }
        description(asHtml: false)
        averageScore
        popularity
        siteUrl
        coverImage { large }
        startDate { year }
      }
    }
  }
`;

function formatLabel(format, country) {
  if (format === 'NOVEL') {
    if (country === 'CN' || country === 'KR') return 'Web Novel';
    return 'Light Novel';
  }
  if (format === 'ONE_SHOT') return 'One-Shot';
  if (country === 'KR') return 'Manhwa';
  if (country === 'CN') return 'Manhua';
  return 'Manga';
}

function normalizeMedia(media) {
  const label = formatLabel(media.format, media.countryOfOrigin);
  return {
    source: 'anilist',
    sourceUrl: media.siteUrl ?? null,
    title: media.title?.english || media.title?.romaji || 'Untitled',
    authors: [], // AniList's search response doesn't include staff credits
    year: media.startDate?.year ?? null,
    // The format label goes into subjects too, so searching/scoring can
    // match on "manhwa" the same way it matches any other signal.
    subjects: [label, ...(media.genres ?? []), ...(media.tags ?? []).map((t) => t.name)],
    description: stripHtml(media.description),
    ratingsAverage: typeof media.averageScore === 'number' ? media.averageScore / 20 : null, // 0-100 → 0-5
    ratingsCount: media.popularity ?? 0, // AniList doesn't expose a ratings count; popularity is the closest proxy
    coverUrl: media.coverImage?.large ?? null,
    medium: label,
  };
}

/**
 * @param {{ genres: string[], tropes: string[], keywords: string[] }} signals
 * @param {string} description used as a text-search fallback when nothing mapped to a real genre/tag
 * @param {{ limit?: number, fetchImpl?: typeof fetch }} [opts]
 */
export async function searchAniList(signals, description, { limit = 20, fetchImpl = fetch } = {}) {
  const genres = [...new Set(signals.genres.map((g) => GENRE_MAP[g]).filter(Boolean))];
  const tags = [...new Set(signals.genres.concat(signals.tropes).flatMap((t) => TAG_MAP[t] ?? []))];

  const formatHint = [...signals.genres, ...signals.keywords]
    .map((term) => FORMAT_HINTS[term])
    .find(Boolean);

  const variables = {
    page: 1,
    perPage: limit,
    genres: genres.length ? genres : undefined,
    tags: tags.length ? tags : undefined,
    tagsExcluded: EXCLUDED_TAGS,
    format: formatHint?.format,
    country: formatHint?.country,
    // Only fall back to a text search when nothing mapped to a structured
    // filter — otherwise genre_in/tag_in alone already narrows things
    // down well, and adding a title-text search on top would wrongly
    // exclude anything whose title doesn't literally contain a keyword.
    // Prefer the already-cleaned keywords over the raw description —
    // filler words like "like novel" or "I want" only hurt a literal
    // title search, they don't help it.
    search:
      genres.length || tags.length
        ? undefined
        : signals.keywords.length
          ? signals.keywords.join(' ')
          : description,
  };

  const res = await withRetry(() =>
    fetchImpl(ANILIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables }),
    }),
  );
  if (!res.ok) throw new Error(`AniList search failed: HTTP ${res.status}`);
  const data = await res.json();
  if (data.errors?.length) throw new Error(`AniList search failed: ${data.errors[0].message}`);
  return (data.data?.Page?.media ?? []).map(normalizeMedia);
}
