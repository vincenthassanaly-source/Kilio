---
target: critique sur Aujourd hui
total_score: 26
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 1
target_identity: "file:/home/user/Kilio/src/app/(app)/aujourdhui/AujourdhuiView.tsx"
target_fingerprint: "sha256:cad42dc9d937e8671a5139238f0d251b8af2eb908139eac4ab03ba6402c2a759"
target_path: /home/user/Kilio/src/app/(app)/aujourdhui/AujourdhuiView.tsx
timestamp: 2026-11-09T13-01-59Z
slug: src-app-app-aujourdhui-aujourdhuiview-tsx
---
# Critique : écran Aujourd'hui (mobile 390x844, clair et sombre)

Méthode : DEGRADED single-context (pas de sous-agent). Détecteur : 0 finding. Bas de l'écran jugé d'après le code (captures défilées vides).

Score : 26/36 (Bon, 72 %). Heuristique 10 (Aide) n/a.

## Problèmes prioritaires
- [P1] La journée (chronologie) est après ~1,2 écran, sous « En retard » et « Plan du jour » -> /impeccable layout
- [P2] La même tâche en retard apparaît dans « En retard » et « Plan du jour » ; 6 puces de report -> /impeccable distill
- [P2] 10 sections de même poids, « Jours libres » en carte permanente -> /impeccable layout
- [P2] Collisions : bouton « + » sur « Placer », bouton thème fixe sur les en-têtes de carte, barre du bas translucide -> /impeccable polish
- [P3] Bouton haltère sans libellé ni état visible -> /impeccable clarify

## Propositions
A. Journée d'abord (score en bandeau, journée, tâches, « À rattraper » replié). B. Bandeau santé (séances, repas, jours libres, pesée) en une rangée de pastilles. C. Maintenant / Ensuite / Plus tard (plus radical).
Recommandé : A + B.
