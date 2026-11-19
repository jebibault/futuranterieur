// usage: node shot.mjs <page url (may carry ?s=1.5)> <out prefix> t1 t2 ...   -> <prefix>_<t>.jpg at the canvas's full size, and prints render time per frame
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
const CHROME_BIN = process.env.CHROME || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');   // same scripts on the Mac and on the PC
const TMPD = tmpdir().replace(/\\/g, '/');
const [url, prefix, ...ts] = process.argv.slice(2);
const port = 9400 + Math.floor(Math.random() * 500);
const ch = spawn(CHROME_BIN, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${TMPD}/chf_shot${port}`, url], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const ev = e => new Promise(res => { const i = ++id; pend.set(i, r => { if (r && r.exceptionDetails) console.log('EXC', JSON.stringify(r.exceptionDetails).slice(0, 600)); res(r && r.result ? r.result.value : null); }); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: e, returnByValue: true, awaitPromise: true } })); });
try {
  let tabs; for (let i = 0; i < 60; i++) { await sleep(300); try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find(t => t.type === 'page')) break; } catch (e) {} }
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
  for (let i = 0; i < 600; i++) { if (await ev('!!window.FILM')) break; await sleep(500); }
  await ev('window.FONTS_READY ? FONTS_READY.then(() => 1) : 1');   // embedded typefaces must be loaded before the first frame
  await sleep(4000);
  console.log('canvas', await ev(`(()=>{const c=document.getElementById('film');return c.width+'x'+c.height+' missing='+JSON.stringify(window.MISSING||{})})()`));
  for (const t of ts) {
    const b = await ev(`(()=>{const c=document.getElementById('film');FILM.render(${t});return c.toDataURL('image/jpeg',0.93).slice(23)})()`);
    writeFileSync(`${prefix}_${t}.jpg`, Buffer.from(b, 'base64'));
  }
  console.log('ms per frame (render + jpeg)', await ev(`(()=>{const c=document.getElementById('film');const t0=performance.now();let n=0;for(let i=0;i<48;i++){FILM.render(${ts[0] || 10}+i/24);c.toDataURL('image/jpeg',0.93);n++}return Math.round((performance.now()-t0)/n)})()`));
} finally { try { ws.close(); } catch (e) {} ch.kill(); }
