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
const uniq = (a) => [...new Set(a)].filter(Boolean).sort();
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// cute per-product icons. Matched on the product name (anchored ^ so e.g. "Regii"
// isn't caught by the "Gii" rule); fruit names get their fruit, the rest get a
// fitting little glyph, with a heart as the catch-all.
const ICONS = [
  [/^lem|^lemmy/i, '🍋'], [/^avo/i, '🥑'], [/^berr/i, '🍓'], [/^lolly/i, '🍭'],
  [/^pixie/i, '🧚'], [/^uno|^just uno/i, '⭐'], [/^namii/i, '🌸'], [/^gii/i, '✨'],
  [/^anii/i, '🌷'], [/^kalii/i, '🌺'], [/^cecii/i, '🌼'], [/^yonii/i, '🌙'],
  [/^evii/i, '💫'], [/^lumii/i, '💡'], [/^surii/i, '🌊'], [/^regii/i, '👑'],
  [/^riin/i, '💍'], [/^ohwii/i, '🐬'], [/^biind/i, '🎀'], [/^together/i, '💞'],
  [/bundle|pack|triple|frutti/i, '🎁'], [/charger|cable/i, '🔌'], [/pouch/i, '👝'],
  [/gift/i, '🎁'], [/panties|socks|necklace|blanket|perfume|lubricant|jelly|warranty|packaging|protect|masterclass|digital|tales|gift card/i, '💝'],
];
const iconFor = (name) => { for (const [re, ic] of ICONS) if (re.test(name || '')) return ic; return '💗'; };

let DATA = { rows: [], summary: {}, generatedAt: '', windowStart: '', windowEnd: '' };
let FILT = { product: '', category: '', subcategory: '', stream: '', manufacturer: '', cFrom: '', cTo: '', eFrom: '', eTo: '', q: '' };
let SORT = { key: 'eventDate', dir: -1 };

const COLS = [
  { key: 'refOrder', label: 'Order' },
  { key: 'stream', label: 'Stream' },
  { key: 'product', label: 'Product' },
  { key: 'category', label: 'Category' },
  { key: 'subcategory', label: 'Reason' },
  { key: 'createdDate', label: 'Ordered' },
  { key: 'eventDate', label: 'Refund/Repl.' },
  { key: 'manufacturer', label: 'Factory' },
  { key: 'lot', label: 'Lot/Batch' },
  { key: 'quote', label: 'Evidence' },
  { key: 'ticketLink', label: 'Ticket' },
];

