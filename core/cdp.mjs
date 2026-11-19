// usage: node cdp.mjs <url> <js expression to return when title==ready>
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
const CHROME_BIN = process.env.CHROME || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');   // same scripts on the Mac and on the PC
const TMPD = tmpdir().replace(/\\/g, '/');
const [url, expr] = process.argv.slice(2);
const port = 9300 + Math.floor(Math.random() * 500);
const ch = spawn(CHROME_BIN, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${TMPD}/chf_cdp${port}`, '--autoplay-policy=no-user-gesture-required', url], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
try {
  let tabs; for (let i = 0; i < 40; i++) { await sleep(300); try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find(t => t.type === 'page')) break; } catch (e) {} }
  const tab = tabs.find(t => t.type === 'page');
  ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
  const ev = e => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: e, returnByValue: true, awaitPromise: true } })); });
  for (let i = 0; i < (process.argv[4] ? 6 : 300); i++) { const r = await ev('document.title + "|" + (document.getElementById("dump") ? 1 : 0)'); if (r.result.value.startsWith('ready') || r.result.value.endsWith('|1')) break; await sleep(500); }
  const r = await ev(expr); console.log(typeof r.result.value === 'string' ? r.result.value : JSON.stringify(r.result.value ?? r));
} finally { try { ws.close(); } catch (e) {} ch.kill(); }
