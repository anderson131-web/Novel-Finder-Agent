# Novel Finder Agent

Describe the kind of story you want — a genre, a couple of tropes,
whatever comes to mind — and this finds real candidates across novels,
manga, manhwa, manhua, and light/web novels, ranks them by how well they
actually match, and keeps a searchable history of everything it's found.

```
$ node src/cli.mjs "action manhwa with cultivation and martial arts"

Signals: genres=[action,manhwa] tropes=[cultivation,martial arts] keywords=[]

Top 8 matches for "action manhwa with cultivation and martial arts":

[89] (Manhwa) Tower of God — Unknown author (2010)
[89] (Manhwa) SSS-Class Revival Hunter — Unknown author (2020)
[89] (Manhwa) Nano Machine — Unknown author (2020)
[89] (Manhwa) Return of the Blossoming Blade — Unknown author (2021)
...

$ node src/cli.mjs "Lord of the Mysteries"

[20] (Manhua) Lord of the Mysteries — Unknown author (2020)
      https://anilist.co/manga/125291
```

There's also a small web UI over the same pipeline (`npm run serve`) —
cover art, score badges, and matched-trope chips instead of a terminal
list:

![Screenshot of the Novel Finder Agent web UI showing action manhwa search results with cover art, medium tags, score badges, and matched-genre/trope chips](docs/screenshot.png?v=3f8b832)

