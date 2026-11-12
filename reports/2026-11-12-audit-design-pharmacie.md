# Audit design — module Pharmacie (2026-11-12)

Lecture seule. Périmètre : `src/app/(app)/pharmacie/**` et `src/lib/pharmacie/*` (lecture). Cadre : brief du 2026-11-12 (5 axes, 3 passes), `DESIGN.md`, audit du 2026-11-07 (cité, non refait). Les numéros de ligne sont ceux du dépôt à la date de l'audit. Rien n'a été exécuté (ni build, ni lint, ni tests). Les points marqués « à tester » sont des hypothèses issues de la lecture du code.

## Résumé

- Le module est globalement sain : les cibles tactiles de la révision (`min-h-14`, `min-h-12`), les pictogrammes doublant la couleur et les états vides sont soignés. Aucun constat critique.
- Les écarts importants touchent le geste central, qui est de chercher une notion puis de la réviser. Le compteur « à réviser » peut être périmé, une note ne s'annule pas, le lien profond `#notion-…` n'a pas de repli, et la recherche du cours perd sa requête au retour (contrairement au Référentiel et aux Huiles).
- Le reste est de la finition et de la cohérence : anneau de focus absent sur les liens `cardTight`, cibles de 40 px sous le seuil de 44 px, `tabular-nums` manquant, écarts de style entre écrans voisins.

## Critique

Aucun.

## Important

### P-I1. Accueil : le compteur « à réviser » est figé à l'instant du premier rendu
- Fichier : `PharmacieAccueil.tsx:50` (`useState(() => new Date())`), utilisé en `:58`.
- Scénario : la PWA reste ouverte en arrière-plan toute la journée. Le soir, l'écran s'affiche avec `maintenant` du matin. Les cartes devenues échues depuis ne sont pas comptées et l'accueil affiche « Rien à réviser / Tu es à jour » alors qu'il y en a, sans bouton « Commencer ». `AppResumeRefresh` ne corrige pas, car `router.refresh()` conserve l'état React. Le commentaire du code parle d'une « liste » qui bougerait, mais il n'y a qu'un compteur.
- Axe violé : Purpose (consulter en quelques secondes) et Memorable detail (le point d'entrée de la révision ment).
- Correctif proposé : recalculer `maintenant` sur `visibilitychange` (retour au premier plan) et quand `snapshot.cartes` change, au lieu de le figer à vie.
- Correctif sûr : oui.

### P-I2. Révision : la file est figée au montage ; une route conservée par `Activity` pourrait réafficher « Séance terminée » (à tester)
- Fichier : `revision/RevisionView.tsx:48-53` (`file` et `total` dans `useState` initialisé une seule fois).
- Scénario (hypothèse) : on termine une séance, on revient à l'accueil, et le lendemain « Commencer » rouvre `/pharmacie/revision`. Si Next conserve la page masquée (`cacheComponents: true`, voir I-13 de l'audit global), l'état d'hier est réutilisé. On voit « Séance terminée, bien joué » avec l'ancien bilan, sans nouvelles cartes.
- Axe violé : Memorable detail (le lancement de séance doit être irréprochable).
- Correctif proposé : à confirmer d'abord sur appareil. Si le cas se vérifie, réinitialiser `Seance` avec une `key` dérivée de la visite (par exemple recalculée au retour de focus de la page), ou recalculer la file quand `file` est vide et que le snapshot a des cartes échues.
- Correctif sûr : non.

