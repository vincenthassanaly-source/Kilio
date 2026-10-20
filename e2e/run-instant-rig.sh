#!/usr/bin/env bash
# Rig instant() local — voir instant-nav.rig.md.
# Usage : e2e/run-instant-rig.sh [--no-build] [arguments playwright…]
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3100}"
MOCK_PORT="${MOCK_SUPABASE_PORT:-54321}"
export E2E_SUPABASE_URL="http://localhost:${MOCK_PORT}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-e2e-dummy}"
export EXPOSE_TESTING_API=1
# Le verrou biométrique de « Vider ma tête » ne se simule pas dans un navigateur de test.
export E2E_VERROU_DESACTIVE=1
export NEXT_TELEMETRY_DISABLED=1

if ! curl -sf -o /dev/null "http://localhost:${MOCK_PORT}/__reset"; then
  node e2e/mock-supabase.mjs > /tmp/kilio-mock-supabase.log 2>&1 &
  for _ in $(seq 1 50); do curl -sf -o /dev/null "http://localhost:${MOCK_PORT}/__reset" && break; sleep 0.1; done
fi

# `next start` forke un process next-server : on arrête celui qui possède
# réellement le port (fuser ; lsof ne le voit pas dans ce sandbox), et on
# attend que le port soit libéré.
stop_server() {
  for _ in $(seq 1 50); do
    fuser -s "${PORT}/tcp" 2>/dev/null || return 0
    fuser -k -TERM "${PORT}/tcp" > /dev/null 2>&1 || true
    sleep 0.2
  done
  fuser -k -KILL "${PORT}/tcp" > /dev/null 2>&1 || true
}

if [ "${1:-}" = "--no-build" ]; then
  shift
else
  npx next build
fi

stop_server
if fuser -s "${PORT}/tcp" 2>/dev/null; then
  echo "Port ${PORT} toujours occupé : abandon." >&2
  exit 1
fi
npx next start --port "${PORT}" > /tmp/kilio-next-start.log 2>&1 &
trap stop_server EXIT
for _ in $(seq 1 100); do curl -sf -o /dev/null "http://localhost:${PORT}/plus" && break; sleep 0.2; done

BASE_URL="http://localhost:${PORT}" npx playwright test "$@"
