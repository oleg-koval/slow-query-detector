#!/usr/bin/env bash
# Builds docs/assets/queryd-readme-demo.gif — terminal-style teaser for README / social.
# Requires: ImageMagick 7+ (`magick`), ffmpeg (palette GIF).
#
# Timing (tune without editing script):
#   QUERYD_GIF_FPS=4              playback fps (lower = slower overall)
#   QUERYD_GIF_STEP_HOLD=3        duplicate each "typing step" (~0.75s at 4fps per step)
#   QUERYD_GIF_FINAL_HOLD=12      extra copies of last frame (~3s at 4fps) to read JSON
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/docs/assets/queryd-readme-demo.gif"
TMP="${ROOT}/.tmp-readme-gif-frames"

FPS="${QUERYD_GIF_FPS:-4}"
STEP_HOLD="${QUERYD_GIF_STEP_HOLD:-3}"
FINAL_HOLD="${QUERYD_GIF_FINAL_HOLD:-12}"

command -v magick >/dev/null 2>&1 || {
  echo "error: ImageMagick 7+ (magick) not found" >&2
  exit 1
}
command -v ffmpeg >/dev/null 2>&1 || {
  echo "error: ffmpeg not found" >&2
  exit 1
}

FONT="${QUERYD_DEMO_FONT:-}"
if [[ -z "${FONT}" ]]; then
  for f in \
    "/System/Library/Fonts/Supplemental/Courier New.ttf" \
    "/System/Library/Fonts/Monaco.ttf" \
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf" \
    "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"; do
    if [[ -f "${f}" ]]; then
      FONT="${f}"
      break
    fi
  done
fi
if [[ -z "${FONT}" ]]; then
  echo "error: no monospace TTF found. Install DejaVu or set QUERYD_DEMO_FONT=/path/to/font.ttf" >&2
  exit 1
fi

rm -rf "${TMP}"
mkdir -p "${TMP}"

# Intro + plain-English hints before each JSON line (GIF is still simulated / not a screen recording).
readarray -t lines <<'EOF'
# queryd — simulated terminal. Each section: what happened, then the JSON your app can log.

$ node quickstart.mjs

// wrapTaggedTemplate + runWithDbContext()

# (1) Normal query finished in 19ms → one "db.query" event (no slow flag yet).
{"evt":"db.query","durationMs":19,"db":"primary","requestId":"req-1"}

# (2) Same shape, but 287ms crossed your warn threshold → "slow": true on the event.
{"evt":"db.query","durationMs":287,"slow":true,"db":"primary","requestId":"req-1"}

# (3) This request issued 84 DB round-trips; your cap is 80 → "db.request.budget" (storm / N+1).
{"evt":"db.request.budget","used":84,"maxQueries":80,"requestId":"req-1"}
EOF

n=${#lines[@]}
idx=0
cur="${TMP}/_caption.png"

for ((i = 0; i < n; i++)); do
  cap="${TMP}/caption-${i}.txt"
  : >"${cap}"
  for ((j = 0; j <= i; j++)); do
    printf '%s\n' "${lines[j]}" >>"${cap}"
  done
  magick \
    -background '#0d1117' \
    -fill '#c9d1d9' \
    -font "${FONT}" \
    -pointsize 15 \
    -size 920x480 \
    caption:@"${cap}" \
    "${cur}"

  for ((d = 0; d < STEP_HOLD; d++)); do
    cp "${cur}" "${TMP}/$(printf 'frame-%03d.png' "${idx}")"
    idx=$((idx + 1))
  done
done

rm -f "${cur}"

# Hold final frame so readers can read JSON
last=$((idx - 1))
lastfile="${TMP}/$(printf 'frame-%03d.png' "${last}")"
for _ in $(seq 1 "${FINAL_HOLD}"); do
  cp "${lastfile}" "${TMP}/$(printf 'frame-%03d.png' "${idx}")"
  idx=$((idx + 1))
done

palette="${TMP}/palette.png"
ffmpeg -y -hide_banner -loglevel error -framerate "${FPS}" -i "${TMP}/frame-%03d.png" \
  -vf "palettegen=stats_mode=single" -frames:v 1 "${palette}"
ffmpeg -y -hide_banner -loglevel error -framerate "${FPS}" -i "${TMP}/frame-%03d.png" -i "${palette}" \
  -lavfi "paletteuse=dither=bayer:bayer_scale=3" "${OUT}"

rm -rf "${TMP}"
approx_s="$(awk -v f="${idx}" -v fps="${FPS}" 'BEGIN { if (fps > 0) printf "%.1f", f / fps; else print "?" }')"
echo "wrote ${OUT}  (${idx} frames ≈ ${approx_s}s @ ${FPS} fps, step_hold=${STEP_HOLD}, final_hold=${FINAL_HOLD})"
