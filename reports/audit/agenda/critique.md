⚠️ DEGRADED: single-context (aucun outil de sous-agent exposé dans cette session ; Assessment A puis Assessment B exécutés à la suite dans le même contexte, A terminée avant lecture du détecteur). Pas d'outil de question structurée (agent délégué) : questions remplacées par une ligne « Questions skipped ».

# Critique /impeccable : module Agenda (mobile, 390×844)

Cible : `src/app/(app)/agenda/page.tsx` (une route, quatre vues client : Jour, Semaine, Mois, Liste) + `src/app/(app)/_accueil/EvenementForm.tsx`.
Matériau : `ecrans/agenda-{jour,semaine,mois,liste}.{clair,sombre}.png`, pellicule `parcours/*/`, sondes `sondes/`, problèmes `PROBLEMES.md`.
Mode : **Operate** (outil quotidien, usage répété d'une seule personne, à une main).

## Design Health Score

| # | Heuristique | Score | Constat clé |
|---|-------------|-------|-------------|
| 1 | Visibilité de l'état du système | 3 | Toasts « Événement ajouté », « Tâche ajoutée », « … supprimé · Annuler » clairs ; mais en Semaine la bande « sans heure / journée entière » est hors champ à l'ouverture : l'écran affirme un vide qui n'existe pas. |
| 2 | Correspondance avec le monde réel | 3 | Français naturel (« Journée libre : rien de prévu », « Aujourd'hui · Mercredi 25 novembre 2026 ») ; heures de gouttière « 07h » à zéro de tête, alors que les repères de créneau écrivent « 8h30 ». |
| 3 | Contrôle et liberté | 3 | Retour ferme la feuille, Échap ferme menu et feuille, suppression annulable ; mais après un tap sur un jour du Mois, Retour quitte l'Agenda au lieu de revenir au Mois. |
| 4 | Cohérence et standards | 2 | Même concept (éléments sans heure) traité différemment : bande fixe au-dessus de la grille en Jour, bande qui défile avec la grille en Semaine ; deux défilements initiaux qui masquent la matinée sans le signaler. |
| 5 | Prévention des erreurs | 3 | Titre requis, double clic sans doublon, appui long (et non tap) pour créer depuis la grille ; message « Le titre est requis. » qui reste affiché une fois le titre saisi. |
| 6 | Reconnaissance plutôt que rappel | 2 | La création depuis la grille repose sur un geste caché, expliqué par une phrase sous la grille que le FAB recouvre en partie ; raccourcis seulement dans un `title`. |
| 7 | Flexibilité et efficacité | 3 | Swipe de période, pincement-zoom, appui long, raccourcis clavier, vue mémorisée : très riche pour un seul utilisateur ; les gestes restent invisibles. |
| 8 | Esthétique et minimalisme | 3 | Calme, fidèle au « Tableau de Bord Doux » ; la grille occupe 55 vh d'heures vides à 17 h alors que l'unique événement du jour est à 9 h. |
| 9 | Récupération après erreur | 3 | Erreurs en français, saisie conservée, bouton « Réessayer » sur l'échec de chargement, message hors-ligne explicite et juste. |
| 10 | Aide et documentation | 2 | Une seule ligne d'aide (« Appui long sur la grille… ») ; rien pour le swipe, le pincement, les raccourcis. |
| **Total** | | **27/40** | **Acceptable** (67,5 %) |

## Design Specificity Verdict

**Évaluation LLM** : l'agenda est clairement de la famille Kilio : ivoire chaud, encre teintée, contrôle segmenté à pastille glissante, barre flottante, FAB vert, bleu « agenda » réservé aux événements (couleur identitaire de module, conforme à DESIGN.md). La date du jour en Sora, plus grande que le titre de période, montre une vraie décision éditoriale. Ce qui reste interchangeable, c'est la grille horaire elle-même : 55 vh de lignes d'heures vides, que n'importe quel calendrier générique produirait. L'occasion manquée est de mettre la *journée de Vincent* (ce qui reste, ce qui est passé, le prochain rendez-vous) devant la *mécanique* du calendrier.

**Scan déterministe** : `impeccable detect --json` sur `src/app/(app)/agenda/`, `EvenementForm.tsx` et `EvenementBlock.tsx` : **0 constat** (sortie 0).

**Overlays visuels** : injection réussie dans les quatre vues (onglet `[Human]` d'un Chromium sans interface, dans l'espace réseau isolé : aucun overlay n'est visible pour l'utilisateur, captures dans `sondes/impeccable-overlay-*.png`). Console : « 1 anti-pattern found » par vue, toujours le même, **OVERUSED FONT : Inter (95 % du texte)**. C'est un **faux positif** au regard du brief : DESIGN.md impose Inter pour le corps et Sora pour les titres (« The brief wins »).

## Overall Impression

Un agenda soigné, rapide et fiable sur le chemin nominal : créer, modifier, supprimer avec annulation, cocher, recharger, tout passe. Le défaut principal est de **cadrage** : les deux vues à grille s'ouvrent sur « maintenant » et escamotent ce qui ne tient pas dans ce cadrage (journée entière, tâches sans heure en Semaine ; matinée en Jour). Le plus gros levier : garantir que tout ce qui est prévu un jour donné est visible, ou signalé, dès l'ouverture.

## What's Working

1. **Le FAB unique à deux choix** (Événement / Tâche) avec focus sur le premier choix, Échap qui rend le focus au FAB et raccourcis `n`/`e` : un seul point d'entrée, sans ambiguïté, rapide à une main.
2. **La suppression différée avec « Annuler »** : l'événement disparaît tout de suite, revient intact à l'annulation, et la suppression en base n'arrive qu'à l'expiration du toast (vérifié : DELETE seulement après 8 s).
3. **La vue Liste** : chronologique, couleurs sémantiques nettes (bloc bleu = événement, carte ivoire = tâche), fenêtre explicitement bornée (« Événements affichés du 26 oct. au 23 févr. 2027 »). Les titres très longs y passent à la ligne proprement.

## Priority Issues

- **[P1] En Semaine, journée entière et tâches sans heure sont invisibles à l'ouverture.**
  *Why* : la bande qui les porte est dans le conteneur défilant mais n'est pas collante ; le défilement initial vers l'heure courante (scrollTop ≈ 590 px) la sort du cadre. La semaine paraît vide alors qu'une réunion « journée entière » et une tâche du jour existent.
  *Fix* : rendre la bande `sticky` sous l'en-tête des jours (`top-11`), avec son pendant dans la gouttière, comme la bande fixe de la vue Jour.
  *Suggested command* : /impeccable layout

- **[P2] La grille s'ouvre sur « maintenant » et cache sans le dire ce qui est plus tôt.**
  *Why* : à 17 h 40, la vue Jour montre 16 h à 23 h vides ; le rendez-vous de 9 h n'est signalé nulle part. Même chose en Semaine (15 h à 23 h).
  *Fix* : un repère « ↑ 1 événement plus tôt (9:00) » en haut de la grille, cliquable pour y défiler ; ou démarrer sur le premier bloc restant du jour.
  *Suggested command* : /impeccable layout

- **[P2] La création depuis la grille dépend d'un geste caché, et son aide est recouverte par le FAB.**
  *Why* : « Appui long sur la grille pour ajouter un événement à cette heure. » est la seule aide, posée en bas de pli, où le FAB la coupe (« …un événeme[+] »).
  *Fix* : réserver l'espace du FAB en bas du contenu (`pb` égal à la hauteur du FAB plus la nav) ; à terme, ouvrir le créneau par un tap long avec retour haptique *et* un repère visuel au premier usage.
  *Suggested command* : /impeccable clarify

- **[P2] Le message « Le titre est requis. » persiste après correction.**
  *Why* : l'erreur n'est retirée qu'à la soumission suivante : le champ, rempli, reste rouge et contredit ce qu'on voit.
  *Fix* : `setTitreManquant(false)` dès que le titre devient non vide.
  *Suggested command* : /impeccable harden

- **[P2] Tap sur un jour du Mois, puis Retour : on quitte l'Agenda.**
  *Why* : le passage Mois → Jour ressemble à un « drill-down », mais Retour mène au parent logique (Aujourd'hui), pas au Mois.
  *Fix* : traiter ce passage comme une couche `useBackClose` (Retour revient au Mois), sans le mémoriser comme vue habituelle (comportement actuel conservé).
  *Suggested command* : /impeccable harden

## Persona Red Flags

**Vincent (propriétaire, entre deux rendez-vous, téléphone à une main)** : ouvre Semaine pour voir « ce qui l'attend » : colonnes vides de 15 h à 23 h, pas de trace de la réunion journée entière de mercredi. Il doit penser à remonter la grille. En Jour, il ne voit pas son rendez-vous du matin sans défiler vers le haut.

**Alex (utilisateur avancé)** : bien servi au clavier (←/→, t, j/s/m/l, n, e), mais ces raccourcis ne sont découvrables que par le `title` du FAB, invisible sur mobile. Le swipe de période et le pincement ne sont annoncés nulle part.

**Casey (mobile, interrompue)** : feuille d'ajout bien dimensionnée, Retour ferme sans perdre l'Agenda. Mais tap sur un jour du Mois, puis Retour : elle se retrouve sur l'accueil et perd son contexte de mois.

## Minor Observations

- Gouttière « 06h / 07h » (zéro de tête) contre repères de créneau « 8h30 » : deux écritures de l'heure à l'écran.
- Pas d'insertion optimiste à la création d'un événement : le toast arrive avant le bloc (moins d'une seconde).
- La légende du Mois (« • tâche ▬ événement ») est utile ; la cellule du jour combine anneau, point et barre : chargée sur un 46 px.
- Sombre : contrastes tenus (bloc d'événement bleu clair sur fond quasi noir, pastille Semaine verte) ; rien à signaler.
- Hors périmètre design : la pastille « Hors ligne » et les champs date/heure au format US des captures sont des artefacts de l'environnement de test (voir PROBLEMES.md).

## Questions to Consider

- Et si la vue Jour s'ouvrait sur *« Prochain : Kiné 19:00 »* plutôt que sur une grille d'heures vides ?
- La Semaine sur 3,5 colonnes visibles est-elle vraiment une *semaine* sur téléphone, ou un « 3 jours » qui gagnerait à le dire ?
- Faut-il un geste caché pour créer, quand le FAB fait déjà ce travail en deux taps ?

Questions skipped: exécution en agent délégué sans outil de question structurée, alors que 5 Priority Issues imposent les questions ; à reposer à Vincent : ordre de traitement (P1 Semaine d'abord ?), cadrage initial des grilles (maintenant ou premier élément ?), périmètre (P1 seul / P1+P2).
