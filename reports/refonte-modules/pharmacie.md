# Cohérence interne — module Pharmacie (lecture seule, 2026-11-14)

Sources : code `src/app/(app)/pharmacie/**`, `src/app/actions/{pharmacie,huiles}.ts`, `src/lib/pharmacie/*`, `src/lib/navigation/{parentRoute.ts,registry.ts}`, `BackNavigationHandler.tsx` ; GLOSSARY, PRODUCT, DESIGN ; rapports `2026-09-30-module-pharmacie`, `2026-09-30-pharmacie-couleurs`, `2026-10-27-lot-4-coherence-navigation`, `2026-11-12-audit-design-pharmacie` (non refait ; on constate que P-I1 et P-I5 sont déjà corrigés dans le code). Captures : `reports/audit/pharmacie/` (`ecrans/`, `parcours/`, `parcours/verif/`, `scenarios/`). Script de vérification ad hoc : copie dans le scratchpad (aucun fichier du dépôt modifié, aucune notation de carte envoyée au banc).

## Résumé
- Le « module » est en réalité trois sous-produits sous un seul titre : Cours (matières/notions/cartes), Référentiel (médicaments) et Huiles essentielles. PRODUCT.md ne décrit que le premier ; les deux autres ne sont documentés nulle part.
- Contradiction directe avec PRODUCT.md:17 : les Huiles ont un formulaire d'ajout dans l'app (`HuilesAccueil.tsx:55`, `HuileEditeur`), alors que l'ajout « se fait uniquement par le chat ».
- Le geste central « chercher puis revenir » est incohérent : le retour matériel mène au parent logique (matière), pas aux résultats ; trois champs de recherche aux portées et aux comportements différents ; le placeholder du Cours promet des molécules qu'il ne cherche pas.
- La révision mélange cartes de cours, de molécules et d'huiles sans le dire, et l'anneau « % acquis » ne compte pas comme les barres par matière.
- 8 propositions (6 S, 2 M), aucune ne remet en cause un choix tranché sans le signaler.

