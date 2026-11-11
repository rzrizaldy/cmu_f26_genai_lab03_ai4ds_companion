/* How this lab works: a 60-second isometric film.
   drawFilm(t) is a pure function of time (seconds), so the same code can play live,
   jump to a chapter, or be rendered frame by frame. Numbers come from bundle.js. */
(function () {
  'use strict';
  const D = window.LAB || {};
  const W = 960, H = 540, S = 25, OX = 480, OY = 292, LEN = 60;
  const C = {
    green: ['#89e219', '#58cc02', '#46a302'], blue: ['#84d8ff', '#1cb0f6', '#1480b3'],
    orange: ['#ffc26b', '#ff9600', '#cd7900'], purple: ['#e5b5ff', '#ce82ff', '#a568cc'],
    red: ['#ff9b9b', '#ff4b4b', '#d33131'], gray: ['#ffffff', '#e5e5e5', '#cfcfcf'],
    ink: ['#5b6670', '#3c4650', '#2b333b'], gold: ['#ffe680', '#ffc800', '#e0a800'],
    floor: ['#eef6e4', '#d7e6c8', '#c4d6b2']
  };
  const CHAPTERS = [
    { t: 0, name: 'A reminder goes out', cap: 'Duolingo’s system picks one eligible template at random and sends it to the learner.' },
    { t: 12, name: 'One send = one row', cap: 'Each send becomes one row: what was eligible, what was sent, and whether a lesson finished within 2 hours.' },
    { t: 24, name: 'Mission 1 · Winner', cap: 'Mission 1: compare two templates only where both were possible. The raw winner flips, and C drops out because nobody chose it.' },
    { t: 36, name: 'Mission 2 · Prediction', cap: 'Mission 2: patterns across many sends favor a model we train. Meaning inside review text favors Jev, with zero labels.' },
    { t: 48, name: 'Mission 3 · Launch', cap: 'Mission 3: the policy’s promise shrinks every time we check it honestly. Next step: a controlled test that keeps exploring.' }
  ];

  // ---------- numbers from the bundle, with safe fallbacks
  const rate = (rows, k, f) => { const r = (rows || []).find(x => x.selected_template === k); return r ? r.rate : f; };
  const RAW = { A: rate(D.templates, 'A', .197), G: rate(D.templates, 'G', .091), C: rate(D.templates, 'C', .397) };
  const SHARED = { A: rate(D.pair_table, 'A', .197), G: rate(D.pair_table, 'G', .227) };
  const metric = (name, f) => { const m = (D.metrics || []).find(x => x.model === name); return m ? m['ROC AUC'] : f; };
  const AUC = { xgb: metric('xgboost_engineered', .785), jev: metric('jev', .512) };
  const rb = (D.review_pilot && D.review_pilot.binary_metrics) || [];
  const fullText = rb.filter(m => !m.model || m.model === 'logreg' || /logistic|tfidf_logreg|full/.test(m.model || '')).sort((a, b) => b.training_labels - a.training_labels)[0];
  const jevText = rb.find(m => m.model === 'jev_noul');
  const TXT = { tfidf: fullText ? fullText.roc_auc : .927, jev: jevText ? jevText.roc_auc : .948 };
  const LADDER = (D.policy_ladder || [{ gap_pp: 3.09 }, { gap_pp: .58 }, { gap_pp: -1.19 }]).map(r => r.gap_pp);
  const SENDS = (D.train_rows || 40000) + (D.test_rows || 15000);

  // ---------- helpers
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const back = x => { if (x <= 0) return 0; if (x >= 1) return 1; const c = 1.9, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const lerp = (a, b, x) => a + (b - a) * x;
  const P = (x, y, z) => [OX + (x - y) * S * 0.866, OY + (x + y) * S * 0.5 - z * S];
  const n1 = v => v.toFixed(1);
  const pts = a => a.map(p => n1(p[0]) + ',' + n1(p[1])).join(' ');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const op = o => (o < 1 ? ` opacity="${clamp(o).toFixed(2)}"` : '');

  function box(x, y, z, w, d, h, c, o = 1) {
    h = Math.max(h, 0.001);
    return `<g${op(o)}><polygon points="${pts([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)])}" fill="${c[0]}"/>` +
      `<polygon points="${pts([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)])}" fill="${c[1]}"/>` +
      `<polygon points="${pts([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)])}" fill="${c[2]}"/></g>`;
  }
  function label(x, y, z, s, o = {}) {
    const p = P(x, y, z), size = o.size || 16;
    return `<text x="${n1(p[0] + (o.dx || 0))}" y="${n1(p[1] + (o.dy || 0))}" font-size="${size}" font-weight="900" fill="${o.fill || '#3c4650'}" text-anchor="${o.anchor || 'middle'}"${op(o.o == null ? 1 : o.o)} font-family="Nunito,system-ui,sans-serif">${esc(s)}</text>`;
  }
  function chip(px, py, s, fill, scale = 1, color = '#fff', size = 15) {
    if (scale <= 0.01) return '';
    const w = s.length * size * 0.58 + 22, h = size + 14;
    return `<g transform="translate(${n1(px)} ${n1(py)}) scale(${scale.toFixed(3)})"><rect x="${n1(-w / 2)}" y="${n1(-h / 2)}" width="${n1(w)}" height="${h}" rx="${h / 2}" fill="${fill}"/>` +
      `<rect x="${n1(-w / 2)}" y="${n1(h / 2 - 4)}" width="${n1(w)}" height="4" rx="2" fill="rgba(0,0,0,.15)"/>` +
      `<text y="${n1(size * 0.36)}" font-size="${size}" font-weight="900" fill="${color}" text-anchor="middle" font-family="Nunito,system-ui,sans-serif">${esc(s)}</text></g>`;
  }
  function bubble(px, py, lines, scale, fill = '#fff', stroke = '#e5e5e5', color = '#3c4650') {
    if (scale <= 0.01) return '';
    const w = Math.max(...lines.map(l => l.length)) * 8.6 + 28, h = lines.length * 20 + 18;
    return `<g transform="translate(${n1(px)} ${n1(py)}) scale(${scale.toFixed(3)})"><rect x="${n1(-w / 2)}" y="${-h}" width="${n1(w)}" height="${h}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>` +
      `<polygon points="-9,-1.5 9,-1.5 0,11" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/><rect x="-10" y="-5" width="20" height="5" fill="${fill}"/>` +
      lines.map((l, i) => `<text x="0" y="${-h + 26 + i * 20}" font-size="15" font-weight="800" fill="${color}" text-anchor="middle" font-family="Nunito,system-ui,sans-serif">${esc(l)}</text>`).join('') + '</g>';
  }
  function gear(px, py, r, ang, fill) {
    const p = [];
    for (let i = 0; i < 16; i++) { const a = ang + i * Math.PI / 8, rr = i % 2 ? r * 0.74 : r; p.push([px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.55]); }
    return `<polygon points="${pts(p)}" fill="${fill}"/><ellipse cx="${n1(px)}" cy="${n1(py)}" rx="${n1(r * .3)}" ry="${n1(r * .17)}" fill="#fff"/>`;
  }
  function check(px, py, s) {
    if (s <= 0.01) return '';
    return `<g transform="translate(${n1(px)} ${n1(py)}) scale(${s.toFixed(3)})"><circle r="24" fill="#58cc02"/><circle r="24" cy="3" fill="none"/><path d="M-11 1l7 7 15-15" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  function dice(x, y, z, roll) {
    const c = box(x, y, z, 1.2, 1.2, 1.2, C.orange);
    const t = P(x + .6, y + .6, z + 1.2), pips = [[0, 0], [-.3, -.3], [.3, .3], [-.3, .3], [.3, -.3]].slice(0, 1 + (Math.floor(roll) % 5));
    return c + pips.map(([a, b]) => { const q = P(x + .6 + a, y + .6 + b, z + 1.2); return `<ellipse cx="${n1(q[0])}" cy="${n1(q[1])}" rx="3.2" ry="1.9" fill="#fff"/>`; }).join('') + (t ? '' : '');
  }
  function floor() {
    let s = box(-9, -7, -0.7, 18, 14, 0.7, C.floor);
    for (let i = -8; i <= 8; i += 2) s += `<polyline points="${pts([P(i, -7, 0), P(i, 7, 0)])}" stroke="#dbe9cc" stroke-width="1.2"/>`;
    for (let j = -6; j <= 6; j += 2) s += `<polyline points="${pts([P(-9, j, 0), P(9, j, 0)])}" stroke="#dbe9cc" stroke-width="1.2"/>`;
    return s;
  }
  function phone(z, o = 1) {
    let s = box(-1.6, -1.2, z, 3.2, 5, .45, C.ink, o);
    s += `<polygon points="${pts([P(-1.3, -.9, z + .46), P(1.3, -.9, z + .46), P(1.3, 3.5, z + .46), P(-1.3, 3.5, z + .46)])}" fill="#f7f7f7"${op(o)}/>`;
    return s;
  }
  function stamp(tt) { return `<text x="${W - 22}" y="${H - 18}" font-size="13" font-weight="800" fill="#9aa6b0" text-anchor="end" font-family="Nunito,system-ui,sans-serif">${Math.floor(tt / 60)}:${String(Math.floor(tt % 60)).padStart(2, '0')} / 1:00</text>`; }
  function title(i, u) {
    const s = back(seg(u, 0, .6));
    return chip(110 + CHAPTERS[i].name.length * 2.8, 46, CHAPTERS[i].name, ['#58cc02', '#1cb0f6', '#58cc02', '#ce82ff', '#ff9600'][i], s, '#fff', 18);
  }

  // ---------- scenes (u = seconds inside the scene, 0..12)
  function scene1(u) {
    let s = '';
    const drop = back(seg(u, 0, 1.1));
    s += phone((1 - drop) * 5, clamp(u * 2));
    const tiles = ['A', 'G', 'L'];
    const pick = 1;
    tiles.forEach((k, i) => {
      const appear = back(seg(u, 1 + i * .3, 1.9 + i * .3));
      const chosen = i === pick, mv = easeOut(seg(u, 6, 7.4));
      let x = -2.9 + i * 2.1, y = -1.6, z = 3.8 + Math.sin(u * 2 + i) * .18;
      if (chosen && u > 6) { x = lerp(x, -.5, mv); y = lerp(y, .9, mv); z = lerp(z, .5, mv); }
      const o = chosen ? 1 : (u > 5.6 ? lerp(1, .3, seg(u, 5.6, 6.2)) : 1);
      const col = chosen && u > 5.4 ? C.green : C.gray;
      if (appear > 0 && !(chosen && u > 7.4)) {
        s += box(x, y, z * appear, 1, 1, 1, col, o * clamp(appear));
        s += label(x + .5, y + .5, z * appear + 1, k, { dy: 6, size: 15, o: o * clamp(appear), fill: chosen && u > 5.4 ? '#fff' : '#4b4b4b' });
      }
    });
    if (u > 1.4) s += label(-.4, -1.1, 6.6, 'eligible templates', { size: 14, fill: '#7a8794', o: seg(u, 1.4, 2) * (1 - seg(u, 9, 10)) });
    if (u > 2.4) {
      const r = seg(u, 2.6, 5.6), bounce = Math.abs(Math.sin(r * Math.PI * 4)) * (1 - r) * 2;
      s += dice(4.6, -1.4, bounce * back(seg(u, 2.4, 3)), u * 3);
      s += label(5.2, -.8, 2.6 + bounce, 'random pick', { size: 14, fill: '#cd7900', o: seg(u, 2.6, 3.2) });
    }
    if (u > 7.4) {
      const bp = P(0, 1.2, .5);
      s += bubble(bp[0], bp[1] - 40, ['Practice reminder', 'Time for a quick lesson!'], back(seg(u, 7.4, 8.2)), '#58cc02', '#46a302', '#fff');
    }
    return s;
  }
  function scene2(u) {
    let s = phone(0);
    const c = P(0, 1.2, .5), cx = c[0] - 120, cy = c[1] - 70;
    const sweep = easeOut(seg(u, .3, 4));
    if (u < 7) {
      const a = sweep * 2 * Math.PI, x2 = cx + 34 * Math.sin(a), y2 = cy - 34 * Math.cos(a);
      s += `<g${op(1 - seg(u, 6, 7))}><circle cx="${cx}" cy="${cy}" r="38" fill="#fff" stroke="#e5e5e5" stroke-width="4"/>` +
        `<path d="M${cx} ${cy - 34} A34 34 0 ${a > Math.PI ? 1 : 0} 1 ${n1(x2)} ${n1(y2)}" fill="none" stroke="#1cb0f6" stroke-width="8" stroke-linecap="round"/>` +
        `<text x="${cx}" y="${cy + 6}" font-size="17" font-weight="900" fill="#3c4650" text-anchor="middle" font-family="Nunito,system-ui,sans-serif">${(sweep * 2).toFixed(1)} h</text></g>`;
      s += label(0, 1.2, .5, 'lesson finished within 2 hours?', { dy: -150, dx: -120, size: 15, o: seg(u, .3, 1) * (1 - seg(u, 6, 7)) });
    }
    s += check(c[0] + 10, c[1] - 30, back(seg(u, 4.3, 5)) * (1 - seg(u, 6.5, 7)));
    // database
    for (let i = 0; i < 3; i++) s += box(4.4, -4.4, i * .9, 2.6, 2.6, .7, C.blue, clamp(seg(u, 4.6, 5.4)));
    s += label(5.7, -3.1, 2.6, Math.round(SENDS * easeOut(seg(u, 5, 11))).toLocaleString() + ' sends', { dy: -10, size: 16, o: seg(u, 5, 5.6) });
    for (let k = 0; k < 12; k++) {
      const p = seg(u, 5.2 + k * .45, 6.6 + k * .45);
      if (p <= 0 || p >= 1) continue;
      const x = lerp(-.3, 5.4, p), y = lerp(1, -3.4, p), z = .6 + Math.sin(Math.PI * p) * 3;
      s += box(x, y, z, .55, .55, .55, k % 3 === 0 ? C.green : C.gray);
    }
    if (u > 6.5) {
      const p = P(-5, 3, 0);
      s += bubble(p[0], p[1] - 40, ['eligible: A, G, L', 'sent: G', 'lesson in 2 h: yes'], back(seg(u, 6.5, 7.3)));
    }
    return s;
  }
  function tower(x, y, h, col, letter, val, o, sz = 1.4) {
    return box(x, y, 0, sz, sz, h, col, o) + label(x + sz / 2, y + sz / 2, h, letter, { dy: -12, size: 18, o }) + label(x + sz / 2, y + sz / 2, h, val, { dy: -32, size: 15, fill: '#5b6670', o });
  }
  function scene3(u) {
    let s = '';
    const k = 15;
    const grow = easeOut(seg(u, .4, 2.4)), flip = easeOut(seg(u, 6.6, 8.6));
    const shared = u > 6.2;
    const a = RAW.A * k * grow, g = lerp(RAW.G, SHARED.G, flip) * k * grow;
    const cOp = 1 - seg(u, 5, 6);
    if (cOp > 0) s += tower(3.2, -.5, RAW.C * k * easeOut(seg(u, 1, 3)), C.orange, 'C', (RAW.C * 100).toFixed(1) + '%', cOp);
    s += tower(-3.6, -.5, a, C.green, 'A', (RAW.A * 100).toFixed(1) + '%', 1);
    s += tower(-.2, -.5, g, C.blue, 'G', (lerp(RAW.G, SHARED.G, flip) * 100).toFixed(1) + '%', 1);
    if (u > 3.2 && cOp > 0) { const p = P(3.9, .2, RAW.C * k); s += chip(p[0] + 70, p[1] + 10, 'only option · no choice made', '#ff9600', back(seg(u, 3.2, 3.9)) * cOp, '#fff', 14); }
    const mode = shared ? 'only where A and G were both eligible' : 'raw rates, all sends';
    s += chip(OX, 98, mode, shared ? '#1cb0f6' : '#afafaf', back(seg(u, shared ? 6.2 : .3, shared ? 6.8 : .9)), '#fff', 16);
    if (u > 9.2) {
      const d = (SHARED.A - SHARED.G) * 100;
      s += chip(OX, H - 70, `A minus G: ${d.toFixed(1)} pp · interval crosses 0`, '#3c4650', back(seg(u, 9.2, 9.9)), '#fff', 16);
    }
    return s;
  }
  function machine(x, y, col, name, u, kind) {
    let s = box(x, y, 0, 2.8, 2.8, 2.2, col);
    const top = P(x + 1.4, y + 1.4, 2.2);
    if (kind === 'gear') s += gear(top[0], top[1], 22, u * 2, '#fff');
    else s += `<path transform="translate(${n1(top[0] - 11)} ${n1(top[1] - 22)}) scale(1.3)" d="M10 0 1 11h6l-1.5 8 9.5-11.5H9z" fill="#ffc800" stroke="#e0a800" stroke-width="1.2"/>`;
    return s;
  }
  function scene4(u) {
    let s = '';
    const textPhase = u > 6.4;
    s += machine(-4.4, 1.4, C.blue, textPhase ? 'trained text model' : 'XGBoost (trained)', u, 'gear');
    s += machine(1.6, -4.2, C.purple, 'Jev (zero labels)', u, 'bolt');
    s += chip(OX, 98, textPhase ? 'Input: review text' : 'Input: behavior logs', textPhase ? '#ce82ff' : '#1cb0f6', back(seg(u, textPhase ? 6.4 : .2, textPhase ? 7 : .8)), '#fff', 17);
    for (let k = 0; k < 8; k++) {
      const base = textPhase ? 6.8 : .6, p = seg(u, base + k * .42, base + 1.4 + k * .42);
      if (p <= 0 || p >= 1) continue;
      const toJev = k % 2 === 1, sx = 5.5, sy = 5.5;
      const tx = toJev ? 3 : -3, ty = toJev ? -2.8 : 2.8;
      const x = lerp(sx, tx, p), y = lerp(sy, ty, p), z = lerp(.3, 2.4, p) + Math.sin(Math.PI * p) * 1.8;
      if (!textPhase) s += box(x, y, z, .6, .6, .6, C.gray);
      else { const q = P(x, y, z); s += bubble(q[0], q[1], ['“the ads…”'], .7); }
    }
    s += label(-4.4 + 1.4, 1.4 + 2.8, 0, textPhase ? 'trained text model' : 'XGBoost (trained)', { dy: 26, dx: -14, size: 15 });
    s += label(1.6 + 1.4, -4.2 + 2.8, 0, 'Jev (zero labels)', { dy: 26, dx: -14, size: 15 });
    const pX = P(-3, 2.8, 2.2), pJ = P(3, -2.8, 2.2);
    if (!textPhase) {
      s += chip(pX[0], pX[1] - 64, 'AUC ' + AUC.xgb.toFixed(2), '#58cc02', back(seg(u, 4, 4.6)) * (1 - seg(u, 6, 6.4)));
      s += chip(pJ[0], pJ[1] - 64, 'AUC ' + AUC.jev.toFixed(2), '#afafaf', back(seg(u, 4.4, 5)) * (1 - seg(u, 6, 6.4)));
    } else {
      s += chip(pX[0], pX[1] - 64, 'AUC ' + TXT.tfidf.toFixed(2), '#afafaf', back(seg(u, 10, 10.6)));
      s += chip(pJ[0], pJ[1] - 64, 'AUC ' + TXT.jev.toFixed(2), '#58cc02', back(seg(u, 10.4, 11)));
    }
    return s;
  }
  function scene5(u) {
    let s = '';
    const baseH = 3.2, names = ['rate table says', 'same data, honest check', 'later data'];
    const XY = [[-4.6, 2.2], [-1.6, -.8], [1.4, -3.8]];
    const lineO = seg(u, .2, .8);
    s += `<polyline points="${pts([P(-5.8, 3.4, baseH), P(3.8, -6.2, baseH)])}" stroke="#e0a800" stroke-width="3" stroke-dasharray="8 6"${op(lineO)}/>`;
    s += label(3.8, -6.2, baseH, 'random sends', { anchor: 'start', dx: 10, dy: 4, size: 14, fill: '#cd7900', o: lineO });
    LADDER.forEach((g, i) => {
      const p = back(seg(u, .8 + i * 2.2, 1.8 + i * 2.2));
      if (p <= 0) return;
      const h = Math.max(.3, baseH + g * .9) * p;
      const [tx, ty] = XY[i];
      s += box(tx, ty, 0, 1.6, 1.6, h, g >= 0 ? C.green : C.red, clamp(p));
      s += label(tx + .8, ty + .8, h, (g > 0 ? '+' : '') + g.toFixed(1) + ' pp', { dy: -12, size: 17, fill: g >= 0 ? '#46a302' : '#d33131', o: clamp(p) });
      s += label(tx + 1.6, ty + 1.6, 0, names[i], { dy: 24, size: 13, fill: '#5b6670', o: clamp(p) });
    });
    if (u > 7.6) {
      const r = seg(u, 7.6, 11);
      s += dice(8.2, 1.2, Math.abs(Math.sin(r * Math.PI * 5)) * (1 - r) * 1.6, u * 3);
      const q = P(8.8, 1.8, 1.4);
      s += bubble(q[0] + 150, q[1] + 20, ['Next: a controlled test', 'that keeps exploring'], back(seg(u, 8, 8.8)));
    }
    return s;
  }
  const SCENES = [scene1, scene2, scene3, scene4, scene5];

  function drawFilm(t) {
    t = clamp(t, 0, LEN);
    const i = Math.min(4, Math.floor(t / 12)), u = t - i * 12;
    const fadeIn = seg(u, 0, .35), fadeOut = i < 4 ? 1 - seg(u, 11.6, 12) : 1;
    return `<rect width="${W}" height="${H}" fill="#fbfdf8"/>` +
      `<g>${floor()}</g><g opacity="${(fadeIn * fadeOut).toFixed(2)}">${SCENES[i](u)}</g>` + title(i, u) + stamp(t);
  }

  // ---------- player wiring
  function init() {
    const svg = document.getElementById('film-svg');
    if (!svg) return;
    const play = document.getElementById('film-play'), scrub = document.getElementById('film-scrub'),
      cap = document.getElementById('film-cap'), chaps = document.getElementById('film-chapters'),
      wrap = document.getElementById('film'), expand = document.getElementById('film-expand');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let t = 9, playing = false, last = 0, raf = 0;
    CHAPTERS.forEach((c, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = (i + 1) + ' · ' + c.name;
      b.onclick = () => { seek(reduced ? c.t + 11.9 : c.t + .01); if (!reduced) start(); };
      chaps.append(b);
    });
    function render() {
      svg.innerHTML = drawFilm(t);
      scrub.value = t.toFixed(1);
      const i = Math.min(4, Math.floor(t / 12));
      cap.textContent = (i + 1) + ' · ' + CHAPTERS[i].cap;
      [...chaps.children].forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    }
    function frame(now) {
      if (!playing) return;
      const dt = Math.min(.5, (now - last) / 1000); last = now;
      t += dt;
      if (t >= LEN) { t = LEN; stop(); play.textContent = '↻ Replay'; }
      render();
      if (playing) raf = requestAnimationFrame(frame);
    }
    function start() { if (t >= LEN) t = 0; playing = true; play.textContent = '❚❚ Pause'; wrap.classList.add('open'); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    function stop() { playing = false; cancelAnimationFrame(raf); play.textContent = '▶ Play'; }
    function seek(v) { t = clamp(+v, 0, LEN); render(); }
    play.onclick = () => (playing ? stop() : start());
    scrub.oninput = () => { stop(); seek(scrub.value); };
    function setFull(on) { wrap.classList.toggle('full', on); expand.textContent = on ? '✕ Close' : '⤢ Expand'; document.body.style.overflow = on ? 'hidden' : ''; }
    expand.onclick = () => { const on = !wrap.classList.contains('full'); setFull(on); if (on && !playing && !reduced) start(); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && wrap.classList.contains('full')) setFull(false); });
    render();
  }
  window.LabFilm = { drawFilm, CHAPTERS, LEN };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
