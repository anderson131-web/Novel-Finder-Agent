import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeBooks } from './dedupe.mjs';

test('merges the same book found from two sources into one entry', () => {
  const books = [
    { title: 'Dune', authors: ['Frank Herbert'], subjects: ['sci-fi'], description: null, source: 'openlibrary' },
    { title: 'Dune', authors: ['Frank Herbert'], subjects: ['classic'], description: 'A desert planet epic.', source: 'googlebooks' },
  ];
  const result = dedupeBooks(books);
  assert.equal(result.length, 1);
  assert.equal(result[0].description, 'A desert planet epic.'); // filled in from whichever source had it
  assert.deepEqual(new Set(result[0].subjects), new Set(['sci-fi', 'classic']));
  assert.deepEqual(new Set(result[0].sources), new Set(['openlibrary', 'googlebooks']));
});

test('title casing/whitespace differences still merge', () => {
  const books = [
    { title: 'The Hobbit', authors: ['J.R.R. Tolkien'], subjects: [], source: 'openlibrary' },
    { title: '  the hobbit  ', authors: ['J.R.R. Tolkien'], subjects: [], source: 'googlebooks' },
  ];
  assert.equal(dedupeBooks(books).length, 1);
});

test('keeps the higher ratings count when merging', () => {
  const books = [
    { title: 'Dune', authors: ['Frank Herbert'], subjects: [], ratingsCount: 50, source: 'openlibrary' },
    { title: 'Dune', authors: ['Frank Herbert'], subjects: [], ratingsCount: 5000, source: 'googlebooks' },
  ];
  assert.equal(dedupeBooks(books)[0].ratingsCount, 5000);
});

test('different books by different authors are not merged', () => {
  const books = [
    { title: 'Dune', authors: ['Frank Herbert'], subjects: [], source: 'openlibrary' },
    { title: 'Dune', authors: ['Someone Else'], subjects: [], source: 'googlebooks' },
  ];
  assert.equal(dedupeBooks(books).length, 2);
});
