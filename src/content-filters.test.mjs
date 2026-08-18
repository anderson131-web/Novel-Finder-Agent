import { test } from 'node:test';
import assert from 'node:assert/strict';
import { excludeUnwantedContent } from './content-filters.mjs';

test('drops a book tagged Boys\' Love', () => {
  const books = [
    { title: 'Given', subjects: ["Boys' Love", 'Band', 'Coming of Age'], description: '' },
    { title: 'Horimiya', subjects: ['Romance', 'School'], description: '' },
  ];
  const result = excludeUnwantedContent(books);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Horimiya');
});

test('drops a book described as yaoi even without a matching subject tag', () => {
  const books = [{ title: 'Some Title', subjects: [], description: 'A classic yaoi romance.' }];
  assert.equal(excludeUnwantedContent(books).length, 0);
});

test('does not drop unrelated books just because they mention "love" or "boys"', () => {
  const books = [
    { title: 'The Fault in Our Stars', subjects: ['Romance'], description: 'A love story.' },
    { title: 'Lord of the Flies', subjects: ['Classics'], description: 'A group of boys stranded on an island.' },
  ];
  assert.equal(excludeUnwantedContent(books).length, 2);
});
