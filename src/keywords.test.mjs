import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSignals, buildSearchQueries } from './keywords.mjs';

test('extracts a known genre and trope from a natural description', () => {
  const signals = extractSignals('a cozy fantasy with a slow burn enemies to lovers romance');
  assert.ok(signals.genres.includes('fantasy'));
  assert.ok(signals.genres.includes('romance'));
  assert.ok(signals.tropes.includes('slow burn'));
  assert.ok(signals.tropes.includes('enemies to lovers'));
});

test('matches a hyphenated trope the same as a spaced one', () => {
  const spaced = extractSignals('enemies to lovers story');
  const hyphenated = extractSignals('enemies-to-lovers story');
  assert.deepEqual(spaced.tropes, hyphenated.tropes);
});

test('falls back to generic keywords when no known genre/trope matches', () => {
  const signals = extractSignals('a lighthouse keeper solving a decades-old disappearance');
  assert.equal(signals.genres.length, 0);
  assert.equal(signals.tropes.length, 0);
  assert.ok(signals.keywords.includes('lighthouse'));
  assert.ok(signals.keywords.includes('disappearance'));
});

test('drops filler words and words already captured by a matched phrase', () => {
  const signals = extractSignals('I want a fantasy book about dragons');
  assert.ok(!signals.keywords.includes('want'));
  assert.ok(!signals.keywords.includes('book'));
  assert.ok(!signals.keywords.includes('fantasy')); // captured as a genre, not a loose keyword
  assert.ok(signals.keywords.includes('dragons'));
});

test('deduplicates repeated keywords', () => {
  const signals = extractSignals('dragons dragons dragons');
  assert.deepEqual(signals.keywords, ['dragons']);
});

test('buildSearchQueries splits genres/tropes into separate queries instead of one big AND query', () => {
  const signals = extractSignals('cozy fantasy with a found family and slow burn romance');
  const queries = buildSearchQueries(signals, 'cozy fantasy with a found family and slow burn romance');
  assert.ok(queries.includes('fantasy'));
  assert.ok(queries.includes('romance'));
  assert.ok(queries.includes('found family'));
  assert.ok(queries.includes('slow burn'));
  assert.ok(queries.length > 1); // the whole point — not one combined query
});

test('recognizes "action" as a genre', () => {
  const signals = extractSignals('action manhwa with cultivation and martial arts');
  assert.ok(signals.genres.includes('action'));
  assert.ok(signals.genres.includes('manhwa'));
  assert.ok(signals.tropes.includes('cultivation'));
  assert.ok(signals.tropes.includes('martial arts'));
});

test('does not false-positive "action" inside an unrelated word (word-boundary regression)', () => {
  const signals = extractSignals('a story about attraction between two rivals');
  assert.ok(!signals.genres.includes('action'));
});

test('buildSearchQueries falls back to the raw description when no signals were extracted at all', () => {
  const emptySignals = { genres: [], tropes: [], keywords: [] };
  const queries = buildSearchQueries(emptySignals, 'something with no known genre or keyword');
  assert.deepEqual(queries, ['something with no known genre or keyword']);
});
