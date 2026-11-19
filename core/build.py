# run from a film folder:  python3 ../core/build.py "<Film title>"
import base64,io,os,re,sys,glob,subprocess,struct,json,math
from PIL import Image,ImageChops,ImageFilter,ImageStat,ImageDraw
CORE=os.path.dirname(os.path.abspath(__file__)); TITLE=sys.argv[1]; SLUG=sys.argv[2]
COMPS={}; DREAM=(); POSTER='a1'
if os.path.exists('comps.py'): exec(open('comps.py').read())
import os as _os, sys
K=float(_os.environ.get('RES','1')); SUF='' if K==1 else '@'+_os.environ['RES']; IWp,IHp=round(1344*K),round(756*K); IMG=_os.environ.get('IMGDIR','img')
def load(n):
    im=Image.open((f'{IMG}/{n}.png' if _os.path.exists(f'{IMG}/{n}.png') else f'img/{n}.png')).convert('RGB'); w,h=im.size; th=round(w*9/16)
    if th<h: im=im.crop((0,(h-th)//2,w,(h-th)//2+th))
    return im.resize((IWp,IHp),Image.LANCZOS)
def match(B,A):
    sa,sb=ImageStat.Stat(A),ImageStat.Stat(B); ch=[]
    for i,c in enumerate(B.split()):
        k=sa.stddev[i]/max(1e-3,sb.stddev[i]); k=1+(k-1)*0.8; m=sa.mean[i]-sb.mean[i]*k
        ch.append(c.point(lambda v,k=k,m=m:max(0,min(255,v*k+m))))
    return Image.merge('RGB',ch)
def comp(n):
    a,reg,th=COMPS[n]; A=load(a); B=match(load(n),A)
    if th is None: return B
    d=ImageChops.difference(A,B).convert('L').filter(ImageFilter.GaussianBlur(4*K))
    m=d.point(lambda v:0 if v<th else min(255,(v-th)*14)).filter(ImageFilter.MaxFilter(int(15*K)//2*2+1)).filter(ImageFilter.GaussianBlur(9*K))
    if reg:
        r=Image.new('L',A.size,0); ImageDraw.Draw(r).rectangle((reg[0]*IWp,reg[1]*IHp,reg[2]*IWp,reg[3]*IHp),fill=255)
        m=ImageChops.multiply(m,r.filter(ImageFilter.GaussianBlur(24*K)))
    return Image.composite(B,A,m)
for _f in glob.glob('img/*_p[0-9]*.png'):
    _n=os.path.basename(_f)[:-4]; _m=re.match(r'^(.+)_p\d+[aic]?$',_n)
    if _m and _n not in COMPS: COMPS[_n]=(_m.group(1),None,10)
SRC=open('story.js').read()
names=sorted(os.path.basename(f)[:-4] for f in glob.glob('img/*.png'))
names=[n for n in names if not n.startswith('m_') and n!='title' and not re.search(r'-\d+$',n)]
A={}
os.makedirs('out',exist_ok=True)
_Q=lambda n: (84 if K!=1 else 66 if n.startswith(DREAM) and DREAM else 72)
# The drawings are prepared in several processes at once and kept in out/imgcache (see prep.py).
sys.path.insert(0,CORE); import prep as _prep
for n,d in _prep.prepare(names,COMPS,IMG,K,_Q,False).items(): A[n]='data:image/webp;base64,'+base64.b64encode(d).decode()
t=Image.open('img/title.png').convert('RGB'); w,h=t.size
t=t.crop((int(w*.2),int(h*.3),int(w*.8),int(h*.7))).resize((round(900*K),int(round(900*K)*(h*.4)/(w*.6))),Image.LANCZOS)
b=io.BytesIO(); t.save(b,'WEBP',quality=88); A['title']='data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()
V={}; os.makedirs('out/vo',exist_ok=True)
for f in sorted(glob.glob('vo/*.mp3')):
    vid=os.path.basename(f)[:-4]; o=f'out/vo/{vid}.mp3'
    if not os.path.exists(o) or os.path.getmtime(o)<os.path.getmtime(f):
        if vid=='MUS': subprocess.run(['ffmpeg','-y','-v','error','-i',f,'-ac','2','-ar','44100','-b:a','112k','-af','loudnorm=I=-16:TP=-1.5:LRA=14',o],check=True)
        else: subprocess.run(['ffmpeg','-y','-v','error','-i',f,'-ac','1','-ar','32000','-b:a','56k','-af','loudnorm=I=-19:TP=-2:LRA=9',o],check=True)
    raw=subprocess.run(['ffmpeg','-v','error','-i',o,'-ac','1','-ar','8000','-f','s16le','-'],capture_output=True).stdout
    n=len(raw)//2; sm=struct.unpack('<%dh'%n,raw[:n*2]); hop=8000//12; rms=[]
    for k in range(0,n,hop):
        sg=sm[k:k+hop]; rms.append(math.sqrt(sum(x*x for x in sg)/max(1,len(sg))))
    mx=max(rms) if rms else 1
    V[vid]={'d':round(n/8000,2),'e':''.join('0' if r<mx*0.13 else '1' if r<mx*0.45 else '2' for r in rms),'b':base64.b64encode(open(o,'rb').read()).decode()}
vjs='const VO='+json.dumps(V,separators=(',',':'))+';'
ks=list(A.keys()); half=len(ks)//2
def ajs(keys,first): return ('const ASSETS={};' if first else '')+'Object.assign(ASSETS,{'+','.join(f'"{k}":"{A[k]}"' for k in keys)+'});'
film=open(CORE+'/core_a.js').read()+'\n'+SRC+'\n'+open(CORE+'/core_b.js').read()
cfg='const CFG={comps:[]};const POSTER="%s";'%POSTER
FONTS=open(CORE+'/fonts/free-fonts.html',encoding='utf8').read() if os.path.exists(CORE+'/fonts/free-fonts.html') else ''   # free typefaces embedded under the names the films ask for: same letters on the Mac and on the PC
shell=open(CORE+'/shell.html').read().replace('<head>','<head>\n'+FONTS,1).replace('Sérotonine bleue',TITLE).replace('ASSETS.s1_brest','ASSETS[POSTER]')
h=shell.replace('/*ASSETS*/',ajs(ks,True)+vjs).replace('/*CFG*/',cfg).replace('/*FILM*/',film)
open(SLUG+SUF+'.html','w').write(h)
if K!=1: print('hi-res build',SLUG+SUF+'.html',round(len(h)/1e6,1),'MB'); sys.exit()
os.makedirs('dist',exist_ok=True)
open('dist/a1.js','w').write(ajs(ks[:half],True)); open('dist/a2.js','w').write(ajs(ks[half:],False)); open('dist/vo.js','w').write(vjs)
hp=shell.replace('<script>\n/*ASSETS*/','<script src="a1.js"></script>\n<script src="a2.js"></script>\n<script src="vo.js"></script>\n<script>').replace('/*CFG*/',cfg).replace('/*FILM*/',film)
assert 'a1.js' in hp
st=re.search(r'<style>.*?</style>',hp,re.S).group(0)
st=st.replace("html, body { margin: 0;",":root { color-scheme: dark; }\n  html, body { margin: 0;").replace("</style>","  .rot { display: none; }\n  @media (orientation: portrait) { .rot { display: block; } }\n</style>")
bd=re.search(r'<body>(.*)</body>',hp,re.S).group(1).replace('<div class="small">avec le son</div>','<div class="small">avec le son</div><div class="small rot">tournez le téléphone à l’horizontale</div>')
open(SLUG+'-page.html','w').write('<title>'+TITLE+'</title>\n'+st+bd)
used=set(re.findall(r"'([a-z][a-z0-9_]*)'",SRC)); 
print(len(names),'images;',len(V),'voices',round(sum(v['d'] for v in V.values()),1),'s; standalone MB',round(len(h)/1e6,2),'; a1',round(os.path.getsize('dist/a1.js')/1e6,1),'a2',round(os.path.getsize('dist/a2.js')/1e6,1))
print('unused images:',[n for n in names if n not in used and not re.search(r'_(m[12]|k)$',n)])
