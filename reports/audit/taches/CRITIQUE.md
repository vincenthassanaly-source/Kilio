⚠️ DEGRADED: single-context (aucun outil de sous-agent exposé à cet agent : les évaluations A puis B ont tourné l'une après l'autre dans le même contexte, A d'abord)

# Critique /impeccable : module Tâches (mobile, 2026-11-25)

Cible : `src/app/(app)/taches/` (routes `/taches`, `/taches/listes`). Mode **Operate**.
Sources : `ecrans/ecrans.json` (2 routes, 4 captures clair et sombre, toutes en HTTP 200),
pellicule `parcours/` (7 parcours, 96 étapes), sondes `sondes/`, problèmes `PROBLEMES.md`.
Le contexte produit vient de `PRODUCT.md` et `DESIGN.md` (vert Kcal comme seul accent, deux
niveaux d'ombre, Sora 600+). Aucun brief de surface n'existe pour Tâches.

## Note de santé (Nielsen)

| # | Heuristique | Score | Point clé |
|---|---|---|---|
| 1 | Visibilité de l'état du système | 2 | Toasts « Tâche ajoutée », « faite / Annuler », « Enregistrement… » : bien. Mais un squelette muet pendant plus de 30 s si Supabase traîne (P3), et une carte d'édition vide le temps du chargement (P4). |
| 2 | Correspondance avec le monde réel | 4 | Libellés français naturels (« À faire », « Ce week-end », « Donne un titre à la tâche »). |
| 3 | Contrôle et liberté | 3 | Annuler partout (cochage, suppression de tâche, de liste, de tag), retour arrière qui ferme feuille et édition. En revanche, l'appui long annule lui-même sa sélection (P2). |
| 4 | Cohérence et standards | 3 | Grammaire unique de chips, de segmenté et de cartes. Écarts : « Monter/Descendre » anonymes, `ghostButton` à 35 px sur Listes contre 44 px ailleurs. |
| 5 | Prévention des erreurs | 3 | Titre vide refusé, double tap sans doublon, liste en double refusée. Tag en double : message Postgres (P6). |
| 6 | Reconnaître plutôt que se souvenir | 3 | Liste et filtres visibles dans une barre unique, badge de filtres actifs. Mais vue et filtres oubliés après « Gérer les listes » (P9). |
| 7 | Souplesse et efficacité | 2 | Raccourcis d'échéance et Entrée pour valider : bien. La sélection multiple (le seul geste de masse) ne marche pas au tactile (P2). Recherche bornée à l'onglet (D2). |
| 8 | Esthétique et minimalisme | 3 | Écran calme, une seule action forte (le « + »). Chevrons désactivés inutiles (D4), grande marge sous l'édition (D3). |
| 9 | Récupération après erreur | 3 | `ErrorInline` avec « Réessayer », message d'actualisation ratée qui garde la liste. Atteint trop tard en cas de panne (P3). |
| 10 | Aide et documentation | 3 | Les sous-titres « Une liste pour regrouper des tâches » et « Touche des tâches pour les choisir » guident sans tutoriel. |
| **Total** | | **29/40** | **Bon, des trous ciblés** |

Le 2026-11-10, la note était de 28/40. Les corrections P1 et P2 de cette passe ont tenu
(chips, segmenté, zones de tap sur `/taches`, état vide avec bouton). Ce qui reste bloque
surtout l'usage en lot (sélection) et la tenue en cas de panne.

## Verdict de spécificité

**Évaluation LLM (A)** : l'écran est soigné, mais il pourrait appartenir à n'importe quel
gestionnaire de tâches. Le segmenté, la barre « recherche + liste + filtres », la carte avec
sa pastille ronde et le « + » flottant reprennent tels quels le vocabulaire TickTick et
Todoist que le module a pris pour modèle (`reports/2026-08-30-taches-ticktick.md`). Rien ne
rattache Tâches au reste de Kilio, alors que le reste de l'app a un trait signature (l'anneau
de progression, `DESIGN.md › Progress (signature)`). L'occasion manquée la plus nette : « À
faire » est un écran de journée, il pourrait s'ouvrir sur l'avancement du jour dans
l'anneau Kcal (D5).

**Scan déterministe (B)** : `impeccable detect --json "src/app/(app)/taches"` renvoie
`[]`, **0 trouvaille**. Le détecteur rejoint la revue sur l'absence d'anti-motifs
mécaniques (pas de dégradé gratuit, pas de couleur hors système) : les problèmes relevés
sont comportementaux et de composition, hors de sa portée.

**Overlays visuels** : non tentés. Aucun outil navigateur natif n'est exposé, et l'app ne
tournait que dans une instance jetable en espace réseau privé (voir `PROBLEMES.md`). Aucun
overlay n'est donc visible. Les mesures navigateur (zones de tap, événements de pointeur,
débordement) viennent de scripts Playwright.

## Impression générale

L'écran est solide au quotidien : une main, un pouce, tout passe par la carte et le « + ».
Le plus gros gain possible n'est pas visuel. Il faut **réparer l'appui long** (P2), seule
entrée vers les actions groupées, puis donner à « À faire » une fin de journée lisible (D1)
qui porte la signature Kilio (D5).

## Critique par écran

### `/taches` au repos (`ecrans/taches.clair.png`, `ecrans/taches.sombre.png`)
- Bien : hiérarchie nette (titre Sora, segmenté plein en vert Kcal, barre de contrôle unique,
  cartes). En sombre, le contraste reste solide et l'actif garde le même vert en version claire.
- Faible : sous une seule carte, environ 60 % de l'écran est vide. « Gérer les listes »
  flotte au milieu, sans ancrage. L'écran ne dit pas combien il reste à faire.
