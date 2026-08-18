// Turns a plain-language description ("cozy fantasy with a slow-burn
// enemies-to-lovers romance and a found family") into a small set of
// genre/trope/keyword signals to match candidate books against.
//
// This is deliberately a lookup table plus generic tokenization, not a
// model — the scoring downstream is meant to stay transparent and
// debuggable (you can see exactly which words drove a score), and it
// keeps the whole tool runnable offline with zero API keys.
import { includesPhrase } from './text.mjs';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'with', 'without', 'for', 'of', 'in',
  'on', 'at', 'to', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'that', 'this', 'these', 'those', 'i', 'want', 'looking', 'like', 'some',
  'something', 'book', 'books', 'novel', 'novels', 'story', 'stories',
  'find', 'me', 'my', 'about', 'read', 'reading',
]);

// A handful of known genres and tropes get bundled with their common
// synonyms so "enemies to lovers" and "enemies-to-lovers" both hit the
// same signal, and so genre words carry more weight than an incidental
// word (see scoring.mjs).
const KNOWN_GENRES = [
  'action', 'fantasy', 'romance', 'mystery', 'thriller', 'horror', 'scifi',
  'science fiction', 'dystopian', 'historical fiction', 'literary fiction',
  'ya', 'young adult', 'contemporary', 'mythology', 'noir', 'gothic',
  'adventure', 'crime', 'paranormal', 'urban fantasy', 'epic fantasy',
  // Manga/manhwa/manhua/web-novel/light-novel are formats more than
  // genres, but calling one out in a description ("a manhwa about...")
  // is a strong, common signal worth capturing the same way.
  'manga', 'manhwa', 'manhua', 'light novel', 'web novel', 'webnovel',
  'wuxia', 'xianxia',
];

const KNOWN_TROPES = [
  'enemies to lovers', 'friends to lovers', 'slow burn', 'found family',
  'love triangle', 'chosen one', 'coming of age', 'time travel',
  'second chance', 'forbidden love', 'fake dating', 'redemption arc',
  'anti hero', 'morally grey', 'road trip', 'heist', 'revenge',
  'unreliable narrator', 'multiple pov', 'dual timeline',
  // Common across Chinese/Korean/Japanese web novels, manhwa, and manhua
  // specifically — regression/system/level-up stories are one of the
  // biggest categories in that space and had no coverage before.
  'isekai', 'reincarnation', 'transmigration', 'regression', 'cultivation',
  'martial arts', 'dungeon', 'villainess', 'overpowered protagonist',
  'overpowered', 'hidden strength', 'system', 'level up', 'chuunibyou',
  'academy', 'school', 'tournament', 'guild', 'hunter', 'apocalypse',
  'zombie', 'sect', 'clan', 'bloodline', 'dragon', 'demon', 'vampire',
  'elf', 'harem', 'yandere', 'obsession', 'possessive', 'tyrant',
  'genius', 'prodigy', 'swordsman', 'assassin', 'knight', 'noble',
  'royalty', 'empire', 'returner', 'necromancer', 'betrayal', 'war',
  'military', 'pirate', 'ghost', 'monster', 'dark fantasy',
];

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} description
 * @returns {{ genres: string[], tropes: string[], keywords: string[] }}
 */
export function extractSignals(description) {
  const normalized = normalize(description);
  const spaced = normalized.replace(/-/g, ' ');

  const genres = KNOWN_GENRES.filter((g) => includesPhrase(spaced, g));
  const tropes = KNOWN_TROPES.filter((t) => includesPhrase(spaced, t));

  const keywords = spaced
    .split(' ')
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    // Drop words already captured as part of a matched genre/trope phrase
    // so they don't get double-counted as loose keywords too.
    .filter((w) => !genres.some((g) => includesPhrase(g, w)) && !tropes.some((t) => includesPhrase(t, w)));

  return { genres, tropes, keywords: [...new Set(keywords)] };
}

/**
 * Both source APIs do fielded/literal keyword search, not semantic
 * matching — searching the whole raw sentence as one query tends to
 * effectively AND every word together and starve out real matches (see
 * README's "How the query works" section for a measured example). So
 * instead this fans out one query per strong signal (each genre, each
 * trope) plus one broader query from the leftover keywords, and the
 * caller merges everything before scoring. A book that's genuinely a
 * match tends to surface from more than one of these and scores higher
 * downstream regardless of which query found it.
 *
 * @param {{ genres: string[], tropes: string[], keywords: string[] }} signals
 * @param {string} fallbackDescription used verbatim if no signals were found at all
 * @returns {string[]}
 */
export function buildSearchQueries(signals, fallbackDescription) {
  const queries = [...signals.genres, ...signals.tropes];
  if (signals.keywords.length) queries.push(signals.keywords.slice(0, 4).join(' '));
  if (queries.length === 0) queries.push(fallbackDescription);
  return [...new Set(queries)].slice(0, 6);
}
