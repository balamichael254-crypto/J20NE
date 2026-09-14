#!/usr/bin/env bash
# Fetch every remaining world photograph, across as many hourly windows as it
# takes. Unsplash demo apps allow 50 calls an hour and a stop costs two, so
# ~24 stops land per pass and 140 stops needs roughly six passes.
#
# The fetcher skips stops that already have a file, so each pass resumes.
# After every pass the content is rebuilt, so whatever has landed so far is
# immediately live in the app even if the run is interrupted.
#
#   UNSPLASH_ACCESS_KEY=... bash tools/fetch_all_worlds.sh
set -u
cd "$(dirname "$0")"

for pass in $(seq 1 9); do
  echo "===================== pass $pass  ($(date +%H:%M)) ====================="
  PYTHONIOENCODING=utf-8 python fetch_world_images.py

  remaining=$(PYTHONIOENCODING=utf-8 python - <<'PY'
import os
from world_data import WORLDS
out = os.path.join(os.path.dirname(os.path.abspath('.')), 'miss-you-app', 'assets', 'worlds')
out = os.path.join(os.path.dirname(os.getcwd()), 'miss-you-app', 'assets', 'worlds')
missing = sum(
    0 if os.path.exists(os.path.join(out, slug, f"{i:02d}.webp")) else 1
    for slug, w in WORLDS.items() for i in range(len(w[3]))
)
print(missing)
PY
)
  echo "still missing: $remaining"

  PYTHONIOENCODING=utf-8 python build_worlds.py

  if [ "$remaining" -le 0 ]; then
    echo "all stops have photographs after $pass pass(es)"
    break
  fi

  echo "sleeping until the hourly limit resets..."
  sleep 3660
done
