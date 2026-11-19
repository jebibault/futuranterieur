#!/bin/bash
# framecheck.sh — pull N evenly spaced frames from a finished MP4 into one
# labelled grid (and the single frames), for the 16-frame check.
#   framecheck.sh renders/film.mp4 review/framecheck [N=16]
set -euo pipefail
IN="$1"; OUT="$2"; N="${3:-16}"
mkdir -p "$OUT"; : > "$OUT/times.txt"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
for i in $(seq 0 $((N-1))); do
  T=$(python3 -c "print(round(($i+0.5)/$N*$D,3))")
  ffmpeg -hide_banner -loglevel error -y -ss "$T" -i "$IN" -frames:v 1 "$OUT/frame_$(printf %02d $((i+1))).png"
  echo "frame_$(printf %02d $((i+1))).png t=$T" >> "$OUT/times.txt"
done
ffmpeg -hide_banner -loglevel error -y -framerate 1 -i "$OUT/frame_%02d.png" \
  -vf "scale=480:-1,tile=4x$(( (N+3)/4 )):padding=6:margin=6:color=0x202020" -frames:v 1 "$OUT/grid.png"
echo "{\"ok\":true,\"grid\":\"$OUT/grid.png\",\"times\":\"$OUT/times.txt\",\"frames\":$N,\"duration\":$D}"
