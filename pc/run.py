# Chroniques d'un futur antérieur: builds and renders a film entirely on this PC.
#
#   run.cmd <film> [res] [first_second last_second]
#       film   serotonine | nour | dit | camille | divan | catalogue | ouroboros | all
#       res    3 = 4K (default), 1.5 = 1080p, 1 = 720p
#       the two optional numbers render only a passage, for a quick test
#
# Steps: 1. the drawings are upscaled on the graphics card (4K only)   2. the film page is built with the large drawings
#        3. the film is rendered frame by frame in several headless Chrome at once   4. ffmpeg assembles picture and sound
# Output: out\<Title> (<4K|1080p|720p>).mp4   Log: out\log.txt
#
# MASTER=1 (set MASTER=1 before run.cmd): the high-quality chain, for a film whose page can give its sound as separate stems (Sérotonine bleue for now).
#   picture: frames at full colour resolution, motion blur where the picture moves (MBLUR sub-frames, 4 by default, 0 = none), encoded once in HEVC 10 bits, BT.709
#   sound:   lossless sources at 48 kHz, three mixes levelled by measurement: stereo, binaural (headphones), 5.1
#   output:  out\<Title> (4K master).mov   HEVC 10 bits + stereo, 5.1 and binaural in 24-bit PCM       out\master\<Title> stereo|binaural|5.1.wav and <Title> son.txt (measures)
#            out\<Title> (4K).mp4, (4K 5.1).mp4, (4K casque).mp4   H.264 for the web, made from the master
import os, sys, subprocess, time, pathlib, shutil
ROOT = pathlib.Path(__file__).resolve().parent
PY = sys.executable
FILMS = {  # id: (folder, slug, title, pilot?)
    'serotonine': ('serotonine', 'serotonine-bleue', 'Sérotonine bleue', True),
    'nour': ('nour', 'les-endeuilles-de-nour', 'Les Endeuillés de Nour', False),
    'dit': ('dit', 'ce-que-tu-mas-dit', "Ce que tu m'as dit", False),
    'camille': ('camille', 'six-mois-de-camille', 'Six mois de Camille', False),
    'divan': ('divan', 'divan', 'Divan', False),
    'catalogue': ('catalogue', 'catalogue-des-nuits', 'Le Catalogue des nuits', False),
    'ouroboros': ('ouroboros', 'ouroboros', 'Ouroboros', False),
}
MASTER = os.environ.get('MASTER') == '1'
JOBS = int(os.environ.get('JOBS', '5')); MODEL = ROOT / 'models' / 'RealESRGAN_x4plus.pth'
OUT = ROOT / 'out'; OUT.mkdir(exist_ok=True); LOG = OUT / 'log.txt'
def log(*a):
    s = time.strftime('%H:%M:%S ') + ' '.join(str(x) for x in a); print(s, flush=True); open(LOG, 'a', encoding='utf8').write(s + '\n')
def sh(cmd, cwd=None, env=None, quiet=False):
    r = subprocess.run(cmd, cwd=cwd, env={**os.environ, **(env or {})}, capture_output=True, text=True, encoding='utf8', errors='replace')
    if r.returncode and not quiet: log('  command failed:', ' '.join(map(str, cmd))[:160], '|', (r.stdout + r.stderr)[-400:])
    return r
