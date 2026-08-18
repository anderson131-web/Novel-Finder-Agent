// Shared word-boundary text matching, used both to pull signals out of a
// user's description (keywords.mjs) and to check a candidate book's
// text against those signals (scoring.mjs). Plain `.includes()` was the
// original approach and it has a real false-positive problem: a short
// genre like "action" or "ya" matches inside "attraction" or "yard" just
// as happily as inside an actual mention of the genre. `\b` word
// boundaries fix that without needing full tokenization.
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {string} haystack already-normalized (lowercased) text
 * @param {string} phrase a single word or a space-separated phrase
 */
export function includesPhrase(haystack, phrase) {
  return new RegExp(`\\b${escapeRegExp(phrase)}\\b`).test(haystack);
}
