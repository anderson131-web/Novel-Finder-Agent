// The actual find-a-match pipeline, shared by the CLI and the web server
// so there's exactly one place that defines what "search" means: extract
// signals → query every source → dedupe → score → sort. Neither caller
// re-implements any of it — they just render the result differently.
import { extractSignals, buildSearchQueries } from './keywords.mjs';
import { searchAllSources } from './sources.mjs';
import { searchAniList } from './anilist.mjs';
import { dedupeBooks } from './dedupe.mjs';
import { scoreBook } from './scoring.mjs';
import { excludeUnwantedContent } from './content-filters.mjs';

/**
 * @param {string} description
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ signals: object, queries: string[], results: object[] }>}
 */
export async function findMatches(description, { limit = 10 } = {}) {
  const signals = extractSignals(description);
  const queries = buildSearchQueries(signals, description);

  const [perQueryResults, aniListResults] = await Promise.all([
    Promise.all(queries.map((q) => searchAllSources(q))),
    searchAniList(signals, description).catch((err) => {
      console.warn(`[anilist] search failed: ${err.message}`);
      return [];
    }),
  ]);

  const deduped = dedupeBooks([...perQueryResults.flat(), ...aniListResults]);
  const filtered = excludeUnwantedContent(deduped);
  const results = filtered
    .map((book) => ({ ...book, ...scoreBook(book, signals) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { signals, queries, results };
}
