import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NovelFinderDB } from './db.mjs';

function tmpDb() {
  const dir = mkdtempSync(path.join(tmpdir(), 'novel-finder-test-'));
  const db = new NovelFinderDB(path.join(dir, 'test.db'));
  return { db, dir };
}

test('recordSearch + saveResults + getResultsForSearch round-trip, ordered by score', () => {
  const { db, dir } = tmpDb();
  try {
    const searchId = db.recordSearch('cozy fantasy');
    db.saveResults(searchId, [
      { title: 'Low Match', authors: ['A'], subjects: [], score: 20, matchedGenres: [], matchedTropes: [], matchedKeywords: [] },
      { title: 'High Match', authors: ['B'], subjects: ['fantasy'], score: 80, matchedGenres: ['fantasy'], matchedTropes: [], matchedKeywords: [] },
    ]);

    const results = db.getResultsForSearch(searchId);
    assert.equal(results.length, 2);
    assert.equal(results[0].title, 'High Match'); // higher score first
    assert.deepEqual(results[0].matchedGenres, ['fantasy']);
    assert.equal(results[1].title, 'Low Match');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('listSearches returns most recent first', () => {
  const { db, dir } = tmpDb();
  try {
    db.recordSearch('first query');
    db.recordSearch('second query');
    const searches = db.listSearches();
    assert.equal(searches[0].query, 'second query');
    assert.equal(searches[1].query, 'first query');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('addManualEntry stores a hand-added book/fanfic separately from API results', () => {
  const { db, dir } = tmpDb();
  try {
    db.addManualEntry({ title: 'A Fanfic I Found Myself', author: 'some_author', url: 'https://example.com/fic/1', note: 'recommended by a friend' });
    const entries = db.listManualEntries();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].title, 'A Fanfic I Found Myself');
    assert.equal(entries[0].note, 'recommended by a friend');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
