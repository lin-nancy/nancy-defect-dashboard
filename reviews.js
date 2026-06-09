'use strict';

const $ = (s) => document.querySelector(s);
const el = (t, a = {}, kids = []) => {
  const n = document.createElement(t);
  for (const k in a) {
    if (k === 'class') n.className = a[k];
    else if (k === 'html') n.innerHTML = a[k];
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), a[k]);
    else n.setAttribute(k, a[k]);
  }
  for (const c of [].concat(kids)) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());
const monthLabel = (m) => { const [y, mo] = m.split('-'); return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+mo - 1] + " '" + y.slice(2); };

const ICONS = [
  [/^lem|^lemmy/i, '🍋'], [/^avo/i, '🥑'], [/^berr/i, '🍓'], [/^lolly/i, '🍭'],
  [/^pixie/i, '🧚'], [/^uno|^just uno/i, '⭐'], [/^namii/i, '🌸'], [/^gii/i, '✨'],
  [/^anii/i, '🌷'], [/^kalii/i, '🌺'], [/^cecii/i, '🌼'], [/^yonii/i, '🌙'],
  [/^evii/i, '💫'], [/^lumii/i, '💡'], [/^surii/i, '🌊'], [/^regii/i, '👑'],
  [/^riin/i, '💍'], [/^ohwii/i, '🐬'], [/^biind/i, '🎀'], [/^together/i, '💞'],
  [/bundle|pack|triple|frutti|set/i, '🎁'], [/charger|cable/i, '🔌'], [/pouch/i, '👝'],
  [/gift|mystery/i, '🎁'], [/protect|packaging|warranty|tariff/i, '🛡️'],
  [/panties|socks|necklace|blanket|perfume|lubricant|jelly|masterclass|digital|tales|manual|playtime/i, '💝'],
];
const iconFor = (name) => { for (const [re, ic] of ICONS) if (re.test(name || '')) return ic; return '💗'; };

let DATA = { rows: [], months: [] };
let FROM = '', TO = '', SORT = { key: 'reviews', dir: -1 }, Q = '';

