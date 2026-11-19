# Makes the sound masters of a film from what sound.mjs wrote.     usage: python mix.py <folder with stereo.f32, stems.f32, binaural.f32> <out prefix>
# Writes, 48 kHz 24-bit WAV:   <prefix> stereo.wav    <prefix> binaural.wav    <prefix> 5.1.wav (L R C LFE Ls Rs)   and a report <prefix> son.txt
# Levels: each mix is measured (EBU R128) and brought to its target with one fixed gain, then a limiter catches the rare peaks. Nothing is compressed further.
#   stereo and binaural: -16 LUFS (web, headphones)      5.1: -23 LUFS (EBU R128, home cinema)      true peak never above -1.5 dBTP
# 5.1 layout, from the three stems:   C = dialogue    L R = music + effects    Ls Rs = effects (other side, 12 ms later) + a little music (25 ms later, duller)    LFE = what is under 100 Hz in music and effects
import subprocess, sys, re, json, os
D, P = sys.argv[1], sys.argv[2]
RAW = lambda f, c: ['-f', 'f32le', '-ar', '48000', '-ac', str(c), '-i', os.path.join(D, f)]
def measure(inp, graph):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', *inp, '-filter_complex', graph + ',ebur128=peak=true[o]', '-map', '[o]', '-f', 'null', '-'], capture_output=True, text=True, errors='replace').stderr
    s = r[r.rfind('Summary:'):]; g = lambda k: float(re.search(k + r':\s+(-?[\d.]+|-inf)', s).group(1))
    return {'I': g('I'), 'LRA': g('LRA'), 'TP': g('Peak')}
SURR = ('[0:a]pan=6c|c0=c2+0.8*c4|c1=c3+0.8*c5|c2=0.5*c0+0.5*c1|c3=0.35*c2+0.35*c3+0.35*c4+0.35*c5|c4=c5|c5=c4[m];[0:a]pan=stereo|c0=0.4*c2|c1=0.4*c3,adelay=25|25,lowpass=f=7000[ms];'
        '[m]channelsplit=channel_layout=6c[fl][fr][fc][lf][sl][sr];[lf]lowpass=f=100,lowpass=f=100[lfe];[sl]adelay=12,volume=0.7[sl2];[sr]adelay=12,volume=0.7[sr2];[ms]channelsplit=channel_layout=stereo[ml][mr];'
        '[sl2][ml]amix=inputs=2:normalize=0[ls];[sr2][mr]amix=inputs=2:normalize=0[rs];[fl][fr][fc][lfe][ls][rs]join=inputs=6:channel_layout=5.1[x]')
MIX = {  # name: (input, graph ending in [x], target LUFS)
    'stereo': (RAW('stereo.f32', 2), '[0:a]anull[x]', -16),
    'binaural': (RAW('binaural.f32', 2), '[0:a]anull[x]', -16),
    '5.1': (RAW('stems.f32', 6), SURR, -23),
}
rep = []
for name, (inp, graph, target) in MIX.items():
    m0 = measure(inp, graph + ';[x]anull'); gain = target - m0['I']
    out = f'{P} {name}.wav'
    fin = f'{graph};[x]volume={gain:.2f}dB,alimiter=limit=-2.5dB:level=false:attack=5:release=80[y]'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', *inp, '-filter_complex', fin, '-map', '[y]', '-c:a', 'pcm_s24le', '-ar', '48000', out], check=True)
    m1 = measure(['-i', out], '[0:a]anull')
    line = f"{name:9s} before {m0['I']:6.1f} LUFS, peak {m0['TP']:5.1f} | gain {gain:+5.1f} dB | after {m1['I']:6.1f} LUFS, range {m1['LRA']:4.1f} LU, true peak {m1['TP']:5.1f} dBTP"
    if name != '5.1':   # mono compatibility: how much is lost when left and right are summed
        mm = measure(['-i', out], '[0:a]pan=mono|c0=0.5*c0+0.5*c1'); line += f" | mono sum {mm['I'] - m1['I']:+.1f} LU"
    print(line); rep.append(line)
# level of each 5.1 channel
r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f'{P} 5.1.wav', '-af', 'astats=measure_overall=none:measure_perchannel=RMS_level+Peak_level', '-f', 'null', '-'], capture_output=True, text=True, errors='replace').stderr
ch = re.findall(r'RMS level dB: (-?[\d.]+|-inf)', r)[:6]; line = '5.1 channels RMS dB  ' + '  '.join(f'{n} {v}' for n, v in zip(['L', 'R', 'C', 'LFE', 'Ls', 'Rs'], ch)); print(line); rep.append(line)
open(f'{P} son.txt', 'w', encoding='utf8').write('\n'.join(rep) + '\n')
