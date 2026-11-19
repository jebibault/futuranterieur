(() => {
'use strict';
/* ---------- constants ---------- */
const W = 1280, H = 720, PY = 40, PH = 640, IW = 1344, IH = 756, FPS = 24;
const cv = document.getElementById('film'), ctx = cv.getContext('2d');
const IM = {};
let g = ctx, OY = PY;               // current target context and picture origin
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = t => t * t * (3 - 2 * t);
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = sstep(x - xi), yf = sstep(y - yi); return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), xf), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), xf), yf); }
const RSC = +(new URLSearchParams(location.search).get('s')) || 1;   // render scale: 1 = 1280x720, 1.5 = 1080p, 3 = 4K
// canvases that hold picture are S times larger than their logical size; drawImage keeps taking logical coordinates
function mk(w, h) { const c = document.createElement('canvas'); fit(c, w, h); return c; }
function fit(c, w, h) { if (c._lw === w && c._lh === h) return; c._lw = w; c._lh = h; c._s = RSC; c.width = Math.max(1, Math.ceil(w * RSC)); c.height = Math.max(1, Math.ceil(h * RSC)); c.getContext('2d').setTransform(RSC, 0, 0, RSC, 0, 0); }
function mkRaw(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }   // pixel data, never scaled
if (!CanvasRenderingContext2D.prototype._di) {
  const P = CanvasRenderingContext2D.prototype; P._di = P.drawImage;
  P.drawImage = function (src, ...a) {
    const k = src._s || src._k || 1;
    if (k === 1 || a.length === 4) return this._di(src, ...a);
    if (a.length === 2) return this._di(src, a[0], a[1], src._lw || src.naturalWidth / k, src._lh || src.naturalHeight / k);
    return this._di(src, a[0] * k, a[1] * k, a[2] * k, a[3] * k, a[4], a[5], a[6], a[7]);
  };
}
cv.width = W * RSC; cv.height = H * RSC;

/* ---------- assets ---------- */
function loadAll() {
  return Promise.all(Object.keys(ASSETS).map(k => new Promise(r => { const i = new Image(); i.onload = () => { if (i.naturalWidth > IW + 1 && Math.abs(i.naturalWidth / i.naturalHeight - IW / IH) < 0.01) i._k = i.naturalWidth / IW; IM[k] = i; r(); }; i.src = ASSETS[k]; })));
}
// key pose B composited onto key pose A inside a feathered region, so only the acting changes
function composite(a, b, regs, name) {
  const c = mk(IW, IH), x = c.getContext('2d'), l = mk(IW, IH), lx = l.getContext('2d');
  x.drawImage(IM[a], 0, 0, IW, IH);
  for (const r of regs) {
    lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, IW, IH); lx.drawImage(IM[b], 0, 0, IW, IH);
    lx.globalCompositeOperation = 'destination-in';
    const cx = (r.x + r.w / 2) * IW, cy = (r.y + r.h / 2) * IH, rx = r.w * IW / 2, ry = r.h * IH / 2;
    lx.save(); lx.translate(cx, cy); lx.scale(rx, ry);
    const gr = lx.createRadialGradient(0, 0, 1 - (r.f || 0.35), 0, 0, 1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    lx.fillStyle = gr; lx.fillRect(-1, -1, 2, 2); lx.restore();
    x.drawImage(l, 0, 0);
  }
  IM[name] = c;
}

/* ---------- textures ---------- */
const grains = [];
function makeGrain() {
  for (let k = 0; k < 4; k++) {
    const c = mkRaw(320, 180), x = c.getContext('2d'), d = x.createImageData(320, 180), r = rng(77 + k);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - 0.5) * 90; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); grains.push(c);
  }
}
const MW = 320, MH = 180, maskN = new Float32Array(MW * MH), maskC = mkRaw(MW, MH), maskX = maskC.getContext('2d'), maskD = maskX.createImageData(MW, MH);
function makeMaskNoise() {
  let mn = 9, mx = -9;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    let v = vnoise(x / 46, y / 46) * 0.55 + vnoise(x / 17 + 9, y / 17 + 3) * 0.28 + vnoise(x / 6 + 2, y / 6) * 0.12 + hash(x, y) * 0.05;
    maskN[y * MW + x] = v; mn = Math.min(mn, v); mx = Math.max(mx, v);
  }
  for (let i = 0; i < maskN.length; i++) maskN[i] = (maskN[i] - mn) / (mx - mn);
}
function setMask(p, bias, wd) {
  wd = wd || 0.035;           // p 0..1 : how much of the new drawing has grown in
  const d = maskD.data, th = wd > 0.1 ? p * (1 + wd) : p * 1.16 - 0.08;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x; let n = maskN[i];
    if (bias) n = n * 0.55 + bias(x / MW, y / MH) * 0.45;
    d[i * 4 + 3] = clamp((th - n) / wd) * 255;
  }
  maskX.putImageData(maskD, 0, 0);
}
const layer = mk(W, H), lctx = layer.getContext('2d');

