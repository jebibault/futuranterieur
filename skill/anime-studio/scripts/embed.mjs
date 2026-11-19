#!/usr/bin/env node
// embed.mjs — build the single-file film from its source.
// Every string "asset:<path>" (path relative to the source file) is replaced by a data URI.
// Keeps the source small enough for an agent to read and edit; the built file is self-contained.
//   node embed.mjs film/film.src.html film/film.html
import fs from 'node:fs';
import path from 'node:path';

const [, , src, dst] = process.argv;
if (!src || !dst) { console.log(JSON.stringify({ ok: false, error: 'usage: embed.mjs src.html out.html' })); process.exit(1); }
const dir = path.dirname(path.resolve(src));
const types = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', woff2: 'font/woff2', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg' };
const missing = [], used = new Set();
let html = fs.readFileSync(src, 'utf8').replace(/(["'`])asset:([^"'`]+)\1/g, (m, q, p) => {
  const f = path.resolve(dir, p);
  if (!fs.existsSync(f)) { missing.push(p); return m; }
  used.add(p);
  const t = types[path.extname(f).slice(1).toLowerCase()] || 'application/octet-stream';
  return `${q}data:${t};base64,${fs.readFileSync(f).toString('base64')}${q}`;
});
fs.writeFileSync(dst, html);
const mb = +(fs.statSync(dst).size / 1048576).toFixed(1);
console.log(JSON.stringify({ ok: missing.length === 0, out: dst, assets: [...used], missing, sizeMB: mb }));
process.exit(missing.length ? 1 : 0);
