#!/usr/bin/env node
// film.mjs — drive a self-contained HTML film that follows the FILM contract
// (see references/html-film-contract.md) and turn it into stills, a contact
// sheet, or a frame-exact MP4.
//
//   node film.mjs check   film.html
//   node film.mjs stills  film.html --at 3.5,12,40.25 --out review/stills
//   node film.mjs contact film.html --n 18 --out review/contact.png
//   node film.mjs subs    film.html --out subs            (writes fr.vtt, en.vtt from FILM.subtitles)
//   node film.mjs render  film.html --out renders/film.mp4 [--fps 24] [--from 0 --to 10]
//                         [--subs fr=subs/fr.vtt,en=subs/en.vtt] [--crf 22] [--maxrate 6M] [--keep-wav 1]
//
// Output: one JSON line on stdout ({"ok":true,...} or {"ok":false,"error":...}).

import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const [, , mode, file, ...rest] = process.argv;
const opt = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) { opt[rest[i].slice(2)] = rest[i + 1]; i++; }
}
const out = (o) => { console.log(JSON.stringify(o)); process.exit(o.ok ? 0 : 1); };
if (!mode || !file) out({ ok: false, error: 'usage: film.mjs check|stills|contact|render film.html [options]' });
if (!fs.existsSync(file)) out({ ok: false, error: `no such file: ${file}` });

const W = Number(opt.width || 1920), H = Number(opt.height || 1080);

async function open() {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--disable-gpu-vsync'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const url = pathToFileURL(path.resolve(file)).href + '?render=1';
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  const has = await page.evaluate(() => typeof window.FILM === 'object' && typeof window.FILM.seek === 'function');
  if (!has) { await browser.close(); out({ ok: false, error: 'window.FILM.seek is missing: the film does not follow the FILM contract', errors }); }
  await page.evaluate(async () => { if (window.FILM.ready) await window.FILM.ready; });
  const info = await page.evaluate(() => ({ duration: window.FILM.duration, hasAudio: typeof window.FILM.audio === 'function' }));
  return { browser, page, errors, info };
}

async function seekShot(page, t, type = 'png') {
  await page.evaluate(async (t) => { await window.FILM.seek(t); }, t);
  return page.screenshot({ type, quality: type === 'jpeg' ? 95 : undefined, animations: 'disabled' });
}

function ff(args, input) {
  return new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = ''; p.stderr.on('data', (d) => (err += d));
    p.on('close', (c) => (c === 0 ? res() : rej(new Error(err))));
    if (input) input(p.stdin);
  });
}

const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;

