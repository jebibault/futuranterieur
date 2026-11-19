#!/bin/bash
# new-episode.sh — create the studio (once) and one episode folder from the templates.
#   new-episode.sh <studio dir> <episode slug>      e.g. ~/Documents/Studio ep05-serotonine-bleue
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
STUDIO="$1"; EP="$2"
mkdir -p "$STUDIO"
[ -f "$STUDIO/studio.md" ] || cp "$SKILL/templates/studio.md" "$STUDIO/studio.md"
[ -f "$STUDIO/log.md" ] || printf '# Log\n\n| date | episode | step | tool/model | input | output | verdict |\n|---|---|---|---|---|---|---|\n' > "$STUDIO/log.md"
E="$STUDIO/episodes/$EP"
mkdir -p "$E"/{cast,plates,animatic,film,review,renders,subs}
for f in bible.md shots.md; do [ -f "$E/$f" ] || cp "$SKILL/templates/$f" "$E/$f"; done
[ -f "$E/cast/_passport-template.md" ] || cp "$SKILL/templates/passport.md" "$E/cast/_passport-template.md"
echo "{\"ok\":true,\"episode\":\"$E\"}"