/* ---------- drawing helpers ---------- */
function camAt(a, b, u) { const e = 0.5 * u + 0.5 * sstep(u); return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), z: lerp(a.z, b.z, e), r: lerp(a.r || 0, b.r || 0, e) }; }
let curT = null;
// extra key poses: a still plate X goes to its drawn pose X_p1 and back, through the drawn in-between X_p1i (then X_p2, …)
const POSES = {}; for (const k in ASSETS) { const m = /^(.+)_(p\d)$/.exec(k); if (m) (POSES[m[1]] = POSES[m[1]] || []).push(m[2]); }
const FACEWHO = {};
function posed(name) {
  const P = POSES[name]; if (!P || window.NOPOSE) return name;
  const S = SEG.find(s => NOW >= s.t0 && NOW < s.t1); if (!S) return name;
  // a character who is about to speak, is speaking, or has just spoken keeps the drawing that carries the mouths
  const who = FACEWHO[name]; if (who && LINES.some(l => l.who === who && l.mode === 'room' && NOW > l.t0 - 0.9 && NOW < l.t1 + 0.35)) return name;
  const h = hash(name.length * 7 + name.charCodeAt(0), name.charCodeAt(name.length - 1)), st = NOW - S.t0, dt = 2 / FPS;
  const steps = q => ['a', 'i', 'c'].map(k => q + k).filter(n => IM[n]);       // drawn in-betweens
  // one in-between is held four frames (the setting the films were approved with); several are exposed on twos
  const mix = (q, u, back) => { const s = steps(q); if (!s.length) return back ? name : q; const k = Math.floor(u / (s.length > 1 ? dt : 2 * dt)); if (k >= s.length) return back ? name : q; return back ? s[s.length - 1 - k] : s[k]; };
  if (typeof STAY !== 'undefined' && STAY.includes(name)) { const q = name + '_' + P[0], a = 1.8 + 1.2 * h + 0.8; return st < a ? name : mix(q, st - a, false); }     // a walk does not go backwards
  const per = 7.4 + 2.2 * h, a = 1.8 + 1.2 * h, b = a + 3.0 + 1.2 * h, n = Math.floor(st / per), u = st - n * per, q = name + '_' + P[n % P.length];
  return u < a ? name : u < b ? mix(q, u - a, false) : mix(q, u - b, true);
}
function plate(name, c, over) {
  name = posed(name);
  const im = IM[name]; if (!im) { (window.MISSING = window.MISSING || {})[name] = (window.MISSING[name] || 0) + 1; return; }
  const s = (W / IW) * c.z; let dx = W / 2 - c.x * IW * s, dy = OY + PH / 2 - c.y * IH * s;
  if (!c.r) { dx = clamp(dx, W - IW * s, 0); dy = clamp(dy, OY + PH - IH * s, OY); }
  g.save();
  if (c.r) { g.translate(W / 2, OY + PH / 2); g.rotate(c.r); g.translate(-W / 2, -(OY + PH / 2)); }
  g.translate(dx, dy); g.scale(s, s);
  g.drawImage(im, 0, 0, IW, IH);
  if (over) over(g);
  g.restore();
}
function grow(drawB, p, bias, full, wd) {   // new drawing spreads through the old one like wet paint
  if (p <= 0) return; setMask(p, bias, wd);
  const sg = g, so = OY; g = lctx; OY = full ? 0 : 0;
  lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, W, H);
  drawB();
  lctx.globalCompositeOperation = 'destination-in'; lctx.imageSmoothingEnabled = true;
  lctx.drawImage(maskC, 0, 0, W, full ? H : PH);
  lctx.globalCompositeOperation = 'source-over';
  g = sg; OY = so;
  if (full) g.drawImage(layer, 0, 0); else g.drawImage(layer, 0, 0, W, PH, 0, OY, W, PH);
}
function rainExt(f, amt) {
  const r = rng(1000 + (f >> 1) * 7);
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < 170 * amt; i++) {
    const far = r() < 0.6, x = r() * (W + 200) - 100, y = PY + r() * PH, len = far ? 14 + r() * 22 : 40 + r() * 60;
    g.strokeStyle = `rgba(${far ? '205,212,218' : '225,230,234'},${far ? 0.10 + r() * 0.12 : 0.14 + r() * 0.16})`;
    g.lineWidth = far ? 0.8 + r() * 0.5 : 1.1 + r() * 0.9;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - len * 0.16 + (r() - 0.5) * 2, y + len); g.stroke();
  }
  g.restore();
}
// rivulets on a window pane, in image coordinates (drawn inside the plate transform)
function rivulets(regs, f, seed, col) {
  return x => {
    const t2 = f >> 1; x.lineCap = 'round';
    regs.forEach((R, k) => {
      const r = rng(seed + k * 31);
      const n = R.n || 9;
      for (let i = 0; i < n; i++) {
        const px = (R.x + r() * R.w) * IW, sp = 0.004 + r() * 0.012, ph = r(), len = (0.03 + r() * 0.07) * R.h * IH * 2;
        const cyc = (ph + t2 * sp) % 1.25, yy = (R.y + cyc * R.h) * IH, jr = rng(seed + i * 13 + t2 * 3 + k);
        if (cyc > 1) continue;
        const y1 = Math.min(yy + len, (R.y + R.h) * IH);
        x.strokeStyle = col || 'rgba(226,232,236,0.34)'; x.lineWidth = 1.2 + r() * 1.3;
        x.beginPath(); x.moveTo(px + (jr() - 0.5) * 1.5, yy); x.quadraticCurveTo(px + (jr() - 0.5) * 5, (yy + y1) / 2, px + (jr() - 0.5) * 2.5, y1); x.stroke();
        x.fillStyle = col || 'rgba(232,238,242,0.4)'; x.beginPath(); x.ellipse(px, y1, 1.7, 2.6, 0, 0, 7); x.fill();
      }
    });
  };
}
function glow(xn, yn, rn, col, a) {   // flat-ish coloured light, flickers on twos
  return x => {
    x.globalCompositeOperation = 'screen';
    const gr = x.createRadialGradient(xn * IW, yn * IH, 0, xn * IW, yn * IH, rn * IW);
    gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(0.55, col.replace('A', a * 0.45)); gr.addColorStop(1, col.replace('A', 0));
    x.fillStyle = gr; x.fillRect(0, 0, IW, IH); x.globalCompositeOperation = 'source-over';
  };
}
function flick(f, seed, lo, hi) { const k = f >> 1; return lerp(lo, hi, 0.5 + 0.5 * Math.sin(k * 0.37 + seed) * 0.6 + (hash(k, seed) - 0.5) * 0.4); }
function shade(a, col) { if (a <= 0) return; g.fillStyle = col || `rgba(0,0,0,${a})`; if (!col) g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, OY, W, PH); }
function sub(text, u0, u1, lt) {
  if (lt < u0 || lt > u1) return;
  g.save(); g.font = '500 33px "Helvetica Neue", Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const y = PY + PH - 34;
  g.lineJoin = 'round'; g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 5; g.shadowOffsetY = 1.5;
  g.strokeStyle = 'rgba(10,10,10,0.85)'; g.lineWidth = 4; g.strokeText(text, W / 2, y);
  g.shadowColor = 'transparent'; g.fillStyle = '#f5f3ea'; g.fillText(text, W / 2, y); g.restore();
}
function finish(f, o) {
  o = o || {};
  if (!o.noGrain) {
    g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = o.grain || 0.16; g.imageSmoothingEnabled = true;
    const k = (f >> 1) % 4, ox = hash(f >> 1, 5) * 40, oy = hash(f >> 1, 9) * 40;
    g.drawImage(grains[k], -ox, PY - oy, W + 80, PH + 80); g.restore();
    const v = g.createRadialGradient(W / 2, PY + PH / 2, PH * 0.55, W / 2, PY + PH / 2, W * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${o.vig == null ? 0.22 : o.vig})`); g.fillStyle = v; g.fillRect(0, PY, W, PH);
  }
  drawSubs();
  if (!o.noBars) { g.fillStyle = '#000'; g.fillRect(0, 0, W, PY); g.fillRect(0, PY + PH, W, H - PY - PH); }
}
const C = (x, y, z, r) => ({ x, y, z, r: r || 0 });
const seq = (lt, arr) => { let n = arr[0][1]; for (const [t, name] of arr) if (lt >= t) n = name; return n; };   // drawings exposed on twos or threes
const ov = (...fns) => x => fns.forEach(fn => fn && fn(x));
const bcv = mk(8, 8), bctx = bcv.getContext('2d');
function breathe(name, R, f, amp) {     // the chest rises a pixel or two, redrawn on threes
  return x => {
    const im = IM[posed(name)]; if (!im) return;
    const k = Math.floor(f / 3) * 3 / FPS, a = (amp || 0.008) * (0.5 + 0.5 * Math.sin(k * 2 * Math.PI / 4.4));
    const sx = R.x * IW, sy = R.y * IH, sw = Math.min(R.w * IW, IW - sx) | 0, sh = Math.min(R.h * IH, IH - sy) | 0;
    fit(bcv, sw, sh);
    bctx.globalCompositeOperation = 'source-over'; bctx.clearRect(0, 0, sw, sh);
    const dw = sw * (1 + a * 0.5), dh = sh * (1 + a);
    bctx.drawImage(im, sx, sy, sw, sh, (sw - dw) / 2, sh - dh, dw, dh);
    bctx.globalCompositeOperation = 'destination-in'; bctx.save(); bctx.translate(sw / 2, sh / 2); bctx.scale(sw / 2, sh / 2);
    const gr = bctx.createRadialGradient(0, 0, 0.45, 0, 0, 1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = gr; bctx.fillRect(-1, -1, 2, 2); bctx.restore();
    x.drawImage(bcv, sx, sy);
  };
}
// ---- small facial life, independent of the mouth: a region of a variant drawing laid over the plate with a soft edge
const pcv = mk(8, 8), pctx = pcv.getContext('2d');
function patch(name, R, alpha) {            // R = { x, y, w, h } in image fractions
  return x => { const im = IM[name]; if (!im) return; const sx = R.x * IW | 0, sy = R.y * IH | 0, sw = R.w * IW | 0, sh = R.h * IH | 0;
    fit(pcv, sw, sh);
    pctx.globalCompositeOperation = 'source-over'; pctx.clearRect(0, 0, sw, sh); pctx.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
    pctx.globalCompositeOperation = 'destination-in'; pctx.save(); pctx.translate(sw / 2, sh / 2); pctx.scale(sw / 2, sh / 2);
    const gr = pctx.createRadialGradient(0, 0, 0.55, 0, 0, 1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); pctx.fillStyle = gr; pctx.fillRect(-1, -1, 2, 2); pctx.restore();
    x.save(); x.globalAlpha = alpha == null ? 1 : alpha; x.drawImage(pcv, sx, sy); x.restore(); };
}
// life(base, who, f, { eyes: R, brows: R, look: R }): blinks (base_k), raised eyebrows (base_b) and a glance aside (base_e), each on its own rhythm.
// Blinks come every 2.6 to 5.5 s and last 3 frames; the brows go up on stressed syllables of that character's own lines and now and then while listening.
function life(base, who, f, o) {
  const t = NOW, seed = base.length * 13 + base.charCodeAt(0), fns = [];
  if (o.eyes && IM[base + '_k']) { let t0 = 0, n = 0; while (true) { const gap = 2.6 + 2.9 * hash(n, seed); if (t0 + gap > t) break; t0 += gap; n++; } if (n > 0 && t - t0 < 3 / FPS) fns.push(patch(base + '_k', o.eyes)); }
  if (o.brows && IM[base + '_b']) { const L = LINES.find(l => l.who === who && l.mode === 'room' && t >= l.t0 && t < l.t1); let up = false;
    if (L && VO[L.id]) { const k = Math.floor((t - L.t0) * 12), e = VO[L.id].e; up = +e[k] === 2 && hash(Math.floor(k / 9), seed + 5) > 0.45; }
    else { const per = 5.5 + 3 * hash(1, seed + 3), u = (t + 2 * hash(2, seed)) % per; up = u < 0.7 + 0.5 * hash(Math.floor(t / per), seed + 7); }
    if (up) fns.push(patch(base + '_b', o.brows)); }
  if (o.look && IM[base + '_e']) { const per = 7 + 4 * hash(4, seed), u = (t + 3 * hash(5, seed)) % per; if (u > per - 1.3 && u < per - 0.3) fns.push(patch(base + '_e', o.look)); }
  return x => fns.forEach(fn => fn(x));
}
const lamp = (lx, ly, f, seed) => glow(lx, ly, .13, 'rgba(255,186,110,A)', flick(f, seed, 0, .075));
function brestLife(lt, f) {             // rain glinting on the wet street, the harbour light turning
  return x => {
    const r = rng(900 + (f >> 2)); x.lineCap = 'round';
    for (let i = 0; i < 16; i++) { const px = (.43 + r() * .2) * IW, py = (.8 + r() * .18) * IH, l = 4 + r() * 12; x.strokeStyle = `rgba(235,225,200,${.1 + r() * .2})`; x.lineWidth = 1 + r(); x.beginPath(); x.moveTo(px, py); x.lineTo(px + l, py + (r() - .5)); x.stroke(); }
    if ((lt % 3.4) < 0.3) glow(.931, .411, .03, 'rgba(255,235,190,A)', .85)(x);
  };
}
const DIMR = 'rgba(190,200,210,0.26)';

/* ---------- the film ---------- */
const SEG = [], T = {}, LINES = [];
let NOW = 0, SUBS = !/[?&]nosub/.test(location.search);
const VD = id => (typeof VO !== 'undefined' && VO[id] ? VO[id].d : 2);
function seg(id, dur, draw) { const t0 = SEG.length ? SEG[SEG.length - 1].t1 : 0; SEG.push({ id, t0, t1: t0 + dur, dur, draw }); T[id] = t0; }
function chunks(text) {
  const parts = text.match(/[^.?!…]+[.?!…]*\s*/g) || [text], out = []; let cur = '';
  for (const p of parts) { if ((cur + p).length > 74 && cur) { out.push(cur.trim()); cur = p; } else cur += p; }
  if (cur.trim()) out.push(cur.trim());
  const cut = s => { if (s.length <= 88) return [s]; const mid = s.length / 2; let best = -1, bc = -1; for (let i = 20; i < s.length - 20; i++) { if (s[i] !== ' ') continue; if (best < 0 || Math.abs(i - mid) < Math.abs(best - mid)) best = i; if (',;:'.includes(s[i - 1]) && (bc < 0 || Math.abs(i - mid) < Math.abs(bc - mid))) bc = i; }
    const k = bc > 0 && Math.abs(bc - mid) < s.length * 0.28 ? bc : best; return k < 0 ? [s] : [...cut(s.slice(0, k)), ...cut(s.slice(k + 1))]; };
  return out.flatMap(cut);
}
function say(id, who, text, tAbs, mode) {
  const d = VD(id), ch = chunks(text), tot = ch.reduce((a, c) => a + c.length + 8, 0); let acc = 0;
  const subs = ch.map(c => { const a = acc; acc += (c.length + 8) / tot; return { text: c, a, b: acc }; });
  LINES.push({ id, who, text, t0: tAbs, t1: tAbs + d, subs, mode: mode || 'room' });
}
// a shot that carries spoken lines: its length follows the recordings
function shot(id, o, draw) {
  const t0 = SEG.length ? SEG[SEG.length - 1].t1 : 0, marks = {}; let t = o.pre == null ? 0.5 : o.pre;
  for (const [lid, who, text, gap, mode] of (o.lines || [])) { marks[lid] = t; say(lid, who, text, t0 + t, mode); t += VD(lid) + (gap == null ? 0.45 : gap); marks[lid + '_end'] = marks[lid] + VD(lid); }
  seg(id, Math.max(o.min || 0, t + (o.post == null ? 0.4 : o.post)), (lt, d, f) => draw(lt, d, f, marks));
}
const mouthOf = who => { const L = LINES.find(l => l.who === who && l.mode === 'room' && NOW >= l.t0 && NOW < l.t1); if (!L || !VO[L.id]) return 0; return +VO[L.id].e[Math.floor((NOW - L.t0) * 12)] || 0; };
function face(base, who, lt, blinks) {
  FACEWHO[base] = who;
  const m = mouthOf(who); if (m) return base + '_m' + m;
  if (blinks) for (const b of blinks) if (lt > b && lt < b + 0.17) return base + '_k';
  return base;
}
function drawSubs() {
  if (!SUBS) return;
  const L = LINES.find(l => NOW >= l.t0 - 0.05 && NOW < l.t1 + 0.25); if (!L) return;
  const u = clamp((NOW - L.t0) / (L.t1 - L.t0), 0, 0.999), s = L.subs.find(x => u >= x.a && u < x.b) || L.subs[L.subs.length - 1];
  let rows = [s.text];
  if (s.text.length > 46) { const mid = s.text.length / 2; let best = -1; for (let i = 0; i < s.text.length; i++) if (s.text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i; if (best > 0) rows = [s.text.slice(0, best), s.text.slice(best + 1)]; }
  const inner = L.mode !== 'room';
  g.save(); g.font = (inner ? 'italic ' : '') + '500 30px "Helvetica Neue", Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  rows.forEach((r, i) => { const y = PY + PH - 30 - (rows.length - 1 - i) * 37;
    g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 5; g.shadowOffsetY = 1.5; const dk = typeof SUBDARK !== 'undefined' && SUBDARK && !(typeof subLight === 'function' && subLight()); if (dk) { g.shadowColor = 'rgba(255,255,255,0.9)'; g.shadowBlur = 6; g.shadowOffsetY = 0; }
    g.strokeStyle = dk ? 'rgba(252,250,245,0.92)' : 'rgba(10,10,10,0.85)'; g.lineWidth = dk ? 5 : 4; g.strokeText(r, W / 2, y);
    g.shadowColor = 'transparent'; g.fillStyle = dk ? '#23262b' : '#f5f3ea'; g.fillText(r, W / 2, y); });
  g.restore();
}
const off = mk(W, PH), octx = off.getContext('2d');
function blueA(name, c, f, amp) {       // a painted plate with a living, boiling line (redrawn on twos)
  const sg = g, so = OY; g = octx; OY = 0; if (c.r) { octx.fillStyle = (typeof DREAMBG !== 'undefined' ? DREAMBG : '#0b1fc9'); octx.fillRect(0, 0, W, PH); } plate(name, c); g = sg; OY = so;
  const t2 = f >> 1, a = amp == null ? 1.1 : amp, SH = 16;
  for (let y = 0; y < PH; y += SH) {
    const dx = (vnoise(y / 70 + t2 * 3.17, t2 * 1.31) - 0.5) * 2 * a, dy = (vnoise(y / 90 + 40, t2 * 2.3) - 0.5) * a;
    g.drawImage(off, 0, y, W, SH, dx, OY + y + dy, W, SH + 0.6);
  }
}

function titleOver(a, tw, dy) { if (a <= 0 || !IM.title) return; g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = Math.round(clamp(a) * 8) / 8; const w = tw || 700, th = w * IM.title.height / IM.title.width; g.drawImage(IM.title, W / 2 - w / 2, PY + PH / 2 - th / 2 + (dy || -4), w, th); g.restore(); }
// a metamorphosis: drawings exposed one after another, each growing softly out of the last, under one camera move
function chain(names, lt, f, t0, t1, cam, o) {
  o = o || {}; const tq = (f >> 1) * 2 / FPS - (o.abs || 0), step = (t1 - t0) / names.length, gt = Math.min(o.gt || 1.4, step * 0.8);
  const i = clamp(Math.floor((lt - t0) / step), 0, names.length - 1), gp = i > 0 ? clamp(((o.abs != null ? tq : lt) - t0 - i * step) / gt) : 1;
  if (gp < 1) { blueA(names[i - 1], cam, f, o.amp); grow(() => blueA(names[i], cam, f, o.amp), gp, null, false, 0.2); } else blueA(names[i], cam, f, o.amp);
}
function endCard(lines, dur) {
  seg('card', dur || 7.0, (lt, d, f) => {
    const a = Math.round(clamp(lt / 1.2) * clamp((d - lt) / 1.2) * 8) / 8; if (a <= 0) return true;
    g.save(); g.globalAlpha = a;
    if (IM.title) { const tw = 560, th = tw * IM.title.height / IM.title.width; g.globalCompositeOperation = 'screen'; g.drawImage(IM.title, W / 2 - tw / 2, H / 2 - th / 2 - 62, tw, th); g.globalCompositeOperation = 'source-over'; }
    g.textAlign = 'center'; g.fillStyle = '#d9d5c8';
    g.font = 'italic 22px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif'; g.fillText(lines[0], W / 2, H / 2 + 58);
    g.font = '30px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif'; g.fillText(lines[1], W / 2, H / 2 + 100);
    g.restore(); return true;
  });
}
