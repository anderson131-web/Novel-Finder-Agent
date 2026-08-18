// SQLite persistence: every search and its scored results get saved, so
// re-running the same query doesn't need a fresh explanation of what
// happened, and results can be browsed later without re-querying the
// APIs. Also holds manually-added entries (see sources.mjs's note on why
// fan-fiction isn't auto-discovered) so your whole reading list — API
// finds and things you added by hand — lives in one place.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export class NovelFinderDB {
  /** @param {string} dbPath */
  constructor(dbPath) {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this._migrate();
  }

  _migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        search_id INTEGER NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        authors_json TEXT NOT NULL,
        year INTEGER,
        subjects_json TEXT NOT NULL,
        description TEXT,
        ratings_average REAL,
        ratings_count INTEGER,
        cover_url TEXT,
        source_url TEXT,
        medium TEXT,
        sources_json TEXT NOT NULL,
        score INTEGER NOT NULL,
        matched_genres_json TEXT NOT NULL,
        matched_tropes_json TEXT NOT NULL,
        matched_keywords_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS manual_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT,
        url TEXT,
        note TEXT,
        added_at TEXT NOT NULL
      );
    `);
  }

  /** @param {string} query @returns {number} the new search's id */
  recordSearch(query) {
    const stmt = this.db.prepare('INSERT INTO searches (query, created_at) VALUES (?, ?)');
    const info = stmt.run(query, new Date().toISOString());
    return Number(info.lastInsertRowid);
  }

  /**
   * @param {number} searchId
   * @param {Array<object & { score: number, matchedGenres: string[], matchedTropes: string[], matchedKeywords: string[] }>} scoredBooks
   */
  saveResults(searchId, scoredBooks) {
    const stmt = this.db.prepare(`
      INSERT INTO results (
        search_id, title, authors_json, year, subjects_json, description,
        ratings_average, ratings_count, cover_url, source_url, medium, sources_json,
        score, matched_genres_json, matched_tropes_json, matched_keywords_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const book of scoredBooks) {
      stmt.run(
        searchId,
        book.title,
        JSON.stringify(book.authors ?? []),
        book.year ?? null,
        JSON.stringify(book.subjects ?? []),
        book.description ?? null,
        book.ratingsAverage ?? null,
        book.ratingsCount ?? 0,
        book.coverUrl ?? null,
        book.sourceUrl ?? null,
        book.medium ?? null,
        JSON.stringify(book.sources ?? [book.source].filter(Boolean)),
        book.score,
        JSON.stringify(book.matchedGenres ?? []),
        JSON.stringify(book.matchedTropes ?? []),
        JSON.stringify(book.matchedKeywords ?? []),
      );
    }
  }

  /** @param {number} searchId */
  getResultsForSearch(searchId) {
    const rows = this.db
      .prepare('SELECT * FROM results WHERE search_id = ? ORDER BY score DESC')
      .all(searchId);
    return rows.map(rowToResult);
  }

  /** @param {number} [limit] */
  listSearches(limit = 20) {
    return this.db
      .prepare('SELECT * FROM searches ORDER BY id DESC LIMIT ?')
      .all(limit);
  }

  /**
   * For a book you found yourself (a fanfic, a rec from a friend, whatever)
   * that you want tracked alongside the API-discovered results.
   * @param {{ title: string, author?: string, url?: string, note?: string }} entry
   */
  addManualEntry({ title, author = null, url = null, note = null }) {
    const stmt = this.db.prepare(
      'INSERT INTO manual_entries (title, author, url, note, added_at) VALUES (?, ?, ?, ?, ?)',
    );
    const info = stmt.run(title, author, url, note, new Date().toISOString());
    return Number(info.lastInsertRowid);
  }

  listManualEntries() {
    return this.db.prepare('SELECT * FROM manual_entries ORDER BY id DESC').all();
  }

  close() {
    this.db.close();
  }
}

function rowToResult(row) {
  return {
    id: row.id,
    title: row.title,
    authors: JSON.parse(row.authors_json),
    year: row.year,
    subjects: JSON.parse(row.subjects_json),
    description: row.description,
    ratingsAverage: row.ratings_average,
    ratingsCount: row.ratings_count,
    coverUrl: row.cover_url,
    sourceUrl: row.source_url,
    medium: row.medium,
    sources: JSON.parse(row.sources_json),
    score: row.score,
    matchedGenres: JSON.parse(row.matched_genres_json),
    matchedTropes: JSON.parse(row.matched_tropes_json),
    matchedKeywords: JSON.parse(row.matched_keywords_json),
  };
}
