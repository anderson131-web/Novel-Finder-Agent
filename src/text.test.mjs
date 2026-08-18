import { test } from 'node:test';
import assert from 'node:assert/strict';
import { includesPhrase } from './text.mjs';

test('matches a whole word', () => {
  assert.equal(includesPhrase('an action-packed story', 'action'), true);
});

test('does not match a word that is only a substring of another word', () => {
  assert.equal(includesPhrase('a lot of attraction between them', 'action'), false);
  assert.equal(includesPhrase('meet me in the yard', 'ya'), false);
});

test('matches a multi-word phrase with a boundary on both ends', () => {
  assert.equal(includesPhrase('a classic enemies to lovers romance', 'enemies to lovers'), true);
  assert.equal(includesPhrase('frenemies to lovers, sort of', 'enemies to lovers'), false);
});

test('is case-sensitive by design — callers normalize to lowercase first', () => {
  assert.equal(includesPhrase('Action movie', 'action'), false);
  assert.equal(includesPhrase('action movie', 'action'), true);
});