### P-I3. Révision : aucune annulation d'une note
- Fichier : `revision/RevisionView.tsx:96-120` (avance immédiate, optimiste) et `:146-162` (quatre boutons adjacents d'environ 76 px).
- Scénario : on veut « Bien » et on tape « Facile » sur le bouton voisin. La carte disparaît, l'intervalle SRS est écrit, et il n'existe aucun « Annuler » ni retour à la carte précédente.
- Axe violé : Memorable detail (retour visuel, annulation).
- Correctif proposé : un toast « Note enregistrée · Annuler » (composant toast existant) qui restaure la carte, son état local et l'état serveur. Le principe est à relier à I-10 (réécriture de la note).
- Correctif sûr : non (nécessite une action serveur de restauration d'état).

### P-I4. Cours : la requête de recherche est perdue au retour depuis un résultat
- Fichier : `PharmacieAccueil.tsx:19` (`useState("")` local). Le Référentiel (`ReferentielAccueil.tsx:32-41`) et les Huiles (`HuilesAccueil.tsx:32-42`) gardent la requête dans l'URL (`?q=`), et le commentaire de `Repliable.tsx:7-9` confirme que l'écran se démonte.
- Scénario : on cherche « warfarine », on ouvre une notion, puis « Retour ». Le champ est vide et la liste a disparu. Il faut retaper pour consulter le résultat suivant. Les deux autres onglets ne se comportent pas ainsi.
- Axe violé : Memorable detail (recherche plein texte, geste le plus fréquent du cahier de cours) et Audience (mémoire musculaire : trois onglets, trois comportements).
- Correctif proposé : reprendre le motif `?q=` + `replaceState` du Référentiel (la page est un composant serveur : prévoir `Suspense` autour, comme `referentiel/page.tsx:11`).
- Correctif sûr : non (nouveau comportement d'URL).

### P-I5. Lien profond `#notion-…` sans repli ni repère d'arrivée
- Fichiers : `ResultatsRecherche.tsx:28`, `PharmacieAccueil.tsx:130`, cible en `[matiereId]/[chapitreId]/page.tsx:88`. Aucun code ne gère `location.hash` : le chapitre ne dépend que du défilement natif.
- Scénario : depuis un résultat de recherche, si le snapshot n'est pas déjà en cache (cache TanStack évincé, lancement à froid, hors ligne via Dexie), le chapitre rend d'abord le squelette. Le navigateur cherche `#notion-…`, ne le trouve pas et on arrive en haut du chapitre. Même quand le défilement réussit, rien ne signale la notion visée parmi plusieurs.
- Axe violé : Memorable detail (recherche, puis lecture de la bonne notion).
- Correctif proposé : un effet dans `Chapitre` qui défile vers `location.hash` une fois les notions rendues (comme `allerA`, `:56-62`), plus un bref repère de la cible (`:target`, teinte `kcal-soft`, sans animation de mouvement).
- Correctif sûr : oui pour le défilement ; le repère visuel est un ajout à valider.

### P-I6. Liens `cardTight` sans anneau de focus (aucune règle globale)
- Fichiers : `lib/ui.ts:14` (`cardTight` sans `focusRing`) ; `globals.css` ne définit aucun `:focus-visible`. Dans le module : `PharmacieAccueil.tsx:97,129`, `ResultatsRecherche.tsx:27`, `[matiereId]/page.tsx:42`, `huiles-essentielles/HuilesAccueil.tsx:158`, `ReferentielAccueil.tsx:88,111`, `classe/[classeId]/page.tsx:70,95`, `medicament/…/page.tsx:145`, plus `pathologie/…/page.tsx:82,87`, les pilules de `classe/…/page.tsx:125` et de `medicament/…/page.tsx:89`, et les entrées du Sommaire (`[chapitreId]/page.tsx:123-129`).
- Scénario : clavier ou lecteur d'écran avec Tab. Il n'y a aucun indicateur de focus sur toutes les lignes de liste, ce qui échoue à WCAG 2.4.7 (AA). L'impact est réduit pour un usage tactile, mais la règle de `DESIGN.md` (`focus-visible` partout) est violée sur ce segment.
- Axe violé : Constraints (tokens et règles de `DESIGN.md`).
- Correctif proposé : ajouter `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2` à `cardTight` (un seul endroit, et ça corrige aussi les autres modules). Pour les liens locaux et le Sommaire, utiliser le même gabarit.
- Correctif sûr : oui.

### P-I7. Création d'huile : `onClose()` puis `router.push` dans le même geste (à tester)
- Fichier : `huiles-essentielles/HuileEditeur.tsx:114-116`.
- Scénario (hypothèse) : après « Ajouter l'huile », `onClose()` démonte la modale. Le nettoyage de `useBackClose` appelle `history.back()` (`hooks/useBackClose.ts:34-38`), alors que `router.push` vers la nouvelle fiche est déjà lancé. Selon l'ordre de résolution, on peut atterrir sur la liste au lieu de la fiche, ou empiler la fiche sur l'entrée de la modale. Même famille que I-13 de l'audit global, mais sur ce flux précis.
- Axe violé : Memorable detail (ajout rapide sans quitter le flux).
- Correctif proposé : attendre la fin du `history.back()` (popstate) avant le `push`, ou naviguer d'abord et laisser la modale se démonter avec la page. À valider avec un test e2e « créer une huile ».
- Correctif sûr : non.

## Mineur

### P-M1. Cibles tactiles de 33 à 40 px sur des actions fréquentes
- Fichiers : `PharmacieAccueil.tsx:80` (« Commencer » = `primaryButton` + `text-label`, environ 40 px ; c'est le point d'entrée de la révision), `[chapitreId]/page.tsx:71-77` (« Sommaire » `px-3 py-1.5 text-small`, environ 33 px, sans zone étendue), `medicament/…/page.tsx:157` (« Modifier la fiche », sans `min-h-11`, contrairement à `huile/page.tsx:183`), `MoleculeEditeur.tsx:68` et `NotionEditeur.tsx:158` (« Enregistrer », environ 40 px).
- Axe violé : Memorable detail (zone tactile du geste principal) et Constraints (44 px de `DESIGN.md`).
- Correctif proposé : `min-h-11` (et `inline-flex items-center` pour les liens) sans changer le visuel au repos.
- Correctif sûr : oui.

### P-M2. Compteurs de séance sans `tabular-nums`
- Fichier : `revision/RevisionView.tsx:125-128` (`{fait} / {total}` et « restantes »), et les valeurs du bilan en `:82`.
- Scénario : les chiffres changent à la même place à chaque carte et la ligne tremble. L'audit global notait `tabular-nums` « présent partout », mais pas ici.
- Axe violé : Memorable detail (finition du geste répété, jusqu'à 20 fois par séance).
- Correctif proposé : ajouter `tabular-nums` aux deux `<span>` et aux `<p>` du bilan.
- Correctif sûr : oui.

### P-M3. Révision : la hauteur de la zone d'actions varie à chaque carte
- Fichier : `revision/RevisionView.tsx:131-143` (carte `min-h-[220px]`, réponse montée à la demande) et `:146-167`.
- Scénario : une réponse de plusieurs lignes agrandit la carte et pousse les quatre boutons vers le bas. Après la note, la carte rétrécit et « Voir la réponse » remonte de plusieurs dizaines de pixels. Le pouce doit rechercher la cible à chaque carte, et un second tap involontaire peut déclencher « Voir la réponse » sur la carte suivante.
- Axe violé : Memorable detail (stabilité de la cible du geste répété).
- Correctif proposé : voir l'option O-2 (zone d'actions ancrée). Réduction minimale : réserver la hauteur de la zone de réponse.
- Correctif sûr : non (modification de mise en page).

### P-M4. Révision : focus perdu et réponse non annoncée
- Fichier : `revision/RevisionView.tsx:136-166` (le bouton « Voir la réponse » est démonté, les boutons de note aussi ; seul le compteur « restantes » est en `aria-live`).
- Scénario : clavier ou lecteur d'écran. Après « Voir la réponse », le focus retombe sur `<body>` et la réponse n'est pas annoncée. Après une note, il en va de même.
- Axe violé : Constraints (accessibilité, WCAG 2.4.3 et 4.1.3).
- Correctif proposé : placer le focus sur le premier bouton de note à la révélation et sur « Voir la réponse » à la carte suivante ; `aria-live="polite"` sur le conteneur de la réponse.
- Correctif sûr : non (gestion du focus).

### P-M5. Fin de séance : aucun moyen de continuer alors qu'il reste des cartes
- Fichier : `revision/RevisionView.tsx:21` (`TAILLE_SEANCE = 20`) et `:87-89` (seul « Retour à la Pharmacie »).
- Scénario : avec 50 cartes échues, on finit les 20 premières, l'écran de fin ne dit pas qu'il en reste 30 et ne propose que le retour. Il faut revenir à l'accueil, puis retaper « Commencer ». Le texte « bien joué » est correct côté ton.
- Axe violé : Memorable detail (enchaînement du geste principal).
- Correctif proposé : afficher « N cartes restent » et un bouton « Continuer » qui relance une séance (même mécanisme que P-I2).
- Correctif sûr : non.

### P-M6. Le même fil d'Ariane de notion est rendu de deux façons
- Fichiers : `PharmacieAccueil.tsx:133` (classe `eyebrow` : 13 px, normal) et `ResultatsRecherche.tsx:31` (`text-micro uppercase tracking-wide`).
- Scénario : « Matière › Chapitre » apparaît en deux styles selon qu'on est sur l'accueil ou sur une recherche. Les mêmes lignes sont rendues avec deux hiérarchies typographiques, et la version en capitales est difficile à lire sur des noms accentués.
- Axe violé : Constraints (hiérarchie typographique de `DESIGN.md`).
- Correctif proposé : utiliser `eyebrow` dans les deux cas.
- Correctif sûr : oui.

### P-M7. Compteurs de section hétérogènes dans le Référentiel
- Fichiers : `ReferentielAccueil.tsx:105` et `:124` (nombre nu), `:161` (`(120)` entre parenthèses), `classe/[classeId]/page.tsx:88` (`Médicaments (n)`).
- Axe violé : Constraints (cohérence des composants).
- Correctif proposé : un seul format, sans parenthèses, avec `tabular-nums` (déjà présent).
- Correctif sûr : oui.

### P-M8. Chevron des repliables en `ease-out` générique
- Fichier : `referentiel/Repliable.tsx:27` (`transition-transform duration-200 ease-out`). `DESIGN.md` impose `var(--ease-out)` et des transitions explicites ; `cardTight` utilise bien `ease-[var(--ease-out)]`.
- Axe violé : Constraints (tokens de mouvement).
- Correctif proposé : `ease-[var(--ease-out)]`.
- Correctif sûr : oui.

### P-M9. Deux styles « actif » pour des pilules équivalentes, et un défilement horizontal sans indice
- Fichiers : `HuilesAccueil.tsx:89-91` (actif = `bg-kcal` plein, comme `SegmentedControl`) contre `pathologie/…/page.tsx:164-166` (actif = `kcal-soft` + texte `kcal`). Le sélecteur de profil (`:155`) défile horizontalement sans fondu ni indice de débordement : un profil hors écran passe inaperçu.
- Scénario : l'état actif ne se lit pas de la même manière d'un écran à l'autre, et un protocole de profil caché n'est pas visible.
- Axe violé : Constraints (un seul langage de contrôle sélectionné ; `-mx-4` suppose le padding de page).
- Correctif proposé : aligner sur `Puce`/`SegmentedControl` et ajouter un fondu de bord ou un retour à la ligne.
- Correctif sûr : non (décision visuelle).

### P-M10. Huiles : le bouton d'ajout passe avant la recherche et les filtres peuvent occuper quatre lignes
- Fichier : `HuilesAccueil.tsx:50-56` (carte « Ajouter », environ 80 px), puis recherche (`:62-70`), puis `FiltresRapides` (`:110-126`) : 2 + 8 pilules de 44 px en `flex-wrap`.
- Scénario : sur 360 px, le premier résultat est repoussé sous environ 300 px de contrôles. L'action fréquente (consulter une fiche) est derrière l'action rare (ajouter). Dans les deux autres onglets, la recherche est en tête.
- Axe violé : Purpose et Audience (consultation rapide, usage fréquent).
- Correctif proposé : recherche en premier, filtres sur une ligne défilante, ajout compact en bas ou en en-tête.
- Correctif sûr : non.

### P-M11. États de chargement qui ne reproduisent pas l'écran
- Fichiers : `loading.tsx:7-8` (titre + squelette, sans `OngletsPharmacie`, alors que la page en contient), `EtatSnapshot.tsx:11-18` (champ de recherche + carte héro affichés même sous `[matiereId]`, `revision`, fiches, où il n'y en a pas), `referentiel/page.tsx:11` et `huiles-essentielles/page.tsx:11` (`<Suspense>` sans `fallback` : zone vide au chargement à froid).
- Scénario : à froid, la barre d'onglets apparaît d'un coup et décale le contenu, et une fiche affiche brièvement une carte héro puis un tout autre gabarit. Ça contredit le ton calme.
- Axe violé : Tone (calme, discret) et Constraints.
- Correctif proposé : inclure `OngletsPharmacie` (statique) dans `loading.tsx`, ajouter un `fallback={<PharmacieSkeleton />}`, et prévoir un squelette de détail simple pour les sous-routes.
- Correctif sûr : oui.

### P-M12. Pastille « Comestible » : 11 px à environ 4,4:1
- Fichier : `huiles-essentielles/BadgesHuile.tsx:7` (`color-mix(... 14%)` au lieu du token `kcal-soft` à 12 %). Calcul approché (oklch vers sRGB, texte `--accent-kcal` sur la teinte à 14 % sur `surface`) : environ 4,41:1, sous 4,5:1 (WCAG 1.4.3 AA pour 11 px). À confirmer avec l'outil de contraste. La pastille d'alerte (environ 4,8:1) passe.
- Axe violé : Constraints (contrastes et tokens `kcal-soft`).
- Correctif proposé : utiliser `bg-kcal-soft`.
- Correctif sûr : oui.

### P-M13. `aria-label` sur un `<span>` sans rôle
- Fichier : `pathologie/[pathologieId]/page.tsx:42-45` (`<span aria-label="Étape n">n</span>`). Le nom d'un élément générique n'est pas fiablement exposé.
- Axe violé : Constraints (noms accessibles).
- Correctif proposé : `<span aria-hidden>` pour le chiffre et `<span className="sr-only">Étape n</span>`.
- Correctif sûr : oui.

### P-M14. Une fiche d'huile sans précaution ne dit rien (et le filtre « Sans alerte grossesse » ne distingue pas « non renseigné »)
- Fichiers : `huile/…/page.tsx:121` (bloc « Précautions » omis si rien), `HuilesAccueil.tsx:114` (filtre) et `lib/pharmacie/huiles.ts:52` (`!precautions.includes("grossesse")`).
- Scénario : au comptoir, une huile jamais documentée est présentée comme « sans alerte grossesse », et l'absence de bloc se lit comme « sûre ».
- Axe violé : Purpose (information fiable en quelques secondes ; contexte santé).
- Correctif proposé : afficher « Aucune précaution renseignée » et nommer le filtre « Sans alerte renseignée ». Un champ « vérifié » relèverait d'un choix de schéma, donc d'une option.
- Correctif sûr : non (libellés sécurité, à valider).

### P-M15. Huiles : les filtres ne sont pas conservés au retour, alors que la requête l'est
- Fichier : `HuilesAccueil.tsx:32-33` (`q` dans l'URL, `filtres` dans un `useState`).
- Scénario : filtre « Comestibles » + « sommeil », ouverture d'une fiche, retour : la liste revient avec la requête mais sans les filtres. Ce n'est plus la liste quittée, contrairement à ce que promet le commentaire `:29-30`.
- Axe violé : Audience (mémoire musculaire, cohérence du retour).
- Correctif proposé : mettre les filtres dans l'URL (`?comestible=1&grossesse=1&ind=…`) avec le même `replaceState`.
- Correctif sûr : non.

### P-M16. Suppression d'une huile : confirmation inline maison au lieu de `ConfirmDialog`
- Fichier : `huile/[huileId]/page.tsx:182-201`. `NotionEditeur.tsx:164-173` utilise `ConfirmDialog` pour la même opération, avec titre, détail du nombre de cartes supprimées, focus piégé et retour système. Ici, le bouton « Confirmer la suppression » apparaît à côté de « Modifier la fiche », la mise en garde (`:201`) est rendue plus bas, hors du groupe, et « Annuler » n'est pas relié au bouton retour.
- Axe violé : Constraints (utiliser `ConfirmDialog` plutôt qu'un motif ad hoc).
- Correctif proposé : `ConfirmDialog` avec le message « Les cartes de révision seront supprimées avec elle ».
- Correctif sûr : non (change la présentation d'une action destructive).

## Options structurantes (non appliquées)

- **O-1. Révision ciblée.** Aujourd'hui seule la file globale « échues » est révisable (`PharmacieAccueil.tsx:79-83`). Proposer « Réviser cette matière / ce chapitre » (depuis `[matiereId]` et `[chapitreId]`) et un mode « en avance ». Purpose : préparer un examen sans attendre l'échéance.
- **O-2. Zone d'actions de révision ancrée en bas (pouce).** Bouton « Voir la réponse » puis quatre notes dans un conteneur de hauteur fixe collé au bas de l'écran (au-dessus de la barre du bas ou en remplacement, comme l'écriture du Journal), la carte défilant au-dessus. Supprime P-M3 et rapproche le geste fréquent de la main. Arbitrage avec la règle sur la barre du bas.
- **O-3. Recherche unifiée.** Trois champs de recherche pour trois onglets (Cours, Référentiel, Huiles) avec des comportements différents (P-I4, P-M15). Une seule recherche transversale (ou un champ commun dans l'en-tête du module) servirait mieux « un client est au comptoir ». À confirmer : si `GlobalSearchBar` couvre déjà la Pharmacie.
- **O-4. Extrait contextuel et surlignage dans les résultats de cours.** `ResultatsRecherche.tsx:35` affiche le début de la notion, pas l'endroit où le mot correspond. Pour une correspondance approximative (une faute de frappe, `selecteurs.ts:102`), on ne voit pas pourquoi la notion est proposée. Le plafond de 40 résultats (`selecteurs.ts:110`) est silencieux.
- **O-5. Mémoriser les sections ouvertes du Référentiel.** `Repliable.tsx:10` repart vide à chaque lancement de la PWA : trois sections repliées, puis une lettre A–Z à ouvrir avant d'atteindre un médicament. Mémoriser l'état dans `localStorage` (par spectateur), ou ouvrir « Médicaments A–Z » par défaut.
- **O-6. Édition hors ligne.** `modifierNotion`, `modifierHuile` et `modifierMolecule` échouent hors ligne avec un message d'erreur dans la modale. Seule `noterCarte` est en file (`RevisionView.tsx:111-119`). Pour un module « parfois hors ligne », une file d'édition (avec idempotence) est une décision produit et de schéma.
- **O-7. Sommaire persistant dans les longs chapitres.** Le bouton « Sommaire » (`[chapitreId]/page.tsx:71`) défile avec le titre. Un accès flottant ou un en-tête collant éviterait de remonter au début du chapitre.

## Déjà couvert par l'audit du 2026-11-07

- **I-10 (Pharmacie/Révision)** : note refusée par le serveur qui fait avancer la carte sans rien écrire (`RevisionView.tsx:96-120`). Cité tel quel : non refait. P-I3 (annulation) en est un complément, pas un doublon.
- **I-13 (`useBackClose` et `Activity`)** : base de l'hypothèse P-I2 et de P-I7. Ce rapport ajoute deux flux précis à tester, pas une nouvelle analyse du hook.
- **I3 (fermeture d'une feuille par clic sur le fond)** : s'applique à `NotionEditeur`, `HuileEditeur` et `MoleculeEditeur` (perte de saisie d'une notion modifiée). Non refait.
- **I1 (champs sans nom accessible)** : la liste « à vérifier » citait `HuilesAccueil.tsx:62` et `ReferentielAccueil.tsx:46`. Les deux champs portent désormais un `aria-label` (`HuilesAccueil.tsx:67`, `ReferentielAccueil.tsx:51`, `PharmacieAccueil.tsx:29`) : constat caduc pour ce module. Les champs de `HuileEditeur` sont bien entourés de `<Champ libelle>` (faux positif confirmé).
- **M5 (page client entière)** et **M6 / M8 (cache, `staleTime`)** : architecture offline-first du snapshot, pas de constat design.
- **Fit-and-finish générique** (aucun `transition-all`, ombres uniques, `text-wrap` global) : confirmé pour ce module. Les écarts de P-M2 et P-M8 sont des cas locaux.
- **M4 (placeholders en `--ink-3`)** : concerne les champs de recherche du module. Non refait.
