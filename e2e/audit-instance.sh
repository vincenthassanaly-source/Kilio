#!/usr/bin/env bash
# Instance isolée pour un agent d'audit, dans son propre espace réseau (le build fige
# l'URL Supabase sur localhost:54321 : chaque instance a donc son propre « localhost »).
# Faire `npx next build` une fois avant (avec E2E_SUPABASE_URL=http://localhost:54321).
# Usage : e2e/audit-instance.sh <slot>   → affiche NSPID=<pid>, reste au premier plan.
# Ensuite : nsenter -t <NSPID> -n -- <commande>   (app :3100, faux Supabase :54321 DANS l'espace).
# Remise à zéro complète (données + cache serveur) : e2e/audit-reset.sh <NSPID>.
# Panne simulée : nsenter -t <NSPID> -n -- curl 'localhost:54321/__panne?mode=down|lent&ms=8000|off'.
# Captures et rapports sont écrits sur le disque partagé ; seul le réseau est isolé.
set -euo pipefail
cd "$(dirname "$0")/.."
SLOT="${1:?slot requis}"
exec unshare -n bash -c '
  python3 -c "import socket,fcntl,struct;s=socket.socket();fcntl.ioctl(s,0x8914,struct.pack(\"16sH14x\",b\"lo\",1|0x40))"
  export E2E_SUPABASE_URL=http://localhost:54321 SUPABASE_SERVICE_ROLE_KEY=e2e-dummy EXPOSE_TESTING_API=1 E2E_VERROU_DESACTIVE=1 NEXT_TELEMETRY_DISABLED=1 MOCK_SUPABASE_AUDIT=1
  node e2e/mock-supabase.mjs > /tmp/kilio-mock-'"$SLOT"'.log 2>&1 &
  # `next start` relancé s'"'"'il est tué : audit-reset.sh s'"'"'en sert pour vider le cache serveur.
  ( while true; do npx next start --port 3100 >> /tmp/kilio-next-'"$SLOT"'.log 2>&1; sleep 0.3; done ) &
  for _ in $(seq 1 150); do curl -sf -o /dev/null http://localhost:3100/plus && break; sleep 0.2; done
  echo NSPID=$$
  wait
'
