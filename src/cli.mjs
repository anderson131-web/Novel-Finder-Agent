#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findMatches } from './search.mjs';
import { NovelFinderDB } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { limit: 10, dbPath: path.join(__dirname, '..', 'data', 'novels.db') };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') args.limit = Number.parseInt(argv[++i], 10);
    else if (argv[i] === '--db') args.dbPath = argv[++i];
    else rest.push(argv[i]);
  }
  args.description = rest.join(' ');
  return args;
}

async function main() {
  const { description, limit, dbPath } = parseArgs(process.argv.slice(2));

  if (!description) {
    console.error('Usage: node src/cli.mjs "<what you want to read>" [--limit N] [--db path]');
    console.error('Example: node src/cli.mjs "cozy fantasy with a found family and a slow burn romance"');
    process.exit(1);
  }

  const { signals, queries, results } = await findMatches(description, { limit });
  console.log(`Signals: genres=[${signals.genres}] tropes=[${signals.tropes}] keywords=[${signals.keywords.slice(0, 8)}]`);
  console.log(`Searching books: ${queries.map((q) => `"${q}"`).join(', ')}`);
  console.log('Searching manga/manhwa/manhua/light novels/web novels via AniList');

  const db = new NovelFinderDB(dbPath);
  const searchId = db.recordSearch(description);
  db.saveResults(searchId, results);
  db.close();

  if (results.length === 0) {
    console.log('No matches found. Try a broader description.');
    return;
  }

  console.log(`\nTop ${results.length} matches for "${description}":\n`);
  for (const book of results) {
    const tag = book.medium ? `(${book.medium}) ` : '';
    const author = book.authors[0] ?? 'Unknown author';
    console.log(`[${book.score}] ${tag}${book.title} — ${author}${book.year ? ` (${book.year})` : ''}`);
    if (book.sourceUrl) console.log(`      ${book.sourceUrl}`);
  }
}

main().catch((err) => {
  console.error('novel-finder-agent failed:', err.message);
  process.exit(1);
});
