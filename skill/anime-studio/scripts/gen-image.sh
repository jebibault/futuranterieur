#!/bin/bash
# gen-image.sh — generate one plate or sheet with codex-imagegen, passing the locked references.
# Run from the episode folder. Prompts live in <dir>/<name>-prompt.txt; refs in plates/_refs.json:
#   {"_stylekey": "plates/harbour-v1.png", "office-two": ["oceane","legoff"], "gwen-beach": {"nostyle": true, "cast": []}}
# usage: gen-image.sh <dir> <name> [version]     e.g. gen-image.sh plates office-two 1 ; gen-image.sh cast/oceane sheet 1
set -uo pipefail
dir=$1; k=$2; v=${3:-1}
G=$(ls -d ~/.claude/plugins/marketplaces/codex-imagegen/skills/codex-imagegen/scripts/imagegen.mjs 2>/dev/null | head -1)
[ -z "$G" ] && { echo '{"ok":false,"error":"codex-imagegen skill not found"}'; exit 1; }
refs=()
if [ -f plates/_refs.json ]; then
  while IFS= read -r r; do [ -n "$r" ] && refs+=(--image "$r"); done < <(python3 - "$k" <<'P'
import json,sys,os
k=sys.argv[1]; R=json.load(open('plates/_refs.json')); e=R.get(k,[])
if isinstance(e,list): e={"cast":e}
if not e.get("nostyle") and R.get("_stylekey") and os.path.exists(R["_stylekey"]): print(R["_stylekey"])
for c in e.get("cast",[]): print(f"cast/{c}/sheet-v1.png")
for x in e.get("extra",[]): print(x)
P
)
fi
node "$G" --prompt-file "$dir/$k-prompt.txt" --out "$dir/$k-v$v.png" ${refs[@]+"${refs[@]}"} --log plates/SOURCES.md --timeout-sec 540 2>/dev/null \
 | python3 -c "import sys,json;d=json.load(sys.stdin);print(json.dumps({'name':'$dir/$k','ok':d.get('ok'),'w':d.get('width'),'h':d.get('height'),'error':d.get('error')}))"
