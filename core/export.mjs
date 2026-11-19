// usage: node export.mjs <page url> <firstFrame> <lastFrameExclusive|end> <out.mp4> [audio.raw]
// Options (environment), all off by default so the usual exports do not change:
//   JQ=1       frames leave the browser as JPEG quality 1 (full colour resolution, 4:4:4) instead of 0.93 (4:2:0)
//   MBLUR=4    motion blur: a frame whose picture moves during the exposure (half the frame time, a 180 degree shutter) is the average of 4 renders spread over it;
//              frames that do not move, and renders that fall after a cut, are left alone, so nothing is blurred that should stay sharp
//   VENC=master   parts are encoded once, in the master format (HEVC 10 bits, BT.709 colours declared) instead of an intermediate H.264
import { spawn } from 'node:child_process';
import { writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
const CHROME_BIN = process.env.CHROME || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');   // same scripts on the Mac and on the PC
const TMPD = tmpdir().replace(/\\/g, '/');
const [url, a0, a1, out, audioOut] = process.argv.slice(2);
const port = 9400 + Math.floor(Math.random() * 500);
const ch = spawn(CHROME_BIN, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${TMPD}/chf_exp${port}`, '--window-size=1280,720', url], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const ev = e => new Promise((res, rej) => { const i = ++id; setTimeout(() => { if (pend.has(i)) { console.log('TIMEOUT'); process.exit(3); } }, 180000); pend.set(i, r => r.exceptionDetails ? rej(new Error(JSON.stringify(r.exceptionDetails).slice(0, 400))) : res(r.result.value)); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: e, returnByValue: true, awaitPromise: true } })); });
try {
  let tabs; for (let i = 0; i < 60; i++) { await sleep(300); try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find(t => t.type === 'page')) break; } catch (e) {} }
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
  for (let i = 0; i < 240; i++) { if (await ev('!!window.FILM')) break; await sleep(500); }
  await ev('window.FONTS_READY ? FONTS_READY.then(() => 1) : 1');   // embedded typefaces must be loaded before the first frame
  const DUR = await ev('FILM.DUR'), total = Math.ceil(DUR * 24), first = a0 === 'audio' ? 0 : +a0, last = a1 === 'end' ? total : Math.min(total, +a1);
  if (audioOut) {
    const n = await ev(`FILM.audio(44100).then(b=>{const L=b.getChannelData(0),R=b.getChannelData(1),n=L.length,u=new Uint8Array(n*4),dv=new DataView(u.buffer);for(let i=0;i<n;i++){dv.setInt16(i*4,Math.max(-1,Math.min(1,L[i]))*32767,true);dv.setInt16(i*4+2,Math.max(-1,Math.min(1,R[i]))*32767,true)}window.__PCM=u;return u.length})`);
    writeFileSync(audioOut, Buffer.alloc(0));
    for (let p = 0; p < n; p += 3000000) appendFileSync(audioOut, Buffer.from(await ev(`(()=>{const u=__PCM.subarray(${p},${Math.min(n, p + 3000000)});let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)})()`), 'base64'));
    console.log('audio bytes', n);
  }
  if (a0 === 'audio') { console.log('audio only done'); throw 0; }
  const JQ = +(process.env.JQ || 0.93), MB = +(process.env.MBLUR || 0);
  // the browser's JPEG is full-range BT.601; the master converts it properly to video-range BT.709 and says so in the file (an untagged file is read as BT.709 anyway, which shifts the colours a little)
  const enc = process.env.VENC === 'master'
    ? ['-vf', 'scale=in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p10le', '-c:v', 'libx265', '-preset', process.env.PPRESET || 'medium', '-crf', process.env.PCRF || '14',
       '-x265-params', 'log-level=error:keyint=48:min-keyint=48:scenecut=0:open-gop=0:aq-mode=3:colorprim=bt709:transfer=bt709:colormatrix=bt709:range=limited', '-tag:v', 'hvc1', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv']
    : ['-c:v', 'libx264', '-preset', 'medium', '-crf', process.env.PCRF || '20', '-pix_fmt', 'yuv420p'];
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '24', '-c:v', 'mjpeg', '-i', '-', ...enc, '-r', '24', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise(r => ff.on('close', r));
  await ev(`window.__c=document.getElementById('film');1`);
  // one frame, with motion blur when it is asked for and needed. A small copy of the picture (320 wide) tells whether it moves between the start and the end of the exposure.
  await ev(`window.__blurred=0;window.__frame=(i,S,q)=>{const c=__c,t=i/24+0.0005,sh=0.5/24;FILM.render(t);if(!S)return c.toDataURL('image/jpeg',q).slice(23);
    if(!window.__acc){__acc=document.createElement('canvas');__acc.width=c.width;__acc.height=c.height;__ax=__acc.getContext('2d');__ax.di=(__ax._di||__ax.drawImage).bind(__ax);__pr=document.createElement('canvas');__pr.width=320;__pr.height=180;__px=__pr.getContext('2d',{willReadFrequently:true});__px.di=(__px._di||__px.drawImage).bind(__px)}
    const probe=()=>{__px.di(c,0,0,320,180);return __px.getImageData(0,0,320,180).data},diff=(a,b)=>{let s=0;for(let k=0;k<a.length;k+=4)s+=Math.abs(a[k]-b[k])+Math.abs(a[k+1]-b[k+1])+Math.abs(a[k+2]-b[k+2]);return s/(a.length/4*3)};
    const p0=probe().slice();__ax.globalAlpha=1;__ax.di(c,0,0);FILM.render(t+sh*(S-1)/S);const dl=diff(p0,probe());
    if(dl<0.3){FILM.render(t);return c.toDataURL('image/jpeg',q).slice(23)}          /* nothing moves: the plain frame */
    let n=1;for(let j=1;j<S;j++){FILM.render(t+sh*j/S);if(diff(p0,probe())>10)break;n++;__ax.globalAlpha=1/n;__ax.di(c,0,0)}   /* stop at a cut */
    if(n>1)__blurred++;return __acc.toDataURL('image/jpeg',q).slice(23)};1`);
  const BATCH = +(process.env.BATCH || 8);
  for (let f = first; f < last; f += BATCH) {
    const e = Math.min(last, f + BATCH);
    const s = await ev(`(()=>{const o=[];for(let i=${f};i<${e};i++)o.push(__frame(i,${MB},${JQ}));return o.join('|')})()`);
    for (const b of s.split('|')) if (!ff.stdin.write(Buffer.from(b, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - first) % 800 === 0) console.log(out, 'frame', f, '/', last);
  }
  const nb = MB ? await ev('__blurred') : 0;
  ff.stdin.end(); await done; console.log('done', out, first, last, MB ? 'blurred frames ' + nb : '');
} catch (err) { if (err !== 0) { console.log('ERR', err); process.exitCode = 1; } } finally { try { ws.close(); } catch (e) {} ch.kill(); setTimeout(() => process.exit(process.exitCode || 0), 300); }   // leave at once: a pending 180 s safety timer would otherwise keep this process alive
