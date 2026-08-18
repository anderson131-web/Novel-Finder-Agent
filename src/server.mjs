#!/usr/bin/env node
// A small local web UI over the same search pipeline the CLI uses — no
// framework, no build step, no frontend dependency: node:http serves one
// HTML page with inline CSS/JS, and a JSON API the page's own fetch()
// calls talk to.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findMatches } from './search.mjs';
import { NovelFinderDB } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4321;
const DB_PATH = process.env.NOVEL_FINDER_DB || path.join(__dirname, '..', 'data', 'novels.db');

const db = new NovelFinderDB(DB_PATH);

function send(res, status, body, contentType = 'application/json') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(contentType === 'application/json' ? JSON.stringify(body) : body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, PAGE, 'text/html');
    }

    if (req.method === 'GET' && url.pathname === '/api/search') {
      const description = (url.searchParams.get('q') ?? '').trim();
      const limit = Math.min(Number(url.searchParams.get('limit')) || 15, 50);
      if (!description) return send(res, 400, { error: 'Missing q parameter' });

      const { signals, results } = await findMatches(description, { limit });
      const searchId = db.recordSearch(description);
      db.saveResults(searchId, results);
      return send(res, 200, { signals, results });
    }

    if (req.method === 'GET' && url.pathname === '/api/history') {
      return send(res, 200, { searches: db.listSearches(15) });
    }

    send(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[server]', err);
    send(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Novel Finder Agent running at http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  db.close();
  server.close(() => process.exit(0));
});

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Novel Finder Agent</title>
<style>
  :root {
    --bg: #0d1117; --panel: #161b22; --border: #30363d; --text: #e6edf3;
    --muted: #8b949e; --accent: #58a6ff; --accent-dim: #1f6feb33;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    background: var(--bg); color: var(--text);
  }
  header { padding: 2rem 1.5rem 1rem; text-align: center; }
  header h1 { margin: 0 0 0.25rem; font-size: 1.6rem; }
  header p { margin: 0; color: var(--muted); font-size: 0.95rem; }
  .search-bar {
    max-width: 640px; margin: 1.5rem auto; display: flex; gap: 0.5rem;
    padding: 0 1.5rem;
  }
  input[type=text] {
    flex: 1; padding: 0.7rem 1rem; border-radius: 8px; border: 1px solid var(--border);
    background: var(--panel); color: var(--text); font-size: 1rem;
  }
  input[type=text]:focus { outline: 2px solid var(--accent); }
  button {
    padding: 0.7rem 1.4rem; border-radius: 8px; border: none;
    background: var(--accent); color: #0d1117; font-weight: 600; cursor: pointer;
  }
  button:hover { opacity: 0.9; }
  button:disabled { opacity: 0.5; cursor: default; }
  .examples { max-width: 640px; margin: 0 auto 1rem; padding: 0 1.5rem; color: var(--muted); font-size: 0.85rem; }
  .examples span { cursor: pointer; text-decoration: underline; margin-right: 0.75rem; }
  .signals { max-width: 900px; margin: 0 auto 1rem; padding: 0 1.5rem; font-size: 0.85rem; color: var(--muted); min-height: 1.2em; }
  .signals b { color: var(--text); }
  .status { max-width: 900px; margin: 0 auto; padding: 0 1.5rem; color: var(--muted); min-height: 1.2em; }
  .grid {
    max-width: 1100px; margin: 1rem auto 3rem; padding: 0 1.5rem;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem;
  }
  .card {
    background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
    overflow: hidden; display: flex; flex-direction: column;
  }
  .cover { width: 100%; height: 260px; object-fit: cover; background: #21262d; }
  .cover.placeholder { display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 0.8rem; }
  .card-body { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
  .card-title { font-weight: 600; font-size: 0.95rem; line-height: 1.3; }
  .card-meta { font-size: 0.8rem; color: var(--muted); }
  .score-row { display: flex; align-items: center; justify-content: space-between; }
  .score {
    display: inline-flex; align-items: center; justify-content: center;
    width: 2.2rem; height: 2.2rem; border-radius: 50%; font-weight: 700; font-size: 0.85rem;
    background: var(--accent-dim); color: var(--accent);
  }
  .medium-tag {
    font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 999px;
    background: #23863633; color: #3fb950; border: 1px solid #23863680;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: auto; }
  .chip { font-size: 0.7rem; padding: 0.15rem 0.45rem; border-radius: 6px; background: #21262d; color: var(--muted); }
  .card a { margin-top: 0.4rem; font-size: 0.8rem; color: var(--accent); text-decoration: none; }
  .card a:hover { text-decoration: underline; }
  footer { text-align: center; color: var(--muted); font-size: 0.8rem; padding: 1rem; }
</style>
</head>
<body>
  <header>
    <h1>Novel Finder Agent</h1>
    <p>Books, manga, manhwa, manhua, and light/web novels — matched by description, not just title.</p>
  </header>

  <div class="search-bar">
    <input id="q" type="text" placeholder="e.g. manhwa isekai reincarnation revenge" autofocus>
    <button id="go">Search</button>
  </div>
  <div class="examples">
    Try:
    <span data-q="cozy fantasy with a found family and slow burn romance">cozy fantasy found family</span>
    <span data-q="manhwa isekai reincarnation revenge">manhwa isekai revenge</span>
    <span data-q="Lord of the Mysteries">Lord of the Mysteries</span>
  </div>

  <div class="examples" id="history" style="display:none">Recent: <span id="history-list"></span></div>

  <div class="signals" id="signals"></div>
  <div class="status" id="status"></div>
  <div class="grid" id="grid"></div>

  <footer>Sources: Open Library, Google Books, AniList. Fan-fiction archives are deliberately not scraped (no public API / ToS).</footer>

<script>
const q = document.getElementById('q');
const go = document.getElementById('go');
const grid = document.getElementById('grid');
const statusEl = document.getElementById('status');
const signalsEl = document.getElementById('signals');

async function search() {
  const description = q.value.trim();
  if (!description) return;
  go.disabled = true;
  statusEl.textContent = 'Searching Open Library, Google Books, and AniList...';
  signalsEl.textContent = '';
  grid.innerHTML = '';

  try {
    const res = await fetch('/api/search?q=' + encodeURIComponent(description) + '&limit=24');
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const s = data.signals;
    signalsEl.innerHTML = 'Signals: ' +
      '<b>genres</b>=[' + s.genres.join(', ') + '] ' +
      '<b>tropes</b>=[' + s.tropes.join(', ') + '] ' +
      '<b>keywords</b>=[' + s.keywords.slice(0, 8).join(', ') + ']';

    if (data.results.length === 0) {
      statusEl.textContent = 'No matches found. Try a broader description.';
      return;
    }
    statusEl.textContent = data.results.length + ' matches';
    grid.innerHTML = data.results.map(renderCard).join('');
    loadHistory();
  } catch (err) {
    statusEl.textContent = 'Search failed: ' + err.message;
  } finally {
    go.disabled = false;
  }
}

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    const historyEl = document.getElementById('history');
    const listEl = document.getElementById('history-list');
    if (!data.searches || data.searches.length === 0) {
      historyEl.style.display = 'none';
      return;
    }
    listEl.innerHTML = data.searches
      .map((s) => '<span data-q="' + escapeHtml(s.query) + '">' + escapeHtml(s.query) + '</span>')
      .join('');
    listEl.querySelectorAll('span').forEach((el) => {
      el.addEventListener('click', () => { q.value = el.dataset.q; search(); });
    });
    historyEl.style.display = 'block';
  } catch {
    // History is a nice-to-have; a failed fetch here shouldn't disrupt search.
  }
}

function renderCard(book) {
  const cover = book.coverUrl
    ? '<img class="cover" src="' + book.coverUrl + '" alt="" loading="lazy">'
    : '<div class="cover placeholder">No cover</div>';
  const author = book.authors && book.authors[0] ? book.authors[0] : null;
  const chips = [...(book.matchedGenres || []), ...(book.matchedTropes || []), ...(book.matchedKeywords || [])]
    .slice(0, 4).map((c) => '<span class="chip">' + escapeHtml(c) + '</span>').join('');

  return '<div class="card">' + cover +
    '<div class="card-body">' +
      '<div class="score-row">' +
        (book.medium ? '<span class="medium-tag">' + escapeHtml(book.medium) + '</span>' : '<span></span>') +
        '<span class="score">' + book.score + '</span>' +
      '</div>' +
      '<div class="card-title">' + escapeHtml(book.title) + '</div>' +
      '<div class="card-meta">' + (author ? escapeHtml(author) : 'Unknown author') + (book.year ? ' · ' + book.year : '') + '</div>' +
      '<div class="chips">' + chips + '</div>' +
      (book.sourceUrl ? '<a href="' + book.sourceUrl + '" target="_blank" rel="noopener">View source →</a>' : '') +
    '</div></div>';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

go.addEventListener('click', search);
q.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
document.querySelectorAll('.examples span').forEach((el) => {
  el.addEventListener('click', () => { q.value = el.dataset.q; search(); });
});
loadHistory();
</script>
</body>
</html>`;
