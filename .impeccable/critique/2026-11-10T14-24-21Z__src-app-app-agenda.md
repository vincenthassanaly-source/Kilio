---
target: module agenda (passe 2)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/user/Kilio/src/app/(app)/agenda"
timestamp: 2026-11-10T14-24-21Z
slug: src-app-app-agenda
---
# Critique Agenda, passe 2 (2026-11-10), Operate, dual-agent. Score 22/40 (aucun n/a), relecteur plus sévère que la passe 1 (25/40): non comparable. Détecteur: 0 finding.
P1 Faux vide / erreurs silencieuses (events, fériés, planning; events non préchargés) -> harden
P1 Événements journée entière absents de la Semaine (vérifié, WeekView.tsx:110); cas avant 6h à vérifier -> harden, layout
P1 Menu du FAB: role=menu sans gestion du focus/flèches/retour (introduit par PR #292) -> harden
P2 Création lente, Semaine/Mois opaques -> shape, adapt
P2 Hiérarchie titre/date inversée, Liste sans ancrage Aujourd'hui -> typeset, layout
Personas: Alex (raccourcis, scroll perdu au changement de jour), Sam (focus menu, 21 arrêts de tab en Semaine, focus-visible), Casey (contrôles en haut, tap accidentel édition).
