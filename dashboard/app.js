// Depth Radar dashboard: renders window.RADAR (written by main.ts) with no network.
//
// Views, all hash-routed so each screenshot state is a plain URL:
//   #/            the board
//   #/p/<slug>    one protocol's detail view and farm plan
//   #/?category=Dexs&sort=depth&watchlist=1   a filtered view
// The model sandbox re-runs the depth formula in the page: moving a slider
// re-scores every row from the snapshot's own figures and re-sorts the board.
(function () {
  var D = window.RADAR;
  var rows = D.rows.slice();
  var live = D.live.slice();
  var M = D.model;

  function $(id) { return document.getElementById(id); }
  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
    return s;
  }
  function ageFmt(a) {
    if (a === null || a === undefined) return '—';
    if (a < 30) return a + 'd';
    if (a < 365) return Math.round(a / 30) + 'mo';
    return (a / 365).toFixed(1) + 'y';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- header stats -------------------------------------------------------
  var pre = rows.length;
  $('stats').innerHTML =
    '<div class="stat"><b>' + pre + '</b><span>ranked</span></div>' +
    '<div class="stat"><b>' + D.watchlist_size + '</b><span>watchlist</span></div>' +
    '<div class="stat"><b>' + D.early_size + '</b><span>early finds</span></div>' +
    '<div class="stat"><b>' + D.live_size + '</b><span>already live</span></div>';
  $('model-version').textContent = 'model ' + D.model_version;
  $('formula').textContent =
    'implied = TVL x 0.25 x depthMult x breadthMult x growthMult x tenureMult    ' +
    'depth = TVL / chains, depthMult 0.75-1.25 from log10(depth / $1M)';
  $('model-note').textContent =
    'Snapshot ' + D.as_of + ' · floor $' + (D.floor_usd / 1e6) + 'M · ' + D.rows.length +
    ' rows scored from TVL, chains, 7-day change and listing date. Sliders re-score live; reset restores the submitted model.';
  $('source-line').textContent = 'Source: ' + D.source + ' · as of ' + D.as_of + '.';

  // ---- depth chart: top 10 by depth per chain ----------------------------
  var topDepth = rows.slice().sort(function (a, b) { return b.depth_usd - a.depth_usd; }).slice(0, 10);
  var maxDepth = topDepth.length ? topDepth[0].depth_usd : 1;
  $('depth-chart').innerHTML = topDepth.map(function (r) {
    var w = Math.max(2, Math.round((r.depth_usd / maxDepth) * 100));
    return '<div class="depth-row"><span>' + esc(r.name) + '</span>' +
      '<span class="bar"><i style="width:' + w + '%"></i></span>' +
      '<span class="val">' + money(r.depth_usd) + ' / chain</span></div>';
  }).join('');

  // ---- live-token strip ----------------------------------------------------
  $('live-grid').innerHTML = live.map(function (p) {
    var ratio = p.mcap_usd ? (p.tvl_usd / p.mcap_usd).toFixed(2) : '—';
    return '<div class="live"><b>' + esc(p.name) + '</b>' +
      '<span>mcap ' + (p.mcap_usd ? money(p.mcap_usd) : '—') + ' · TVL ' + money(p.tvl_usd) + '</span>' +
      '<span>TVL / mcap ' + ratio + ' · 7d ' + pct(p.change_7d) + '</span></div>';
  }).join('');

  // ---- filter controls -----------------------------------------------------
  var cats = [], chains = [];
  rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  $('category').innerHTML += cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  $('chain').innerHTML += chains.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');

  // ---- model sandbox -------------------------------------------------------
  var depthW = 1, growthW = 1;
  function rescore(r) {
    var depthPart = 1 + (r.depth_multiplier - 1) * depthW;
    var growthPart = 1 + (r.growth_multiplier - 1) * growthW;
    return Math.max(1, Math.round(r.tvl_usd * M.base_multiple * depthPart * r.breadth_multiplier * growthPart * r.tenure_multiplier));
  }
  function currentRows() {
    return rows.map(function (r) {
      var c = Object.assign({}, r);
      c.implied_value_usd = rescore(r);
      return c;
    });
  }

  function filtered() {
    var q = ($('search').value || '').toLowerCase();
    var cat = $('category').value, ch = $('chain').value;
    var minTvl = +$('min-tvl').value, wl = $('watchlist-only').checked;
    // Watchlist-only is exact as a TVL test: every watchlist row sits at or
    // above the floor, and every early row was chosen below it.
    var list = currentRows().filter(function (r) {
      if (q && (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0)) return false;
      if (cat && r.category !== cat) return false;
      if (ch && r.chains.indexOf(ch) < 0) return false;
      if (minTvl && r.tvl_usd < minTvl) return false;
      if (wl && r.tvl_usd < D.floor_usd) return false;
      return true;
    });
    var sort = $('sort').value;
    var key = { implied: 'implied_value_usd', tvl: 'tvl_usd', depth: 'depth_usd', growth: 'change_7d', age: 'age_days' }[sort];
    list.sort(function (a, b) {
      var av = a[key], bv = b[key];
      if (av === null || av === undefined) av = -Infinity;
      if (bv === null || bv === undefined) bv = -Infinity;
      return bv - av || (a.slug < b.slug ? -1 : 1);
    });
    return list;
  }

  function renderBoard() {
    var list = filtered();
    var maxImp = list.length ? list[0].implied_value_usd : 1;
    $('board-count').textContent = list.length + ' of ' + rows.length + ' protocols';
    $('board-title').textContent = $('watchlist-only').checked ? 'The board — at or above the $50M floor' : 'The board';
    $('board-body').innerHTML = list.map(function (r, i) {
      var w = Math.max(2, Math.round((r.implied_value_usd / maxImp) * 100));
      var g = r.change_7d;
      var gCls = g === null ? '' : (g >= 0 ? 'up' : 'down');
      var rankShown = (depthW === 1 && growthW === 1 && $('sort').value === 'implied') ? r.rank : (i + 1);
      return '<tr data-slug="' + esc(r.slug) + '"><td>' + rankShown + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span><span class="slug">' + esc(r.slug) +
        (r.tvl_usd >= D.floor_usd ? ' <span class="tag wl">watchlist</span>' : '') + '</span></td>' +
        '<td><span class="tag">' + esc(r.category || '—') + '</span></td>' +
        '<td>' + esc(r.chains.slice(0, 2).join(', ')) + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + money(r.depth_usd) + '</td>' +
        '<td class="num ' + gCls + '">' + pct(g) + '</td>' +
        '<td class="num">' + ageFmt(r.age_days) + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b><span class="implied-bar"><i style="width:' + w + '%"></i></span></td></tr>';
    }).join('');
  }

  function renderDetail(slug) {
    var box = $('detail');
    var r = rows.filter(function (x) { return x.slug === slug; })[0];
    if (!r) { box.hidden = true; box.innerHTML = ''; return; }
    var v = rescore(r);
    box.hidden = false;
    box.innerHTML =
      '<h2>' + esc(r.name) + ' <span class="pill">rank #' + r.rank + ' · pre-token</span></h2>' +
      '<p class="muted">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ') || 'no chain listed') +
      ' · listed ' + esc(r.listed_at || 'unknown') + ' · snapshot ' + D.as_of + '</p>' +
      '<div class="grid">' +
      '<div class="kv"><span>Implied value</span><b>' + money(v) + '</b></div>' +
      '<div class="kv"><span>TVL</span><b>' + money(r.tvl_usd) + '</b></div>' +
      '<div class="kv"><span>Depth / chain</span><b>' + money(r.depth_usd) + '</b></div>' +
      '<div class="kv"><span>Depth multiplier</span><b>' + r.depth_multiplier.toFixed(2) + 'x</b></div>' +
      '<div class="kv"><span>Breadth multiplier</span><b>' + r.breadth_multiplier.toFixed(2) + 'x</b></div>' +
      '<div class="kv"><span>Growth multiplier</span><b>' + r.growth_multiplier.toFixed(2) + 'x (' + pct(r.change_7d) + ' 7d)</b></div>' +
      '<div class="kv"><span>Tenure multiplier</span><b>' + r.tenure_multiplier.toFixed(2) + 'x (' + ageFmt(r.age_days) + ' old)</b></div>' +
      '<div class="kv"><span>Token status</span><b>No token trades yet</b></div>' +
      '</div>' +
      '<h2>How to farm it</h2>' +
      '<ol class="steps">' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<p class="muted small" style="margin-top:12px">Implied value is this entry\u2019s own claim from the snapshot\u2019s figures, not a prediction that a token is issued. ' +
      '<a href="#/">Back to the board</a></p>';
  }

  // ---- routing --------------------------------------------------------------
  function route() {
    var h = location.hash || '#/';
    var m = h.match(/^#\/p\/([A-Za-z0-9._-]+)/);
    document.body.classList.toggle('detail-mode', !!m);
    if (m) { renderDetail(m[1]); return; }
    $('detail').hidden = true;
    var q = h.match(/^#\/\?(.*)/);
    if (q) {
      var params = new URLSearchParams(q[1]);
      if (params.get('category')) $('category').value = params.get('category');
      if (params.get('chain')) $('chain').value = params.get('chain');
      if (params.get('sort')) $('sort').value = params.get('sort');
      if (params.get('min_tvl')) $('min-tvl').value = params.get('min_tvl');
      if (params.get('watchlist')) $('watchlist-only').checked = params.get('watchlist') === '1';
      if (params.get('q')) $('search').value = params.get('q');
    }
    renderBoard();
  }

  // ---- events ---------------------------------------------------------------
  ['search', 'category', 'chain', 'min-tvl', 'sort', 'watchlist-only'].forEach(function (id) {
    $(id).addEventListener('input', renderBoard);
    $(id).addEventListener('change', renderBoard);
  });
  $('board-body').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) location.hash = '#/p/' + tr.getAttribute('data-slug');
  });
  $('depth-weight').addEventListener('input', function (e) {
    depthW = +e.target.value / 100;
    $('depth-weight-val').textContent = depthW.toFixed(2);
    renderBoard();
  });
  $('growth-weight').addEventListener('input', function (e) {
    growthW = +e.target.value / 100;
    $('growth-weight-val').textContent = growthW.toFixed(2);
    renderBoard();
  });
  $('reset-model').addEventListener('click', function () {
    depthW = 1; growthW = 1;
    $('depth-weight').value = 100; $('growth-weight').value = 100;
    $('depth-weight-val').textContent = '1.00'; $('growth-weight-val').textContent = '1.00';
    renderBoard();
  });
  window.addEventListener('hashchange', route);
  route();
})();
