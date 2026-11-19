// usage: node grab.mjs <page url> <out prefix> t1 t2 ...   -> <prefix>_<t>.jpg (frames rendered in one browser, after everything is loaded)
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
const CHROME_BIN = process.env.CHROME || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');   // same scripts on the Mac and on the PC
const TMPD = tmpdir().replace(/\\/g, '/');
const [url, prefix, ...ts] = process.argv.slice(2);
const port = 9400 + Math.floor(Math.random() * 500);
const ch = spawn(CHROME_BIN, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${TMPD}/chf_grab${port}`, url], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const ev = e => new Promise(res => { const i = ++id; pend.set(i, r => res(r.result ? r.result.value : null)); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: e, returnByValue: true, awaitPromise: true } })); });
try {
  let tabs; for (let i = 0; i < 60; i++) { await sleep(300); try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find(t => t.type === 'page')) break; } catch (e) {} }
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
  for (let i = 0; i < 240; i++) { if (await ev('!!window.FILM')) break; await sleep(500); }
  for (const t of ts) { const b = await ev(`(()=>{FILM.render(${t});const c=document.getElementById('film'),s=document.createElement('canvas');s.width=640;s.height=360;s.getContext('2d').drawImage(c,0,0,640,360);return s.toDataURL('image/jpeg',0.85).slice(23)})()`); writeFileSync(`${prefix}_${t}.jpg`, Buffer.from(b, 'base64')); }
} finally { try { ws.close(); } catch (e) {} ch.kill(); }
