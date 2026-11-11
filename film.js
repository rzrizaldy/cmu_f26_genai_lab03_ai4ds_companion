/* How this lab works: a 60-second flat, bouncy animation with original characters.
   drawFilm(t) is a pure function of time (seconds), so the same code can play live,
   jump to a chapter, or be rendered frame by frame. Numbers come from bundle.js. */
(function () {
  'use strict';
  const D = window.LAB || {};
  const W = 960, H = 540, LEN = 60, GROUND = 432;
  const K = {
    green: '#58cc02', greenLip: '#46a302', blue: '#1cb0f6', blueLip: '#1899d6', orange: '#ff9600', orangeLip: '#cd7900',
    purple: '#ce82ff', purpleLip: '#a568cc', red: '#ff4b4b', redLip: '#d33131', gold: '#ffc800', goldLip: '#e0a800',
    ink: '#3c3c3c', gray: '#e5e5e5', grayLip: '#cecece', muted: '#777', skin: '#f5c4a0', hair: '#4b3426'
  };
  const CHAPTERS = [
    { t: 0, name: 'A reminder goes out', cap: 'Duolingo picks one eligible reminder at random and sends it.' },
    { t: 12, name: 'One send = one row', cap: 'Each send becomes a row: what was eligible, what was sent, and whether a lesson followed within 2 hours.' },
    { t: 24, name: 'Mission 1 · Winner', cap: 'Compare A and G only where both were possible. The raw winner flips, and C drops out.' },
    { t: 36, name: 'Mission 2 · Prediction', cap: 'On send logs, the model we train wins. On review text, Jev wins with zero labels.' },
    { t: 48, name: 'Mission 3 · Launch', cap: 'The policy’s promise shrinks each time we check honestly. Next: a controlled test.' }
  ];

  // ---------- numbers from the bundle, with fallbacks
  const rate = (rows, k, f) => { const r = (rows || []).find(x => x.selected_template === k); return r ? r.rate : f; };
  const RAW = { A: rate(D.templates, 'A', .197), G: rate(D.templates, 'G', .091), C: rate(D.templates, 'C', .397) };
  const SHARED = { A: rate(D.pair_table, 'A', .197), G: rate(D.pair_table, 'G', .227) };
  const metric = (name, f) => { const m = (D.metrics || []).find(x => x.model === name); return m ? m['ROC AUC'] : f; };
  const AUC = { xgb: metric('xgboost_engineered', .785), jev: metric('jev', .512) };
  const rb = (D.review_pilot && D.review_pilot.binary_metrics) || [];
  const full = rb.filter(m => /tfidf_logreg/.test(m.model || '')).sort((a, b) => b.training_labels - a.training_labels)[0];
  const jn = rb.find(m => m.model === 'jev_noul');
  const TXT = { tfidf: full ? full.roc_auc : .927, jev: jn ? jn.roc_auc : .948 };
  const LADDER = (D.policy_ladder || [{ gap_pp: 3.09 }, { gap_pp: .58 }, { gap_pp: -1.19 }]).map(r => r.gap_pp);
  const SENDS = (D.train_rows || 40000) + (D.test_rows || 15000);

  // ---------- easing and svg helpers
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const inOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const back = x => { if (x <= 0) return 0; if (x >= 1) return 1; const c = 2.2, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const lerp = (a, b, x) => a + (b - a) * x;
  const n = v => (+v).toFixed(1);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const G = (x, y, inner, o = {}) => {
    const sx = o.sx ?? o.s ?? 1, sy = o.sy ?? o.s ?? 1, op = o.o ?? 1;
    if (sx <= 0.005 || sy <= 0.005 || op <= 0.005) return '';
    return `<g transform="translate(${n(x)} ${n(y)})${o.r ? ` rotate(${n(o.r)})` : ''} scale(${sx.toFixed(3)} ${sy.toFixed(3)})"${op < 1 ? ` opacity="${op.toFixed(2)}"` : ''}>${inner}</g>`;
  };
  const rr = (x, y, w, h, r, fill, extra = '') => `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.max(0, w))}" height="${n(Math.max(0, h))}" rx="${n(r)}" fill="${fill}"${extra}/>`;
  const lip = (x, y, w, h, r, top, bottom, d = 6) => rr(x, y + d, w, h, r, bottom) + rr(x, y, w, h, r, top, top === '#fff' ? ` stroke="${K.gray}" stroke-width="3"` : '');
  const txt = (x, y, s, size = 18, fill = K.ink, anchor = 'middle', weight = 900, o = 1) =>
    `<text x="${n(x)}" y="${n(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${o < 1 ? ` opacity="${clamp(o).toFixed(2)}"` : ''} font-family="Nunito,system-ui,sans-serif">${esc(s)}</text>`;
  function chip(x, y, s, fill, lipc, scale = 1, size = 17, color = '#fff') {
    const w = s.length * size * .56 + 30, h = size + 18;
    return G(x, y, lip(-w / 2, -h / 2, w, h, h / 2, fill, lipc, 4) + txt(0, size * .36, s, size, color), { s: scale });
  }
  function bubble(x, y, lines, scale, fill = '#fff', stroke = K.gray, color = K.ink, size = 17) {
    const w = Math.max(...lines.map(l => l.length)) * size * .52 + 34, h = lines.length * (size + 6) + 22;
    const inner = `<rect x="${n(-w / 2)}" y="${-h}" width="${n(w)}" height="${h}" rx="18" fill="${fill}" stroke="${stroke}" stroke-width="3"/>` +
      `<path d="M-12 -1.5 L0 14 L12 -1.5" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/><rect x="-13" y="-6" width="26" height="6" fill="${fill}"/>` +
      lines.map((l, i) => txt(0, -h + 14 + (i + 1) * (size + 6) - 6, l, size, color, 'middle', 800)).join('');
    return G(x, y, inner, { s: scale });
  }
  function confetti(x, y, p, count = 18) {
    if (p <= 0 || p >= 1) return '';
    const cols = [K.green, K.blue, K.orange, K.purple, K.gold, K.red];
    let s = '';
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + i, d = 40 + (i % 5) * 22;
      const px = x + Math.cos(a) * d * easeOut(p), py = y + Math.sin(a) * d * easeOut(p) + 90 * p * p;
      s += G(px, py, rr(-5, -5, 10, 10, 3, cols[i % cols.length]), { r: p * 540 + i * 40, o: 1 - p });
    }
    return s;
  }
  function checkBadge(x, y, s) {
    return G(x, y, `<circle r="34" cy="5" fill="${K.greenLip}"/><circle r="34" fill="${K.green}"/><path d="M-15 1 l10 10 l21 -22" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`, { s });
  }

  // ---------- original characters
  function learner(x, y, t, o = {}) {
    // origin at the feet; o.mood: 'smile' | 'wow' | 'worry'; o.hop: pixels up; o.phone: screen content
    const hop = o.hop || 0;
    const blink = (t % 3.4) < .12 ? .12 : 1;
    const mouth = o.mood === 'wow' ? `<ellipse cx="0" cy="-118" rx="9" ry="11" fill="#7a2e2e"/>`
      : o.mood === 'worry' ? `<path d="M-12 -112 q12 -10 24 0" fill="none" stroke="${K.ink}" stroke-width="5" stroke-linecap="round"/>`
        : `<path d="M-15 -122 q15 16 30 0" fill="#7a2e2e" stroke="#7a2e2e" stroke-width="3" stroke-linejoin="round"/>`;
    const brows = o.mood === 'wow' || o.mood === 'worry' ? `<path d="M-30 -174 q10 -8 20 0 M10 -174 q10 -8 20 0" stroke="${K.hair}" stroke-width="5" fill="none" stroke-linecap="round"/>` : '';
    const eyes = `<ellipse cx="-19" cy="-150" rx="12" ry="${n(14 * blink)}" fill="#fff"/><ellipse cx="19" cy="-150" rx="12" ry="${n(14 * blink)}" fill="#fff"/>` +
      (blink < 1 ? '' : `<circle cx="-17" cy="-148" r="7" fill="${K.ink}"/><circle cx="21" cy="-148" r="7" fill="${K.ink}"/>`);
    const phone = o.phone == null ? '' :
      G(44, -70, lip(-24, -44, 48, 80, 12, K.ink, '#222', 0) + rr(-18, -37, 36, 62, 7, '#fff') + o.phone, { r: -8 }) + rr(18, -66, 30, 24, 12, K.skin);
    const figure = lip(-50, -96, 100, 96, 40, K.blue, K.blueLip, 0) + rr(-50, -40, 100, 40, 18, K.blueLip) +
      `<circle cy="-150" r="52" fill="${K.skin}"/>` +
      `<path d="M-54 -158 q4 -52 54 -52 q50 0 54 52 q-20 -22 -54 -24 q-34 2 -54 24z" fill="${K.hair}"/>` +
      eyes + brows + mouth + `<circle cx="-36" cy="-128" r="8" fill="#ff9ba0" opacity=".55"/><circle cx="36" cy="-128" r="8" fill="#ff9ba0" opacity=".55"/>` + phone;
    return G(x, y, `<ellipse cx="0" cy="4" rx="${n(58 - hop * .25)}" ry="10" fill="rgba(0,0,0,.08)"/>` + G(0, -hop, figure));
  }
  function bot(x, y, t, color, lipc, kind, mood, label) {
    const bob = Math.sin(t * 3 + x) * 4;
    const eyes = mood === 'happy'
      ? `<path d="M-30 -92 q12 -14 24 0 M6 -92 q12 -14 24 0" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/>`
      : `<circle cx="-18" cy="-94" r="9" fill="#fff"/><circle cx="18" cy="-94" r="9" fill="#fff"/>`;
    const sweat = mood === 'sweat' ? `<path d="M56 -128 q9 15 0 22 q-9 -7 0 -22z" fill="#84d8ff"/>` : '';
    let antenna;
    if (kind === 'gear') { let p = ''; for (let i = 0; i < 8; i++) p += G(0, 0, rr(-7, -24, 14, 14, 3, K.gold), { r: i * 45 }); antenna = G(0, -176, p + `<circle r="17" fill="${K.gold}"/><circle r="7" fill="${lipc}"/>`, { r: t * 90 }); }
    else antenna = `<path d="M4 -210 L-14 -178 h12 l-6 26 l22 -34 h-12 l8 -24z" fill="${K.gold}" stroke="${K.goldLip}" stroke-width="3" stroke-linejoin="round"/>`;
    const body = `<rect x="-4" y="-160" width="8" height="26" rx="4" fill="${lipc}"/>` + antenna +
      lip(-74, -140, 148, 128, 36, color, lipc, 8) + rr(-52, -122, 104, 62, 22, 'rgba(255,255,255,.28)') + eyes + sweat +
      rr(-24, -46, 48, 10, 5, 'rgba(255,255,255,.4)');
    return G(x, y, `<ellipse cx="0" cy="4" rx="70" ry="11" fill="rgba(0,0,0,.08)"/>` + G(0, bob, body)) + txt(x, y + 36, label, 17, K.ink);
  }
  function card(x, y, letter, fill, lipc, color, o = {}) {
    return G(x, y, lip(-34, -44, 68, 88, 16, fill, lipc, 6) + txt(0, 14, letter, 40, color), o);
  }
  function die(x, y, r, s = 1) {
    const pip = (a, b) => `<circle cx="${a}" cy="${b}" r="5.5" fill="#fff"/>`;
    return G(x, y, lip(-30, -30, 60, 60, 14, K.orange, K.orangeLip, 6) + pip(-13, -13) + pip(13, 13) + pip(0, 0) + pip(13, -13) + pip(-13, 13), { r, s });
  }
  function backdrop(i) {
    const tint = ['#eaf8dc', '#e3f5fe', '#eaf8dc', '#f6eaff', '#fff3df'][i];
    return `<rect width="${W}" height="${H}" fill="#fff"/>` +
      `<circle cx="120" cy="140" r="70" fill="${tint}"/><circle cx="870" cy="100" r="46" fill="${tint}"/><circle cx="820" cy="300" r="22" fill="${tint}"/>` +
      rr(-20, GROUND, W + 40, H - GROUND + 20, 0, '#f2f8ec') + rr(-20, GROUND, W + 40, 6, 3, '#dcecc9');
  }
  function stamp(t) { return txt(W - 22, H - 16, `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')} / 1:00`, 13, '#a0a0a0', 'end', 800); }
  function title(i, u) {
    const cols = [[K.green, K.greenLip], [K.blue, K.blueLip], [K.green, K.greenLip], [K.purple, K.purpleLip], [K.orange, K.orangeLip]][i];
    const s = CHAPTERS[i].name;
    return chip(40 + (s.length * 18 * .56 + 30) / 2, 44, s, cols[0], cols[1], back(seg(u, 0, .5)), 18);
  }

  // ---------- scenes (u = seconds inside the scene)
  function scene1(u) {
    let s = '';
    const pop = back(seg(u, 0, .7));
    const got = u > 6.6, hop = got ? Math.max(0, Math.sin(seg(u, 6.6, 7.4) * Math.PI)) * 34 : 0;
    const screen = got ? `<circle cx="0" cy="-8" r="12" fill="${K.green}"/>` : '';
    s += G(300, GROUND, learner(0, 0, u, { mood: got && u < 7.8 ? 'wow' : 'smile', hop, phone: screen }), { s: pop });
    s += txt(650, 110, 'eligible reminders', 16, K.muted, 'middle', 800, seg(u, .8, 1.3) * (1 - seg(u, 6, 6.6)));
    ['A', 'G', 'L'].forEach((k, i) => {
      const x0 = 560 + i * 90, y0 = 180 + Math.sin(u * 2.4 + i) * 6, app = back(seg(u, .6 + i * .2, 1.2 + i * .2));
      const isG = i === 1, flip = seg(u, 4.6, 5.2), green = isG && flip > .5;
      const sx = isG ? Math.max(.03, Math.abs(Math.cos(flip * Math.PI))) : 1;
      if (isG && u > 5.4) {
        const fly = easeOut(seg(u, 5.4, 6.6));
        if (fly < 1) s += card(lerp(x0, 352, fly), lerp(y0, 300, fly) - Math.sin(fly * Math.PI) * 90, k, K.green, K.greenLip, '#fff', { s: lerp(1, .35, fly), r: fly * 20 });
        return;
      }
      const dim = !isG && u > 5 ? lerp(1, .35, seg(u, 5, 5.6)) : 1;
      s += card(x0, y0, k, green ? K.green : '#fff', green ? K.greenLip : K.grayLip, green ? '#fff' : K.ink, { sx: app * sx, sy: app, o: dim });
    });
    if (u > 1.8) {
      const r = seg(u, 1.8, 4.4), bounce = Math.abs(Math.sin(r * Math.PI * 3.5)) * (1 - r) * 110;
      s += die(lerp(900, 700, easeOut(r)), 330 - bounce, r * 720, back(seg(u, 1.8, 2.2)));
      s += txt(700, 395, 'random pick', 16, K.orangeLip, 'middle', 900, seg(u, 3.6, 4));
    }
    if (got) s += bubble(330, 200 - hop, ['Time for a quick lesson!'], back(seg(u, 6.8, 7.4)), K.green, K.greenLip, '#fff', 18);
    return s;
  }
  function scene2(u) {
    let s = '';
    const done = u > 4.4, prog = seg(u, 2.4, 4.3);
    const screen = rr(-14, 10, 28, 6, 3, K.gray) + rr(-14, 10, 28 * prog, 6, 3, K.green) + (done ? `<path d="M-8 -12 l6 6 l10 -12" stroke="${K.green}" stroke-width="4" fill="none" stroke-linecap="round"/>` : '');
    const hop = done ? Math.max(0, Math.sin(seg(u, 4.4, 5.1) * Math.PI)) * 30 : 0;
    s += learner(240, GROUND, u, { mood: done && u < 5.6 ? 'wow' : 'smile', hop, phone: screen });
    const sweep = easeOut(seg(u, .2, 4.2)), a = sweep * 2 * Math.PI, cx = 500, cy = 190;
    s += G(cx, cy, `<circle r="64" cy="6" fill="${K.blueLip}"/><circle r="64" fill="#fff" stroke="${K.blue}" stroke-width="6"/>` +
      `<path d="M0 -50 A50 50 0 ${a > Math.PI ? 1 : 0} 1 ${n(50 * Math.sin(a))} ${n(-50 * Math.cos(a))} L0 0z" fill="#ddf4ff"/>` +
      `<line x1="0" y1="0" x2="${n(40 * Math.sin(a))}" y2="${n(-40 * Math.cos(a))}" stroke="${K.ink}" stroke-width="6" stroke-linecap="round"/>` +
      txt(0, 98, (sweep * 2).toFixed(1) + ' hours', 18, K.blueLip), { s: back(seg(u, 0, .6)) * (1 - seg(u, 6, 6.5)) });
    s += checkBadge(cx + 62, cy - 44, back(seg(u, 4.4, 5)) * (1 - seg(u, 6, 6.5)));
    s += confetti(cx, cy, seg(u, 4.4, 5.6));
    const stackX = 790, stackY = GROUND - 14;
    const shown = Math.floor(clamp((u - 6) / .45, 0, 10));
    for (let k = 0; k < Math.min(shown, 6); k++) s += lip(stackX - 70, stackY - 22 - k * 26, 140, 22, 8, k % 3 === 0 ? K.green : '#fff', k % 3 === 0 ? K.greenLip : K.grayLip, 4);
    for (let k = 0; k < 10; k++) {
      const p = seg(u, 5.2 + k * .45, 6.0 + k * .45);
      if (p <= 0 || p >= 1) continue;
      const x = lerp(290, stackX, inOut(p)), y = lerp(330, stackY - 30 - Math.min(k, 5) * 26, inOut(p)) - Math.sin(p * Math.PI) * 110;
      s += G(x, y, lip(-34, -11, 68, 22, 8, k % 3 === 0 ? K.green : '#fff', k % 3 === 0 ? K.greenLip : K.grayLip, 4), { r: (1 - p) * -20 });
    }
    if (u > 5.4) s += chip(stackX, GROUND + 42, Math.round(SENDS * easeOut(seg(u, 5.4, 11))).toLocaleString() + ' sends', K.blue, K.blueLip, back(seg(u, 5.4, 6)), 17);
    if (u > 6.6) s += bubble(540, 150, ['eligible: A, G, L', 'sent: G', 'lesson within 2 h: yes'], back(seg(u, 6.6, 7.2)));
    return s;
  }
  function bar(x, h, w, fill, lipc, letter, value, o = 1, extra = {}) {
    if (h <= .5) return '';
    return G(x, GROUND, rr(-w / 2, -h, w, h, 16, fill) + rr(-w / 2, -16, w, 16, 0, lipc) + rr(-w / 2 + 12, -h + 12, 14, Math.max(0, h - 40), 7, 'rgba(255,255,255,.3)') +
      txt(0, -h - 14, value, 19, K.ink) + (letter ? txt(0, 36, letter, 24, K.ink) : ''), { o, ...extra });
  }
  function scene3(u) {
    let s = '';
    const k = 600, flip = back(seg(u, 6.8, 7.8));
    const gRate = lerp(RAW.G, SHARED.G, flip);
    s += bar(330, RAW.A * k * back(seg(u, .3, 1.6)), 110, K.green, K.greenLip, 'A', (RAW.A * 100).toFixed(1) + '%');
    s += bar(480, gRate * k * back(seg(u, .5, 1.8)), 110, K.blue, K.blueLip, 'G', (gRate * 100).toFixed(1) + '%');
    const fall = seg(u, 5, 6.2);
    if (fall < 1) {
      s += bar(630, RAW.C * k * back(seg(u, .7, 2)), 110, K.orange, K.orangeLip, 'C', (RAW.C * 100).toFixed(1) + '%', 1 - fall, { r: fall * 25 });
      if (u > 3) s += chip(760, GROUND - RAW.C * k * .5, 'only option', K.gold, K.goldLip, back(seg(u, 3, 3.5)) * (1 - fall), 15, K.ink);
    }
    const sw = easeOut(seg(u, 6.2, 6.7));
    s += G(480, 100, lip(-190, -24, 380, 48, 24, '#f1f1f1', K.grayLip, 4) + rr(-186 + sw * 186, -20, 186, 40, 20, sw > .5 ? K.blue : '#fff') +
      txt(-93, 6, 'all sends', 16, sw > .5 ? K.muted : K.ink) + txt(93, 6, 'both eligible', 16, sw > .5 ? '#fff' : K.muted), { s: back(seg(u, 0, .5)) });
    s += G(140, GROUND, learner(0, 0, u, { mood: u > 7.6 && u < 9.4 ? 'wow' : 'smile' }), { s: .72 });
    if (u > 9) s += chip(480, GROUND + 64, `A minus G: ${((SHARED.A - SHARED.G) * 100).toFixed(1)} pp · the interval crosses 0`, K.ink, '#222', back(seg(u, 9, 9.6)), 16);
    return s;
  }
  function scene4(u) {
    let s = '';
    const text = u > 6.4;
    s += chip(480, 70, text ? 'input: review text' : 'input: send logs', text ? K.purple : K.blue, text ? K.purpleLip : K.blueLip, back(seg(u, text ? 6.4 : 0, text ? 6.9 : .5)), 18);
    const xMood = !text && u > 4.2 ? 'happy' : 'calm';
    const jMood = !text ? (u > 4.6 ? 'sweat' : 'calm') : (u > 10.4 ? 'happy' : 'calm');
    s += bot(320, GROUND - 8, u, K.blue, K.blueLip, 'gear', xMood, text ? 'text model · trained' : 'XGBoost · trained');
    s += bot(660, GROUND - 8, u, K.purple, K.purpleLip, 'bolt', jMood, 'Jev · zero labels');
    for (let k = 0; k < 8; k++) {
      const base = text ? 6.9 : .6, p = seg(u, base + k * .42, base + 1.2 + k * .42);
      if (p <= 0 || p >= 1) continue;
      const tx = k % 2 ? 660 : 320;
      const x = lerp(480, tx, inOut(p)), y = lerp(120, 270, inOut(p)) - Math.sin(p * Math.PI) * 40;
      s += text ? bubble(x, y, ['“love it, but ads…”'], .62 * (1 - p * .3))
        : G(x, y, lip(-42, -16, 84, 32, 10, '#fff', K.grayLip, 4) + txt(0, 6, 'A, G · 0.12', 13, K.muted, 'middle', 800), { s: 1 - p * .3 });
    }
    if (!text) {
      s += chip(320, 200, 'AUC ' + AUC.xgb.toFixed(2), K.green, K.greenLip, back(seg(u, 4, 4.5)) * (1 - seg(u, 6, 6.3)), 19);
      s += chip(660, 200, 'AUC ' + AUC.jev.toFixed(2), '#afafaf', '#8f8f8f', back(seg(u, 4.4, 4.9)) * (1 - seg(u, 6, 6.3)), 19);
    } else {
      s += chip(320, 200, 'AUC ' + TXT.tfidf.toFixed(2), '#afafaf', '#8f8f8f', back(seg(u, 10, 10.5)), 19);
      s += chip(660, 200, 'AUC ' + TXT.jev.toFixed(2), K.green, K.greenLip, back(seg(u, 10.4, 10.9)), 19);
      s += confetti(660, 200, seg(u, 10.5, 11.7), 14);
    }
    return s;
  }
  function scene5(u) {
    let s = '';
    const base = 150, names = ['rate table says', 'honest check', 'later data'], xs = [210, 360, 510];
    const lineO = seg(u, .2, .7);
    s += `<line x1="130" x2="588" y1="${GROUND - base}" y2="${GROUND - base}" stroke="${K.goldLip}" stroke-width="4" stroke-dasharray="12 9" opacity="${lineO.toFixed(2)}"/>`;
    s += txt(598, GROUND - base + 6, 'random sends', 15, K.goldLip, 'start', 900, lineO);
    LADDER.forEach((g, i) => {
      const p = back(seg(u, .8 + i * 2, 1.8 + i * 2));
      if (p <= 0) return;
      const h = Math.max(30, base + g * 30) * p, up = g >= 0;
      s += bar(xs[i], h, 104, up ? K.green : K.red, up ? K.greenLip : K.redLip, '', (g > 0 ? '+' : '') + g.toFixed(1) + ' pp', clamp(p * 2));
      s += txt(xs[i], GROUND + 32, names[i], 15, K.muted, 'middle', 800, clamp(p));
    });
    const hop = u > 8.4 ? Math.max(0, Math.sin(seg(u, 8.4, 9) * Math.PI)) * 24 : 0;
    s += learner(790, GROUND, u, { mood: u > 5 && u < 8.2 ? 'worry' : 'smile', hop });
    if (u > 7.6) {
      const r = seg(u, 7.6, 10);
      s += die(lerp(980, 680, easeOut(r)), GROUND - 34 - Math.abs(Math.sin(r * Math.PI * 3)) * (1 - r) * 90, r * 600, back(seg(u, 7.6, 8)));
      s += bubble(790, 180, ['Next: a controlled test', 'that keeps exploring'], back(seg(u, 8.6, 9.2)));
    }
    return s;
  }
  const SCENES = [scene1, scene2, scene3, scene4, scene5];

  function drawFilm(t) {
    t = clamp(t, 0, LEN);
    const i = Math.min(4, Math.floor(t / 12)), u = t - i * 12;
    const fade = seg(u, 0, .3) * (i < 4 ? 1 - seg(u, 11.7, 12) : 1);
    return backdrop(i) + `<g opacity="${fade.toFixed(2)}">${SCENES[i](u)}</g>` + title(i, u) + stamp(t);
  }

  // ---------- player wiring
  function init() {
    const svg = document.getElementById('film-svg');
    if (!svg) return;
    const play = document.getElementById('film-play'), scrub = document.getElementById('film-scrub'),
      cap = document.getElementById('film-cap'), chaps = document.getElementById('film-chapters'),
      wrap = document.getElementById('film'), expand = document.getElementById('film-expand');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let t = 7.6, playing = false, last = 0, raf = 0;
    CHAPTERS.forEach((c, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = (i + 1) + ' · ' + c.name;
      b.onclick = () => { seek(reduced ? c.t + 11.9 : c.t + .01); if (!reduced) start(); };
      chaps.append(b);
    });
    function render() {
      svg.innerHTML = drawFilm(t);
      scrub.value = t.toFixed(1);
      const i = Math.min(4, Math.floor(t / 12));
      cap.textContent = CHAPTERS[i].cap;
      [...chaps.children].forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    }
    function frame(now) {
      if (!playing) return;
      t += Math.min(.5, (now - last) / 1000); last = now;
      if (t >= LEN) { t = LEN; stop(); play.textContent = '↻ Replay'; }
      render();
      if (playing) raf = requestAnimationFrame(frame);
    }
    function start() { if (t >= LEN) t = 0; playing = true; play.textContent = '❚❚ Pause'; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    function stop() { playing = false; cancelAnimationFrame(raf); if (t < LEN) play.textContent = '▶ Play'; }
    function seek(v) { t = clamp(+v, 0, LEN); render(); }
    play.onclick = () => (playing ? stop() : start());
    scrub.oninput = () => { stop(); seek(scrub.value); };
    function setFull(on) { wrap.classList.toggle('full', on); expand.textContent = on ? '✕ Close' : '⤢ Expand'; document.documentElement.classList.toggle('film-open', on); }
    expand.onclick = () => { const on = !wrap.classList.contains('full'); setFull(on); if (on && !playing && !reduced) start(); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && wrap.classList.contains('full')) setFull(false); });
    window.LabFilm.stop = stop;
    render();
  }
  window.LabFilm = { drawFilm, CHAPTERS, LEN };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