init();
async function init() {
  try {
    const res = await fetch('./data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    DATA = await res.json();
  } catch (e) {
    $('#sub').textContent = 'Could not load data.json — ' + e.message;
    return;
  }
  DATA.rows = DATA.rows || [];
  const s = DATA.summary || {};
  $('#sub').innerHTML = `Window <b>${esc(DATA.windowStart || '?')}</b> → <b>${esc(DATA.windowEnd || '?')}</b> · `
    + `${(s.refunds ?? '?')} refunds + ${(s.replacements ?? '?')} replacements scanned · `
    + `generated ${esc((DATA.generatedAt || '').slice(0, 16).replace('T', ' '))}`;
  buildFilters();
  render();
}

function buildFilters() {
  const rows = DATA.rows;
  const mk = (key, label, opts, decorate) => el('div', { class: 'field' }, [
    el('label', {}, label),
    el('select', { onchange: (e) => { FILT[key] = e.target.value; if (key === 'category') { FILT.subcategory = ''; } render(); } },
      [el('option', { value: '' }, 'All')].concat(opts.map((o) => el('option', { value: o }, decorate ? decorate(o) : o)))),
  ]);
  const date = (key, label) => el('div', { class: 'field' }, [
    el('label', {}, label),
    el('input', { type: 'date', oninput: (e) => { FILT[key] = e.target.value; render(); } }),
  ]);
  const f = $('#filters');
  f.innerHTML = '';
  f.append(
    mk('product', 'Product', uniq(rows.map((r) => r.product)), (o) => iconFor(o) + ' ' + o),
    mk('category', 'Category', uniq(rows.map((r) => r.category))),
    mk('subcategory', 'Reason', uniq(rows.map((r) => r.subcategory))),
    mk('stream', 'Stream', uniq(rows.map((r) => r.stream))),
    mk('manufacturer', 'Factory', uniq(rows.map((r) => r.manufacturer))),
    date('cFrom', 'Ordered from'), date('cTo', 'Ordered to'),
    date('eFrom', 'Refund/Repl from'), date('eTo', 'Refund/Repl to'),
    el('div', { class: 'field' }, [el('label', {}, 'Search'), el('input', { type: 'search', placeholder: 'order / reason…', oninput: (e) => { FILT.q = e.target.value.toLowerCase(); render(); } })]),
    el('div', { class: 'field' }, [el('label', { html: '&nbsp;' }), el('button', { onclick: resetFilters }, 'Reset')]),
  );
}
function resetFilters() {
  FILT = { product: '', category: '', subcategory: '', stream: '', manufacturer: '', cFrom: '', cTo: '', eFrom: '', eTo: '', q: '' };
  buildFilters();
  render();
}

function applyFilters() {
  return DATA.rows.filter((r) => {
    if (FILT.product && r.product !== FILT.product) return false;
    if (FILT.category && r.category !== FILT.category) return false;
    if (FILT.subcategory && r.subcategory !== FILT.subcategory) return false;
    if (FILT.stream && r.stream !== FILT.stream) return false;
    if (FILT.manufacturer && r.manufacturer !== FILT.manufacturer) return false;
    if (FILT.cFrom && (r.createdDate || '') < FILT.cFrom) return false;
    if (FILT.cTo && (r.createdDate || '') > FILT.cTo) return false;
    if (FILT.eFrom && (r.eventDate || '') < FILT.eFrom) return false;
    if (FILT.eTo && (r.eventDate || '') > FILT.eTo) return false;
    if (FILT.q) {
      const blob = `${r.refOrder} ${r.product} ${r.category} ${r.subcategory} ${r.manufacturer} ${r.quote}`.toLowerCase();
      if (!blob.includes(FILT.q)) return false;
    }
    return true;
  });
}

function render() {
  const rows = applyFilters();
  renderKpis(rows);
  renderBar('#chartProduct', countBy(rows, 'product'), { colorByCat: false, icons: true, labelW: 140 });
  renderReason(rows);
  renderTrend(rows);
  renderFactory(rows);
  renderTable(rows);
}

function countBy(rows, key) {
  const m = new Map();
  for (const r of rows) { const k = r[key] || '—'; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function renderKpis(rows) {
  const def = rows.filter((r) => r.category === 'Product Defect').length;
  const ns = rows.filter((r) => r.category === 'Not Satisfied').length;
  const lem = rows.filter((r) => r.product === 'Lem').length;
  const cards = [
    { n: rows.length, l: 'Product issues (filtered)' },
    { n: def, l: 'Product Defect', cls: 'defect' },
    { n: ns, l: 'Not Satisfied', cls: 'notsat' },
    { n: lem, l: '🍋 Lem issues' },
  ];
  $('#kpis').innerHTML = '';
  for (const c of cards) $('#kpis').append(el('div', { class: 'kpi ' + (c.cls || '') }, [el('div', { class: 'n' }, String(c.n)), el('div', { class: 'l' }, c.l)]));
}

function svg(w, h) { return el('div', { html: `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" font-family="inherit"></svg>` }).firstChild; }

function renderBar(sel, data, opts = {}) {
  const host = $(sel); host.innerHTML = '';
  if (!data.length) { host.append(el('div', { class: 'empty' }, 'No data')); return; }
  const W = 520, rowH = 26, pad = 8, labelW = opts.labelW || 110, max = Math.max(...data.map((d) => d.value), 1);
  const H = pad * 2 + data.length * rowH;
  const s = svg(W, H);
  data.forEach((d, i) => {
    const y = pad + i * rowH;
    const bw = (W - labelW - 60) * (d.value / max);
    const label = opts.icons ? iconFor(d.label) + ' ' + d.label : d.label;
    const fill = opts.colorFor ? (opts.colorFor(d.label) || 'var(--accent)') : (opts.color || 'var(--accent)');
    s.append(mk('text', { x: labelW - 8, y: y + 15, 'text-anchor': 'end', 'font-size': 12, fill: 'var(--ink)' }, label));
    s.append(mk('rect', { x: labelW, y: y + 4, width: Math.max(bw, 1), height: rowH - 12, rx: 4, fill }));
    s.append(mk('text', { x: labelW + Math.max(bw, 1) + 6, y: y + 15, 'font-size': 12, fill: 'var(--muted)' }, String(d.value)));
  });
  host.append(s);
}

function renderReason(rows) {
  const host = $('#chartReason'); host.innerHTML = '';
  const m = new Map(); // subcategory -> {def, ns}
  for (const r of rows) {
    const k = r.subcategory || '—';
    const o = m.get(k) || { def: 0, ns: 0 };
    if (r.category === 'Not Satisfied') o.ns++; else o.def++;
    m.set(k, o);
  }
  const data = [...m.entries()].map(([label, o]) => ({ label, value: o.def + o.ns, def: o.def, ns: o.ns })).sort((a, b) => b.value - a.value);
  if (!data.length) { host.append(el('div', { class: 'empty' }, 'No data')); return; }
  const W = 520, rowH = 26, pad = 8, labelW = 150, max = Math.max(...data.map((d) => d.value), 1);
  const H = pad * 2 + data.length * rowH;
  const s = svg(W, H);
  data.forEach((d, i) => {
    const y = pad + i * rowH, scale = (W - labelW - 60) / max;
    s.append(mk('text', { x: labelW - 8, y: y + 15, 'text-anchor': 'end', 'font-size': 12, fill: 'var(--ink)' }, d.label));
    const dw = d.def * scale, nw = d.ns * scale;
    if (d.def) s.append(mk('rect', { x: labelW, y: y + 4, width: Math.max(dw, 1), height: rowH - 12, rx: 3, fill: 'var(--defect)' }));
    if (d.ns) s.append(mk('rect', { x: labelW + dw, y: y + 4, width: Math.max(nw, 1), height: rowH - 12, rx: 3, fill: 'var(--notsat)' }));
    s.append(mk('text', { x: labelW + dw + nw + 6, y: y + 15, 'font-size': 12, fill: 'var(--muted)' }, String(d.value)));
  });
  host.append(s);
}

const FACTORY_COLORS = { Eryi: '#ff30cc', Liten: '#5b8def', Kings: '#22b07d' };
function renderFactory(rows) {
  const known = rows.filter((r) => r.manufacturer);
  renderBar('#chartFactory', countBy(known, 'manufacturer'), {
    labelW: 72,
    colorFor: (label) => FACTORY_COLORS[label] || 'var(--accent)',
  });
  const note = $('#factoryNote');
  if (note) {
    note.textContent = known.length
      ? `Showing ${known.length} attributed case${known.length === 1 ? '' : 's'} (of ${rows.length} in view).`
      : 'No factory-attributed cases match the current filters.';
  }
}

function isoWeek(dstr) {
  const d = new Date(dstr + 'T00:00:00Z'); if (isNaN(d)) return null;
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - firstThu) / 864e5 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return t.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

function renderTrend(rows) {
  const host = $('#chartTrend'); host.innerHTML = '';
  const weeks = new Map();
  for (const r of rows) {
    const w = isoWeek(r.eventDate || r.createdDate); if (!w) continue;
    const o = weeks.get(w) || { def: 0, ns: 0 };
    if (r.category === 'Not Satisfied') o.ns++; else o.def++;
    weeks.set(w, o);
  }
  const keys = [...weeks.keys()].sort();
  if (keys.length < 1) { host.append(el('div', { class: 'empty' }, 'No data')); return; }
  const data = keys.map((k) => ({ k, ...weeks.get(k) }));
  const W = 1080, H = 240, padL = 36, padB = 46, padT = 12, padR = 12;
  const max = Math.max(...data.map((d) => d.def + d.ns), 1);
  const n = data.length, bw = (W - padL - padR) / n;
  const s = svg(W, H);
  // axes
  for (let g = 0; g <= 4; g++) {
    const yv = Math.round((max * g) / 4), y = (H - padB) - (H - padB - padT) * (g / 4);
    s.append(mk('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: 'var(--line)' }));
    s.append(mk('text', { x: padL - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--muted)' }, String(yv)));
  }
  data.forEach((d, i) => {
    const x = padL + i * bw + bw * 0.18, w = bw * 0.64, scale = (H - padB - padT) / max;
    const dh = d.def * scale, nh = d.ns * scale, base = H - padB;
    if (d.def) s.append(mk('rect', { x, y: base - dh, width: w, height: dh, fill: 'var(--defect)' }));
    if (d.ns) s.append(mk('rect', { x, y: base - dh - nh, width: w, height: nh, fill: 'var(--notsat)' }));
    if (i % Math.ceil(n / 12) === 0 || n <= 12)
      s.append(mk('text', { x: x + w / 2, y: H - padB + 14, 'text-anchor': 'middle', 'font-size': 9.5, fill: 'var(--muted)', transform: `rotate(35 ${x + w / 2} ${H - padB + 14})` }, d.k.replace('2026-', '')));
  });
  host.append(s);
}

function mk(tag, attrs, text) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
}

function renderTable(rows) {
  const sorted = rows.slice().sort((a, b) => {
    const x = a[SORT.key] ?? '', y = b[SORT.key] ?? '';
    return (x < y ? -1 : x > y ? 1 : 0) * SORT.dir;
  });
  $('#count').textContent = `${sorted.length} row${sorted.length === 1 ? '' : 's'}`;
  const thead = $('#table thead'); thead.innerHTML = '';
  thead.append(el('tr', {}, COLS.map((c) => el('th', {
    onclick: () => { SORT.dir = SORT.key === c.key ? -SORT.dir : 1; SORT.key = c.key; renderTable(rows); },
  }, [c.label + ' ', el('span', { class: 'arr' }, SORT.key === c.key ? (SORT.dir > 0 ? '▲' : '▼') : '')]))));
  const tb = $('#table tbody'); tb.innerHTML = '';
  if (!sorted.length) { tb.append(el('tr', {}, el('td', { colspan: COLS.length, class: 'empty' }, 'No rows match the filters'))); return; }
  for (const r of sorted) {
    const cells = COLS.map((c) => {
      if (c.key === 'category') return el('td', {}, el('span', { class: 'tag ' + (r.category === 'Not Satisfied' ? 'notsat' : 'defect') }, r.category || '—'));
      if (c.key === 'stream') return el('td', {}, el('span', { class: 'pill' }, r.stream || '—'));
      if (c.key === 'manufacturer') return el('td', { class: 'mfr' }, r.manufacturer || '');
      if (c.key === 'quote') return el('td', { class: 'wrap' }, r.quote || '');
      if (c.key === 'ticketLink') return el('td', {}, r.ticketLink ? el('a', { href: r.ticketLink, target: '_blank', rel: 'noopener' }, 'open ↗') : '—');
      if (c.key === 'product') return el('td', { class: 'prod' }, r.product ? iconFor(r.product) + ' ' + r.product : '—');
      return el('td', {}, String(r[c.key] ?? ''));
    });
    tb.append(el('tr', {}, cells));
  }
}
