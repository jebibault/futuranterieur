import os,sys,subprocess,json
from concurrent.futures import ThreadPoolExecutor
CORE=os.path.dirname(os.path.abspath(__file__))
IMG=os.environ.get("IMAGEGEN","imagegen.mjs")   # path of the image generation script (the codex-imagegen skill): set IMAGEGEN
R=open(CORE+'/style_real.txt').read(); D=open(CORE+'/style_dream.txt').read()
SAME="Use the attached frame as the exact starting drawing: same framing, same background, same character design, same colours and line. Redraw it as the next key pose of the same animated shot. The only change: "
INB="The two attached images are two consecutive key drawings of the same hand-drawn animated shot: image 1 is the earlier pose, image 2 is the later pose. Draw the in-between drawing that an assistant animator would draw between them: exactly the same framing, background, character design, colours and line as both images. In this in-between: "
NEXT="Use the attached frame as the starting drawing: same ink line, same hatching, same flat colours. Redraw it as a later key frame of one continuous slow metamorphosis: "
MET="The two attached images are two key frames of a slow hand-drawn metamorphosis: image 1 is the earlier state, image 2 is the later state. Draw the in-between key frame exactly %s of the way from image 1 to image 2: same composition, same ink line and hatching, same flat colours; every form is caught part-way through its change of shape, closer to image %s.\n"
S={}
def s(name,refs,text,pas=1): S[name]=(refs,text,pas)
def same(name,ref,change,pas=2,extra=[]): s(name,[ref]+extra,SAME+change+" Nothing else changes at all.\n"+R,pas)
def mouths(base,pro='her',pas=2):
    same(base+'_m1',base,pro+" mouth is slightly open, lips just parted in the middle of saying a word.",pas)
    same(base+'_m2',base,pro+" mouth is open a little wider, speaking, the lower lip dropped and a dark gap between the lips.",pas)
def blink(base,pro='her',pas=2): same(base+'_k',base,pro+" eyes are closed in a slow blink.",pas)
def ib(name,a,b,desc,pas=3,extra=[]): s(name,[a,b]+extra,INB+desc+" Nothing else changes.\n"+R,pas)
def mt(name,a,b,frac,near,pal,pas): s(name,[a,b],MET%(frac,near)+pal+D,pas)
def run(n):
    refs,text,_=S[n]
    if os.path.exists(f'img/{n}.png'): return n,'exists'
    os.makedirs('prompts',exist_ok=True); os.makedirs('img',exist_ok=True)
    open(f'prompts/{n}.txt','w').write(text)
    cmd=['node',IMG,'--prompt-file',f'prompts/{n}.txt','--out',f'img/{n}.png','--log','img/SOURCES.md','--timeout-sec','540']
    for r in refs: cmd+=['--image',f'img/{r}.png']
    p=subprocess.run(cmd,capture_output=True,text=True)
    last=p.stdout.strip().splitlines()[-1] if p.stdout.strip() else p.stderr[-300:]
    try:
        j=json.loads(last); return n,('ok' if j.get('ok') else json.dumps(j)[:400])
    except Exception: return n,last[:400]
def main():
    arg=sys.argv[1]
    names=[n for n in S if S[n][2]==int(arg)] if arg.isdigit() else sys.argv[1:]
    with ThreadPoolExecutor(5) as ex:
        for n,r in ex.map(run,names): print(n,r,flush=True)
