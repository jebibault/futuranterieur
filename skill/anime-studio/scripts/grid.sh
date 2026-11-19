#!/bin/bash
# grid.sh — put images side by side, 2 per row, for review.   grid.sh out.jpg a.png b.png c.png ...
set -euo pipefail
out=$1; shift; n=$#; args=(); f=""; i=0
for p in "$@"; do args+=(-i "$p"); f+="[$i]scale=836:470[x$i];"; i=$((i+1)); done
if [ $((n % 2)) -eq 1 ]; then args+=(-f lavfi -i "color=c=0x202020:s=836x470"); f+="[$n]null[x$n];"; n=$((n+1)); fi
rows=""; for ((r=0; r<n/2; r++)); do f+="[x$((2*r))][x$((2*r+1))]hstack[r$r];"; rows+="[r$r]"; done
if [ $((n/2)) -gt 1 ]; then f+="${rows}vstack=inputs=$((n/2))"; else f="${f%;}"; f="${f%\[r0\]}"; fi
ffmpeg -hide_banner -loglevel error -y "${args[@]}" -filter_complex "$f" -frames:v 1 "$out"
echo "{\"ok\":true,\"out\":\"$out\",\"images\":$#}"
