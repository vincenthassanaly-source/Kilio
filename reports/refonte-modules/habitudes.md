# Cohérence interne — module Habitudes (lecture seule, 2026-11-14)

Sources : `src/app/(app)/habitudes/*` (page, `HabitudesView`, `HabitudeCard`, `HabitudeForm`, `AddHabitudeToggle`, `HistoriqueView`, `HabitudesVides`), `src/app/actions/habitudes.ts`, `src/lib/habitudes/compute.ts`, `DashboardHabitudesSection.tsx` / `DashboardHabitItem.tsx`, GLOSSARY/PRODUCT/DESIGN, rapports `2026-09-02-swipe-journal-et-habitudes`, `2026-09-04-dashboard-espacement-habitudes…`, `2026-11-12-audit-design-habitudes`. Captures : `reports/audit/habitudes/` (ecrans/, parcours/, scenarios/).

## Résumé
- Module compact et lisible : un écran, deux vues (Aujourd'hui / Historique), un geste central (cocher), patrons Supprimer/Annuler/Fermer conformes au GLOSSARY.
- Le libellé « Supprimer » ne dit pas ce que fait le code : l'habitude est archivée (`actif=false`), donc invisible partout et irrécupérable depuis l'app (C1, B1).
- Le formulaire mélange deux axes (Type × Rythme) dont « Série » vs « Oui / non » ne se distingue que par l'affichage de la flamme (B3) ; sous-titre « Un suivi quotidien » inexact (B4).
- Trois accès à la même donnée (écran du jour, /habitudes, historique) sans lien explicite entre eux : la quantité n'est saisissable que dans /habitudes, sans lien depuis l'écran du jour (A3).
- 6 propositions (S/M), aucune ne remet en cause un choix tranché. Aucun écran avec données n'a pu être rendu sur le banc (voir fin).

## Inventaire des écrans
| Route / écran | Rôle |
|---|---|
| `/habitudes` vue « Aujourd'hui » (`HabitudesView.tsx:35-66`) | Carte repliée « Ajouter une habitude », liste de cartes (anneau + coche, nom, flamme de série, « X / Y cette semaine », champ de valeur pour les quantifiées, boutons Modifier / Supprimer). État vide `HabitudesVides`. |
| `/habitudes` vue « Historique » (`HistoriqueView.tsx`) | Sélecteur d'habitude (`<select>`), navigation mois (flèches + swipe), grille calendrier teintée. Lecture seule. |
| Édition en place (`HabitudeCard.tsx:96-115`) | `HabitudeForm` dans la carte + « Annuler ». |
| `loading.tsx` / `HabitudesSkeleton` | Squelette. |
| Hors module | Section « Habitudes » de l'écran du jour (`DashboardHabitudesSection`, pastilles à cocher ; quantifiées désactivées `DashboardHabitItem.tsx:82`) ; score du jour (`score.ts`). Pas d'entrée dans le FAB rapide ni dans la recherche globale. |
Pas de sous-route ; pas d'écran orphelin. Captures : `ecrans/habitudes.clair.png`, `habitudes.sombre.png` (état vide uniquement).

## Constats

### Axe A — parcours et hiérarchie
- A1 (basse) Hiérarchie claire : titre → bascule de vue → ajout → liste. L'onglet « Aujourd'hui » porte le même nom que l'écran du jour (`/`), alors que `/habitudes` montre bien les habitudes du jour : lisible, mais deux « Aujourd'hui » dans l'app.
- A2 (moyenne) Historique en lecture seule, une habitude à la fois : une coche oubliée hier ne peut pas être rattrapée, et pour comparer deux habitudes il faut changer le `<select>` (`HistoriqueView.tsx:86-98`). Option déjà listée (audit design 11-12, option 4), non tranchée.
- A3 (moyenne) Dashboard → module : la section de l'écran du jour désactive les quantifiées (`DashboardHabitItem.tsx:82`) mais son titre n'est pas un lien ; le seul lien vers `/habitudes` n'existe que dans l'état vide (« Créer une habitude », `DashboardHabitudesSection.tsx:35-40`). Pour saisir « 3 verres » depuis le jour, il faut passer par la barre « Plus ».
- A4 (basse) Carte d'ajout en tête de liste : pousse les habitudes de ~70 px alors que l'usage quotidien est de cocher (audit design, option 2, non tranchée).
- A5 (basse) L'historique ne montre que les habitudes actives (`habitudes` issu de `getHabitudesDuJour`) : l'historique d'une habitude supprimée n'est plus consultable (voir C1).

### Axe B — vocabulaire et gestes
- B1 (moyenne) « Supprimer » (bouton `HabitudeCard.tsx:281-ish`, toast « Habitude « X » supprimée ») mais l'action archive (`actions/habitudes.ts:119-139`, commentaire « Archivage plutôt que suppression »). GLOSSARY : Supprimer = détruire ; « archivé » est d'ailleurs déconseillé dans les textes visibles pour Courses. Le geste (différé + Annuler 6 s, sans confirmation) est conforme au patron GLOSSARY ; c'est la promesse du mot qui est inexacte : les données restent mais sans accès.
- B2 (basse, conforme) « Annuler » sous le formulaire (ajout et édition) = GLOSSARY (« fermer un formulaire sans rien enregistrer ») ; `textButton` appliqué aux deux endroits (`AddHabitudeToggle.tsx:36`, `HabitudeCard.tsx`).
- B3 (moyenne) Type : segments « Oui / non · Série · Quantité » mais noms accessibles « Fait / pas fait · Série (jours consécutifs) · Quantifiée » (`HabitudeForm.tsx:17-27`) : trois vocabulaires pour les mêmes types. Surtout, « Oui / non » et « Série » se comportent pareil (`estFait`, `compute.ts:34-40`) ; seule la flamme change (`HabitudeCard.tsx` : flamme si `type === "streak"` ou hebdo). Le streak d'une « Oui / non » quotidienne est calculé mais jamais montré, sans que le formulaire l'explique. Rythme (« Chaque jour / X fois / semaine ») est un second axe orthogonal : une « Quantité » hebdo est possible.
- B4 (basse) Sous-titre de la carte d'ajout « Un suivi quotidien » (`AddHabitudeToggle.tsx:21`) alors que le rythme peut être hebdomadaire et le type quantifié (même défaut que Courses B2).
- B5 (basse) Abréviations dans la pastille de série : « 5j », « 3 sem. » (`HabitudeCard.tsx` pill) vs « cette semaine » en toutes lettres ; libellé « X fois / semaine » (segment) vs « Fois par semaine » (champ) vs « Objectif (optionnel) » / « Icône (optionnel) ».
- B6 (basse) Couleur interactive : le contrôle segmenté est en vert Kcal (commentaire `HabitudesView.tsx:34-35` : « l'orange n'est qu'une couleur d'identité »), mais l'anneau et la coche des cartes et de l'écran du jour sont en `--accent-habitudes` orange (`HabitudeCard.tsx` ProgressRing, `DashboardHabitItem.tsx:87`). DESIGN.md:146 : les teintes de module ne remplacent pas le vert Kcal comme couleur interactive. Possiblement voulu (anneau de progression), non tranché explicitement.
- B7 (basse) Texte de pending : « Enregistrement... » (trois points ASCII) côté formulaire (`HabitudeForm.tsx:182`) ; à comparer aux autres modules (non vérifié).

### Axe C — cohésion fonctionnelle
- C1 (moyenne) Données archivées sans écran : `supprimerHabitude` conserve `habitude_entries` « pour l'historique/heatmap » (commentaire `actions/habitudes.ts:119-122`), mais aucun écran ne les relit (`getHabitudesDuJour` filtre sur `actif`). Soit l'archive est un vrai besoin (alors prévoir « Habitudes archivées » dans l'Historique), soit c'est une suppression et le libellé est juste mais les données traînent.
- C2 (basse) Pas de réordonnancement : `creerHabitude` calcule `ordre` (`:80-87`) mais aucune action de tri n'existe ; l'ordre est figé à la création.
- C3 (basse) Score du jour et écran du jour dépendent des mêmes données (`queryKeys.habitudes`) : cohérent et déjà documenté (PRODUCT.md:25) ; `/habitudes` ne rappelle pas ce score.
- C4 (basse) Aucun doublon de composant : `HabitudeForm` sert à l'ajout et à l'édition, `ProgressRing` partagé avec l'écran du jour. Deux implémentations de la coche (`HabitudeCard` maison, `DashboardHabitItem`) et ni l'une ni l'autre n'est `CheckToggle` (audit design, option 5, non tranchée).
- Déjà corrigé depuis l'audit design 11-12 (relu dans le code) : cible tactile 44 px (`after:-inset-[5px]`), `aria-label`/`aria-pressed`, Entrée valide la valeur, `textButton` pour Annuler, `navArrowButton`, états d'erreur/chargement de l'historique, texte sr-only par jour, id effectif de l'historique, `autoFocus` à la création.

## Propositions

- **P1 — Dire la vérité sur « Supprimer » (B1, C1).** Choisir l'une : (a) garder « Supprimer » et supprimer réellement (`delete` + cascade) ; (b) garder l'archivage et ajouter dans l'Historique un filtre « Archivées » (lecture seule) ; (c) minimum : GLOSSARY précise « Supprimer une habitude l'archive ; son historique est conservé ». Effort S (c) / M (a, b). Risque : (a) perte de données irréversible, migration ; (b) requête en plus. Fichiers : `GLOSSARY.md`, `actions/habitudes.ts`, `HistoriqueView.tsx`. Dépend : décision de Vincent.
- **P2 — Clarifier Type vs Série (B3).** Soit fusionner « Série » dans « Oui / non » (flamme dès que streak > 0), soit ajouter un sous-texte « Série : affiche les jours d'affilée ». Harmoniser les libellés visibles et accessibles. Effort S (texte) / M (fusion : migration de `type`). Risque : tests `HabitudeForm.test.tsx`, `habitudes.test.tsx`. Fichiers : `HabitudeForm.tsx`, `HabitudeCard.tsx`.
- **P3 — Lien du jour vers le module (A3).** Rendre le titre « Habitudes » de l'écran du jour cliquable vers `/habitudes` (comme les autres sections, à vérifier) et, pour une quantifiée désactivée, un lien/aria expliquant « Saisir dans Habitudes ». Effort S. Risque : `view-transition-name` partagé (`habitudes-titre-dashboard`) déjà prévu pour cette transition. Fichiers : `DashboardHabitudesSection.tsx`, `DashboardHabitItem.tsx`.
- **P4 — Sous-titre et libellés (B4, B5).** « Un suivi quotidien » → « Une habitude à suivre » ; écrire « sem. » / « j » en toutes lettres ou le garder partout. Effort S, risque nul. Fichiers : `AddHabitudeToggle.tsx`, `HabitudeCard.tsx`, tests de texte.
- **P5 — Trancher la couleur de coche (B6).** Garder l'orange (documenter l'exception dans DESIGN.md : « anneau de progression ») ou passer au vert Kcal. Effort S. Risque : visuel clair/sombre. Fichiers : `DESIGN.md` ou `HabitudeCard.tsx`, `DashboardHabitItem.tsx`.
- **P6 — Correction d'un jour passé depuis l'Historique (A2).** Tap sur une case → bascule fait/non fait (booléennes) ou saisie (quantifiées), via `enregistrerEntreeHabitude(habitudeId, date, valeur)` déjà datée. Effort M. Risque : recalcul des streaks et du score, file hors ligne. Fichiers : `HistoriqueView.tsx`, éventuellement `HabitudeCard`. Dépend : arbitrage (option déjà listée, non tranchée).

À ne pas faire (déjà tranché) : calcul du streak côté serveur en JS (rapport habitudes), semaines ISO lundi-dimanche, fréquence hebdo 1 à 6, coche optimiste + file hors ligne, bascule segmentée en vert Kcal.

## Pistes inter-modules
- Écran du jour : titre cliquable et quantifiées saisissables (pas +1) depuis la pastille ; voir audit design, option 1 (pas +/-).
- FAB rapide : aucune entrée « Habitude » (non nécessaire : l'usage est de cocher) ; la recherche globale ignore les habitudes : à décider côté Recherche.
- Score du jour : exclut les habitudes archivées ; si P1(b) est retenu, vérifier qu'elles restent exclues.
- Réglages : aucun réglage Habitudes (rappel, ordre) ; hors module.

## Ce qui n'a pas pu être testé
- **Artefact du banc probable, non confirmé** : le faux Supabase n'a aucune fixture `habitudes` / `habitude_entries` (`e2e/mock-supabase.mjs` ne les mentionne pas ; `GET /rest/v1/habitudes` renvoie `[]`). La création via le formulaire reste bloquée sur « Enregistrement... » : la Server Action `POST /habitudes` est annulée (`ERR_ABORTED`) et `/__writes` ne montre aucune écriture `habitudes` (capture `parcours/creer-cocher/04-click.png`, relancé avec 8 s d'attente : même résultat). Je n'ai pas pu déterminer si c'est le mock ou un vrai bug ; à rejouer sur le banc avec fixtures. Je n'ai pas écrit directement dans le mock (refusé par le garde-fou) et n'ai pas modifié `mock-supabase.mjs`.
- En conséquence, **non vérifié visuellement** : cartes (booléenne, quantifiée, hebdo), coche, saisie de valeur, historique avec données, modification, suppression + Annuler, section de l'écran du jour avec habitudes. Tout ce qui les concerne est jugé d'après le code. Seul l'état vide (clair et sombre) est vu : cohérent (« Aucune habitude pour l'instant. » + carte d'ajout).
- Bruit du banc, pas des bugs : 404 `/_vercel/speed-insights/script.js`, `_rsc` `ERR_ABORTED`.
- Outil : Playwright du skill ne trouve pas Chromium 1194 ; copies des scripts dans le scratchpad avec `executablePath` vers `/opt/pw-browsers/chromium-1243`. Aucun `--reset`. Les scénarios `scenarios/01-creer-cocher.json` et `02-historique-modif-suppr.json` sont prêts à rejouer. Le dossier `parcours/` contient des captures d'échec (étapes suivant la création) à ignorer.
- Non testé : hors ligne réel, vibration, gestes tactiles, base réelle.

## Résumé
- Module simple et globalement conforme au GLOSSARY (Annuler, patron de suppression différée) ; les défauts de l'audit design 11-12 sont en grande partie corrigés dans le code.
- Écart principal : « Supprimer » archive en réalité, sans accès aux données archivées (P1).
- Le modèle Type × Rythme est peu lisible, « Série » ≈ « Oui / non » (P2) ; liens écran du jour ↔ module à renforcer (P3).
- Petits écarts de libellés et de couleur à trancher (P4, P5) ; correction d'un jour passé = seule évolution fonctionnelle (P6).
- Vérification visuelle limitée à l'état vide : le faux Supabase n'a pas de données habitudes et la création n'a pas abouti sur le banc.

Rapport : /home/user/Kilio/reports/refonte-modules/habitudes.md
