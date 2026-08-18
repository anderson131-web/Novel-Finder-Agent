// The same book often turns up from both sources under slightly different
// title casing/whitespace — this collapses those into one entry, keeping
// the richer fields (a description if either source had one, the union of
// subjects, the higher ratings count) instead of just picking the first.

function normalizeKey(title, authors) {
  const t = (title ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const a = (authors?.[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${t}::${a}`;
}

/**
 * @param {object[]} books
 * @returns {object[]}
 */
export function dedupeBooks(books) {
  const byKey = new Map();

  for (const book of books) {
    const key = normalizeKey(book.title, book.authors);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, { ...book, sources: [book.source] });
      continue;
    }

    byKey.set(key, {
      ...existing,
      description: existing.description ?? book.description,
      subjects: [...new Set([...(existing.subjects ?? []), ...(book.subjects ?? [])])],
      ratingsCount: Math.max(existing.ratingsCount ?? 0, book.ratingsCount ?? 0),
      ratingsAverage: existing.ratingsAverage ?? book.ratingsAverage,
      coverUrl: existing.coverUrl ?? book.coverUrl,
      medium: existing.medium ?? book.medium,
      sources: [...new Set([...existing.sources, book.source])],
    });
  }

  return [...byKey.values()];
}