(async () => {
  const { browser, page, errors, info } = await open();
  const D = Number(info.duration);
  if (!(D > 0)) { await browser.close(); out({ ok: false, error: 'FILM.duration must be a positive number of seconds' }); }

  if (mode === 'check') {
    // Determinism: the same time must give the same picture, whatever was seeked before.
    const t = Math.min(D * 0.37, D - 0.1);
    const a = await seekShot(page, t);
    await seekShot(page, Math.min(D * 0.8, D - 0.05));
    await seekShot(page, 0);
    const b = await seekShot(page, t);
    const same = Buffer.compare(a, b) === 0;
    await browser.close();
    out({ ok: same && errors.length === 0, duration: D, hasAudio: info.hasAudio, deterministic: same, errors,
      hint: same ? undefined : 'FILM.seek(t) is not a pure function of t: remove Math.random without a seed, performance.now(), rAF accumulators and CSS animations' });
  }

  if (mode === 'stills') {
    const dir = opt.out || 'stills'; fs.mkdirSync(dir, { recursive: true });
    const times = String(opt.at || '').split(',').filter(Boolean).map(Number);
    const files = [];
    for (const t of times) { const f = path.join(dir, `t${t.toFixed(2).padStart(7, '0')}.png`); fs.writeFileSync(f, await seekShot(page, t)); files.push(f); }
    await browser.close(); out({ ok: true, files, errors });
  }

  if (mode === 'contact') {
    const n = Number(opt.n || 18), cols = Number(opt.cols || 6);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'contact-'));
    const times = [];
    for (let i = 0; i < n; i++) {
      // evenly spaced, avoiding the exact first and last frame, plus a little jitter so repeated sheets differ
      const t = Math.min(D - 0.05, Math.max(0, ((i + 0.5) / n) * D + (opt.random ? (Math.random() - 0.5) * (D / n) * 0.8 : 0)));
      times.push(t);
      fs.writeFileSync(path.join(tmp, `f${String(i).padStart(3, '0')}.png`), await seekShot(page, t));
    }
    await browser.close();
    const o = opt.out || 'contact.png'; fs.mkdirSync(path.dirname(path.resolve(o)), { recursive: true });
    const rows = Math.ceil(n / cols);
    await ff(['-framerate', '1', '-i', path.join(tmp, 'f%03d.png'),
      '-vf', `scale=480:-1,tile=${cols}x${rows}:padding=6:margin=6:color=0x202020`, '-frames:v', '1', o]);
    out({ ok: true, out: o, times: times.map(fmt), errors });
  }

  if (mode === 'subs') {
    // export FILM.subtitles {fr:[[start,end,text]],en:[...]} to one .vtt per language
    const subs = await page.evaluate(() => window.FILM.subtitles || {});
    await browser.close();
    const dir = opt.out || 'subs'; fs.mkdirSync(dir, { recursive: true });
    const ts = (s) => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = (s % 60).toFixed(3).padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${x}`; };
    const files = [];
    for (const [lang, cues] of Object.entries(subs)) {
      if (!cues.length) continue;
      const f = path.join(dir, `${lang}.vtt`);
      fs.writeFileSync(f, 'WEBVTT\n\n' + cues.map(([a, b, txt], i) => `${i + 1}\n${ts(a)} --> ${ts(b)}\n${txt}\n`).join('\n'));
      files.push(f);
    }
    out({ ok: true, files });
  }

  if (mode === 'render') {
    const fps = Number(opt.fps || 24);
    const from = Number(opt.from || 0), to = Math.min(D, Number(opt.to || D));
    const o = opt.out || 'film.mp4'; fs.mkdirSync(path.dirname(path.resolve(o)), { recursive: true });
    const silent = o.replace(/\.mp4$/, '') + '.video.mp4';
    const frames = Math.round((to - from) * fps);
    const t0 = Date.now();
    await ff(['-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', String(opt.crf || 22), '-maxrate', String(opt.maxrate || '6M'), '-bufsize', '12M', '-preset', 'slow', '-r', String(fps), silent],
      async (stdin) => {
        for (let i = 0; i < frames; i++) {
          const buf = await seekShot(page, from + i / fps, 'jpeg');
          if (!stdin.write(buf)) await new Promise((r) => stdin.once('drain', r));
          if (i % (fps * 10) === 0) process.stderr.write(`frame ${i}/${frames}\n`);
        }
        stdin.end();
      });
    let wav = null;
    if (info.hasAudio) {
      const b64 = await page.evaluate(async ([from, to]) => {
        const ab = await window.FILM.audio(from, to);
        let s = ''; const u = new Uint8Array(ab);
        for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
        return btoa(s);
      }, [from, to]);
      wav = o.replace(/\.mp4$/, '') + '.wav';
      fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
    }
    await browser.close();
    const inputs = ['-i', silent]; const maps = ['-map', '0:v'];
    let k = 1;
    if (wav) { inputs.push('-i', wav); maps.push('-map', `${k}:a`); k++; }
    const subs = String(opt.subs || '').split(',').filter(Boolean).map((s) => s.split('='));
    const meta = [];
    subs.forEach(([lang, f], j) => { inputs.push('-i', f); maps.push('-map', `${k}:s`); meta.push(`-metadata:s:s:${j}`, `language=${lang === 'fr' ? 'fre' : lang === 'en' ? 'eng' : lang}`); k++; });
    await ff([...inputs, ...maps, '-c:v', 'copy', ...(wav ? ['-c:a', 'aac', '-b:a', '192k'] : []), ...(subs.length ? ['-c:s', 'mov_text', ...meta] : []), '-t', String(to - from), '-movflags', '+faststart', o]);
    fs.unlinkSync(silent); if (wav && !opt['keep-wav']) fs.unlinkSync(wav);
    out({ ok: true, out: o, frames, fps, seconds: to - from, audio: !!wav, subs: subs.map((s) => s[0]), renderSeconds: Math.round((Date.now() - t0) / 1000), errors });
  }

  await browser.close();
  out({ ok: false, error: `unknown mode ${mode}` });
})().catch((e) => out({ ok: false, error: String(e && e.stack || e) }));
