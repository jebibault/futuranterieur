# Prepares the drawings of a film (crop, resize, composite of a key pose over its base, WebP encoding) in several processes at once.
# Used by build.py (season films and pilot):   prepare(names, COMPS, IMG, K, quality_of, extras=False) -> {name: webp bytes}
# Results are kept in out/imgcache: a drawing whose sources, composite rule, resolution and quality have not changed is not prepared again.
# Run as a worker by itself:   python prep.py <jobs.json> <i> <n>   (does every n-th job starting at i)
import sys, os, io, json, hashlib, subprocess
from PIL import Image, ImageChops, ImageFilter, ImageStat, ImageDraw
SALT = 'v1'
def src(IMG, n): return f'{IMG}/{n}.png' if os.path.exists(f'{IMG}/{n}.png') else f'img/{n}.png'
def load(IMG, K, n):
    IWp, IHp = round(1344 * K), round(756 * K)
    im = Image.open(src(IMG, n)).convert('RGB'); w, h = im.size; th = round(w * 9 / 16)
    if th < h: im = im.crop((0, (h - th) // 2, w, (h - th) // 2 + th))
    return im.resize((IWp, IHp), Image.LANCZOS)
def match(B, A):
    sa, sb = ImageStat.Stat(A), ImageStat.Stat(B); ch = []
    for i, c in enumerate(B.split()):
        k = sa.stddev[i] / max(1e-3, sb.stddev[i]); k = 1 + (k - 1) * 0.8; m = sa.mean[i] - sb.mean[i] * k
        ch.append(c.point(lambda v, k=k, m=m: max(0, min(255, v * k + m))))
    return Image.merge('RGB', ch)
def comp(IMG, K, n, rule, extras):
    IWp, IHp = round(1344 * K), round(756 * K)
    a, reg, th = rule; A = load(IMG, K, a); B = match(load(IMG, K, n), A)
    if th is None: return B
    d = ImageChops.difference(A, B).convert('L').filter(ImageFilter.GaussianBlur(4 * K))
    m = d.point(lambda v: 0 if v < th else min(255, (v - th) * 14)).filter(ImageFilter.MaxFilter(int(15 * K) // 2 * 2 + 1)).filter(ImageFilter.GaussianBlur(9 * K))
    if reg:
        r = Image.new('L', A.size, 0); ImageDraw.Draw(r).rectangle((reg[0] * IWp, reg[1] * IHp, reg[2] * IWp, reg[3] * IHp), fill=255)
        m = ImageChops.multiply(m, r.filter(ImageFilter.GaussianBlur(24 * K)))
    if extras: m.save(f'out/mask_{n}.png')
    return Image.composite(B, A, m)
def one(job):
    n, q, rule, IMG, K, extras, out = job
    im = comp(IMG, K, n, rule, extras) if rule else load(IMG, K, n)
    if extras: im.save(f'out/a_{n}.jpg', quality=85)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6)
    open(out + '.tmp', 'wb').write(b.getvalue()); os.replace(out + '.tmp', out)
def prepare(names, COMPS, IMG, K, quality_of, extras=False):
    os.makedirs('out/imgcache', exist_ok=True); jobs = []; path = {}
    for n in names:
        rule = COMPS.get(n); q = quality_of(n); srcs = [src(IMG, n)] + ([src(IMG, rule[0])] if rule else [])
        key = hashlib.sha1(repr((n, q, K, rule, [(s, os.path.getsize(s), int(os.path.getmtime(s))) for s in srcs], SALT)).encode()).hexdigest()[:16]
        path[n] = f'out/imgcache/{n}@{K}-{key}.webp'
        if not os.path.exists(path[n]): jobs.append([n, q, rule, IMG, K, extras, path[n]])
    if jobs:
        json.dump(jobs, open('out/imgcache/jobs.json', 'w'))
        N = max(1, min(len(jobs), int(os.environ.get('PREP_JOBS', os.cpu_count() or 4))))
        ps = [subprocess.Popen([sys.executable, os.path.abspath(__file__), 'out/imgcache/jobs.json', str(i), str(N)]) for i in range(N)]
        if any(p.wait() for p in ps): raise SystemExit('drawing preparation failed')
    return {n: open(path[n], 'rb').read() for n in names}
if __name__ == '__main__':
    for job in json.load(open(sys.argv[1]))[int(sys.argv[2])::int(sys.argv[3])]: one(job)
