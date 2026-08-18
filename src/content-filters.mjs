// A fixed content preference applied to every search, not something
// derived from a query — same category of decision as the fan-fiction
// source exclusion, just expressed as a result filter instead of a
// missing source. AniList's own tag_not_in already keeps BL/yaoi-tagged
// titles from ever being fetched from AniList (see anilist.mjs); this is
// the defense-in-depth layer that also covers anything Open Library or
// Google Books might surface, which don't have a comparable tag system
// to filter server-side.
import { includesPhrase } from './text.mjs';

const EXCLUDED_TERMS = ["boys' love", 'boys love', 'yaoi', 'shounen ai', "shonen ai"];

function searchableText(book) {
  return [book.title, ...(book.subjects ?? []), book.description ?? ''].join(' ').toLowerCase();
}

/**
 * @param {object[]} books
 * @returns {object[]}
 */
export function excludeUnwantedContent(books) {
  return books.filter((book) => {
    const text = searchableText(book);
    return !EXCLUDED_TERMS.some((term) => includesPhrase(text, term));
  });
}
