/* Two toy animations: supervised classification and unsupervised clustering (k-means).
   Made-up points so the mechanics are easy to see. Each panel is a pure function of time,
   played only while its slide is on screen. */
(function () {
  'use strict';
  const K = { green: '#58cc02', greenLip: '#46a302', blue: '#1cb0f6', orange: '#ff9600', purple: '#ce82ff', red: '#ff4b4b', gray: '#c9c9c9', ink: '#3c3c3c', muted: '#8a8a8a' };
  const W = 400, H = 280, L = 44, R = 384, T = 16, B = 236;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const back = x => { if (x <= 0) return 0; if (x >= 1) return 1; const c = 2, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const ease = x => 1 - Math.pow(1 - x, 3);
  const lerp = (a, b, x) => a + (b - a) * x;
  const n = v => (+v).toFixed(1);
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function axes(xl, yl) {
    return `<line x1="${L}" y1="${B}" x2="${R}" y2="${B}" stroke="${K.gray}" stroke-width="2"/><line x1="${L}" y1="${T}" x2="${L}" y2="${B}" stroke="${K.gray}" stroke-width="2"/>` +
      `<text x="${(L + R) / 2}" y="${H - 14}" text-anchor="middle" class="ax">${xl}</text>` +
      `<text x="14" y="${(T + B) / 2}" text-anchor="middle" class="ax" transform="rotate(-90 14 ${(T + B) / 2})">${yl}</text>`;
  }
  const px = x => L + x / 10 * (R - L), py = y => B - y / 10 * (B - T);

  // ---------- classification: x = lessons last week, y = days since last reminder (toy)
  const C = (() => {
    const r = rng(7), pts = [];
    for (let i = 0; i < 46; i++) {
      const x = r() * 10, y = r() * 10;
      // toy truth: active learners (x > 5) reminded neither too soon nor too late (2 < y < 7)
      let yes = x > 5 && y > 2 && y < 7;
      if (r() < .08) yes = !yes;
      pts.push({ x, y, yes, d: r() * .9 });
    }
    return pts;
  })();
  const lineY = x => 1.6 * x - 4.6;            // logistic regression's straight boundary (toy)
  const lineSaysYes = p => p.y < lineY(p.x);
  const boxSaysYes = p => p.x > 5 && p.y > 2 && p.y < 7;
  const NEW = { x: 7.4, y: 4.2 };
  const CLASS_LEN = 15;
  const CLASS_CAPS = [
    [0, 'Supervised: every training point comes with its answer. Green = a lesson within 2 hours, gray = no lesson.'],
    [3, 'Logistic regression draws one straight line. It can’t carve out the band in the middle, so it misses some points (red rings).'],
    [6.5, 'Trees ask yes/no questions instead: “more than 5 lessons?”, “reminded more than 2 days ago?”, “less than 7?” Each answer cuts a box.'],
    [10.5, 'A new reminder arrives with no answer. It lands in the green box, so the model predicts a lesson. XGBoost stacks hundreds of these small trees.']
  ];
  function drawClass(t) {
    let s = axes('lessons last week →', 'days since last reminder →'), labels = '';
    const tree = seg(t, 6.6, 9.6), line = seg(t, 3.1, 4.6) * (1 - seg(t, 6.3, 6.8));
    // tree boxes
    if (tree > 0) {
      const a = seg(t, 6.6, 7.6), b = seg(t, 7.6, 8.6), c = seg(t, 8.6, 9.6);
      s += `<rect x="${n(px(5))}" y="${n(py(7))}" width="${n((px(10) - px(5)) * ease(a))}" height="${n(py(2) - py(7))}" fill="rgba(88,204,2,.13)"/>`;
      if (a > 0) s += `<line x1="${n(px(5))}" y1="${n(py(10))}" x2="${n(px(5))}" y2="${n(lerp(py(10), py(0), ease(a)))}" stroke="${K.greenLip}" stroke-width="3" stroke-dasharray="6 5"/>`;
      if (b > 0) s += `<line x1="${n(px(5))}" y1="${n(py(2))}" x2="${n(lerp(px(5), px(10), ease(b)))}" y2="${n(py(2))}" stroke="${K.greenLip}" stroke-width="3" stroke-dasharray="6 5"/>`;
      if (c > 0) s += `<line x1="${n(px(5))}" y1="${n(py(7))}" x2="${n(lerp(px(5), px(10), ease(c)))}" y2="${n(py(7))}" stroke="${K.greenLip}" stroke-width="3" stroke-dasharray="6 5"/>`;
      const q = [['> 5 lessons?', px(5) + 6, py(9.4), a], ['> 2 days?', px(9.8), py(2) + 15, b], ['< 7 days?', px(9.8), py(7) - 6, c]];
      q.forEach(([txt, x, y, o], i) => { if (o > 0) labels += `<text x="${n(x)}" y="${n(y)}" class="q" text-anchor="${i ? 'end' : 'start'}" opacity="${o.toFixed(2)}">${txt}</text>`; });
    }
    // logistic line
    if (line > 0) {
      const x0 = 2.9, x1 = 9.1, xe = lerp(x0, x1, ease(seg(t, 3.1, 4.4)));
      s += `<line x1="${n(px(x0))}" y1="${n(py(lineY(x0)))}" x2="${n(px(xe))}" y2="${n(py(lineY(xe)))}" stroke="${K.blue}" stroke-width="4" stroke-linecap="round" opacity="${line.toFixed(2)}"/>`;
      labels += `<text x="${n(px(9.2))}" y="${n(py(9.6))}" class="q" style="fill:${K.blue}" text-anchor="end" opacity="${line.toFixed(2)}">one straight line</text>`;
    }
    // points
    C.forEach(p => {
      const a = back(seg(t, p.d, p.d + .7));
      if (a <= 0) return;
      const wrongLine = line > .6 && t > 4.6 && lineSaysYes(p) !== p.yes;
      s += `<circle cx="${n(px(p.x))}" cy="${n(py(p.y))}" r="${n(6.5 * a)}" fill="${p.yes ? K.green : K.gray}" stroke="#fff" stroke-width="1.5"/>`;
      if (wrongLine) s += `<circle cx="${n(px(p.x))}" cy="${n(py(p.y))}" r="11" fill="none" stroke="${K.red}" stroke-width="2.5"/>`;
    });
    s += labels;
    // new point
    if (t > 10.6) {
      const drop = ease(seg(t, 10.6, 11.6)), done = t > 12;
      const y = lerp(10.6, NEW.y, drop);
      s += `<circle cx="${n(px(NEW.x))}" cy="${n(py(y))}" r="10" fill="${done ? K.green : '#fff'}" stroke="${done ? K.greenLip : K.ink}" stroke-width="3"/>`;
      s += `<text x="${n(px(NEW.x))}" y="${n(py(y) + 5)}" text-anchor="middle" class="qm" fill="${done ? '#fff' : K.ink}">${done ? '✓' : '?'}</text>`;
      if (done) { const o = back(seg(t, 12, 12.5)); s += `<g transform="translate(${n(px(NEW.x) - 4)} ${n(py(NEW.y) - 22)}) scale(${o.toFixed(2)})"><rect x="-58" y="-16" width="116" height="26" rx="13" fill="${K.green}"/><text x="0" y="2" text-anchor="middle" class="chip">likely a lesson</text></g>`; }
    }
    return s;
  }

  // ---------- clustering: k-means on three toy blobs, iterations computed for real
  const P = (() => {
    const r = rng(21), out = [], centers = [[2.6, 7.2], [7.4, 7.6], [5.4, 2.4]];
    centers.forEach(([cx, cy]) => { for (let i = 0; i < 15; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * 1.7; out.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, d: r() * .9 }); } });
    return out;
  })();
  const KM = (() => {
    let cents = [[1.5, 2.0], [3.0, 2.6], [8.8, 3.4]];        // deliberately poor start
    const steps = [{ cents: cents.map(c => c.slice()), assign: null }];
    for (let it = 0; it < 4; it++) {
      const assign = P.map(p => { let b = 0, bd = 1e9; cents.forEach((c, k) => { const d = (p.x - c[0]) ** 2 + (p.y - c[1]) ** 2; if (d < bd) { bd = d; b = k; } }); return b; });
      steps.push({ cents: cents.map(c => c.slice()), assign });
      cents = cents.map((c, k) => { const m = P.filter((_, i) => assign[i] === k); return m.length ? [m.reduce((a, p) => a + p.x, 0) / m.length, m.reduce((a, p) => a + p.y, 0) / m.length] : c; });
      steps.push({ cents: cents.map(c => c.slice()), assign });
    }
    return steps;
  })();
  const CCOL = [K.orange, K.purple, K.blue];
  // name groups after the fact, by where their final center sits
  const NAMES = (() => {
    const fin = KM.at(-1).cents;
    return fin.map(c => c[1] < 4.5 ? '“hearts & ads” 😠' : (c[0] < 5 ? '“love learning” 😊' : '“free version?” 🤔'));
  })();
  const CLUS_LEN = 16;
  const CLUS_CAPS = [
    [0, 'Unsupervised: the same kind of points, but no answers. Just positions (here, two word-score directions).'],
    [1.8, 'k-means drops k = 3 centers (stars), on purpose in bad spots.'],
    [3, 'Step 1: every point joins its nearest center.'],
    [4.0, 'Step 2: each center moves to the middle of its group. Then we repeat both steps…'],
    [10.4, '…until nothing changes. Now we read the groups and name them ourselves. The algorithm never knew what they meant.']
  ];
  function clusState(t) {
    // phases: 0 gray, 1 centers drop, then alternate assign/move every 1.6 s
    const step = t < 3 ? 0 : Math.min(KM.length - 1, 1 + Math.floor((t - 3) / 1.0));
    const local = t < 3 ? 0 : ((t - 3) % 1.0) / 1.0;
    return { step, local };
  }
  function drawClus(t) {
    let s = axes('word-score direction 1 →', 'word-score direction 2 →');
    const { step, local } = clusState(t);
    const cur = KM[step], prev = KM[Math.max(0, step - 1)];
    const moving = step > 0 && step % 2 === 0;
    const cents = cur.cents.map((c, k) => moving && step <= KM.length - 1 ? [lerp(prev.cents[k][0], c[0], ease(clamp(local * 1.4))), lerp(prev.cents[k][1], c[1], ease(clamp(local * 1.4)))] : c);
    const assign = cur.assign;
    // light lines from points to centers during assignment steps
    if (assign && step % 2 === 1 && t < 10.4) P.forEach((p, i) => { const c = cents[assign[i]]; s += `<line x1="${n(px(p.x))}" y1="${n(py(p.y))}" x2="${n(px(c[0]))}" y2="${n(py(c[1]))}" stroke="${CCOL[assign[i]]}" stroke-width="1.2" opacity="${(.45 * (1 - local)).toFixed(2)}"/>`; });
    P.forEach((p, i) => {
      const a = back(seg(t, p.d, p.d + .7));
      if (a <= 0) return;
      const col = assign ? CCOL[assign[i]] : K.gray;
      s += `<circle cx="${n(px(p.x))}" cy="${n(py(p.y))}" r="${n(6.5 * a)}" fill="${col}" stroke="#fff" stroke-width="1.5"/>`;
    });
    if (t > 1.8) cents.forEach((c, k) => {
      const a = back(seg(t, 1.8 + k * .2, 2.4 + k * .2));
      const x = px(c[0]), y = py(c[1]);
      const star = [...Array(10)].map((_, j) => { const r = j % 2 ? 6 : 14, an = -Math.PI / 2 + j * Math.PI / 5; return n(x + Math.cos(an) * r * a) + ',' + n(y + Math.sin(an) * r * a); }).join(' ');
      s += `<polygon points="${star}" fill="${CCOL[k]}" stroke="${K.ink}" stroke-width="2" stroke-linejoin="round"/>`;
    });
    if (t > 10.6) {
      const fin = KM.at(-1).cents;
      fin.forEach((c, k) => { const o = back(seg(t, 10.8 + k * .35, 11.3 + k * .35)); if (o <= 0) return; const x = clamp(px(c[0]), 92, 308), y = py(c[1]) - 36; const w = NAMES[k].length * 7.2 + 18; s += `<g transform="translate(${n(x)} ${n(y)}) scale(${o.toFixed(2)})"><rect x="${n(-w / 2)}" y="-14" width="${n(w)}" height="24" rx="12" fill="#fff" stroke="${CCOL[k]}" stroke-width="2.5"/><text x="0" y="3" text-anchor="middle" class="nm">${NAMES[k]}</text></g>`; });
    }
    if (step >= KM.length - 1 && t > 10 && t < 10.8) s += `<text x="${(L + R) / 2}" y="${T + 14}" text-anchor="middle" class="q" fill="${K.greenLip}">nothing changed: done ✓</text>`;
    return s;
  }

  function caption(caps, t) { let c = caps[0][1]; caps.forEach(([at, txt]) => { if (t >= at) c = txt; }); return c; }
  function init() {
    const sc = document.getElementById('viz-class'), su = document.getElementById('viz-clus');
    if (!sc || !su) return;
    const slide = sc.closest('.slide'), capC = document.getElementById('cap-class'), capU = document.getElementById('cap-clus');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let tc = reduced ? 13 : 0, tu = reduced ? 12 : 0, last = 0, raf = 0, paused = false;
    const render = () => { sc.innerHTML = drawClass(tc); su.innerHTML = drawClus(tu); capC.textContent = caption(CLASS_CAPS, tc); capU.textContent = caption(CLUS_CAPS, tu); };
    function frame(now) {
      const dt = Math.min(.5, (now - last) / 1000); last = now;
      if (!paused && slide.classList.contains('active')) {
        tc += dt; tu += dt;
        if (tc > CLASS_LEN) tc = 0;
        if (tu > CLUS_LEN) tu = 0;
        render();
      }
      raf = requestAnimationFrame(frame);
    }
    const replay = document.getElementById('ml-replay'), pause = document.getElementById('ml-pause');
    replay.onclick = () => { tc = 0; tu = 0; paused = false; pause.textContent = '❚❚ Pause'; render(); if (reduced) { tc = 13; tu = 12; render(); } };
    pause.onclick = () => { paused = !paused; pause.textContent = paused ? '▶ Play' : '❚❚ Pause'; };
    document.querySelectorAll('[data-ml-step]').forEach(b => b.onclick = () => {
      const [which, at] = b.dataset.mlStep.split(':'); paused = true; pause.textContent = '▶ Play';
      if (which === 'c') tc = +at; else tu = +at; render();
    });
    render();
    if (!reduced) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  window.MLViz = { drawClass, drawClus, CLASS_LEN, CLUS_LEN };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
