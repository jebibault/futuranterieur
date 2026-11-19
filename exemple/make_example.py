# Draws three placeholder pictures so the example can be built at once:   python3 make_example.py
# Replace img/a1.png, img/a2.png and img/title.png with your own drawings (16:9, 1344 pixels wide or more).
import os, math, random
from PIL import Image, ImageDraw, ImageFilter
os.makedirs('img', exist_ok=True); W, H = 1600, 900; random.seed(3)
def paper(top, bottom):
    im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
    for y in range(H): k = y / H; d.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * k) for a, b in zip(top, bottom)))
    return im, d
im, d = paper((236, 226, 204), (214, 196, 170))                                    # a hill, a tree, a sun
d.ellipse((1150, 120, 1330, 300), fill=(232, 170, 96))
d.polygon([(0, 900)] + [(x, 620 - 160 * math.sin(x / 1600 * math.pi) + 12 * math.sin(x / 70)) for x in range(0, 1601, 20)] + [(1600, 900)], fill=(96, 110, 84))
d.rectangle((760, 330, 790, 520), fill=(60, 48, 40)); d.ellipse((660, 190, 890, 400), fill=(70, 96, 70))
im.filter(ImageFilter.GaussianBlur(1.2)).save('img/a1.png')
im, d = paper((34, 44, 78), (12, 18, 40))                                          # the sea at night, a lighthouse
for _ in range(140): x, y = random.random() * W, random.random() * 420; d.ellipse((x, y, x + 3, y + 3), fill=(230, 230, 210))
d.rectangle((0, 560, W, H), fill=(16, 30, 58))
for y in range(580, H, 26): d.line([(0, y), (W, y + 8)], fill=(40, 62, 100), width=3)
d.polygon([(1180, 560), (1200, 300), (1240, 300), (1260, 560)], fill=(214, 208, 190)); d.ellipse((1196, 262, 1244, 310), fill=(255, 226, 140))
im.filter(ImageFilter.GaussianBlur(1.2)).save('img/a2.png')
im = Image.new('RGB', (W, H), (0, 0, 0)); d = ImageDraw.Draw(im)                    # the title: white on black, placed over the picture as light
for i, x in enumerate(range(420, 1180, 95)): d.line([(x, 520 - 60 * (i % 2)), (x + 60, 400 + 60 * (i % 2))], fill=(255, 255, 255), width=14)
im.save('img/title.png')
print('img/a1.png, img/a2.png, img/title.png written')