def film(fid, res, span):
    folder, slug, title, pilot = FILMS[fid]; D = ROOT / 'films' / folder; t0 = time.time()
    label = {'3': '4K', '1.5': '1080p', '1': '720p'}.get(res, 'x' + res); log('START', title, label)
    env = {'RES': res, **({'HQA': '1'} if MASTER else {})}
    if float(res) >= 2:      # 1. upscale the drawings (skips the ones already done)
        r = sh([PY, str(ROOT / 'upscale.py'), str(MODEL), str(D / 'img'), str(D / 'img4k'), str(round(1344 * float(res)))])
        n = len(list((D / 'img4k').glob('*.png'))); log('  drawings upscaled:', n)
        if 'ALLDONE' not in r.stdout: log('  upscale did not finish'); return False
        env['IMGDIR'] = 'img4k'
    # 2. build the page
    r = sh([PY, 'build.py'] if pilot else [PY, str(ROOT / 'core' / 'build.py'), title, slug], cwd=D, env=env)
    page = D / (f'{slug}@{res}.html' if res != '1' else f'{slug}.html')
    if not page.exists(): log('  build failed'); return False
    log('  page built:', round(page.stat().st_size / 1e6), 'MB')
    url = page.as_uri() + f'?nosub=1&s={res}'
    r = sh(['node', str(ROOT / 'core' / 'cdp.mjs'), page.as_uri(), 'Math.ceil(FILM.DUR*24)', 'nowait'])
    try: N = int(r.stdout.strip().split()[-1])
    except Exception: log('  could not read the film length:', r.stdout[-200:], r.stderr[-200:]); return False
    a, b = (0, N) if not span else (int(span[0] * 24), min(N, int(span[1] * 24)))
    V = D / 'out' / 'vid'; shutil.rmtree(V, ignore_errors=True); V.mkdir(parents=True)
    # 3. render: sound once, picture in JOBS parts, each part retried up to three times
    q = -(-(b - a) // JOBS); procs = []
    xenv = {**os.environ, 'PCRF': os.environ.get('PCRF', '17' if float(res) >= 2 else '16'), 'BATCH': '2' if float(res) >= 2 else '8'}
    if MASTER: xenv.update({'PCRF': os.environ.get('PCRF', '14'), 'BATCH': '1', 'JQ': '1', 'MBLUR': os.environ.get('MBLUR', '4'), 'VENC': 'master'})
    procs.append(('audio', subprocess.Popen(['node', str(ROOT / 'core' / 'sound.mjs'), url, str(V)] if MASTER else ['node', str(ROOT / 'core' / 'export.mjs'), url, 'audio', '0', str(V / 'none.mp4'), str(V / 'audio.raw')], stdout=open(V / 'audio.log', 'w'), stderr=subprocess.STDOUT, env=xenv)))
    def part(i): return subprocess.Popen(['node', str(ROOT / 'core' / 'export.mjs'), url, str(a + i * q), str(min(b, a + (i + 1) * q)), str(V / f'p{i}.mp4')], stdout=open(V / f'p{i}.log', 'w', encoding='utf8'), stderr=subprocess.STDOUT, env=xenv)
    tries = {i: 1 for i in range(JOBS)}; run = {i: part(i) for i in range(JOBS)}
    while run:
        time.sleep(5)
        for i, p in list(run.items()):
            if p.poll() is None: continue
            ok = 'done ' in open(V / f'p{i}.log', encoding='utf8', errors='replace').read()
            if ok or tries[i] >= 3:
                del run[i]
                if not ok: log('  part', i, 'failed three times'); return False
            else: tries[i] += 1; log('  part', i, 'restarted'); run[i] = part(i)
    procs[0][1].wait()
    # 4. assemble
    open(V / 'list.txt', 'w').write(''.join(f"file 'p{i}.mp4'\n" for i in range(JOBS)))
    name = f'{title} ({label})' + (f' essai {span[0]}-{span[1]}s' if span else '')
    if MASTER: return master(title, label, name, span, V, a, b, N, t0)
    cut = ['-ss', str(span[0])] if span else []
    r = sh(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(V / 'list.txt'), *cut, '-f', 's16le', '-ar', '44100', '-ac', '2', '-i', str(V / 'audio.raw'),
            '-c:v', 'libx264', '-preset', 'medium', '-crf', os.environ.get('CRF', '21' if float(res) >= 2 else '19'), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', str(OUT / (name + '.mp4'))])
    f = OUT / (name + '.mp4')
    if not f.exists(): log('  assembly failed'); return False
    log('DONE', name, round(time.time() - t0), 's', round(f.stat().st_size / 1e6), 'MB', f'frames {a}-{b} of {N}')
    return True
def master(title, label, name, span, V, a, b, N, t0):
    if 'sound done' not in open(V / 'audio.log', encoding='utf8', errors='replace').read(): log('  sound failed:', open(V / 'audio.log', encoding='utf8', errors='replace').read()[-300:]); return False
    M = OUT / 'master'; M.mkdir(exist_ok=True)
    r = sh([PY, str(ROOT / 'core' / 'mix.py'), str(V), str(M / title)])                       # the three mixes, levelled and measured
    for l in r.stdout.strip().splitlines(): log('  ' + l)
    wav = [str(M / f'{title} {k}.wav') for k in ('stereo', '5.1', 'binaural')]
    if not all(os.path.exists(w) for w in wav): log('  mixes missing'); return False
    cut = ['-ss', str(span[0])] if span else []; ins = []
    for w in wav: ins += [*cut, '-i', w]
    mov = OUT / (name.replace(')', ' master)', 1) + '.mov')
    # the master: the parts are joined as they are (no second encoding), with the three mixes in 24-bit PCM
    r = sh(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(V / 'list.txt'), *ins, '-map', '0:v', '-map', '1:a', '-map', '2:a', '-map', '3:a', '-c:v', 'copy', '-tag:v', 'hvc1', '-c:a', 'pcm_s24le',
            '-metadata:s:a:0', 'title=Stéréo', '-metadata:s:a:1', 'title=5.1', '-metadata:s:a:2', 'title=Binaural (casque)', '-disposition:a:0', 'default', '-disposition:a:1', '0', '-disposition:a:2', '0', '-shortest', str(mov)])
    if not mov.exists(): log('  master assembly failed'); return False
    log('  master:', mov.name, round(mov.stat().st_size / 1e6), 'MB')
    # web files, made from the master: H.264 8 bits (plays everywhere), one file per mix
    web = OUT / (name + '.mp4')
    r = sh(['ffmpeg', '-y', '-v', 'error', '-i', str(mov), '-map', '0:v', '-map', '0:a:0', '-c:v', 'libx264', '-preset', 'slow', '-crf', os.environ.get('CRF', '19'), '-pix_fmt', 'yuv420p',
            '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', str(web)])
    if not web.exists(): log('  web file failed'); return False
    for k, tag, br in ((1, '5.1', '448k'), (2, 'casque', '256k')):
        sh(['ffmpeg', '-y', '-v', 'error', '-i', str(web), '-i', str(mov), '-map', '0:v', '-map', f'1:a:{k}', '-c:v', 'copy', '-c:a', 'aac', '-b:a', br, '-movflags', '+faststart', str(OUT / (name.replace(')', f' {tag})', 1) + '.mp4'))])
    blur = sum(int(l.split('blurred frames')[1]) for i in range(JOBS) for l in open(V / f'p{i}.log', encoding='utf8', errors='replace') if 'blurred frames' in l)
    log('DONE', name, 'master', round(time.time() - t0), 's', round(web.stat().st_size / 1e6), 'MB', f'frames {a}-{b} of {N}, with motion blur: {blur}')
    return True
if __name__ == '__main__':
    if len(sys.argv) < 2: print(__doc__ or open(__file__, encoding='utf8').read().split('import')[0]); sys.exit(1)
    ids = list(FILMS) if sys.argv[1] == 'all' else [sys.argv[1]]; res = sys.argv[2] if len(sys.argv) > 2 else '3'
    span = (float(sys.argv[3]), float(sys.argv[4])) if len(sys.argv) > 4 else None
    ok = [film(i, res, span) for i in ids]; log('ALLDONE', sum(ok), 'of', len(ok)); sys.exit(0 if all(ok) else 1)
