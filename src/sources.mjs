// Traditionally-published book discovery: Open Library and Google Books.
// Manga/manhwa/manhua/light-novel/web-novel coverage lives in its own
// module (anilist.mjs) since it queries a different kind of API — see
// that file's header for why it's a separate source instead of bolted on
// here.
//
// Both APIs here are free, need no API key for a basic search, and their
// terms of use explicitly allow this kind of query.
//
// Fan-fiction archives (AO3, FanFiction.net, Wattpad) are intentionally
// NOT included anywhere in this project. None of them publish a public
// search API, and scraping their site is against their terms of service —
// the same reasoning that keeps LinkedIn out of automated job discovery
// elsewhere. If you want to track a fanfic you already found by hand,
// there's nothing stopping you from adding it to the database directly
// (see db.mjs's `addManualEntry`) — this module just won't go fetch it
// for you.

import { withRetry } from './http.mjs';

const OPEN_LIBRARY_URL = 'https://openlibrary.org/search.json';
const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes';

function normalizeOpenLibraryDoc(doc) {
  return {
    source: 'openlibrary',
    sourceUrl: doc.key ? `https://openlibrary.org${doc.key}` : null,
    title: doc.title ?? 'Untitled',
    authors: doc.author_name ?? [],
    year: doc.first_publish_year ?? null,
    subjects: (doc.subject ?? []).slice(0, 20),
    description: null, // Open Library's search endpoint doesn't return one
    ratingsAverage: doc.ratings_average ?? null,
    ratingsCount: doc.ratings_count ?? 0,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
  };
}

function normalizeGoogleBooksItem(item) {
  const info = item.volumeInfo ?? {};
  return {
    source: 'googlebooks',
    sourceUrl: info.infoLink ?? (item.id ? `https://books.google.com/books?id=${item.id}` : null),
    title: info.title ?? 'Untitled',
    authors: info.authors ?? [],
    year: info.publishedDate ? Number.parseInt(info.publishedDate.slice(0, 4), 10) || null : null,
    subjects: info.categories ?? [],
    description: info.description ?? null,
    ratingsAverage: info.averageRating ?? null,
    ratingsCount: info.ratingsCount ?? 0,
    coverUrl: info.imageLinks?.thumbnail ?? null,
  };
}

/**
 * @param {string} query
 * @param {{ limit?: number, fetchImpl?: typeof fetch }} [opts]
 */
export async function searchOpenLibrary(query, { limit = 20, fetchImpl = fetch } = {}) {
  const url = `${OPEN_LIBRARY_URL}?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await withRetry(() => fetchImpl(url));
  if (!res.ok) throw new Error(`Open Library search failed: HTTP ${res.status}`);
  const data = await res.json();
  return (data.docs ?? []).map(normalizeOpenLibraryDoc);
}

/**
 * @param {string} query
 * @param {{ limit?: number, fetchImpl?: typeof fetch }} [opts]
 */
export async function searchGoogleBooks(query, { limit = 20, fetchImpl = fetch } = {}) {
  const url = `${GOOGLE_BOOKS_URL}?q=${encodeURIComponent(query)}&maxResults=${Math.min(limit, 40)}`;
  const res = await withRetry(() => fetchImpl(url));
  if (!res.ok) throw new Error(`Google Books search failed: HTTP ${res.status}`);
  const data = await res.json();
  return (data.items ?? []).map(normalizeGoogleBooksItem);
}

/**
 * Queries both sources and returns their combined, still-unscored,
 * still-un-deduped results. Failures in one source don't take down the
 * other — a source that's down just contributes zero results.
 *
 * @param {string} query
 * @param {{ limit?: number, fetchImpl?: typeof fetch }} [opts]
 */
export async function searchAllSources(query, opts = {}) {
  const [openLibrary, googleBooks] = await Promise.allSettled([
    searchOpenLibrary(query, opts),
    searchGoogleBooks(query, opts),
  ]);

  const results = [];
  if (openLibrary.status === 'fulfilled') results.push(...openLibrary.value);
  else console.warn(`[sources] Open Library search failed: ${openLibrary.reason?.message}`);

  if (googleBooks.status === 'fulfilled') results.push(...googleBooks.value);
  else console.warn(`[sources] Google Books search failed: ${googleBooks.reason?.message}`);

  return results;
}
