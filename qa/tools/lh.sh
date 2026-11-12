#!/bin/bash
# Lighthouse runs (mobile = default emulation with simulated slow 4G, desktop preset) against the local production build.
CHROME=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome 2>/dev/null | head -1)
export CHROME_PATH=$CHROME
LH=/tmp/qa-tools/node_modules/.bin/lighthouse
for p in "home:/" "courses:/courses" "course:/courses/personnel-licensing" "apply:/apply?course=personnel-licensing" "gallery:/gallery"; do
  n=${p%%:*}; u=${p#*:}
  for mode in mobile desktop; do
    extra=""; [ $mode = desktop ] && extra="--preset=desktop"
    $LH "http://localhost:3100$u" $extra --chrome-flags="--headless --no-sandbox" --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=qa/perf/lh-$n-$mode.json --quiet >/dev/null 2>&1 && echo "ok $n $mode" || echo "FAIL $n $mode"
  done
done
