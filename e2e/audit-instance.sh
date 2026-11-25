#!/usr/bin/env bash
# Instance isolée pour un agent d'audit : faux Supabase + `next start` sur des ports dédiés,
# sans rebuild (faire `npx next build` une fois avant). Voir le skill kilio-audit-module.
# Usage : e2e/audit-instance.sh <slot>   (slot 1..9 → app 3100+slot*10, mock 54321+slot*10)
# Affiche BASE=… et MOCK=… une fois prêt, puis reste au premier plan jusqu'à Ctrl-C/kill.
set -euo pipefail
cd "$(dirname "$0")/.."
SLOT="${1:?slot requis (1..9)}"
PORT=$((3100 + SLOT * 10)); MOCK_PORT=$((54321 + SLOT * 10))
export MOCK_SUPABASE_PORT="$MOCK_PORT" E2E_SUPABASE_URL="http://localhost:${MOCK_PORT}"
export SUPABASE_SERVICE_ROLE_KEY=e2e-dummy EXPOSE_TESTING_API=1 E2E_VERROU_DESACTIVE=1 NEXT_TELEMETRY_DISABLED=1
node e2e/mock-supabase.mjs > "/tmp/kilio-mock-${SLOT}.log" 2>&1 & MOCK_PID=$!
npx next start --port "$PORT" > "/tmp/kilio-next-${SLOT}.log" 2>&1 & NEXT_PID=$!
cleanup() { kill "$MOCK_PID" 2>/dev/null || true; fuser -k -TERM "${PORT}/tcp" >/dev/null 2>&1 || kill "$NEXT_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
for _ in $(seq 1 150); do curl -sf -o /dev/null "http://localhost:${PORT}/plus" && break; sleep 0.2; done
echo "BASE=http://localhost:${PORT}"; echo "MOCK=http://localhost:${MOCK_PORT}"
wait
