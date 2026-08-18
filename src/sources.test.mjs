import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchOpenLibrary, searchGoogleBooks, searchAllSources } from './sources.mjs';

function fakeFetch(body, ok = true, status = 200) {
  return async () => ({ ok, status, json: async () => body });
}

test('searchOpenLibrary normalizes a doc into the common book shape', async () => {
  const fetchImpl = fakeFetch({
    docs: [
      {
        key: '/works/OL1W',
        title: 'Dune',
        author_name: ['Frank Herbert'],
        first_publish_year: 1965,
        subject: ['Science fiction', 'Adventure'],
        ratings_average: 4.5,
        ratings_count: 200,
        cover_i: 12345,
      },
    ],
  });
  const results = await searchOpenLibrary('dune', { fetchImpl });
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Dune');
  assert.equal(results[0].authors[0], 'Frank Herbert');
  assert.equal(results[0].source, 'openlibrary');
  assert.equal(results[0].sourceUrl, 'https://openlibrary.org/works/OL1W');
  assert.equal(results[0].coverUrl, 'https://covers.openlibrary.org/b/id/12345-M.jpg');
});

test('searchOpenLibrary throws on a non-ok response instead of silently returning nothing', async () => {
  await assert.rejects(() => searchOpenLibrary('dune', { fetchImpl: fakeFetch({}, false, 503) }));
});

test('searchGoogleBooks normalizes an item into the common book shape', async () => {
  const fetchImpl = fakeFetch({
    items: [
      {
        id: 'abc123',
        volumeInfo: {
          title: 'Dune',
          authors: ['Frank Herbert'],
          publishedDate: '1965-08-01',
          categories: ['Fiction'],
          description: 'A desert planet epic.',
          averageRating: 4.6,
          ratingsCount: 900,
          imageLinks: { thumbnail: 'https://example.com/cover.jpg' },
          infoLink: 'https://books.google.com/books?id=abc123',
        },
      },
    ],
  });
  const results = await searchGoogleBooks('dune', { fetchImpl });
  assert.equal(results[0].title, 'Dune');
  assert.equal(results[0].year, 1965);
  assert.equal(results[0].description, 'A desert planet epic.');
  assert.equal(results[0].source, 'googlebooks');
});

test('searchAllSources combines both sources', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    return call === 1
      ? { ok: true, status: 200, json: async () => ({ docs: [{ title: 'From Open Library', author_name: [] }] }) }
      : { ok: true, status: 200, json: async () => ({ items: [{ volumeInfo: { title: 'From Google Books' } }] }) };
  };
  const results = await searchAllSources('anything', { fetchImpl });
  const titles = results.map((r) => r.title);
  assert.ok(titles.includes('From Open Library'));
  assert.ok(titles.includes('From Google Books'));
});

test('searchAllSources tolerates one source failing and still returns the other', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    if (call === 1) throw new Error('network down');
    return { ok: true, status: 200, json: async () => ({ items: [{ volumeInfo: { title: 'Still Found' } }] }) };
  };
  const results = await searchAllSources('anything', { fetchImpl });
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Still Found');
});
