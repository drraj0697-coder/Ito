#!/bin/sh
# Container/server entrypoint. All data remains server-side; the GitHub Pages
# PWA talks to this process over HTTPS.
set -eu

uv run python scripts/wait_for_mongo.py

# A new deployment may set SEED_DEMO=true to prove the whole stack works. It
# creates only the six clearly labelled sample questions; do not enable it in
# a populated production database.
if [ "${SEED_DEMO:-false}" = "true" ]; then
  uv run python scripts/seed_pwa_demo.py
fi

# Safe to repeat. Adds the indexes used by PWA browsing, search and progress.
uv run python scripts/setup_pwa.py

exec uv run gunicorn \
  --bind "0.0.0.0:${PORT:-5001}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout "${GUNICORN_TIMEOUT:-90}" \
  run:app
