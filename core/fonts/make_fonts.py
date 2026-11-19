# usage: python3 season/core/fonts/make_fonts.py <google fonts css file>
# Downloads the free typefaces (latin subset) next to this script and writes free-fonts.html: a <style> block that declares them
# under the names of the macOS typefaces the films ask for, so a film page that carries this block draws the same letters on any machine.
import re, sys, os, base64, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
ALIAS = {'Inter': 'Helvetica Neue', 'Source Serif 4': 'Iowan Old Style', 'Cutive': 'American Typewriter',
         'Kalam': 'Bradley Hand', 'Pinyon Script': 'Snell Roundhand', 'Patrick Hand': 'Noteworthy'}
css = open(sys.argv[1], encoding='utf8').read()
ADJ = {'Cutive': 'size-adjust:91%;'}   # Cutive runs larger than American Typewriter at the same size
out = []; loads = []
for m in re.finditer(r'/\* latin \*/\s*@font-face\s*\{(.*?)\}', css, re.S):
    b = m.group(1)
    fam = re.search(r"font-family:\s*'([^']+)'", b).group(1); sty = re.search(r'font-style:\s*(\w+)', b).group(1)
    wt = re.search(r'font-weight:\s*([\d ]+)', b).group(1).strip(); url = re.search(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', b).group(1)
    fn = os.path.join(HERE, f"{fam.replace(' ', '')}-{sty}-{wt.replace(' ', '_')}.woff2")
    if not os.path.exists(fn): open(fn, 'wb').write(urllib.request.urlopen(url, timeout=60).read())
    adj = ADJ.get(fam, '')
    d = base64.b64encode(open(fn, 'rb').read()).decode()
    out.append(f'@font-face{{font-family:"{ALIAS[fam]}";font-style:{sty};font-weight:{wt};{adj}src:url(data:font/woff2;base64,{d}) format("woff2")}}')
    for w in wt.split(): loads.append(f'{sty} {w} 20px "{ALIAS[fam]}"')
html = '<style id="free-fonts">\n' + '\n'.join(out) + '\n</style>\n<script>window.FONTS_READY = Promise.all(' + repr(loads) + '.map(f => document.fonts.load(f)));</script>\n'
open(os.path.join(HERE, 'free-fonts.html'), 'w', encoding='utf8').write(html)
print(len(out), 'faces,', round(len(html) / 1024), 'KB')
