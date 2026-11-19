// Master sound of a film, rendered by the film page itself.   usage: node sound.mjs <page url> <out folder>
// Writes three raw files, 48 kHz, 32-bit float, interleaved:
//   stereo.f32    2 channels  the film's own stereo mix (the one the web player plays)
//   stems.f32     6 channels  dialogue L R, music L R, effects L R, each alone, before the master compressor
//   binaural.f32  2 channels  for headphones: the stems placed around the listener with the browser's HRTF (voices stay dry in the centre)
// mix.py then levels them and makes the stereo, binaural and 5.1 files.
import { spawn } from 'node:child_process';
import { writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
const CHROME_BIN = process.env.CHROME || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const [url, outDir] = process.argv.slice(2);
const port = 9900 + Math.floor(Math.random() * 90);
const ch = spawn(CHROME_BIN, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${tmpdir().replace(/\\/g, '/')}/chf_snd${port}`, '--window-size=1280,720', url + (url.includes('?') ? '&' : '?') + 'sr=48000'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const ev = e => new Promise((res, rej) => { const i = ++id; pend.set(i, r => r.exceptionDetails ? rej(new Error(JSON.stringify(r.exceptionDetails).slice(0, 600))) : res(r.result.value)); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: e, returnByValue: true, awaitPromise: true } })); });
// pulls window[name] (an AudioBuffer) out of the page as interleaved float32
async function dump(name, file) {
  const n = await ev(`(()=>{const b=window.${name},c=b.numberOfChannels,n=b.length,f=new Float32Array(n*c);for(let k=0;k<c;k++){const d=b.getChannelData(k);for(let i=0;i<n;i++)f[i*c+k]=d[i]}window.__U=new Uint8Array(f.buffer);return __U.length})()`);
  writeFileSync(file, Buffer.alloc(0));
  for (let p = 0; p < n; p += 3000000) appendFileSync(file, Buffer.from(await ev(`(()=>{const u=__U.subarray(${p},${Math.min(n, p + 3000000)});let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)})()`), 'base64'));
  console.log(file, n, 'bytes');
}
// binaural: every stem channel becomes a virtual loudspeaker around the head (angles in degrees, 0 = in front, positive = right)
const BINAURAL = `(async()=>{const S=window.__stems,sr=S.sampleRate,n=S.length,O=new OfflineAudioContext(2,n,sr);
  const mono=k=>{const b=O.createBuffer(1,n,sr);b.copyToChannel(S.getChannelData(k),0);const s=O.createBufferSource();s.buffer=b;s.start(0);return s};
  const spk=(src,az,gain,delay)=>{const p=O.createPanner();p.panningModel='HRTF';p.distanceModel='linear';p.refDistance=1;p.maxDistance=10000;p.rolloffFactor=0;const a=az*Math.PI/180;p.positionX.value=Math.sin(a);p.positionY.value=0;p.positionZ.value=-Math.cos(a);
    const g=O.createGain();g.gain.value=gain;let x=src;if(delay){const d=O.createDelay(0.1);d.delayTime.value=delay;src.connect(d);x=d}x.connect(g);g.connect(p);p.connect(O.destination)};
  const dl=mono(0),dr=mono(1),ml=mono(2),mr=mono(3),fl=mono(4),fr=mono(5);
  const mg=O.createChannelMerger(2),dg=O.createGain();dg.gain.value=1.25;dl.connect(mg,0,0);dr.connect(mg,0,1);mg.connect(dg);dg.connect(O.destination);   // voices: dry, in the centre of the head
  spk(ml,-30,1,0);spk(mr,30,1,0);spk(ml,-110,0.4,0.018);spk(mr,110,0.4,0.018);       // music: in front, with a quieter, later copy behind
  spk(fl,-70,0.9,0);spk(fr,70,0.9,0);spk(fr,-135,0.7,0.012);spk(fl,135,0.7,0.012);   // effects (rain, room, horn): wide, and all around
  window.__bin=await O.startRendering();return 1})()`;
try {
  let tabs; for (let i = 0; i < 60; i++) { await sleep(300); try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find(t => t.type === 'page')) break; } catch (e) {} }
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); } };
  for (let i = 0; i < 600; i++) { if (await ev('!!window.FILM')) break; await sleep(500); }
  if (!await ev('!!FILM.stems')) throw new Error('this film has no FILM.stems yet');
  await ev('FILM.audio(48000).then(b=>{window.__st=b;return 1})'); await dump('__st', outDir + '/stereo.f32');
  await ev('FILM.stems(48000).then(b=>{window.__stems=b;return 1})'); await dump('__stems', outDir + '/stems.f32');
  await ev(BINAURAL); await dump('__bin', outDir + '/binaural.f32');
  console.log('sound done');
} catch (err) { console.log('ERR', err); process.exitCode = 1; } finally { try { ws.close(); } catch (e) {} ch.kill(); setTimeout(() => process.exit(process.exitCode || 0), 300); }
