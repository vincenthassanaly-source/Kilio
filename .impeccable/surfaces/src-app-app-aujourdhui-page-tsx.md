---
version: 1
slug: "src-app-app-aujourdhui-page-tsx"
primary_target: "src/app/(app)/aujourdhui/page.tsx"
related_targets: []
---

# Aujourd'hui (/aujourdhui)

Mode : Operate. Extension d'un monde établi (DESIGN.md Kilio : tableau de bord doux, vert olive, cartes 22px, Sora/Inter) : aucune nouvelle identité.

Audience : Vincent, seul, au téléphone, une main, plusieurs fois par jour. Tâche : savoir en un coup d'oeil ce qui reste de la journée (heure, trous libres, retard), cocher, reporter, ajouter un rendez-vous.
Contenu : événements légers (titre, heure, durée, sans case à cocher), tâches du jour, horaires de travail, habitudes, macros restantes, tâches en retard avec report en un tap. Le Programme du jour IA est supprimé.
Contraintes : mobile d'abord, saisie rapide, hors ligne partiel (file d'attente existante), pas d'onboarding, pas de nouvelle couleur.

## Direction contract

THESIS: la journée comme une frise à l'échelle réelle, avec le trou libre visible, plutôt que quatre cartes de résumé empilées comme l'accueil.
OWN-WORLD: surfaces `surface` sur fond `background`, filets `line`, accent vert `kcal` réservé aux actions et à l'état coché, bleu `agenda` pour le temps (repère « maintenant », événements), bande `planning-travail` pour le travail, retard en `alert` discret (texte et pastille, jamais de fond plein).
STORY: Vincent ouvre l'écran, voit s'il est en retard sur quelque chose, ce qui l'attend ensuite et combien de temps libre il lui reste, puis coche, reporte ou ajoute un rendez-vous sans changer d'écran.
FIRST VIEWPORT: titre « Aujourd'hui » + date ; bandeau « En retard » (3 lignes max, trois reports en un tap) quand il existe ; en dessous la frise du jour, calée sur l'heure courante, avec le repère maintenant et le bouton « Événement » dans son en-tête.
FORM: Frise horaire à l'échelle (liste chronologique à part rejetée : elle cache les trous libres), seed key: aucun (extension d'un monde établi, pas de concept-seed).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
