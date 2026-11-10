---
target: module agenda
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/Kilio/src/app/(app)/agenda"
timestamp: 2026-11-10T14-12-45Z
slug: src-app-app-agenda
---
# Critique Agenda (2026-11-10), Operate, dual-agent. Score 25/40 (aucun n/a). Detecteur: 0 finding.
Verdict: modérément spécifique, squelette type Google Calendar; thèse "trous libres" d'Aujourd'hui absente.
P1 Deux "+" concurrents (AgendaView.tsx:339-350, 416-426) -> FAB unique Tâche/Événement. clarify, layout
P1 "Aujourd'hui" par la couleur seule (WeekView.tsx:187, MonthView.tsx:117) -> marqueur non chromatique. harden
P2 Redondance vue Jour (DayView.tsx:130-141,180-195) -> distill (chips cliquables, doublons, trous libres)
P2 Semaine: cibles/densité (WeekView.tsx:182-238, TimeGrid.tsx:25) -> adapt
P3 Copie/micro-états (DayView.tsx:181, PeriodHeader.tsx, loading.tsx) -> polish
Personas: Alex (pas de saut de date/création grille/report), Sam (groupe sélecteur, ordre tab, lien Aujourd'hui 12px), Casey (Événement hors pouce, swipe vs scroll).