<!--
Note for future updates: GitHub's README image rendering goes through an
image proxy (camo) that caches by exact URL. Replacing screenshot.png in
place without changing the URL can leave viewers seeing a stale cached
copy for a while even though the file itself is correctly updated (this
happened once — the file was already right, only the cached render
wasn't). Bump the ?v= query param above to the new commit's short SHA
every time the screenshot changes, so the URL itself changes and the
cache can't serve something stale.
-->

## Sources — and the one deliberately left out

- [Open Library](https://openlibrary.org/dev/docs/api/search) and the
  [Google Books API](https://developers.google.com/books) for
  traditionally-published novels — free, public, documented, no API key
  needed.
- [AniList](https://anilist.co/graphiql) for manga, manhwa, manhua, light
  novels, and web novels — also free and public, with real structured
  genre/tag filters (see `src/anilist.mjs`) rather than plain keyword
  search, which is what makes something like "manhwa isekai reincarnation
  revenge" actually work instead of just matching on stray words.

Fan-fiction and Korean web-novel-platform sites (AO3, FanFiction.net,
Wattpad, Novelpia) are **not** included. None of them offer a public
search API, and Novelpia's own `robots.txt` explicitly disallows
crawling (`Disallow: /`, plus `/api/` and `/json/` blocked outright even
for the handful of search engines it does allow) — about as direct a
"don't scrape us" as a site can send. Same line I drew around LinkedIn
on a job-search project I built earlier. If you already found something
on your own and want it tracked alongside everything else,
`addManualEntry()` in `src/db.mjs` will store it — the tool just won't
go fetch it for you.

## How the query actually works

Open Library and Google Books both do literal keyword search, not
semantic matching. Early on this sent the whole sentence as one query,
which effectively ANDs every word together — `"cozy fantasy with a found
family and slow burn romance"` as a single Open Library query returns
almost nothing, because no book's title/subject text contains all of
those words at once.

So instead, `buildSearchQueries()` splits the description into its
strongest signals — each genre, each trope — and searches them
separately, merging everything before scoring. A book that's a genuine
match tends to turn up from more than one of those queries and outscores
one that only happened to match a single word.

AniList doesn't have this problem the same way — it has real
`genre_in`/`tag_in` filters, so `searchAniList()` maps recognized signals
straight onto AniList's actual genre/tag vocabulary (e.g. `isekai` →
`Isekai`, `found family` → `Found Family`) and only falls back to a
title search when nothing mapped to a known one — and even then it
searches the cleaned keyword list, not the raw sentence, since filler
words ("I want", "like novel") only hurt a literal title match, they
don't help it. `"The Eminence in Shadow"` correctly finds the real title
this way even though nothing in it maps to a genre/tag.

The genre/trope vocabulary itself (`KNOWN_GENRES`/`KNOWN_TROPES` in
`keywords.mjs`) is deliberately broad — beyond the obvious ones it covers
isekai/manhwa/manhua staples like `chuunibyou`, `academy`, `yandere`,
`bloodline`, `returner`, `necromancer`, `harem`, `swordsman`, and more —
because a narrow vocabulary quietly biases results toward whatever
happened to be covered (an early version only recognized romance-y
tropes, so an "action" query had nothing to search for and just
defaulted to whatever was popular).

## Scoring

`scoreBook()` checks a candidate's title/subjects/description against the
extracted signals and returns a 0-100 score, plus exactly which
genres/tropes/keywords matched — nothing about the score is a black box.
A small, capped bonus accounts for a book's ratings count/average so two
equally-matching books aren't separated purely by popularity, but
popularity alone can't outscore actual relevance (a wildly popular but
unrelated book still scores near zero — see `src/scoring.test.mjs`).

## Setup

```bash
git clone https://github.com/anderson131-web/novel-finder-agent.git
cd novel-finder-agent
node src/cli.mjs "epic fantasy with dragons and a chosen one"
```

No dependencies to install — it's built entirely on Node's native `fetch`
and `node:sqlite`, both built in since Node 22.

## Usage

CLI:

```bash
node src/cli.mjs "<what you want to read>" [--limit N] [--db path]
```

Web UI:

```bash
npm run serve
# → http://localhost:4321
```

Both talk to the exact same pipeline (`src/search.mjs`) — the CLI just
prints to a terminal, the server renders cards. Every search and its
results get saved to a local SQLite database (`data/novels.db` by
default) so you can build a running list over time instead of losing
results the moment the process exits; the web UI's `/api/history`
endpoint reads that same history back.

> Google Books' unauthenticated tier has a fairly low rate limit shared
> across whoever's calling it from the same network — if you see
> `HTTP 429` in the output, Open Library's results still come through
> fine on their own; get a free Google Books API key for heavier use.

## Project Structure

```
novel-finder-agent/
├── src/
│   ├── cli.mjs         # Terminal entry point
│   ├── server.mjs       # Web UI + JSON API (node:http, zero frontend deps)
│   ├── search.mjs        # The actual pipeline both entry points share
│   ├── keywords.mjs       # Description → genre/trope/keyword signals + query builder
│   ├── sources.mjs        # Open Library + Google Books clients (novels)
│   ├── anilist.mjs         # AniList client (manga/manhwa/manhua/light novels/web novels)
│   ├── http.mjs             # Shared fetch-with-retry + HTML-stripping helpers
│   ├── text.mjs              # Shared word-boundary text matching
│   ├── dedupe.mjs             # Merges the same title found across sources/queries
│   ├── scoring.mjs             # 0-100 relevance score against the extracted signals
│   └── db.mjs                  # SQLite: search history, results, manual entries
├── docs/screenshot.png
└── *.test.mjs                   # One test file per module, run with `npm test`
```

## Testing

```bash
npm test
```

44 tests: signal extraction and query-building, word-boundary text
matching (a short genre like "action" doesn't false-positive inside
"attraction"), source normalization for all three APIs (mocked
responses, no live network calls), the AniList genre/tag mapping and its
format-label logic (manga vs manhwa vs manhua vs light/web novel),
retry/failure handling, dedup merging, the scoring function's weighting,
and the SQLite layer.

## Project Status

Functional and tested end-to-end against the real APIs — including a
live run against AniList that correctly surfaced *Lord of the Mysteries*
from a plain-text query, and a full browser run of the web UI. Known
limitation: AniList's search response doesn't include author/artist
credits, so manga/manhwa/manhua/web-novel results show "Unknown author"
— traditionally-published books from Open Library/Google Books still get
real author names. Natural next steps: a richer trope/genre vocabulary,
and an optional second scoring pass using a full book description where
Google Books provides one.

## License

MIT — see [LICENSE](LICENSE).
