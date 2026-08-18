import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreBook, WEIGHTS } from './scoring.mjs';

const signals = { genres: ['fantasy'], tropes: ['found family'], keywords: ['dragons'] };

test('a book matching every signal scores higher than one matching none', () => {
  const strongMatch = scoreBook(
    { title: 'Dragons of the Found Family Fantasy', subjects: [], description: '' },
    signals,
  );
  const noMatch = scoreBook({ title: 'A Quiet Accounting Manual', subjects: [], description: '' }, signals);
  assert.ok(strongMatch.score > noMatch.score);
  assert.equal(noMatch.score, 0);
});

test('reports which specific genres/tropes/keywords matched', () => {
  const result = scoreBook({ title: 'A Fantasy of Found Family and Dragons', subjects: [], description: '' }, signals);
  assert.deepEqual(result.matchedGenres, ['fantasy']);
  assert.deepEqual(result.matchedTropes, ['found family']);
  assert.deepEqual(result.matchedKeywords, ['dragons']);
});

test('score never exceeds 100 even with a huge ratings count', () => {
  const result = scoreBook(
    {
      title: 'Dragons of the Found Family Fantasy',
      subjects: ['fantasy', 'found family', 'dragons'],
      description: 'fantasy found family dragons',
      ratingsCount: 10_000_000,
      ratingsAverage: 5,
    },
    signals,
  );
  assert.ok(result.score <= 100);
});

test('a highly-rated, popular book scores a little higher than an identical but obscure one', () => {
  const base = { title: 'Fantasy Found Family Dragons', subjects: [], description: '' };
  const obscure = scoreBook({ ...base, ratingsCount: 0 }, signals);
  const popular = scoreBook({ ...base, ratingsCount: 5000, ratingsAverage: 4.5 }, signals);
  assert.ok(popular.score > obscure.score);
});

test('does not credit a genre match found only as a substring of another word (word-boundary regression)', () => {
  const result = scoreBook(
    { title: 'The Attraction Between Rivals', subjects: [], description: '' },
    { genres: ['action'], tropes: [], keywords: [] },
  );
  assert.deepEqual(result.matchedGenres, []);
  assert.equal(result.score, 0);
});

test('popularity alone cannot outweigh actual content relevance', () => {
  const irrelevantButPopular = scoreBook(
    { title: 'A Bestselling Cookbook', subjects: [], description: '', ratingsCount: 1_000_000, ratingsAverage: 4.9 },
    signals,
  );
  assert.ok(irrelevantButPopular.score < WEIGHTS.genreMatch);
});
