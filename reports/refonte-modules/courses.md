# Cohérence interne — module Courses (lecture seule, 2026-11-14)

Sources : code `src/app/(app)/courses/*`, `src/app/actions/{courses,menus}.ts`, `EnvoyerCoursesBouton.tsx`, `QuickAddFab.tsx`, GLOSSARY/PRODUCT/DESIGN, rapports `*courses*` (dont audit 09-19 et audit design 11-12). Captures : `reports/audit/courses/` (ecrans/, parcours/).

## Résumé
- Module petit et très cohérent : un seul écran, un geste central (coche), vocabulaire À prendre / Pris / Supprimer conforme au GLOSSARY.
- Pas de bug d'usage trouvé sur le banc (ajout multiple, doublon, vide, 100 car., coche, rechargement, suppression + Annuler, vider les pris).
- Écarts de cohérence réels mais mineurs : couleur de coche violette (contredit DESIGN.md), sous-titre « Un article… » alors que l'ajout est multiple, titres d'ajout différents selon l'entrée, patron « Supprimer » de Courses ≠ celui décrit au GLOSSARY.
- Aucun doublon ni écran orphelin ; la vraie question de cohésion est à la frontière Menus → Courses (dédoublonnage par libellé avec quantité).
- 5 propositions, toutes S, aucune ne remet en cause un choix déjà tranché.

## Inventaire des écrans
| Route | Rôle |
|---|---|
| `/courses` (`page.tsx`, `CoursesView`, `CoursesList`) | Seul écran. Carte « Ajouter un article » (repliée), liste « N articles à prendre » groupée par rayon (classement automatique par mot-clé, `compute.ts:257-402`), carte « Articles pris (N) » repliable + bouton « Supprimer les articles pris ». |
| `loading.tsx` | Squelette. |
| Points d'entrée hors module | FAB rapide « Courses » (modale `AddCourseForm`, `QuickAddFab.tsx:228-245,399-407`) ; recherche globale (`recherche.ts:150-158`, tout résultat → `/courses`) ; « Envoyer aux Courses » dans Nutrition › Menus (`EnvoyerCoursesBouton.tsx`, toast « Voir » → `/courses`) ; Réglages › nettoyage auto des articles pris (`NettoyageAutoRow.tsx`). |
Pas de sous-route, pas d'écran orphelin. Captures : `ecrans/courses.clair.png`, `courses.sombre.png` (état vide), `parcours/*`.

## Constats

### Axe A — parcours et hiérarchie
- A1 (basse) Hiérarchie claire : titre → ajout → à prendre par rayon → pris en bas. Les « pris » vivent dans une carte repliée dont le bouton « Supprimer les articles pris » reste visible même repliée (`ArchivedCoursesSection.tsx:97-111`, capture `coche-pris-suppression/07`). Cohérent avec l'usage « en sortant du magasin », choix déjà tranché (rapport 09-13).
- A2 (basse) Retour d'un menu : le toast « Voir » mène bien à `/courses`, mais rien dans Courses n'indique que des articles viennent des Menus ; l'état vide ne mentionne que la saisie manuelle (`CoursesList.tsx:41-43`). Pas bloquant.
- A3 (basse) Le chemin « décocher un article pris » exige de déplier « Articles pris » (`07` → `10`) : prévu, mais la coche est le seul moyen de revenir en arrière hors toast ; l'option « coche annulable » est déjà listée à l'audit design 11-12 (non revisitée ici).

