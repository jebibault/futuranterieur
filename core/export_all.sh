#!/bin/zsh
# SCALE=1.5 renders 1080p, SCALE=3 renders 4K (the page must be built with RES set to the same value); CRF sets the quality; NOLIGHT=1 skips the small copy; JOBS sets the number of browsers
# usage (from a film folder): ../core/export_all.sh <file.html> "<Output name>"   -> "<Output name>.mp4" and "<Output name> (léger).mp4", without subtitles
H="$1"; NAME="$2"; SC="${SCALE:-1}"; U="file://$PWD/$H?nosub=1&s=$SC"; CRF="${CRF:-24}"; D=out/vid; rm -rf $D; mkdir -p $D
N=$(node ../core/cdp.mjs "file://$PWD/$H" 'Math.ceil(FILM.DUR*24)' nowait)
J="${JOBS:-5}"; Q=$(( (N + J - 1) / J ))
node ../core/export.mjs "$U" audio 0 $D/none.mp4 $D/audio.raw > $D/audio.log 2>&1 &
for i in $(seq 0 $((J-1))); do ( for try in 1 2 3; do node ../core/export.mjs "$U" $(( i * Q )) $(( (i + 1) * Q )) $D/p$i.mp4 > $D/p$i.log 2>&1 && grep -q "^done" $D/p$i.log && break; done ) & done
wait
: > $D/list.txt; for i in $(seq 0 $((J-1))); do echo "file 'p$i.mp4'" >> $D/list.txt; done
ffmpeg -y -v error -f concat -safe 0 -i $D/list.txt -f s16le -ar 44100 -ac 2 -i $D/audio.raw -c:v libx264 -preset medium -crf $CRF -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -shortest "$NAME.mp4"
if [ -n "$NOLIGHT" ]; then echo EXPORTDONE $N frames > $D/done.txt; exit 0; fi
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$NAME.mp4"); BR=$(python3 -c "print(int(min(900, (27.5*8*1024)/float('$DUR') - 80)))")
ffmpeg -y -v error -i "$NAME.mp4" -vf "scale=854:480,hqdn3d=3:3:6:6" -c:v libx264 -preset slow -b:v ${BR}k -pass 1 -passlogfile $D/pl -an -f mp4 /dev/null
ffmpeg -y -v error -i "$NAME.mp4" -vf "scale=854:480,hqdn3d=3:3:6:6" -c:v libx264 -preset slow -b:v ${BR}k -pass 2 -passlogfile $D/pl -c:a aac -b:a 80k -movflags +faststart "$NAME (léger).mp4"
echo EXPORTDONE $N frames > $D/done.txt