init();
async function init() {
  try {
    const res = await fetch('./reviews.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    DATA = await res.json();
  } catch (e) { $('#sub').textContent = 'Could not load reviews.json — ' + e.message; return; }
  DATA.rows = DATA.rows || [];
  FROM = DATA.defaultFrom; TO = DATA.defaultTo;
  $('#banner').innerHTML = `<b>Same-window comparison.</b> ${DATA.note || ''}`;
  const sel = (id, val) => {
    const s = $(id); s.innerHTML = '';
    for (const m of DATA.months) s.append(el('option', { value: m }, monthLabel(m)));
    s.value = val;
    s.addEventListener('change', () => {
      FROM = $('#fFrom').value; TO = $('#fTo').value;
      if (FROM > TO) { TO = FROM; $('#fTo').value = TO; }
      render();
    });
  };
  sel('#fFrom', FROM); sel('#fTo', TO);
  $('#fReset').addEventListener('click', () => { FROM = DATA.defaultFrom; TO = DATA.defaultTo; $('#fFrom').value = FROM; $('#fTo').value = TO; render(); });
  $('#q').addEventListener('input', (e) => { Q = e.target.value.toLowerCase(); renderTable(); });
  render();
}

function months() { return (DATA.months || []).filter((m) => m >= FROM && m <= TO); }
function sumIn(map) { let t = 0; for (const m of months()) t += (map && map[m]) || 0; return t; }

// per-product values within the selected range
function computeRows() {
  return DATA.rows.map((r) => {
    const reviews = sumIn(r.reviewsByMonth);
    const ratingSum = sumIn(r.ratingSumByMonth);
    const unitsSold = sumIn(r.salesByMonth);
    return {
      ...r, reviews, unitsSold,
      avgRating: reviews ? +(ratingSum / reviews).toFixed(2) : 0,
      reviewRate: unitsSold > 0 ? +(reviews / unitsSold * 100).toFixed(1) : null,
    };
  });
}

function render() {
  if (FROM > TO) TO = FROM; // guard
  $('#rangeLabel').textContent = `Showing ${monthLabel(FROM)} → ${monthLabel(TO)}`;
  const rows = computeRows();
  const totReviews = rows.reduce((a, r) => a + r.reviews, 0);
  const totUnits = rows.reduce((a, r) => a + r.unitsSold, 0);
  const reviewed = rows.filter((r) => r.reviews > 0).length;
  $('#sub').innerHTML = `${reviewed} products reviewed · ${fmt(totReviews)} reviews vs ${fmt(totUnits)} units sold · ${monthLabel(FROM)}–${monthLabel(TO)}`;
  const cards = [
    { n: fmt(totReviews), l: '⭐ Reviews received' },
    { n: fmt(totUnits), l: 'Units sold' },
    { n: totUnits ? (totReviews / totUnits * 100).toFixed(1) : '—', l: 'Reviews per 100 sold' },
    { n: fmt(reviewed), l: 'Products reviewed' },
  ];
  $('#kpis').innerHTML = '';
  for (const c of cards) $('#kpis').append(el('div', { class: 'kpi' }, [el('div', { class: 'n' }, String(c.n)), el('div', { class: 'l' }, c.l)]));
  renderReviews(rows);
  renderRate(rows);
  renderTrend();
  renderTable(rows);
}

function svg(w, h) { return el('div', { html: `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" font-family="inherit"></svg>` }).firstChild; }
function mk(tag, attrs, text) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
}
function bar(sel, data, opts = {}) {
  const host = $(sel); host.innerHTML = '';
  if (!data.length) { host.append(el('div', { class: 'empty' }, 'No data in range')); return; }
  const W = 520, rowH = 26, pad = 8, labelW = opts.labelW || 150, valW = opts.valW || 80, max = Math.max(...data.map((d) => d.value), 1);
  const H = pad * 2 + data.length * rowH;
  const s = svg(W, H);
  data.forEach((d, i) => {
    const y = pad + i * rowH, bw = (W - labelW - valW) * (d.value / max);
    s.append(mk('text', { x: labelW - 8, y: y + 15, 'text-anchor': 'end', 'font-size': 12, fill: 'var(--ink)' }, iconFor(d.label) + ' ' + d.label));
    s.append(mk('rect', { x: labelW, y: y + 4, width: Math.max(bw, 1), height: rowH - 12, rx: 4, fill: opts.color || 'var(--accent)' }));
    s.append(mk('text', { x: labelW + Math.max(bw, 1) + 6, y: y + 15, 'font-size': 12, fill: 'var(--muted)' }, opts.fmt ? opts.fmt(d) : String(d.value)));
  });
  host.append(s);
}

function renderReviews(rows) {
  const data = rows.filter((r) => r.reviews > 0).sort((a, b) => b.reviews - a.reviews).slice(0, 15).map((r) => ({ label: r.product, value: r.reviews }));
  bar('#chartReviews', data, { color: 'var(--accent)', fmt: (d) => d.value.toLocaleString() });
}
function renderRate(rows) {
  const data = rows.filter((r) => r.reviewRate != null && r.unitsSold >= 20).sort((a, b) => b.reviewRate - a.reviewRate).slice(0, 15).map((r) => ({ label: r.product, value: r.reviewRate }));
  bar('#chartRate', data, { color: '#5b8def', fmt: (d) => d.value.toFixed(1) + ' / 100' });
}

