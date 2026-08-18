// Scores a candidate book against the signals extracted from the user's
// description. Deliberately simple and inspectable: every point on the
// 0-100 scale traces back to a specific matched genre, trope, or keyword,
// plus a small, capped popularity bonus so two equally-matching books
// don't get separated purely by an API's ratings count.
import { includesPhrase } from './text.mjs';

const WEIGHTS = {
  genreMatch: 22,
  tropeMatch: 18,
  keywordMatch: 6,
  maxGenreContribution: 44,
  maxTropeContribution: 36,
  maxKeywordContribution: 24,
  maxPopularityBonus: 12,
};

function searchableText(book) {
  return [book.title, ...(book.subjects ?? []), book.description ?? '']
    .join(' ')
    .toLowerCase();
}

function popularityBonus(book) {
  const count = book.ratingsCount ?? 0;
  const avg = book.ratingsAverage ?? 0;
  if (count <= 0) return 0;
  // log-scaled so 10 ratings and 10,000 ratings don't differ by 1000x —
  // a well-rated book with modest ratings still gets meaningful credit.
  const countBonus = Math.min(1, Math.log10(count + 1) / 4) * (WEIGHTS.maxPopularityBonus * 0.6);
  const ratingBonus = avg >= 3.5 ? ((avg - 3.5) / 1.5) * (WEIGHTS.maxPopularityBonus * 0.4) : 0;
  return countBonus + ratingBonus;
}

/**
 * @param {object} book - normalized book shape (see src/sources.mjs)
 * @param {{ genres: string[], tropes: string[], keywords: string[] }} signals
 * @returns {{ score: number, matchedGenres: string[], matchedTropes: string[], matchedKeywords: string[] }}
 */
export function scoreBook(book, signals) {
  const text = searchableText(book);

  const matchedGenres = signals.genres.filter((g) => includesPhrase(text, g));
  const matchedTropes = signals.tropes.filter((t) => includesPhrase(text, t));
  const matchedKeywords = signals.keywords.filter((k) => includesPhrase(text, k));

  const genrePoints = Math.min(matchedGenres.length * WEIGHTS.genreMatch, WEIGHTS.maxGenreContribution);
  const tropePoints = Math.min(matchedTropes.length * WEIGHTS.tropeMatch, WEIGHTS.maxTropeContribution);
  const keywordPoints = Math.min(matchedKeywords.length * WEIGHTS.keywordMatch, WEIGHTS.maxKeywordContribution);

  const raw = genrePoints + tropePoints + keywordPoints + popularityBonus(book);
  const score = Math.round(Math.min(100, raw));

  return { score, matchedGenres, matchedTropes, matchedKeywords };
}

export { WEIGHTS };
