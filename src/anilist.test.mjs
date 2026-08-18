import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchAniList } from './anilist.mjs';

function fakeFetch(media, ok = true, status = 200) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(JSON.parse(options.body));
    return { ok, status, json: async () => ({ data: { Page: { media } } }) };
  };
  return { fetchImpl, calls };
}

const SAMPLE_MEDIA = {
  title: { romaji: 'Guimi Zhi Zhu', english: 'Lord of the Mysteries' },
  format: 'MANGA',
  countryOfOrigin: 'CN',
  genres: ['Mystery', 'Fantasy'],
  tags: [{ name: 'Reincarnation' }],
  description: 'A Victorian-era mystery.<br><br>With Beyonders and Tarot cards.',
  averageScore: 80,
  popularity: 9000,
  siteUrl: 'https://anilist.co/manga/125291',
  coverImage: { large: 'https://example.com/cover.jpg' },
  startDate: { year: 2021 },
};

test('always excludes Boys\' Love-tagged content, on every query', async () => {
  const { fetchImpl, calls } = fakeFetch([]);
  await searchAniList({ genres: ['fantasy'], tropes: [], keywords: [] }, 'fantasy', { fetchImpl });
  assert.deepEqual(calls[0].variables.tagsExcluded, ["Boys' Love"]);
});

test('normalizes a manhua result and labels its medium correctly', async () => {
  const { fetchImpl } = fakeFetch([SAMPLE_MEDIA]);
  const signals = { genres: ['fantasy'], tropes: ['reincarnation'], keywords: [] };
  const results = await searchAniList(signals, 'fantasy reincarnation', { fetchImpl });

  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Lord of the Mysteries');
  assert.equal(results[0].medium, 'Manhua'); // MANGA format + CN origin
  assert.equal(results[0].source, 'anilist');
  assert.ok(results[0].subjects.includes('Manhua'));
  assert.ok(!results[0].description.includes('<br>')); // HTML stripped
  assert.equal(results[0].ratingsAverage, 4); // 80/20 → 0-5 scale
});

test('labels a Korean NOVEL-format result as Web Novel and a Japanese one as Light Novel', async () => {
  const korean = { ...SAMPLE_MEDIA, format: 'NOVEL', countryOfOrigin: 'KR' };
  const japanese = { ...SAMPLE_MEDIA, format: 'NOVEL', countryOfOrigin: 'JP' };
  const { fetchImpl } = fakeFetch([korean, japanese]);
  const results = await searchAniList({ genres: [], tropes: [], keywords: [] }, 'anything', { fetchImpl });

  assert.equal(results[0].medium, 'Web Novel');
  assert.equal(results[1].medium, 'Light Novel');
});

test('maps a known genre/trope to AniList genre_in/tag_in instead of a text search', async () => {
  const { fetchImpl, calls } = fakeFetch([]);
  const signals = { genres: ['fantasy'], tropes: ['found family'], keywords: ['dragons'] };
  await searchAniList(signals, 'fantasy with found family and dragons', { fetchImpl });

  const vars = calls[0].variables;
  assert.deepEqual(vars.genres, ['Fantasy']);
  assert.deepEqual(vars.tags, ['Found Family']);
  assert.equal(vars.search, undefined); // structured filters found — no text search needed
});

test('maps "action" to AniList\'s Action genre', async () => {
  const { fetchImpl, calls } = fakeFetch([]);
  const signals = { genres: ['action'], tropes: ['cultivation', 'martial arts'], keywords: [] };
  await searchAniList(signals, 'action cultivation martial arts', { fetchImpl });

  const vars = calls[0].variables;
  assert.deepEqual(vars.genres, ['Action']);
  assert.deepEqual(new Set(vars.tags), new Set(['Cultivation', 'Martial Arts']));
});

test('falls back to a text search built from cleaned keywords, not the raw description', async () => {
  const { fetchImpl, calls } = fakeFetch([]);
  const signals = { genres: [], tropes: [], keywords: ['lighthouse', 'disappearance'] };
  // The raw description has filler words ("a", "keeper", "solving") that
  // only hurt a literal title search — the cleaned keyword list shouldn't.
  await searchAniList(signals, 'a lighthouse keeper solving a disappearance', { fetchImpl });

  const vars = calls[0].variables;
  assert.equal(vars.genres, undefined);
  assert.equal(vars.tags, undefined);
  assert.equal(vars.search, 'lighthouse disappearance');
});

test('falls back to the raw description only when there are no keywords either', async () => {
  const { fetchImpl, calls } = fakeFetch([]);
  const signals = { genres: [], tropes: [], keywords: [] };
  await searchAniList(signals, 'a a a', { fetchImpl });

  assert.equal(calls[0].variables.search, 'a a a');
});

test('a "manhwa" mention biases the query toward Korean MANGA-format results', async () => {
  const { fetchImpl, calls } = fakeFetch([]);
  const signals = { genres: ['manhwa', 'fantasy'], tropes: [], keywords: [] };
  await searchAniList(signals, 'manhwa fantasy', { fetchImpl });

  const vars = calls[0].variables;
  assert.equal(vars.format, 'MANGA');
  assert.equal(vars.country, 'KR');
});

test('throws with the GraphQL error message on a query error', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ errors: [{ message: 'Invalid variable' }] }),
  });
  await assert.rejects(
    () => searchAniList({ genres: [], tropes: [], keywords: [] }, 'x', { fetchImpl }),
    /Invalid variable/,
  );
});

test('throws on a non-ok HTTP response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(() => searchAniList({ genres: [], tropes: [], keywords: [] }, 'x', { fetchImpl }));
});