function renderTrend() {
  const host = $('#chartTrend'); host.innerHTML = '';
  const ms = months();
  if (!ms.length) { host.append(el('div', { class: 'empty' }, 'No data in range')); return; }
  const data = ms.map((m) => ({
    m,
    rev: DATA.rows.reduce((a, r) => a + ((r.reviewsByMonth && r.reviewsByMonth[m]) || 0), 0),
    units: DATA.rows.reduce((a, r) => a + ((r.salesByMonth && r.salesByMonth[m]) || 0), 0),
  }));
  const W = 1040, H = 230, padL = 14, padR = 14, padT = 16, padB = 40;
  const revMax = Math.max(...data.map((d) => d.rev), 1), unitMax = Math.max(...data.map((d) => d.units), 1);
  const n = data.length, gw = (W - padL - padR) / n, plotH = H - padT - padB, base = H - padB;
  const s = svg(W, H);
  data.forEach((d, i) => {
    const gx = padL + i * gw, bw = Math.min(gw * 0.3, 46);
    const rh = (d.rev / revMax) * plotH, uh = (d.units / unitMax) * plotH;
    const x1 = gx + gw / 2 - bw - 3, x2 = gx + gw / 2 + 3;
    s.append(mk('rect', { x: x1, y: base - rh, width: bw, height: Math.max(rh, 1), rx: 3, fill: 'var(--accent)' }));
    s.append(mk('rect', { x: x2, y: base - uh, width: bw, height: Math.max(uh, 1), rx: 3, fill: '#5b8def' }));
    s.append(mk('text', { x: x1 + bw / 2, y: base - rh - 4, 'text-anchor': 'middle', 'font-size': 9.5, fill: 'var(--accent)' }, d.rev.toLocaleString()));
    s.append(mk('text', { x: x2 + bw / 2, y: base - uh - 4, 'text-anchor': 'middle', 'font-size': 9.5, fill: '#5b8def' }, d.units.toLocaleString()));
    s.append(mk('text', { x: gx + gw / 2, y: H - padB + 16, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)' }, monthLabel(d.m)));
  });
  host.append(s);
}

const COLS = [
  { key: 'product', label: 'Product', num: false },
  { key: 'reviews', label: 'Reviews', num: true },
  { key: 'avgRating', label: 'Avg rating', num: true },
  { key: 'unitsSold', label: 'Units sold', num: true },
  { key: 'reviewRate', label: 'Reviews / 100 sold', num: true },
];
function renderTable(rows) {
  rows = rows || computeRows();
  const filtered = rows.filter((r) => (r.reviews > 0 || r.unitsSold > 0) && (!Q || (r.product + ' ' + r.fullTitle).toLowerCase().includes(Q)));
  const sorted = filtered.sort((a, b) => {
    let x = a[SORT.key], y = b[SORT.key];
    if (x == null) x = -1; if (y == null) y = -1;
    if (typeof x === 'string') return x.localeCompare(y) * SORT.dir;
    return (x < y ? -1 : x > y ? 1 : 0) * SORT.dir;
  });
  $('#count').textContent = `${sorted.length} product${sorted.length === 1 ? '' : 's'} · ${monthLabel(FROM)}–${monthLabel(TO)}`;
  const thead = $('#table thead'); thead.innerHTML = '';
  thead.append(el('tr', {}, COLS.map((c) => el('th', {
    class: c.num ? 'num' : '',
    onclick: () => { SORT.dir = SORT.key === c.key ? -SORT.dir : (c.num ? -1 : 1); SORT.key = c.key; renderTable(rows); },
  }, [c.label + ' ', el('span', { class: 'arr' }, SORT.key === c.key ? (SORT.dir > 0 ? '▲' : '▼') : '')]))));
  const tb = $('#table tbody'); tb.innerHTML = '';
  if (!sorted.length) { tb.append(el('tr', {}, el('td', { colspan: COLS.length, class: 'empty' }, 'No products in range'))); return; }
  for (const r of sorted) {
    tb.append(el('tr', {}, [
      el('td', {}, iconFor(r.product) + ' ' + r.product),
      el('td', { class: 'num' }, fmt(r.reviews)),
      el('td', { class: 'num' }, r.avgRating ? r.avgRating + ' ★' : '—'),
      el('td', { class: 'num' }, fmt(r.unitsSold)),
      el('td', { class: 'num' }, r.reviewRate == null ? '—' : r.reviewRate.toFixed(1)),
    ]));
  }
}
