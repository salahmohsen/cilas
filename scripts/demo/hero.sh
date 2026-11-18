#!/usr/bin/env bash
# Records the home page hero alone (no frame, caption or cursor) and makes the README teaser GIF.
# Usage: scripts/demo/hero.sh [base-url]   (default: the demo server from serve-demo.sh)
set -euo pipefail
cd "$(dirname "$0")/../.."
BASE=${1:-http://localhost:3100}
CLIP=video/public/clips/hero.mp4
S=(agent-browser --session demo-hero)

mkdir -p "$(dirname "$CLIP")"
"${S[@]}" close >/dev/null 2>&1 || true
"${S[@]}" --args "--force-device-scale-factor=2,--window-size=1600,1043" open "$BASE/en" >/dev/null
"${S[@]}" set media light >/dev/null
sleep 5
"${S[@]}" record start "$CLIP" --fps 30 >/dev/null
sleep 12
"${S[@]}" record stop >/dev/null
"${S[@]}" close >/dev/null

# The first second can hold the page's entry animation; the loop starts after it.
ffmpeg -loglevel error -y -ss 1 -t 10 -i "$CLIP" -vf \
  "fps=10,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" \
  docs/demo/cilas-demo.gif
