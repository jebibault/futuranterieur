# usage: gridview.py out.jpg img1 img2 ...  -> each image (cropped 16:9) at 960px with a 5% grid, labels every 10%
import sys
from PIL import Image,ImageDraw
out,*fs=sys.argv[1:]; W,H=960,540; cols=2; rows=(len(fs)+1)//2
S=Image.new('RGB',(W*cols,H*rows))
for i,f in enumerate(fs):
    im=Image.open(f).convert('RGB'); w,h=im.size; th=round(w*9/16)
    if th<h: im=im.crop((0,(h-th)//2,w,(h-th)//2+th))
    im=im.resize((W,H)); d=ImageDraw.Draw(im)
    for k in range(1,20):
        c=(255,0,0) if k%2==0 else (255,160,160)
        d.line([(k*W//20,0),(k*W//20,H)],fill=c,width=1); d.line([(0,k*H//20),(W,k*H//20)],fill=c,width=1)
        if k%2==0: d.text((k*W//20+2,2),str(k*5),fill=(255,255,0)); d.text((2,k*H//20+2),str(k*5),fill=(255,255,0))
    S.paste(im,((i%cols)*W,(i//cols)*H))
S.save(out,quality=88)
