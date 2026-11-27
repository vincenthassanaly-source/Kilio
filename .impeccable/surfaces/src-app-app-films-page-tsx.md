---
version: 1
slug: "src-app-app-films-page-tsx"
primary_target: "src/app/(app)/films/page.tsx"
related_targets: ["src/app/(app)/films/[id]/page.tsx","src/app/(app)/films/plateformes/page.tsx"]
---

# Films (/films)

Mode : Operate. Extension d'un monde établi (DESIGN.md Kilio : tableau de bord doux, vert olive, cartes 22px, Sora/Inter) : aucune nouvelle identité.

Audience : Vincent, seul, au téléphone, une main. Tâche : trouver un film à voir ce soir et savoir tout de suite où le regarder sans payer en plus, puis le garder dans une liste « à voir » / « vus ».
Contenu : recherche par titre et filtres (genre, époque, note, durée), plateformes d'abonnement françaises choisies par l'utilisateur, fiche film avec offres (abonnement, location, achat), liste à voir / vus. Données TMDB, disponibilités JustWatch (attribution visible sur chaque écran).
Contraintes : mobile d'abord (360 px), une main, cibles de 44 px, français, pas de nouvelle couleur interactive (One Accent Rule), teinte de module `--accent-films` limitée à l'icône de la grille « Plus ».
V2 (hors de cette surface pour l'instant) : suggestions du moment, recommandations par humeur (Gemini) et films similaires.

## Direction contract

THESIS: la réponse à « où le regarder ? » est écrite sur chaque ligne, en vert Kilio quand le film est chez l'utilisateur, plutôt qu'un catalogue d'affiches à ouvrir une à une.
OWN-WORLD: surfaces `surface` sur fond `background`, filets `line`, lignes de liste 20px (`rounded-row`) avec affiche 2:3 à coins 12px cerclée d'un filet intérieur, logos de plateformes en pastilles 24px chevauchées, vert `kcal` réservé aux actions, à l'état « dans ma liste » et à la phrase « Sur ma plateforme » ; aucune autre teinte.
STORY: Vincent ouvre Films, voit les films populaires avec leur disponibilité, coche « Sur mes plateformes » pour ne garder que ce qu'il peut lancer, ajoute d'un tap (+) ce qui l'intéresse, et retrouve dans « Ma liste » les films à voir, ceux de ses abonnements en premier.
FIRST VIEWPORT: titre « Films » ; contrôle segmenté Découvrir / Ma liste ; champ de recherche ; rangée « Sur mes plateformes » · Modifier · Filtres ; puis les premières lignes de films (affiche, titre, durée et note, phrase de disponibilité, bouton +) ; le bouton primaire de l'écran est le + de chaque ligne.
FORM: liste de lignes-films pilotée par la disponibilité (structure établie du système : lignes `rounded-row`, contrôle segmenté, filtres en panneau repliable), seed key: aucun (extension d'un monde établi, pas de concept-seed).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