## Inventaire des écrans
| Route | Rôle | Vu |
|---|---|---|
| `/pharmacie` (`PharmacieAccueil`) | Titre + onglets Cours · Référentiel · Huiles ; recherche plein texte locale ; carte « Révision du jour » (anneau % acquis, « N cartes à réviser », Commencer) ; Matières (barre de maîtrise) ; Dernières notions (5) | capture clair/sombre |
| `/pharmacie/[matiere]` | Liste des chapitres (nb notions) | capture |
| `/pharmacie/[matiere]/[chapitre]` | Notions en lecture continue, Sommaire (feuille), « Modifier » par notion → `NotionEditeur` (titre, contenu coloré, tags, Supprimer + Annuler) | capture |
| `/pharmacie/revision` | Séance de 20 cartes max : question → Voir la réponse → 4 notes (À revoir/Difficile/Bien/Facile + délai) ; écrans « Rien à réviser » / « Séance terminée » | capture (notation non exécutée) |
| `/pharmacie/referentiel` | Recherche + 3 sections repliables : Pathologies, Classes (groupées par racine), Médicaments A–Z | vide (mock) : non vérifié visuellement |
| `…/referentiel/classe/[id]`, `/medicament/[id]`, `/pathologie/[id]` | Fiches (lecture ; seule la molécule est modifiable : indications, particularités) | non résolues (mock sans données) : jugées d'après le code |
| `/pharmacie/huiles-essentielles` | Bouton « Ajouter une huile essentielle », recherche, puces de filtre, liste | état vide + formulaire d'ajout capturés |
| `…/huiles-essentielles/[id]` | Fiche (précautions d'abord), Modifier la fiche, Supprimer + Annuler | non résolue : jugée d'après le code |
Points d'entrée hors module : grille « Plus » (`registry.ts:234`, description « Cours, recherche et révision »). Aucun lien depuis Aujourd'hui, aucun résultat dans la recherche globale (grep : aucune référence `pharma` dans `actions/recherche`). Pas de `loading.tsx` propre aux sous-routes autres que la racine.

## Constats

### Axe A — parcours et hiérarchie
- **A1 (haute) Retour après une recherche : on atterrit sur la matière, pas sur les résultats.** Vérifié : recherche « toux » → résultat → retour (popstate) → URL `/pharmacie/<matière>`, aucun champ de recherche (`parcours/verif/03-retour.png`, console du script). Cause : `BackNavigationHandler` renvoie toujours au parent logique ; seule exception d'historique : fiches du Référentiel (`parentRoute.ts:12-17,59-62`, `retourHistoriqueAutorise`). Même effet depuis « Dernières notions » : accueil → chapitre → retour = matière, puis un second retour pour revenir à l'accueil. La requête, en plus, n'est pas dans l'URL (`PharmacieAccueil.tsx:19`, `useState("")`), contrairement au Référentiel (`ReferentielAccueil.tsx:32-41`) et aux Huiles (`HuilesAccueil.tsx:32-42`) : le constat P-I4 du 11-12 reste ouvert et sa correction seule ne suffirait pas (le retour n'y ramène pas).
- **A2 (moyenne) Révision : aucune provenance ni lien vers la notion.** La carte n'affiche ni matière/chapitre ni lien « Voir la notion » (`RevisionView.tsx:129-144`) ; impossible de corriger une carte douteuse depuis la séance. Les cartes ne sont éditables nulle part dans l'app (`modifierNotion` ne touche pas `pharma_cartes`, `pharmacie.ts:93-112`) : modifier une notion laisse sa carte périmée.
- **A3 (moyenne) La révision n'a qu'une porte, sur le premier onglet.** « Commencer » n'existe que sur Cours et disparaît pendant une recherche (`PharmacieAccueil.tsx:30-35`). Sur Référentiel/Huiles, aucun compteur alors que leurs cartes y sont comptées (voir C2). Chemin nominal OK sinon : 2 taps accueil → première carte, 3 taps pour une notion depuis la matière.
- **A4 (basse) Lecture continue sans repère d'arrivée.** Le lien profond défile maintenant (`[chapitreId]/page.tsx:51-57`, P-I5 du 11-12 corrigé) mais la notion visée n'est pas marquée parmi plusieurs ; non vérifiable sur le banc (chapitre de 2 notions tenant à l'écran, `verif/02-lien-profond.png`).
- **A5 (basse) Navigation 3 niveaux sans onglets au niveau 2/3** : matière et chapitre n'affichent plus les onglets (voulu), le BackLink porte le nom du parent (« Pharmacologie ») — cohérent avec lot 4. Rien à changer.
- Vérifié conforme : cibles de notes 56 px, « Bien » en primaire (`verif/04-revision-notes.png`), couleurs de niveau avec pictogrammes, états vides rédigés.

### Axe B — vocabulaire et gestes
- **B1 (moyenne) Placeholder trompeur** : « Rechercher une notion, une molécule… » (`PharmacieAccueil.tsx:30`) alors que `rechercherNotions` ne parcourt que `snap.notions` (`selecteurs.ts:90-120`). Une molécule se cherche dans l'onglet Référentiel, une huile dans Huiles.
- **B2 (moyenne) Trois recherches, trois comportements** : Cours (état local, ≥ 2 car., seuil de faute de frappe, pas de `?q=`), Référentiel (`?q=`), Huiles (`?q=` + puces de filtre, champ masqué tant qu'aucune huile). Les placeholders suivent trois patrons (« … » avec exemples ou liste de champs).
- **B3 (moyenne) « Molécule » vs « Médicament »** : fiches et sections disent « Médicament(s) », la page classe compte des « molécules » (`classe/[classeId]/page.tsx` : `pluriel(…, "molécule")`) sous un titre « Médicaments » ; le vocabulaire Pharmacie (matière, chapitre, notion, carte, fiche, DCI, molécule, médicament) n'est dans aucun GLOSSARY.
- **B4 (basse) « Modifier » a deux formes** : lien texte vert par notion (`[chapitreId]/page.tsx:104`, `linkButton`) vs bouton secondaire « Modifier la fiche » (molécule, huile). « Supprimer » : patron conforme au GLOSSARY partout (toast + Annuler) mais placement différent : dans la feuille d'édition pour la notion (`NotionEditeur.tsx:152`), bouton direct sur la fiche pour l'huile.
- **B5 (basse) Verbes de création conformes** pour les Huiles : bouton d'entrée « Ajouter une huile essentielle », titre « Nouvelle huile essentielle », validation « Ajouter l'huile » (le GLOSSARY dit « Ajouter » seul) ; toasts « Notion enregistrée » / « Fiche enregistrée » / « Huile ajoutée » homogènes.
- **B6 (basse) Retour du Référentiel** : « Retour » (`sansPrefixe`) alors que le reste du module nomme la destination (« Pharmacie », nom de matière, « Huiles essentielles ») ; exception documentée au lot 4, mais l'historique réel y est suivi, ce qui est le vrai écart (voir A1).
- Vérifié : « Supprimer » jamais abrégé, « Enregistrer » en modification, « Annuler » dans les toasts.

### Axe C — cohésion fonctionnelle
- **C1 (haute) Ajout dans l'app pour les Huiles, contraire à PRODUCT.md:17.** `HuilesAccueil.tsx:55-66` + `creerHuile` (`actions/huiles.ts:62`) ; en parallèle un skill chat `kilio-huiles-essentielles` fait la même chose. Cours et Référentiel respectent la règle (commentaire `pharmacie.ts:10-12`, état vide « Dicte… à Claude »). Aucun rapport ne tranche ce choix pour les huiles ; l'état vide des huiles (« Ajoute ta première fiche avec le bouton ci-dessus », capture `ecrans/pharmacie_huiles-essentielles.clair.png`) est l'inverse de celui du Cours.
- **C2 (moyenne) Une seule file de révision pour trois sources.** `getPharmacieSnapshot` lit toutes les `pharma_cartes` (notions, molécules, huiles ; `huile_id`/`he_type` retirés du type, `types.ts:10-12`). Conséquences (d'après le code ; **non vérifié visuellement** : le mock n'a que des cartes de notions) : l'anneau « % acquis » (`PharmacieAccueil.tsx:68-69`) divise par toutes les cartes, alors que les barres par matière ne comptent que les cartes de notions (`selecteurs.ts:15-17`) : les deux chiffres ne se recoupent pas ; une carte d'huile ou de molécule apparaît en séance sans aucune indication d'origine (A2).
- **C3 (moyenne) Documentation absente.** PRODUCT.md:17 décrit seulement « cours matière → chapitre → notion » ; Référentiel (classes, molécules, spécialités, pathologies/protocoles, correction des textes d'une molécule seulement) et Huiles (CRUD complet, filtres, cartes dérivées) n'y figurent pas ; `registry.ts:235` dit « Cours, recherche et révision ».
- **C4 (basse) Pas de pont entre Cours et Référentiel/Huiles** : une notion « IEC » n'est pas liée à la classe « IEC » du référentiel, ni l'inverse ; recherches étanches.
- **C5 (basse) Corrections partielles** : le référentiel n'édite que `indications`/`particularites` d'une molécule (`MoleculeEditeur.tsx`) ; une faute dans une classe, une pathologie, une marque ou une carte nécessite le chat. Cohérent avec « l'app consulte », mais jamais annoncé.
- Aucun écran orphelin ni composant dupliqué notable (`Repliable`, `BadgesHuile`, `EtatSnapshot` partagés). `Modal` + `useBackClose` utilisés partout.

## Propositions

- **P1 — Corriger le placeholder du Cours (B1).** « Rechercher une notion, une molécule… » → « Rechercher une notion… » (ou « … dans les cours »). Effet : plus de fausse promesse. Effort S ; risque nul ; fichier `PharmacieAccueil.tsx` (+ e2e si le libellé est ciblé : `aria-label` inchangé). Dépend : rien.
- **P2 — Retour vers les résultats dans le Cours (A1).** Étendre `retourHistoriqueAutorise` à `chapitre → /pharmacie` (et `/pharmacie/<matière>` → `/pharmacie`) quand l'entrée précédente y est, comme pour les fiches du référentiel, et conserver `?q=` dans l'URL (`replaceState`, patron de `ReferentielAccueil`, `Suspense` dans `page.tsx`). Effet : chercher → lire → retour = retrouver la liste (le geste le plus fréquent). Effort M ; risque : touche la garde de retour globale (`parentRoute.ts` + test) ; **remet en cause « retour = parent logique » du lot 4 pour ce cas, déjà accepté pour le Référentiel**. Fichiers : `parentRoute.ts`, `parentRoute.test.ts`, `PharmacieAccueil.tsx`, `page.tsx`, `ResultatsRecherche.tsx` (aucun, via BackLink à adapter comme `RetourReferentiel`), `[chapitreId]/page.tsx`. Dépend : décision de Vincent.
- **P3 — Trancher l'ajout des huiles (C1).** Option a : conserver le formulaire et l'écrire dans PRODUCT.md (« Huiles : ajout aussi dans l'app ») ; option b : le retirer pour s'aligner (`HuileEditeur` ne sert plus que la modification, état vide « Dicte… à Claude »). Effet : une règle unique ou une exception documentée. Effort S (a) / M (b : `HuilesAccueil.tsx`, `HuileEditeur.tsx`, `creerHuile` devenue inutile puisque le skill écrit en SQL, tests `[huileId]/page.test.tsx`). Risque : (b) perte d'un geste que Vincent utilise peut-être. Dépend : décision de Vincent, **contradiction à signaler avant tout changement**.
- **P4 — Documenter Référentiel et Huiles (C3).** Ajouter un paragraphe à PRODUCT.md (entités, ajout par chat, corrections possibles dans l'app, cartes dérivées des huiles) et une entrée de vocabulaire au GLOSSARY (matière, chapitre, notion, carte, fiche ; molécule = DCI, « Médicament » dans les textes visibles) ; `registry.ts` : « Cours, référentiel, huiles et révision ». Effort S ; risque nul ; fichiers `PRODUCT.md`, `GLOSSARY.md`, `registry.ts`. Dépend : P3 pour la phrase sur l'ajout.
- **P5 — Aligner « molécule » et « médicament » (B3).** Choisir « médicament » dans tout texte visible (`classe/[classeId]/page.tsx`, compteurs de sous-classes) ; `molecule` reste le nom technique. Effort S ; risque : tests éventuels sur les libellés. Dépend : P4.
- **P6 — Indiquer l'origine d'une carte en révision (A2, C2).** Sous la question, une ligne discrète « Pharmacologie › Antibiotiques » (notion), « Huile essentielle » ou « Référentiel » ; lien « Voir la notion/la fiche » sous la réponse révélée. Effet : contexte et correction en un tap. Effort M (le snapshot ne porte plus `huile_id`/`molecule_id` côté huile : le type `PharmaCarte` retire `huile_id`, à rétablir) ; risque : taille du snapshot Dexie ; fichiers `RevisionView.tsx`, `lib/pharmacie/types.ts`, `actions/pharmacie.ts` (select), `selecteurs.ts`. Dépend : rien.
- **P7 — Mesure de maîtrise cohérente (C2).** Soit calculer l'anneau sur les seules cartes de notions (comme les barres), soit afficher les trois sources dans une même base et nommer l'anneau « cartes acquises ». Effort S ; risque nul ; fichier `PharmacieAccueil.tsx` (+ `selecteurs.ts`). Dépend : P6 si on choisit la seconde option.
- **P8 — Compteur de révision visible sur les trois onglets (A3).** Pastille « N » à côté de « Cours » ou ligne « N cartes à réviser · Commencer » au-dessus des onglets, partagée par les trois écrans. Effet : la révision reste accessible depuis Huiles/Référentiel. Effort S–M ; risque : espace vertical mobile ; fichiers `OngletsPharmacie.tsx`, `page.tsx` des trois onglets. Dépend : rien.

À ne pas faire (déjà tranché) : journal brut ou source des notions ; ajout de notion/matière/chapitre dans l'app (gestion de l'arborescence par Claude) ; confirmation avant suppression ; recherche inline plutôt qu'écran dédié (rapport 09-30). Édition des cartes dans l'app : non tranchée, mais contradictoire avec « cartes créées automatiquement » si elle devient un formulaire de création ; ne proposer qu'une correction de texte.

## Pistes inter-modules
- Recherche globale : aucun résultat Pharmacie (notions, médicaments, huiles). À ajouter côté module Recherche, avec lien profond `#notion-…`.
- Aujourd'hui : carte « N cartes à réviser » (ou ligne dans « Plan, jour libre et revue ») ; hors Score du jour, qui exclut la Pharmacie. Module Aujourd'hui.
- Notifications : pas de rappel de révision (PRODUCT.md n'en prévoit pas) ; à arbitrer, module Réglages.
- Notes : aucun lien entre une notion et une note libre ; pas de besoin exprimé.
- Retour global : la règle « parent logique » (`BackNavigationHandler`) est transverse ; P2 en est une exception à valider avec les autres modules (Revue, Journal en ont déjà).

## Ce qui n'a pas pu être testé
- Artefacts du faux Supabase : aucune donnée Référentiel ni Huiles (`e2e/mock-supabase.mjs:76-99` ne contient que cours + cartes de notions) : écrans classe, médicament, pathologie, fiche d'huile et recherche/filtres Référentiel/Huiles jugés d'après le code, **non vérifiés visuellement** ; le mélange de cartes (C2) et l'incohérence anneau/barres ne se voient pas sur le banc ; le défilement du lien profond sur un chapitre long non plus. Je n'ai rien ajouté aux fixtures.
- Non exécuté pour ne pas modifier l'état du banc partagé : noter une carte, enregistrer/supprimer une notion, créer une huile (écritures du faux Supabase). Le plantage ou le toast « Annuler » (P-I3) restent lus dans le code.
- Bruit du banc, pas des bugs : 404 `/_vercel/speed-insights/script.js`, `ERR_ABORTED` sur les `_rsc` et POST annulés par le refetch ; barre du bas sans Courses (préférences mock).
- Artefact du script d'audit : en rejouant les scénarios à la suite dans un même contexte, l'historique se pollue (échecs « étape 8 » de `recherche-retour`) ; le constat A1 vient du script isolé (`scratchpad/pharm/t.mjs`), pas de ces échecs. Chromium 1243 utilisé via `executablePath` sur des copies des scripts.
- Ressenti d'usage (taille réelle des gestes, fluidité) : jugement, pas mesure ; pas de test sur un vrai bouton retour Android (popstate simulé par `goBack`).

## Résumé (5 lignes)
- Trois sous-produits sous un titre : Cours, Référentiel, Huiles ; seul le premier est documenté.
- Contradiction PRODUCT.md : ajout d'huile dans l'app, et état vide inverse de celui du Cours.
- Chercher puis revenir ne ramène pas aux résultats (vérifié) ; trois recherches incohérentes ; placeholder trompeur.
- Révision sans provenance, anneau « % acquis » non cohérent avec les barres (d'après le code).
- 8 propositions (P1, P4, P5, P7 en S ; P2, P6 en M), dont deux demandent une décision de Vincent (P2, P3).

Rapport : /home/user/Kilio/reports/refonte-modules/pharmacie.md
