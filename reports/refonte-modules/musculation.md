# Cohérence interne : module Musculation (2026-11-14)

Lecture seule. Périmètre : `src/app/(app)/musculation/**`, `components/SeanceFlottante.tsx`, lecture de `lib/musculation` et du lien avec `_accueil/SeancesCard.tsx`. Axes : A (parcours et hiérarchie), B (vocabulaire et gestes), C (cohésion fonctionnelle). Les défauts d'ergonomie fine déjà listés dans `reports/2026-11-12-audit-design-musculation.md` ne sont pas refaits ; plusieurs ont d'ailleurs été corrigés depuis (Skeleton `h-40` de `DemarrerSeance`, libellé « Voir la séance », texte de « Démarrer » désactivé, `isError` de l'éditeur de routine, « Chargement… » de « Voir plus »).

## Résumé

- Le module est globalement cohérent : suppressions annulables partout (séance, routine, dossier), retours `BackLink` « parent logique », états chargement/erreur/vide présents.
- Trou de parcours le plus net : l'Historique (et donc « + Séance passée ») n'est joignable depuis l'accueil que si une séance existe déjà.
- Trois implémentations du même « bloc exercice + séries » (séance, séance passée, routine) avec des gestes différents (Monter/Descendre, Remplacer, ± série).
- Libellés encore hors charte : « + Séance passée », « + Ajouter… », « + Série / − Série », toast « Routine créée… » ; « Quitter » est trompeur (c'est un abandon).
- 9 propositions (P1-P9), dont 6 en effort S ; une décision produit à trancher (dossiers de routines vs types Push/Pull/Legs).

## Inventaire des écrans

| Route | Rôle | Fichier |
|---|---|---|
| `/musculation` | Accueil : séance libre / reprise, routines par dossier, 3 dernières séances, carte Statistiques | `page.tsx`, `DemarrerSeance`, `RoutinesSection`, `DernieresSeances` |
| `/musculation/seance` | Séance en direct (immersif : barre du bas masquée), brouillon Dexie, minuteur de repos | `seance/SeanceView.tsx` (+ `ExerciceBloc`, `BarreRepos`, `SelecteurExercices`) |
| `/musculation/routines/[id]` | `nouvelle` = création, uuid = modification d'une routine | `routines/[id]/RoutineEditeur.tsx` |
| `/musculation/historique` | Liste paginée des séances + « + Séance passée » | `historique/HistoriqueView.tsx` |
| `/musculation/historique/nouvelle` | Saisie d'une séance passée | `historique/EditionEntrainement.tsx` |
| `/musculation/historique/[id]` | Détail : Refaire, Modifier, Enregistrer comme routine, Mettre à jour la routine, Supprimer | `EntrainementDetailView.tsx` |
| `/musculation/historique/[id]/modifier` | Modification d'une séance enregistrée | `EditionEntrainement.tsx` |
| `/musculation/stats` | Résumé semaine/mois, assiduité, séries par muscle, liste d'exercices | `stats/StatsView.tsx` |
| `/musculation/stats/[exerciceId]` | Fiche exercice : records, graphique de progression | `FicheExercice.tsx`, `GraphiqueProgression.tsx` |
| Hors route : `SeanceFlottante` | Barre « séance en cours » sur toutes les pages sauf la séance | `components/SeanceFlottante.tsx` |
| Hors module : `SeancesCard` (Aujourd'hui) | Pastilles Push/Pull/Legs A/B/C qui lancent une routine | `_accueil/SeancesCard.tsx` |

Il n'existe aucun écran de gestion du catalogue d'exercices (message « arrive bientôt »).

## Constats

### Axe A : parcours et hiérarchie

- **A1. Historique inaccessible tant qu'il est vide. Gravité haute.** `DernieresSeances.tsx:93` renvoie `null` sans séance, et c'est le seul lien vers `/musculation/historique` (`:99`). Or « + Séance passée » (`HistoriqueView.tsx:57`) est précisément le moyen de rattraper l'historique d'un nouvel utilisateur. Preuve : capture `reports/audit/musculation/ecrans/musculation.clair.png` (aucune entrée Historique, alors que « Statistiques » en a une) ; le formulaire n'est joignable que par URL.
- **A2. Deux entrées de même niveau traitées différemment. Moyenne.** `Statistiques` est une carte pleine (`page.tsx:20`), l'Historique un petit bouton fantôme dans l'en-tête d'une section (`DernieresSeances.tsx:99`). Les lignes de routine, elles, portent un « › » (`RoutinesSection.tsx:164`) mais pas la carte Statistiques. Trois motifs de navigation sur un seul écran.
- **A3. « Quitter » détruit, et aucune sortie douce visible. Moyenne.** `SeanceView.tsx:223` : « Quitter » ouvre « Quitter la séance ? » qui annonce « sera supprimée » (`:349`) ; le code l'appelle `abandonner`. L'écran est immersif (`lib/navigation/immersif.ts:7`), sans `BackLink`. Quitter sans perdre la séance repose donc sur le geste retour système (non testé ici). Libellé et effet divergent.
- **A4. Catalogue vide : message dupliqué et section masquée. Basse.** « Le catalogue d'exercices est vide » (`DemarrerSeance.tsx:57`) et « Aucun exercice pour l'instant » (`page.tsx:24-31`) disent la même chose sur le même écran (capture accueil). `RoutinesSection.tsx:298` masque aussi « Ajouter un dossier », qui n'a pourtant pas besoin d'exercices ; mon parcours d'ajout de dossier a échoué pour cette raison (comportement voulu, pas un bug).
- **A5. Impasse sur les états d'erreur de chargement. Basse.** `EditionEntrainement.tsx:285-287`, `EntrainementDetailView.tsx:535-538` et `FicheExercice.tsx:60-63` affichent seulement `ErrorInline`, sans `BackLink`, alors que `RoutineEditeur.tsx:426-440` et `HistoriqueView` en ont un. Même famille d'écrans, deux comportements.
- **A6. Ordre de l'accueil. Info (déjà tranché dans l'audit design).** « Séance libre » avant les routines : cité en « Options structurantes » n°2 du 2026-11-12, non rejoué ici.

### Axe B : vocabulaire et gestes

- **B1. Libellés « + X » hors charte. Moyenne.** GLOSSARY, « Ajouter » : éviter « + X ». Occurrences : « + Séance passée » (`HistoriqueView.tsx:57`), « + Ajouter un exercice » (`SeanceView.tsx:294`, `EditionEntrainement.tsx:241`, `RoutineEditeur.tsx:377`), « + Ajouter une série » (`ExerciceBloc.tsx:389`), « + Série » et « − Série » (`RoutineEditeur.tsx:356,364`).
- **B2. Même geste, deux libellés. Moyenne.** Retirer une série : « Retirer la dernière série » en séance (`ExerciceBloc.tsx:226`) contre « − Série » dans l'éditeur de routine. Ajouter : « + Ajouter une série » contre « + Série ».
- **B3. « Créer » dans un libellé de création. Basse.** `EntrainementDetailView.tsx:344` : toast « Routine créée depuis cette séance » (charte : « Créer » n'apparaît plus). La modale mélange « Enregistrer comme routine » (titre et bouton d'entrée, `:461,475`) et « Ajouter la routine » (validation, `:496`) ; le titre d'un formulaire de création est « Nouvelle X ».
- **B4. Titres de formulaire de création. Basse.** « Nouvelle routine » (`RoutineEditeur.tsx:170`) mais « Séance passée » tout court (`EditionEntrainement.tsx:185`), sans « Nouvelle ».
- **B5. « Renommer » dans la modale de dossier. Basse.** `RoutinesSection.tsx:238` : la charte dit « Enregistrer » pour valider une modification. Mais « Renommer » est déjà utilisé comme geste dédié ailleurs (Collection, Courses : tests `CollectionHeader.test.tsx`, `e2e/courses.spec.ts`) et la modale ne modifie que le nom : plutôt un trou du GLOSSARY qu'une faute du module.
- **B6. Vide : deux tournures. Basse.** « Séance vide : ajoute ton premier exercice pour commencer. » dans un encart (`SeanceView.tsx:257`) contre « Aucun exercice pour l'instant. » en texte brut `nameText` (`EditionEntrainement.tsx:238`).
- **B7. Retrait d'un exercice : trois traitements. Basse (M5 connu).** Séance : confirmation seulement si des séries sont validées (`ExerciceBloc.tsx:233`) ; éditeur de routine : retrait immédiat sans annulation (`RoutineEditeur.tsx:257`) ; séance passée : même bloc que la séance. La charte « Retirer » ne tranche pas la confirmation.
- **B8. Vocabulaire du module absent du GLOSSARY. Basse.** Séance, séance libre, séance passée, routine, dossier, séance en cours, « Refaire » ne sont pas définis (seul « Retirer » les cite). Dans le code et les données le mot est « entraînement » (`getEntrainements`, `EntrainementDetailView`), dans l'interface « séance », avec un « entraînement » résiduel (`DemarrerSeance.tsx:59`, aria de `StatsView.tsx:55`).

### Axe C : cohésion fonctionnelle

- **C1. Trois écrans, un seul « bloc exercice », trois comportements. Haute (structure).** `ExerciceBloc` (séance et séance passée, via `edition`) et un bloc réécrit à la main dans `RoutineEditeur.tsx:225-369` (grille de séries, sélecteur de type, repos ±15 s, ↑ ↓ Retirer). Écarts constatés : l'éditeur de routine n'a ni menu « Options » ni « Remplacer » ; la séance passée n'a pas « Monter/Descendre » (`EditionEntrainement.tsx:219-235` ne passe pas `onDeplacer`, alors que `deplacerExercice` existe) ; seule la séance affiche « Précédent ». Les pastilles de type de série et de séance existent en 4+ copies de la même chaîne de classes (`RoutineEditeur.tsx:162,335`, `SeanceView.tsx:244`, `ExerciceBloc.tsx:360`, `FicheExercice.tsx:108`).
- **C2. Deux axes de rangement des routines. Moyenne, décision produit.** Aujourd'hui (et PRODUCT.md) groupe par type Push/Pull/Legs avec pastilles A/B/C déduites du nom (`lib/seances/compute.ts:48`, `libellePastille`) ; l'accueil Musculation range par « dossier » (`RoutinesSection.tsx:336-356`). Les deux se recoupent sans se lire : un dossier « Prise de masse » ne dit rien à Aujourd'hui, et le type n'apparaît qu'en méta de ligne (`:160`). Aucun report ne documente le choix des dossiers.
- **C3. Récapitulatif et historique sans lien vers la routine source. Basse.** `EntrainementDetailView` propose « Mettre à jour la routine » mais n'ouvre pas la routine ; l'éditeur de routine ne montre pas les dernières séances faites avec elle. Parcours à sens unique.
- **C4. Pas d'écran catalogue. Basse (annoncé).** Les exercices ne se créent ni ne se consultent que via `SelecteurExercices` ; la liste de Statistiques ne contient que les exercices déjà pratiqués. Cohérent avec « arrive bientôt », à noter comme manque fonctionnel du module.
- **C5. Pas d'écran orphelin.** Toutes les routes sont atteignables ; seule `historique/nouvelle` ne l'est pas depuis un accueil vide (A1).

## Propositions

**P1. Entrée « Historique » permanente sur l'accueil.** Ajouter une carte « Historique » à côté de « Statistiques » (même motif, même hauteur, deux colonnes ou deux lignes), visible même sans séance ; garder « Tout l'historique » dans « Dernières séances ». Effet : « Ajouter une séance passée » joignable dès le premier jour (A1, A2). Effort S. Risque faible. Fichiers : `page.tsx`, éventuellement `DernieresSeances.tsx`. Dépend de : rien.

**P2. Aligner les libellés sur la charte.** « + Séance passée » → « Ajouter une séance passée » ; « + Ajouter un exercice/une série » → « Ajouter un exercice/une série » ; « + Série / − Série » → « Ajouter une série » / « Retirer la dernière série » ; toast « Routine créée… » → « Routine ajoutée depuis cette séance » ; modale routine : titre « Nouvelle routine » (ou garder « Enregistrer comme routine » si Vincent préfère, voir risque), bouton « Ajouter » ; « Séance passée » → « Nouvelle séance passée » ; un seul message pour la liste vide (B6). Effet : B1-B4, B6. Effort S. Risque faible ; aucun test unitaire ne cible ces libellés (recherche faite), les `aria-label` restent. À signaler : « Enregistrer comme routine » est un libellé d'action sur un élément existant, pas une création pure ; il faut choisir « Ajouter comme routine » ou le garder. Fichiers : `HistoriqueView`, `SeanceView`, `EditionEntrainement`, `RoutineEditeur`, `ExerciceBloc`, `EntrainementDetailView`. Dépend de : rien.

**P3. « Quitter » honnête et sortie douce visible.** Option recommandée : ajouter un `BackLink` « Musculation » en tête de la séance (la barre `SeanceFlottante` prend le relais, rien n'est perdu) et renommer le bouton destructif « Abandonner ». Conflit à signaler : le GLOSSARY réserve « Quitter sans enregistrer » à la perte de brouillon ; renommer le bouton sans toucher au bouton de confirmation laisserait deux mots, donc soit on met à jour la charte (« Abandonner » comme libellé du geste, confirmation inchangée), soit on garde « Quitter » et seul le `BackLink` est ajouté. Effet : A3. Effort S. Risque moyen : écran critique en salle, immersif par choix ; à valider sur appareil, y compris le comportement du retour système. Fichiers : `seance/SeanceView.tsx`, `GLOSSARY.md`. Dépend de : décision de Vincent sur le mot.

**P4. Un seul bloc exercice, par étapes.** (a) S : passer `onDeplacer` dans la séance passée pour que « Monter/Descendre » existe aussi ; extraire la pastille de choix (`ChipChoix`) pour les 5 copies de classes. (b) L : faire reposer `RoutineEditeur` sur `ExerciceBloc` avec une variante « modèle » (pas de ✓, pas de « Précédent », cibles au lieu de valeurs), ce qui apporte menu Options, « Remplacer » et libellés communs, et supprime ~150 lignes. Effet : C1, B2, B7. Effort S puis L. Risque : (a) faible ; (b) moyen (modèle de données `RoutineSerie` ≠ `Brouillon`, tests `ExerciceBloc.test.tsx` et `Suppressions.test.tsx` à étendre). Fichiers : `EditionEntrainement.tsx`, `RoutineEditeur.tsx`, `seance/ExerciceBloc.tsx`, `SeanceView.tsx`, `lib/ui.ts`. Dépend de : P2 pour les libellés (à faire avant, pour ne pas migrer deux fois).

**P5. Catalogue vide : un message, et « Ajouter un dossier » toujours présent.** Supprimer soit la carte « Aucun exercice pour l'instant » (`page.tsx:24-32`), soit la phrase de `DemarrerSeance.tsx:57` ; ne masquer que « Ajouter une routine » (qui exige des exercices), pas toute la section Routines. Effet : A4. Effort S. Risque faible. Fichiers : `page.tsx`, `DemarrerSeance.tsx`, `RoutinesSection.tsx`. Dépend de : rien.

**P6. Retours sur les erreurs de chargement.** Envelopper les `ErrorInline` d'`EditionEntrainement`, `EntrainementDetailView` et `FicheExercice` avec le `BackLink` du parent, comme `RoutineEditeur`. Effet : A5. Effort S. Risque faible. Fichiers : ces trois composants. Dépend de : rien.

**P7. Retrait d'un exercice : un seul patron.** Après P4, appliquer la même règle aux trois écrans : retrait immédiat avec toast « Exercice retiré · Annuler » (patron `supprimerAvecAnnulation` adapté en restauration d'état), plutôt que confirmation conditionnelle en séance et rien ailleurs. Effet : B7. Effort M. Risque moyen (restaurer le bloc avec ses valeurs ; en séance, le brouillon est écrit à chaque modification). Fichiers : `ExerciceBloc.tsx`, `RoutineEditeur.tsx`, éventuellement `SeanceView.tsx`. Dépend de : P4(b). Recoupe M5 de l'audit design, à valider avec lui.

**P8. Compléter le GLOSSARY.** Ajouter Séance (libre, en cours, passée), Routine, Dossier, Entraînement (mot de données, non affiché), Refaire, et trancher « Renommer » (geste dédié autorisé quand seul le nom change : Collection, Courses, Musculation). Effet : B5, B8. Effort S. Risque nul. Fichiers : `GLOSSARY.md`. Dépend de : P3 pour « Abandonner ».

**P9. Décision produit : dossiers de routines vs types.** Trois options : (1) garder les deux axes et le dire dans PRODUCT.md/GLOSSARY (rien dans le code) ; (2) grouper l'accueil par type Push/Pull/Legs/Autres, comme Aujourd'hui, et retirer les dossiers (migration et suppression de `creerDossier` etc., effort L, risque élevé, données existantes) ; (3) afficher le dossier en méta dans Aujourd'hui (S). Non recommandé sans confirmation de Vincent : ni PRODUCT.md ni les reports ne tranchent. Effet : C2. Fichiers (option 2) : `RoutinesSection.tsx`, `app/actions/musculation.ts`, `lib/musculation/routines.ts`, schéma Supabase.

## Pistes inter-modules

- **Démarrer une routine dupliqué.** `RoutinesSection.tsx:265-280` et `SeancesCard.tsx:83-96` ont le même `demarrer` (getRoutine, « n'existe plus », `demarrerDepuisRoutine`, push, mêmes toasts). Extraire un hook `useDemarrerRoutine` dans `lib/musculation`. Effort S, risque faible.
- **« Commencer » contre « Démarrer ».** Aujourd'hui dit « Commencer {routine} » (`SeancesCard.tsx:60`), Musculation « Démarrer la routine ». À unifier dans la charte (un verbe).
- **Aujourd'hui ne mène pas à Musculation.** La carte « Séances de la semaine » lance une routine ou reprend la séance, mais n'a pas de lien vers le module (accès normal : grille Plus). Un lien sur le titre de la carte serait cohérent avec les autres cartes d'Aujourd'hui (à vérifier côté Aujourd'hui).
- **Constantes Push/Pull/Legs dispersées.** `TypeSeance` vit dans `lib/musculation/constantes`, mais `LIBELLES_TYPE`/`ORDRE_TYPES` dans `lib/seances/compute.ts` (importés par 6 fichiers du module, `actions/sante.ts`, `jours-libres.ts`, Nutrition/Menus). Regrouper les libellés avec le type.
- **« Jour d'entraînement » dans la carte séances.** `EntrainementBouton` appartient à Nutrition (type de jour kcal) mais s'affiche dans `SeancesCard` ; documenté dans PRODUCT.md, donc à conserver, à noter pour la refonte d'Aujourd'hui/Nutrition.
- **File d'envoi.** `IndicateurConnexion` ne compte pas `musculation_a_envoyer` (I4 de l'audit design) : à traiter avec la file hors ligne globale.

## Ce qui n'a pas pu être testé

- **Artefact du faux Supabase (pas un bug).** Les tables musculation du banc sont vides : catalogue d'exercices, routines, séances. Donc non résolus : `/historique/[id]`, `/historique/[id]/modifier`, `/routines/[id]` (uuid), `/stats/[exerciceId]` (8 « non résolue » sur 18 captures). `/musculation/seance` redirige vers l'accueil sans brouillon. Je n'ai pas complété `e2e/mock-supabase.mjs` (lecture seule demandée).
- Donc **jamais rendus** : séance en cours, `ExerciceBloc`, `BarreRepos`, `SeanceFlottante`, liste des routines et dossiers, détail et modification d'une séance, fiche exercice et graphique. Tout constat sur ces écrans vient de la lecture du code (fichier:ligne), pas d'une capture.
- Parcours joués (`reports/audit/musculation/scenarios/`) : `routine-vide` (erreurs de nom et d'exercice, sélecteur vide) et `seance-passee` (enregistrement vide, retour, accès direct à `/seance`), tous conformes. Le parcours « dossier » a échoué car la section Routines est masquée catalogue vide (A4) ; son dossier `parcours/dossier-et-routine/` est un résidu d'échec, à ignorer.
- Bruit de console attendu, hors module : 404 de `/_vercel/speed-insights/script.js` en local et `_rsc` abandonnés lors des navigations.
- Environnement : Playwright attendait la version 1194, le poste a la 1243 ; contourné par des liens symboliques dans le dossier temporaire de session (rien dans le dépôt).
- Captures sombres produites, non examinées en détail. Gestes tactiles (retour système, double tap), clavier mobile, sonnerie, wake lock, Dexie hors ligne : non testables ici.
