// Shared fetch-with-retry helper for every source client. Every API here
// is public and unauthenticated for a basic search, which means
// occasional connection resets and 429s under load are normal, not a
// sign anything is broken. A couple of short-backoff retries absorbs
// that without hiding a real, persistent failure (which still surfaces
// once the retries run out).

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {() => Promise<Response>} doFetch
 * @param {{ retries?: number, baseDelayMs?: number }} [opts]
 */
export async function withRetry(doFetch, { retries = 2, baseDelayMs = 300 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await doFetch();
      if (res.ok || (res.status < 500 && res.status !== 429)) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < retries) await sleep(baseDelayMs * 2 ** attempt);
  }
  throw lastError;
}

/** Strips the handful of literal HTML tags AniList/Google Books descriptions use. */
export function stripHtml(text) {
  if (!text) return text;
  return text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}