### Axe B — vocabulaire et gestes
- B1 (moyenne) Couleur de coche : `CourseItemRow.tsx:246-251` passe `color="var(--accent-courses)"` (violet, visible sur `coche-pris-suppression/10`) alors que Tâches, Menus (`LigneMenu.tsx:84`) et le reste utilisent le défaut `--accent-kcal` (`CheckToggle.tsx:26`), et que DESIGN.md:146 dit que les teintes de module « ne remplacent jamais le vert Kcal comme couleur interactive à l'intérieur d'un module ». À vérifier si c'est volontaire : aucun rapport ne le tranche (le rapport 09-19 cite `accent-courses`, sans décision explicite sur ce point).
- B2 (basse) Sous-titre de la carte d'ajout : « Un article pour la liste de courses » (`AddCourseToggle.tsx:22`), alors que le champ accepte plusieurs articles (« Ajouter 4 articles », capture `ajout-coche-vider/04`) et que le placeholder dit « lait, œufs, pain ».
- B3 (basse) Trois intitulés pour le même geste d'ajout : « Ajouter un article » (carte), « Ajouter à la liste de courses » (modale FAB, `QuickAddFab.tsx:400`), tuile FAB « Courses ». Les verbes sont corrects (Ajouter), seul le complément varie.
- B4 (basse) « Fermer » sous le formulaire (`AddCourseToggle.tsx:34-36`) : exception explicitement documentée au GLOSSARY (Annuler) : conforme, rien à changer.
- B5 (basse) GLOSSARY « Supprimer » décrit un patron unique « appel serveur différé à la fin du toast » ; Courses supprime immédiatement et restaure en réinsérant (`CourseItemRow.tsx:107-129`, `undo.ts`, `courses.ts:173`), décision actée (audit 09-19 #7) et même origine du patron (`suppressionDifferee.ts:18`). Écart de documentation, pas de comportement (pas de rupture visible pour l'utilisateur).
- B6 (basse) « Retirer » vs « Supprimer » : correct ici (« Supprimer » détruit un article texte libre). Rien à corriger.
- Vu conforme : « à prendre », « Articles pris », « Supprimer les articles pris », toasts « X supprimé · Annuler » identiques à ceux des autres modules (`13`, `19`).

### Axe C — cohésion fonctionnelle
- C1 (moyenne) Dédoublonnage Menus → Courses par libellé complet : la clé est le texte normalisé (`compute.ts:48-55`) et les libellés envoyés contiennent la quantité (« Poulet, 600 g », PRODUCT.md:21). Un menu modifié (800 g) ou un article saisi à la main « poulet » donne donc deux lignes. Conséquence directe du choix « article = texte libre » (déjà tranché : ne pas remettre en cause) ; non vérifié sur le banc (voir plus bas).
- C2 (basse) Un article « pris » dont le libellé identique est renvoyé depuis les Menus repasse à « à prendre » (`aReactiver`, `menus.ts:182-184`, `ajoutes += crees + reactives`) : cohérent pour une nouvelle semaine, mais le toast dit « ajouté aux Courses » sans distinguer réactivé/nouveau.
- C3 (basse) Le nettoyage automatique des articles pris vit dans Réglages (`NettoyageAutoRow.tsx`), partagé avec Tâches : placement transverse acceptable, mais Courses n'en dit rien (la carte « Articles pris » ne rappelle pas la suppression auto).
- C4 (basse) La recherche globale renvoie toujours `/courses` sans repérer la ligne (`recherche.ts:154-156`) : acceptable sur un écran unique et court.
- Aucun doublon de composant : `AddCourseForm` est réutilisé tel quel par le FAB (bon point), `CourseItemRow` par la liste et les pris.

## Propositions

- **P1 — Aligner la couleur de coche sur le défaut Kilio (B1).** Retirer la prop `color` de `CheckToggle` dans `CourseItemRow` (ou documenter l'exception dans DESIGN.md si Vincent la veut). Effet : coche verte comme partout, `--on-accent`/contraste déjà géré par le défaut. Effort S. Risque : faible (visuel) ; vérifier contraste clair/sombre. Fichiers : `src/app/(app)/courses/CourseItemRow.tsx` (+ `DESIGN.md` si exception). Dépend : décision de Vincent (volontaire ou non).
- **P2 — Sous-titre de la carte d'ajout au pluriel (B2).** « Un article pour la liste de courses » → « Un ou plusieurs articles, séparés par une virgule » (texte à valider vs `compute.ts` découpage). Effet : annonce l'ajout multiple, cohérent avec le placeholder. Effort S, risque nul. Fichier : `AddCourseToggle.tsx`. Dépend : rien.
- **P3 — Harmoniser le complément d'ajout (B3).** Titre de modale FAB « Ajouter à la liste de courses » → « Ajouter un article » (même intitulé que la carte). Effort S, risque : tests `QuickAddFab*.test.tsx` à ajuster. Fichiers : `QuickAddFab.tsx`, tests. Dépend : rien.
- **P4 — Corriger la description de « Supprimer » dans GLOSSARY.md (B5).** Ajouter : « Courses supprime immédiatement et restaure par réinsertion (patron d'origine de `supprimerAvecAnnulation`) ». Effet : doc fidèle au code. Effort S, risque nul. Fichier : `GLOSSARY.md`. Dépend : rien.
- **P5 — Toast d'envoi plus précis (C2, A2).** Dans `EnvoyerCoursesBouton`/`envoyerMenuAuxCourses`, remonter `reactives` séparément (« 3 ajoutés, 2 remis à prendre »). Effet : l'utilisateur comprend pourquoi un article « pris » est revenu. Effort S (type `ResultatEnvoiCourses` + libellé). Risque : tests `menus` à ajuster. Fichiers : `src/app/actions/menus.ts`, `EnvoyerCoursesBouton.tsx`. Dépend : rien.

À ne pas faire (déjà tranché) : lien Courses ↔ Recettes, quantité/rayon saisis (article = `libelle` seul), suppression sans confirmation, « Fermer » sur la carte d'ajout.

## Pistes inter-modules
- Menus → Courses (C1) : fusionner « Poulet, 600 g » avec un « poulet » existant demanderait une quantité structurée, donc de rouvrir le choix « article = texte libre » (hors décision actuelle). À arbitrer par Vincent côté Nutrition.
- Réglages › nettoyage auto : mentionner le délai depuis la carte « Articles pris » (lien vers Réglages) — module Réglages.
- Recherche globale : un résultat Courses pourrait ouvrir directement la liste avec l'article mis en évidence (module Recherche).
- Barre du bas : sur le banc, Courses n'est pas dans la barre (préférences du faux Supabase) et l'onglet « Plus » est surligné ; le défaut documenté (PRODUCT.md:23) est Aujourd'hui · Courses · Nutrition · Tâches.

## Ce qui n'a pas pu être testé
- Artefacts du faux Supabase / banc : barre du bas sans Courses (préférences mock, pas un bug) ; aucune table `menus_repas` dans `e2e/mock-supabase.mjs`, donc « Envoyer aux Courses » (C1, C2) lu dans le code uniquement, non exécuté ; erreurs console `/_vercel/speed-insights/script.js` 404 et `POST /courses ERR_ABORTED` (actions serveur annulées par le refetch) : bruit du banc, pas des bugs.
- Outil : Playwright du skill ne trouvait pas son Chromium (build 1194 absent, 1243 présent) ; j'ai lancé des copies des scripts avec `executablePath` dans le scratchpad (code du dépôt inchangé). Un de mes sélecteurs de parcours (coche sur « lait ») était faux, rejoué correctement ensuite.
- Non testé : hors ligne réel / file Dexie, scanner n/a, vibration, gestes tactiles fins, rendu réel d'iOS (zoom au focus), base réelle. Les données mock ont été modifiées par mes parcours (articles lait/œufs/pain/savon), sans `--reset`.
- Le jugement sur B1 (coche violette volontaire ?) et sur les libellés reste un jugement d'usage.
