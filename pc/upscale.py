# usage: python upscale.py <model.pth> <in dir> <out dir> [target width, default 4032] [name filter]
# Upscales every PNG of <in dir> with a spandrel-loadable model (tiled, on the GPU), then resizes to the target width and writes it as JPEG (q96) under the same file name
import sys, os, glob, time, torch, numpy as np
from PIL import Image
from spandrel import ModelLoader
mp, din, dout = sys.argv[1:4]; TW = int(sys.argv[4]) if len(sys.argv) > 4 else 4032; flt = sys.argv[5] if len(sys.argv) > 5 else ''
os.makedirs(dout, exist_ok=True)
m = ModelLoader().load_from_file(mp); sc = m.scale; net = m.model.cuda().eval().half()
print('model', os.path.basename(mp), 'scale', sc, flush=True)
T, O = 384, 24
@torch.no_grad()
def up(im):
    x = torch.from_numpy(np.asarray(im.convert('RGB'), dtype=np.float32) / 255).permute(2, 0, 1)[None].cuda().half()
    _, _, h, w = x.shape; out = torch.zeros(1, 3, h * sc, w * sc, dtype=torch.float32); wt = torch.zeros(1, 1, h * sc, w * sc)
    for y in range(0, h, T - 2 * O):
        for xx in range(0, w, T - 2 * O):
            y1, x1 = min(h, y + T), min(w, xx + T); y0, x0 = max(0, y1 - T), max(0, x1 - T)
            t = net(x[:, :, y0:y1, x0:x1]).float().clamp(0, 1).cpu()
            th, tw = t.shape[2], t.shape[3]; ramp = lambda n: torch.minimum(torch.arange(1, n + 1), torch.arange(n, 0, -1)).clamp(max=O * sc).float() / (O * sc)
            mk = (ramp(th)[:, None] * ramp(tw)[None, :])[None, None]
            out[:, :, y0 * sc:y1 * sc, x0 * sc:x1 * sc] += t * mk; wt[:, :, y0 * sc:y1 * sc, x0 * sc:x1 * sc] += mk
    return Image.fromarray((out / wt.clamp(min=1e-6))[0].permute(1, 2, 0).mul(255).round().byte().numpy())
fs = sorted(f for f in glob.glob(os.path.join(din, '*.png')) if flt in os.path.basename(f))
for k, f in enumerate(fs):
    o = os.path.join(dout, os.path.basename(f))   # JPEG data under the drawing's own name: the build opens it by content
    if os.path.exists(o): continue
    t0 = time.time(); im = Image.open(f); r = up(im); r = r.resize((TW, round(TW * r.height / r.width)), Image.LANCZOS); r.save(o, 'JPEG', quality=96, subsampling=0)
    print(k + 1, '/', len(fs), os.path.basename(f), im.size, '->', r.size, round(time.time() - t0, 1), 's', flush=True)
print('ALLDONE', flush=True)
