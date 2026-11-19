const DUR = SEG[SEG.length - 1].t1;

function render(t) {
  const f = Math.floor(t * FPS + 1e-6); NOW = t;
  ctx.setTransform(RSC, 0, 0, RSC, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); document.body.style.background = '#000';
  const s = SEG.find(s => t >= s.t0 && t < s.t1); if (!s) return;
  g = ctx; OY = PY;
  ctx.save(); ctx.beginPath(); ctx.rect(0, PY, W, PH); if (s.id !== 'blue') ctx.clip();
  // a hair of gate weave
  if (s.id !== 'blue') ctx.translate((hash(f, 1) - .5) * 0.5, (hash(f, 2) - .5) * 0.5);
  const done = s.draw(t - s.t0, s.dur, f);
  ctx.restore();
  if (!done && s.id.indexOf('black') !== 0) finish(f);
  if (s.id === 'card') { ctx.fillStyle = '#000'; }
}

/* ---------- sound (all synthesised in the browser, after the click) ---------- */
let AC = null, T0 = 0;
function buildAudio(A, t0) {
  // events before 'now' (after a seek) are clamped; voices that are already over are never created
  const at = t => Math.max(0, t0 + t), dead = t => t0 + t < A.currentTime - 0.01, late = t => Math.max(0, A.currentTime - (t0 + t));
  const master = A.createGain(); master.gain.value = 0.72;
  const comp = A.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; master.connect(comp); const out = A.createGain(); comp.connect(out); out.connect(A.destination); A._out = out;
  function impulse(sec, dec) { const n = sec * A.sampleRate | 0, b = A.createBuffer(2, n, A.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, dec); } return b; }
  function noiseBuf(sec) { const n = sec * A.sampleRate | 0, b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
  const G = v => { const x = A.createGain(); x.gain.value = v; return x; };
  const F = (type, f, q) => { const x = A.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q != null) x.Q.value = q; return x; };
  const NB = noiseBuf(5);
  // world reverb and music reverb are separate, so the music can be cut dead
  const wrev = A.createConvolver(); wrev.buffer = impulse(3.5, 2.6); const wrevG = G(0.5); wrev.connect(wrevG); wrevG.connect(master);
  const music = G(1), mrev = A.createConvolver(); mrev.buffer = impulse(4.5, 2.2); const mrevG = G(0.7); if (!VBUF.MUS) music.connect(master);     // a composed theme replaces the synthesised music mrev.connect(mrevG); mrevG.connect(music);
  const mdry = G(1); mdry.connect(music);

  /* weather and rooms */
  const rs = A.createBufferSource(); rs.buffer = NB; rs.loop = true; const rhp = F('highpass', 500), rlp = F('lowpass', 9000), rg = G(0);
  rs.connect(rhp); rhp.connect(rlp); rlp.connect(rg); rg.connect(master); rs.start(at(0));
  const rs2 = A.createBufferSource(); rs2.buffer = NB; rs2.loop = true; rs2.playbackRate.value = 0.5; const r2lp = F('lowpass', 260), r2g = G(0); rs2.connect(r2lp); r2lp.connect(r2g); r2g.connect(master); rs2.start(at(0));
  const set = (p, v, t) => p.setValueAtTime(v, at(t)), ramp = (p, v, t) => p.linearRampToValueAtTime(v, at(t));
  // rain(t, hiss, rumble, lowpass): hard change at t ; rainTo ramps to it
  const rain = (t, hi, lo, lp) => { set(rg.gain, hi, t); set(r2g.gain, lo, t); if (lp) set(rlp.frequency, lp, t); };
  const rainTo = (t, hi, lo) => { ramp(rg.gain, hi, t); ramp(r2g.gain, lo, t); };
  rain(0, 0, 0, 9000);
  function horn(t, gain, f) {
    if (dead(t + 4.3)) return;
    const o1 = A.createOscillator(), o2 = A.createOscillator(), o3 = A.createOscillator(); o1.type = o2.type = 'sawtooth'; o3.type = 'triangle';
    o1.frequency.value = f; o2.frequency.value = f * 1.006; o3.frequency.value = f * 1.5;
    const lp = F('lowpass', 360, 1.5), e = G(0), o3g = G(0.35);
    o1.connect(lp); o2.connect(lp); o3.connect(o3g); o3g.connect(lp); lp.connect(e); e.connect(master); e.connect(wrev);
    const s = at(t); e.gain.setValueAtTime(0, s); e.gain.linearRampToValueAtTime(gain, s + 0.5); e.gain.setValueAtTime(gain, s + 2.4); e.gain.exponentialRampToValueAtTime(0.0008, s + 4.2);
    [o1, o2, o3].forEach(o => { o.start(s); o.stop(s + 4.4); });
  }
  function tick(t, gain, hi) {
    if (dead(t)) return;
    const s = A.createBufferSource(); s.buffer = NB; const bp = F('bandpass', hi ? 3300 : 2500, 7), e = G(0);
    s.connect(bp); bp.connect(e); e.connect(master); const x = at(t);
    e.gain.setValueAtTime(gain, x); e.gain.exponentialRampToValueAtTime(0.0005, x + 0.045); s.start(x, Math.random() * 3, 0.06);
  }
  const ticks = (ta, tb, gain, skip) => { for (let t = ta, i = 0; t < tb; t += 1, i++) if (!skip || !skip(t)) tick(t, gain, i % 2); };
  // a steady tone: mains hum, a fridge, a machine room (freqs = [[hz, level], ...])
  function tone(ta, tb, gain, freqs, fade) {
    if (dead(tb)) return; const e = G(0), lp = F('lowpass', 1200); lp.connect(e); e.connect(master);
    (freqs || [[50, 1], [100.3, 0.3]]).forEach(([f, a]) => { const o = A.createOscillator(); o.frequency.value = f; const x = G(a); o.connect(x); x.connect(lp); o.start(at(ta)); o.stop(at(tb + .1)); });
    e.gain.setValueAtTime(0, at(ta)); e.gain.linearRampToValueAtTime(gain, at(ta + (fade || 0.6))); e.gain.setValueAtTime(gain, at(tb - 0.02)); e.gain.linearRampToValueAtTime(0, at(tb));
  }
  const HEADSET = [[96, 1], [144.2, 0.5], [192.5, 0.32], [288.6, 0.12], [48, 0.6]];
  // a short filtered noise: a door, a step, a cloth, a breath (f = centre frequency)
  function thud(t, gain, f, dur) {
    if (dead(t)) return; const s = A.createBufferSource(); s.buffer = NB; const bp = F('lowpass', f || 220), e = G(0); s.connect(bp); bp.connect(e); e.connect(master); e.connect(wrev);
    const x = at(t), d = dur || 0.18; e.gain.setValueAtTime(0, x); e.gain.linearRampToValueAtTime(gain, x + 0.01); e.gain.exponentialRampToValueAtTime(0.0005, x + d); s.start(x, Math.random() * 3, d + 0.05);
  }
  // slow breathing of a sleeper
  function breath(ta, tb, gain, period) {
    if (dead(tb)) return; const s = A.createBufferSource(); s.buffer = NB; s.loop = true; const bp = F('bandpass', 700, 1.2), e = G(0); s.connect(bp); bp.connect(e); e.connect(master);
    const P = period || 4.4; for (let t = ta; t < tb; t += P) { const x = at(t); e.gain.setValueAtTime(0.0001, x); e.gain.linearRampToValueAtTime(gain, x + P * 0.36); e.gain.linearRampToValueAtTime(0.0001, x + P * 0.5); e.gain.linearRampToValueAtTime(gain * 0.7, x + P * 0.8); e.gain.linearRampToValueAtTime(0.0001, x + P * 0.98); }
    s.start(at(ta)); s.stop(at(tb + 0.1));
  }

  /* voices (recorded) */
  const vroom = A.createConvolver(); vroom.buffer = impulse(0.7, 3.2); const vroomG = G(0.22); vroom.connect(vroomG); vroomG.connect(master);
  for (const L of LINES) {
    const buf = VBUF[L.id]; if (!buf || dead(L.t1)) continue;
    const src = A.createBufferSource(); src.buffer = buf; const e = G(1); let node = src;
    if (L.mode === 'room') { e.gain.value = 1.15; e.connect(vroom); }
    else if (L.mode === 'over') { e.gain.value = 1.15; const sg = G(0.3); e.connect(sg); sg.connect(wrev); }
    else if (L.mode === 'hall') { e.gain.value = 1.1; const sg = G(0.55); e.connect(sg); sg.connect(wrev); }
    else if (L.mode === 'device') { const hp = F('highpass', 420), lp = F('lowpass', 3200); src.connect(hp); hp.connect(lp); node = lp; e.gain.value = 1.25; const sg = G(0.2); e.connect(sg); sg.connect(wrev); }
    else if (L.mode === 'speaker') { const hp = F('highpass', 180), lp = F('lowpass', 5200); src.connect(hp); hp.connect(lp); node = lp; e.gain.value = 1.1; e.connect(vroom); }
    else e.gain.value = 1.3;                         // inner voice: close and dry
    node.connect(e); e.connect(master);
    const lateBy = late(L.t0); if (lateBy < buf.duration - 0.05) src.start(at(L.t0), lateBy);
  }

  /* instruments */
  function cello(f, t, d, gain, vib) {
    if (dead(t + d - 0.1)) return; d = Math.max(0.1, d - late(t));
    const s = at(t), e = G(0), lp = F('lowpass', 700, 0.8), b1 = F('peaking', 280, 1.2), b2 = F('peaking', 620, 2); b1.gain.value = 5; b2.gain.value = 4;
    [-5, 4].forEach(c => { const o = A.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = c;
      const l = A.createOscillator(), lg = G(0); l.frequency.value = 5.1 + Math.random() * .4; l.connect(lg); lg.connect(o.frequency);
      lg.gain.setValueAtTime(0, s); lg.gain.linearRampToValueAtTime(f * (vib == null ? 0.006 : vib), s + Math.min(1.2, d * .5));
      o.connect(lp); o.start(s); o.stop(s + d + 1); l.start(s); l.stop(s + d + 1); });
    lp.frequency.setValueAtTime(500, s); lp.frequency.linearRampToValueAtTime(Math.min(2400, 900 + f * 3), s + d * 0.5); lp.frequency.linearRampToValueAtTime(600, s + d + .6);
    lp.connect(b1); b1.connect(b2); b2.connect(e);
    e.gain.setValueAtTime(0, s); e.gain.linearRampToValueAtTime(gain, s + Math.min(0.5, d * 0.3)); e.gain.setValueAtTime(gain * 0.9, s + d); e.gain.linearRampToValueAtTime(0, s + d + 0.7);
    e.connect(mdry); const sg = G(0.5); e.connect(sg); sg.connect(mrev);
  }
  function choir(f, t, d, gain, glide) {
    if (dead(t + d - 0.1)) return; d = Math.max(0.1, d - late(t));
    const s = at(t), e = G(0), pre = G(1), out = F('lowpass', 4200);
    [-9, 0, 8].forEach(c => { const o = A.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, s); if (glide) o.frequency.exponentialRampToValueAtTime(f * glide, s + d); o.detune.value = c + (Math.random() - .5) * 4;
      const l = A.createOscillator(), lg = G(f * 0.004); l.frequency.value = 4.6 + Math.random(); l.connect(lg); lg.connect(o.frequency);
      o.connect(pre); o.start(s); o.stop(s + d + 2.2); l.start(s); l.stop(s + d + 2.2); });
    [[650, 5, 1], [1080, 6, 0.55], [2650, 8, 0.22], [3300, 9, 0.1]].forEach(([ff, q, a]) => { const b = F('bandpass', ff, q), x = G(a); pre.connect(b); b.connect(x); x.connect(out); });
    out.connect(e);
    e.gain.setValueAtTime(0, s); e.gain.linearRampToValueAtTime(gain, s + Math.min(1.4, d * 0.45)); e.gain.setValueAtTime(gain, s + d); e.gain.linearRampToValueAtTime(0, s + d + 1.6);
    const dg = G(0.45); e.connect(dg); dg.connect(mdry); e.connect(mrev);
  }
  function pulse(t, gain) {
    if (dead(t)) return;
    const s = at(t), o = A.createOscillator(), e = G(0); o.frequency.setValueAtTime(74, s); o.frequency.exponentialRampToValueAtTime(41, s + 0.13);
    e.gain.setValueAtTime(0, s); e.gain.linearRampToValueAtTime(gain, s + 0.012); e.gain.exponentialRampToValueAtTime(0.0008, s + 0.34);
    o.connect(e); e.connect(mdry); o.start(s); o.stop(s + 0.4);
  }
  // struck / plucked / blown instruments, so that each film can have its own colour
  function struck(f, t, gain, dec, parts, bright) {
    if (dead(t + 0.25)) return; const s = at(t), e = G(0), lp = F('lowpass', Math.min(6500, f * (bright || 7)), 0.5);
    parts.forEach(([n, a, k]) => { const o = A.createOscillator(); o.type = 'sine'; o.frequency.value = f * n; const pg = G(0); pg.gain.setValueAtTime(a, s); pg.gain.exponentialRampToValueAtTime(0.0005, s + dec * k); o.connect(pg); pg.connect(lp); o.start(s); o.stop(s + dec + 0.3); });
    lp.connect(e); e.gain.setValueAtTime(0, s); e.gain.linearRampToValueAtTime(gain, s + 0.008); e.gain.exponentialRampToValueAtTime(gain * 0.5, s + Math.min(0.3, dec * 0.2)); e.gain.exponentialRampToValueAtTime(0.0004, s + dec);
    e.connect(mdry); const sg = G(0.5); e.connect(sg); sg.connect(mrev);
  }
  const piano = (f, t, gain, dec) => struck(f, t, gain, dec || 3.4, [[1, 1, 1], [2.001, 0.5, 0.7], [3.004, 0.28, 0.5], [4.01, 0.14, 0.4], [5.02, 0.08, 0.3], [6.03, 0.04, 0.25]], 6);
  const bell = (f, t, gain, dec) => struck(f, t, gain, dec || 2.2, [[1, 1, 1], [2.76, 0.42, 0.45], [5.4, 0.2, 0.25], [8.9, 0.08, 0.15]], 12);     // a music box
  const pluck = (f, t, gain, dec) => struck(f, t, gain, dec || 1.1, [[1, 1, 1], [2, 0.35, 0.5], [3, 0.3, 0.35], [4, 0.1, 0.25]], 5);               // pizzicato / marimba
  function flute(f, t, d, gain) {
    if (dead(t + d - 0.1)) return; d = Math.max(0.1, d - late(t)); const s = at(t), e = G(0);
    const o = A.createOscillator(); o.type = 'sine'; o.frequency.value = f; const o2 = A.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2; const g2 = G(0.12);
    const l = A.createOscillator(), lg = G(0); l.frequency.value = 4.8; l.connect(lg); lg.connect(o.frequency); lg.gain.setValueAtTime(0, s); lg.gain.linearRampToValueAtTime(f * 0.006, s + Math.min(0.9, d * 0.6));
    const n = A.createBufferSource(); n.buffer = NB; n.loop = true; const nb = F('bandpass', f * 2, 3), ng = G(0.05); n.connect(nb); nb.connect(ng);
    o.connect(e); o2.connect(g2); g2.connect(e); ng.connect(e);
    e.gain.setValueAtTime(0, s); e.gain.linearRampToValueAtTime(gain, s + Math.min(0.18, d * 0.3)); e.gain.setValueAtTime(gain * 0.9, s + d); e.gain.linearRampToValueAtTime(0, s + d + 0.35);
    e.connect(mdry); const sg = G(0.6); e.connect(sg); sg.connect(mrev);
    [o, o2, l, n].forEach(x => { x.start(s); x.stop(s + d + 0.5); });
  }
  // play a line: seq = [[note name or Hz, beats], ...] (a rest when the note is null); returns the time after the last note
  function line(inst, seq, t, beat, gain, tr) { for (const [n, b] of seq) { if (n != null) { const f = (typeof n === 'number' ? n : N[n]) * (tr || 1); if (inst === flute || inst === cello || inst === choir) inst(f, t, b * beat * 0.96, gain); else inst(f, t, gain); } t += b * beat; } return t; }
  const N = { D1: 36.71, A1: 55, Bb1: 58.27, C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98, A2: 110, Bb2: 116.54, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, 'F#3': 185, G3: 196, A3: 220, Bb3: 233.08, C4: 261.63, 'C#4': 277.18, D4: 293.66, E4: 329.63, F4: 349.23, 'F#4': 369.99, G4: 392, A4: 440, Bb4: 466.16, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, 'F#5': 739.99, G5: 783.99, A5: 880, B3: 246.94, B4: 493.88, Eb4: 311.13, Eb5: 622.25, 'C#5': 554.37, Bb5: 932.33, D6: 1174.66, Eb3: 155.56, B2: 123.47, Ab3: 207.65, 'G#4': 415.3, 'G#3': 207.65, 'C#3': 138.59, 'D#4': 311.13 };
  const cutMusic = t => music.gain.setValueAtTime(0, at(t));
  const onMusic = (t, v) => music.gain.setValueAtTime(v, at(t));
  music.gain.setValueAtTime(0, at(0));
  // a recorded sound (not speech): sample(id, t, gain, rate, wet)
  function sample(sid, t, gain, rate, wet) {
    const buf = VBUF[sid]; if (!buf) return 0; const r = rate || 1, dur = buf.duration / r; if (dead(t + dur)) return dur;
    const src = A.createBufferSource(); src.buffer = buf; src.playbackRate.value = r; const e = G(gain == null ? 1 : gain); src.connect(e); e.connect(master); if (wet) { const sg = G(wet); e.connect(sg); sg.connect(wrev); }
    const lateBy = late(t); if (lateBy < dur - 0.03) src.start(at(t), lateBy * r); return dur;
  }
  SCORE({ piano, bell, pluck, flute, line, sample, A, at, dead, late, set, ramp, rain, rainTo, rg, r2g, rlp, horn, tick, ticks, tone, thud, breath, HEADSET, cello, choir, pulse, N, music, onMusic, cutMusic, master, wrev, mrev, G, F, NB });
  // the composed theme (vo/MUS.mp3): opening, a middle passage and the ending, ducked under the voices
  if (VBUF.MUS) { const mb = VBUF.MUS, md = mb.duration;
    const cue = (ta, off, dur, g0, gd, fi, fo) => { if (dead(ta + dur)) return; off = Math.max(0, Math.min(off, md - 1)); dur = Math.min(dur, md - off);
      const src = A.createBufferSource(); src.buffer = mb; const e = G(0); src.connect(e); e.connect(master);
      let v = 0; const st = 0.1; e.gain.setValueAtTime(0, at(ta));
      for (let t = ta; t < ta + dur; t += st) { const sp = LINES.some(l => t > l.t0 - 0.6 && t < l.t1 + 0.5), env = Math.max(0, Math.min(1, (t - ta) / fi, (ta + dur - t) / fo)); v += ((sp ? gd : g0) - v) * 0.1; if (t + st > A.currentTime - t0) e.gain.linearRampToValueAtTime(v * env, at(t + st)); }
      const lb = late(ta); if (lb < dur - 0.05) { src.start(at(ta), off + lb); src.stop(at(ta + dur) + 0.05); } };
    const cues = (typeof MUSCUES !== 'undefined') ? MUSCUES(T, DUR, md) : null;
    if (cues) cues.forEach(q => cue(...q));
    else { const mid = SEG.reduce((b, s) => Math.abs(s.t0 - DUR * 0.5) < Math.abs(b.t0 - DUR * 0.5) ? s : b, SEG[0]).t0, N = Math.min(54, md * 0.42);
      cue(0.5, 0, 26, 0.5, 0.15, 0.8, 5); cue(mid - 1, md * 0.36, 36, 0.32, 0.12, 3, 5); cue(DUR - 0.4 - N, md - N, N, 0.55, 0.14, 5, 1.2); }
  }
}

