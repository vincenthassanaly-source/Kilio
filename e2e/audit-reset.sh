#!/usr/bin/env bash
# Remise à zéro d'une instance d'audit : données du faux Supabase ET cache serveur Next
# (redémarrage de `next start`, relancé par audit-instance.sh). Usage : e2e/audit-reset.sh <NSPID>
set -euo pipefail
PID="${1:?NSPID requis}"
nsenter -t "$PID" -n -- bash -c '
  curl -sf -o /dev/null http://localhost:54321/__reset
  fuser -k -TERM 3100/tcp >/dev/null 2>&1 || true
  for _ in $(seq 1 100); do sleep 0.2; curl -sf -o /dev/null http://localhost:3100/plus && exit 0; done
  echo "app non revenue" >&2; exit 1
'