- Charge cognitive : 4 vues, 3 contrôles dans la barre et le « + », donc 8 cibles au premier
  regard, à la limite. Les filtres sont bien rangés derrière une feuille.

### Feuille « Nouvelle tâche » (`parcours/01-…/03-fill.png`)
- Bien : titre seul obligatoire, liste en chips, 4 raccourcis d'échéance, « Plus d'options »
  replié. « Ajouter » pleine largeur, à portée de pouce.
- Faible : le champ date natif affiche `11/25/2026` (format US du moteur headless ; à vérifier
  sur iOS en fr-FR). Les 4 raccourcis ont le même poids que le champ date et passent avant
  lui dans l'ordre de lecture.

### Carte en édition (`parcours/01-…/09-click.png`, `10-fill.png`)
- Faible : blanc pendant le chargement du formulaire (P4), puis une longue carte qui empile
  le formulaire, les sous-tâches et « Annuler / Supprimer ». Il y a deux actions de sortie
  (« Enregistrer » en haut, « Annuler » en bas) séparées par la zone des sous-tâches.
- Proposition : une barre basse collante « Annuler · Enregistrer », et « Supprimer » en
  lien danger dans le formulaire.

### Mode sélection (`sondes/S1-appui-long.png`)
- La barre est claire (« Touche des tâches pour les choisir · Tout sélectionner · ✕ »), mais
  inutilisable tant que P2 n'est pas corrigé. Au-dessus de la barre du bas, elle forme deux
  bandeaux flottants empilés : vérifier qu'elle ne masque pas la dernière carte (`pb-52` présent).

### États vides et filtres (`parcours/05-…`)
- Bien : messages qui disent pourquoi c'est vide (« … dans À faire. ») et un
  « Réinitialiser les filtres » à portée. Le badge « 1 » sur l'icône de filtres est lisible.
- Faible : « À faire » entièrement coché n'a pas de message de fin (D1), et la recherche ne
  propose pas d'élargir à « Tout » (D2).

### `/taches/listes` (`ecrans/taches_listes.clair.png`, `.sombre.png`)
- Bien : les tuiles « Ajouter une liste » et « Ajouter un tag » avec leur sous-titre
  expliquent la fonction. Le compte « 1 tâche » est utile avant une suppression.
- Faible : chevrons désactivés à environ 1,5:1 (D4), « Modifier » à 35 px (P8), retour
  « ‹ Tâches » à 21 px sous un H1 large, « Aucun tag pour l'instant » en texte nu alors que
  la tuile au-dessus invite déjà à en ajouter (redondance).

## Cohérence entre écrans

- **Navigation** : `/taches/listes` n'est atteignable que par un lien texte en bas de liste,
  et on en revient par un petit lien « ‹ Tâches » sous le titre. Les autres sous-écrans de
  Kilio utilisent `BackLink`, donc c'est cohérent, mais la perte de la vue au retour (P9)
  casse le fil.
- **Titres** : même `screenTitle` sur les deux écrans, sans rien d'autre au-dessus. Bon.
- **Espacements** : `gap-4` sur `/taches`, `gap-5` sur `/taches/listes`, et `mb-28` en édition :
  trois rythmes différents.
- **États vides** : « Aucun tag pour l'instant. » (texte nu) contre « Rien à faire pour
  l'instant. » avec bouton : deux grammaires différentes.
- **Clair / sombre** : parité correcte sur les 4 captures. Le vert actif garde son rôle, les
  surfaces de carte se distinguent du fond dans les deux thèmes.
- **Hauteur de cible** : 44 px tenus sur `/taches`, pas sur `/taches/listes` (P8).

## Problèmes prioritaires

| Priorité | Problème | Réf. |
|---|---|---|
| P0 | L'appui long s'annule au relâchement, donc pas de sélection multiple au tactile | PROBLEMES P2 |
| P1 | Squelette muet en cas de panne ou de lenteur Supabase | P3 |
| P2 | Carte d'édition vide le temps du chargement, puis empilement de deux zones d'action | P4, D3 |
| P2 | « À faire » terminé sans conclusion ni signature Kilio | D1, D5 |
| P3 | Listes & tags : cibles de 35 px, chevrons morts, labels anonymes | P7, P8, D4 |

## Signaux par persona

- **Utilisateur pressé, une main, dans le métro** : crée une tâche en 3 taps (bien). Veut
  reporter 4 tâches à demain : l'appui long « ne prend pas » (P2), il abandonne et reporte une
  par une.
- **Utilisateur de lecteur d'écran** : la carte est bien nommée (« Tâche e2e du jour
  (modifier) », « Marquer … comme fait »). Sur Listes, il entend « Monter, Descendre » sans
  savoir quelle liste (P7).
- **L'unique utilisatrice de Kilio** (PRODUCT.md, app mono-utilisateur) : fin de journée,
  tout est coché, et l'écran n'affiche qu'un repli gris « Tâches terminées (5) ». C'est le
  moment le plus gratifiant du module, et il ne se passe rien (D1, D5).

## Questions ouvertes

- Faut-il que « À faire » affiche l'avancement du jour (anneau Kcal) plutôt qu'un compteur
  textuel ?
- L'édition en ligne dans la carte est-elle le bon choix face à la feuille plein écran déjà
  utilisée pour la création ? Une seule grammaire réglerait P4 et D3 d'un coup.

Questions skipped: sous-agent d'audit sans canal de question vers l'utilisateur ; les
arbitrages ci-dessus sont transmis à l'agent appelant. Snapshot `.impeccable/critique/` non
écrit : seule l'écriture dans `reports/audit/taches/` est autorisée pour cet audit.