/* ---------- player ---------- */
const $ = id => document.getElementById(id);
const startEl = $('start'), endEl = $('end'), ctl = $('ctl'), seekEl = $('seek'), tmEl = $('tm'), stage = $('stage');
let raf = 0, lastF = -1, state = 'idle', pos = 0, muted = false, hideT = 0, scrubWas = null;
const fmt = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const now = () => state === 'playing' && AC ? clamp(AC.currentTime - T0, 0, DUR) : pos;
function killAudio() { if (AC) { try { AC.close(); } catch (e) {} AC = null; } }
function uiTime(t) { tmEl.textContent = fmt(t) + ' / ' + fmt(DUR); if (scrubWas === null) seekEl.value = Math.round(t / DUR * 1000); seekEl.style.setProperty('--p', (t / DUR * 100) + '%'); }
function ui() {
  const playing = state === 'playing';
  $('icPlay').style.display = playing ? 'none' : ''; $('icPause').style.display = playing ? '' : 'none';
  $('bPlay').setAttribute('aria-label', playing ? 'Pause' : 'Lecture');
  $('icVol').style.display = muted ? 'none' : ''; $('icMute').style.display = muted ? '' : 'none';
  $('bMute').setAttribute('aria-label', muted ? 'Rétablir le son' : 'Couper le son');
  ctl.hidden = state === 'idle'; uiTime(now());
}
function poke() { ctl.classList.add('show'); stage.style.cursor = ''; clearTimeout(hideT); if (state === 'playing') hideT = setTimeout(() => { if (state === 'playing' && scrubWas === null) { ctl.classList.remove('show'); stage.style.cursor = 'none'; } }, 2600); }
function playFrom(t) {
  t = clamp(t, 0, DUR - 0.05); cancelAnimationFrame(raf); killAudio();
  AC = new (window.AudioContext || window.webkitAudioContext)(); T0 = AC.currentTime + 0.12 - t; buildAudio(AC, T0); AC._out.gain.value = muted ? 0 : 1;
  if (AC.state === 'suspended') AC.resume();
  state = 'playing'; startEl.classList.remove('on'); endEl.classList.remove('on'); lastF = -1; ui(); poke(); loop();
}
function pause() { if (state !== 'playing') return; pos = now(); cancelAnimationFrame(raf); killAudio(); state = 'paused'; render(pos); ui(); poke(); }
function toggle() { if (state === 'playing') pause(); else if (state === 'paused') playFrom(pos); else if (state === 'ended') playFrom(0); }
function seek(t) {
  t = clamp(t, 0, DUR - 0.05);
  if (state === 'playing') { playFrom(t); return; }
  if (state === 'idle') return;
  pos = t; state = 'paused'; endEl.classList.remove('on'); render(t); ui(); poke();
}
function ended() { killAudio(); state = 'ended'; pos = DUR; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); document.body.style.background = '#000'; endEl.classList.add('on'); ui(); poke(); }
function loop() {
  if (state !== 'playing' || !AC) return;
  const t = AC.currentTime - T0;
  if (t >= DUR) { ended(); return; }
  const f = Math.floor(Math.max(0, t) * FPS);
  if (f !== lastF) { lastF = f; render(Math.max(0, t)); uiTime(Math.max(0, t)); }
  raf = requestAnimationFrame(loop);
}
function setMuted(m) { muted = m; if (AC && AC._out) AC._out.gain.value = m ? 0 : 1; ui(); poke(); }
function fullscreen() { const d = document; if (d.fullscreenElement) d.exitFullscreen(); else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {}); }
function wire() {
  startEl.addEventListener('click', () => playFrom(0)); $('replay').addEventListener('click', e => { e.stopPropagation(); playFrom(0); });
  cv.addEventListener('click', toggle);
  $('bPlay').addEventListener('click', toggle);
  $('bRw').addEventListener('click', () => seek(now() - 10)); $('bFf').addEventListener('click', () => seek(now() + 10));
  $('bMute').addEventListener('click', () => setMuted(!muted));
  const bs = $('bSub'), sb = () => { bs.style.opacity = SUBS ? 1 : 0.4; bs.setAttribute('aria-label', SUBS ? 'Masquer les sous-titres' : 'Afficher les sous-titres'); }; sb();
  bs.addEventListener('click', () => { SUBS = !SUBS; sb(); if (state !== 'playing') render(now()); poke(); });
  if (stage.requestFullscreen) $('bFs').addEventListener('click', fullscreen); else $('bFs').hidden = true;
  seekEl.addEventListener('input', () => { if (scrubWas === null) { scrubWas = state === 'playing'; if (scrubWas) pause(); } seek(seekEl.value / 1000 * DUR); });
  seekEl.addEventListener('change', () => { const w = scrubWas; scrubWas = null; if (w) playFrom(pos); else ui(); });
  ['pointermove', 'pointerdown'].forEach(ev => stage.addEventListener(ev, poke));
  document.addEventListener('keydown', e => {
    if (state === 'idle' || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === ' ' || k === 'k') toggle(); else if (k === 'ArrowLeft' || k === 'j') seek(now() - (e.shiftKey ? 2 : 10)); else if (k === 'ArrowRight' || k === 'l') seek(now() + (e.shiftKey ? 2 : 10));
    else if (k === 'm') setMuted(!muted); else if (k === 's') $('bSub').click(); else if (k === 'f') fullscreen(); else if (k === 'Home' || k === '0') seek(0); else return;
    e.preventDefault(); poke();
  });
}
const VBUF = {};
function loadVoices() {
  if (typeof VO === 'undefined') return Promise.resolve();
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, oc = new OC(1, 2, 44100);
  return Promise.all(Object.keys(VO).map(id => new Promise(res => {
    try { const bin = atob(VO[id].b), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      oc.decodeAudioData(u8.buffer, buf => { VBUF[id] = buf; res(); }, () => res()); } catch (e) { res(); }
  })));
}
function prep() {
  makeGrain(); makeMaskNoise();
  for (const c of CFG.comps) composite(c.a, c.b, c.regs, c.b);
}
Promise.all([loadAll(), loadVoices()]).then(() => {
  prep();
  const q = new URLSearchParams(location.search);
  if (q.has('t')) { const tt = parseFloat(q.get('t')); render(tt); if (q.has('ui')) { state = 'paused'; pos = tt; document.getElementById('loading').style.display = 'none'; ui(); ctl.classList.add('show'); } document.title = 'ready'; return; }
  if (q.has('wav')) { const O = new OfflineAudioContext(2, Math.ceil((DUR + 0.5) * 22050), 22050); buildAudio(O, 0); O.startRendering().then(b => { const d = b.getChannelData(0), n = 11025, out = []; for (let i = 0; i + n <= d.length; i += n) { let s = 0, p = 0; for (let j = i; j < i + n; j++) { s += d[j] * d[j]; p = Math.max(p, Math.abs(d[j])); } out.push(Math.round(Math.sqrt(s / n) * 1000) + '/' + Math.round(p * 100)); } const pre = document.createElement('pre'); pre.id = 'dump'; pre.textContent = JSON.stringify({ T, DUR }) + '\n' + out.join(' '); document.body.appendChild(pre); document.title = 'ready'; }).catch(e => { const pre = document.createElement('pre'); pre.id = 'dump'; pre.textContent = 'ERR ' + e + ' ' + e.stack; document.body.appendChild(pre); }); return; }
  window.FILM = { T, DUR, SEG, LINES, render, playFrom, pause, seek, toggle, audio: sr => { const O = new OfflineAudioContext(2, Math.ceil((DUR + 0.3) * sr), sr); buildAudio(O, 0); return O.startRendering(); }, get state() { return state; }, get now() { return now(); } };
  startEl.classList.add('on'); document.getElementById('loading').style.display = 'none'; wire(); ui();
});
})();