# Cohérence interne — module Notes (lecture seule, 2026-11-14)

Sources : `src/app/(app)/notes/*` (NotesGrid, NoteCard, NoteForm, AssistantNoteModal, AddNoteToggle), `src/app/actions/{notes,notes-assistant,recherche}.ts`, `QuickAddFab.tsx`, `public/manifest.json`, GLOSSARY / PRODUCT / DESIGN, rapports `2026-08-29-module-notes`, `2026-09-02-notes-keep`, `2026-11-12-audit-design-notes`. Captures : `reports/audit/notes/` (`ecrans/`, `parcours/`, `scenarios/`).

## Résumé
- Module compact : un seul écran `/notes` (grille Keep) + trois feuilles (lecture, édition, assistant IA) ; pas de sous-route ni d'écran orphelin.
- Suppression, ajout, état vide, recherche et filtre de tags suivent la charte ; la plupart des constats de l'audit design du 11-12 sont déjà corrigés dans le code (item en attente envoyé, `aria-pressed`, `Supprimer` en entier, titre sur 4 lignes).
- Écarts de cohérence restants : deux gestes parallèles pour la même modification (tuile : Modifier/Supprimer ; feuille de lecture : les mêmes + Assistant IA), éditeur de checklist qui écrit en direct sous un bouton « Annuler », épingle dessinée en étoile, « → Tâche » répétable sans état.
- Le lien `taches.note_id` est écrit mais jamais relu : aucune trace de la note d'origine côté Tâches (hors la mention en texte).
- 7 propositions (6 S, 1 M), aucune ne contredit un choix tranché.

## Inventaire des écrans
| Route / surface | Rôle |
|---|---|
| `/notes` (`page.tsx`, `NotesGrid`) | Titre, carte « Ajouter une note » (repliée), recherche, pastilles de tags, sections « Épinglées » / « Autres », grille 2 colonnes (`columns-2`). `?action=new` ouvre l'ajout (raccourci PWA, `manifest.json:51`), `?tag=` préfiltre (aucun lien dans le code ne l'émet, `NotesGrid.tsx:33`). |
| `loading.tsx` | Squelette. |
| Feuille « lecture » (`NoteCard.tsx:354-428`) | Texte complet ou checklist cochable, « → Tâche » par item, « Ajouter une tâche depuis cette note », « Assistant IA », Modifier / Supprimer. |
| Feuille « Modifier la note » (`NoteCard.tsx:442-455`, `NoteForm`) | Titre, contenu ou items, couleur, tags, nouveaux tags, Enregistrer + « Annuler ». |
| Feuille « Assistant IA » (`AssistantNoteModal.tsx`) | Résumer et titrer, Reformuler (texte seul), Classer avec des tags ; aperçu puis « Appliquer ». |
| Hors module | FAB « Notes » → modale « Nouvelle note » (`QuickAddFab.tsx:301-317,374-380`, même `NoteForm`) ; recherche globale (`recherche.ts:85-135`, tout résultat → `/notes`) ; barre du bas (onglet Notes) ; tags partagés avec Tâches. |
Captures : `ecrans/notes.clair.png`, `notes.sombre.png` (état vide) ; `parcours/checklist-epingle-lecture/`, `parcours/edition-tache-assistant-suppression/`, `parcours/recherche-filtre-suppression/`.

## Constats

### Axe A — parcours et hiérarchie
- A1 (moyenne) Deux entrées pour la même modification : la tuile porte « Modifier » + « Supprimer » (`NoteCard.tsx:333-351`) alors que la feuille de lecture, ouverte par le titre, propose les mêmes boutons plus l'IA et les tâches (`:419-426`). La tuile est donc chargée de gestes (capture `grille avec 2 notes`) et le chemin « lire → agir » passe par un titre sans signe d'affordance. Option déjà listée à l'audit 11-12 (« tuile entière cliquable »), non tranchée.
- A2 (moyenne) L'assistant IA et « Ajouter une tâche depuis cette note » ne sont atteignables que dans la feuille de lecture (deux taps depuis la grille) ; ils n'existent ni sur la tuile ni dans l'édition. Cohérent (actions secondaires) mais caché ; capture `feuille de lecture checklist`.
- A3 (moyenne) En édition d'une checklist, les items s'écrivent en base à chaque geste (`NoteForm.tsx:38-95`) mais la feuille garde « Enregistrer » et « Annuler » (`NoteCard.tsx:452`) : « Annuler » n'annule rien des items (capture `feuille Modifier la note`). Déjà noté I5 (audit 11-12), toujours présent.
- A4 (basse) Le tri « Épinglées / Autres » laisse l'en-tête « Épinglées » seul pendant le toast de suppression de la dernière note épinglée (capture `suppression + toast Annuler`, `recherche-filtre-suppression/12`) : transitoire, disparaît à la fin du délai.
- A5 (basse) Depuis Tâches, rien ne ramène à la note d'origine : `note_id` n'est lu nulle part (`grep note_id` : écrit dans `notes.ts:375,397` et `creation-rapide.ts:43`). Le parcours Note → Tâche est à sens unique.

### Axe B — vocabulaire et gestes
- B1 (moyenne) « Ajouter » désigne deux gestes dans la même feuille d'édition : bouton d'un item (`NoteForm.tsx:180`) et bouton de validation de la note (`:441`), avec « Ajouter une tâche » / « Ajouter une tâche depuis cette note » en plus. Conforme au verbe, mais ambigu à l'œil (capture `checklist brouillon`, deux « Ajouter » superposés).
- B2 (moyenne) Suppression : le patron est conforme pour la note (toast « Note « … » supprimée · Annuler », capture `recherche-filtre-suppression/12`), mais l'item « × » (`NoteForm.tsx:153-163`, `:213-220`) supprime ou retire sans annulation, et sans le mot « Supprimer » visible (symbole × ; en brouillon le label est « Retirer l'item », conforme à « Retirer », en édition « Supprimer l'item » ne l'est pas puisqu'il détruit). Le GLOSSARY dit « Un seul patron ».
- B3 (basse) « Annuler » sous le formulaire d'édition = fermer sans enregistrer : conforme au GLOSSARY pour un formulaire sans effet ; devient trompeur seulement en checklist (A3).
- B4 (basse) Épingle dessinée en étoile (`NoteCard.tsx:91`, captures `epinglee`) alors que le libellé dit « Épingler » et la section « Épinglées » : l'étoile évoque favori. Contrairement à Opinions où `favori` est un état distinct.
- B5 (basse) Intitulés d'entrée différents pour la même création : carte « Ajouter une note » / titre de feuille FAB « Nouvelle note » (conforme : « Le titre du formulaire reste Nouveau/Nouvelle X ») / tuile FAB « Notes » (pluriel, alors que « Tâche » et « Course » sont au singulier selon `QuickAddFab.tsx:301-317`). Écart de nombre seulement.
- B6 (basse) L'assistant dit « Proposer / Proposition / Gemini propose » (`AssistantNoteModal.tsx:31,248`) alors que GLOSSARY réserve « Suggestion » à ce que Gemini renvoie avant validation et déconseille « Proposition seule ». Même écart dans `AssistantRevueModal`. Libellé visible : « Assistant IA » (identique dans Revue, cohérent).
- B7 (basse) « → Tâche » (symbole + mot, `NoteCard.tsx:387`) vs « Ajouter une tâche : … » en aria-label et « Ajouter une tâche depuis cette note » sur le gros bouton : trois formulations pour un geste. Le feedback est un toast « Tâche créée » sans « Annuler » ; un second tap crée un doublon (capture `edition-tache-assistant-suppression/15` : deux toasts « Tâche créée » empilés), déjà noté M10.
- Vu conforme : « Rechercher une note… », « Effacer la recherche et les filtres », état vide (« Aucune note pour l'instant »), « Enregistrer » en édition / « Ajouter » en création, `Supprimer` en entier (corrigé depuis l'audit 11-12).

### Axe C — cohésion fonctionnelle
- C1 (moyenne) Chevauchement avec les Tâches : une checklist « Courses » à cocher fait doublon avec le module Courses (Notes accepte une liste d'items cochables, Courses aussi) ; et chaque item peut devenir une tâche. Le périmètre n'est documenté nulle part (PRODUCT.md ne décrit pas Notes au-delà de sa mention dans la liste des modules, `PRODUCT.md:11,15`).
- C2 (basse) `?tag=` (préfiltre) et le tri « idées » en tête (`NotesGrid.tsx:19,40-46`) sont des conventions sans émetteur : aucun lien ni raccourci n'utilise `?tag=idees`. Reste d'un ancien module (Inbox retirée, `PRODUCT.md:35`) ; à confirmer par Vincent avant de supprimer.
- C3 (basse) Tags partagés avec Tâches (`NOTES_TAG` revalidé dans `taches.ts:1152,1167`) : bon réemploi, mais la création de tags en cours de saisie existe dans les deux formulaires, la gestion (renommer / supprimer) uniquement côté Tâches. Rien ne le dit depuis Notes.
- C4 (basse) La recherche globale renvoie toujours `/notes` sans repérer la note (`recherche.ts:92,134`) ; recherche locale déjà présente sur l'écran, donc doublon d'entrée mais pas de blocage.
- Bon point : `NoteForm` réutilisé tel quel par l'écran et le FAB ; `Modal`, `CheckToggle`, `AddCardToggle` partagés. Aucun composant dupliqué dans le module.

## Propositions
- **P1 — Aligner « Annuler » / « Enregistrer » de l'édition de checklist (A3, B3).** En édition d'une checklist, remplacer « Annuler » par « Fermer » (exception GLOSSARY existante) ou rendre les items différés jusqu'à « Enregistrer ». Effet : plus de bouton qui promet un retour en arrière impossible. Effort S (libellé) / M (items différés). Risque : tests `NoteCard.test.tsx`. Fichiers : `NoteCard.tsx`, `GLOSSARY.md` si exception. Dépend : choix de Vincent entre les deux variantes.
- **P2 — Suppression d'item avec annulation (B2).** Réutiliser `supprimerAvecAnnulation` pour « × » en édition, renommer le label en « Retirer l'item » seulement si l'item reste (non : il est détruit, donc « Supprimer l'item » + toast Annuler). Effort S-M. Risque : écriture directe actuelle (`deleteNoteItem`), tests à adapter. Fichiers : `NoteForm.tsx`, `src/app/actions/notes.ts`. Dépend : P1.
- **P3 — Une seule entrée vers l'édition (A1).** Décider : tuile cliquable en entier, boutons Modifier / Supprimer retirés de la tuile (déjà dans la feuille). Effet : tuiles plus denses, hiérarchie lecture → action claire. Effort M. Risque : régression du geste de suppression rapide ; tests `NoteCard.test.tsx`. Fichiers : `NoteCard.tsx`, test. Dépend : arbitrage de Vincent (option déjà listée à l'audit 11-12, donc à confirmer, pas à imposer).
- **P4 — Icône d'épingle réelle (B4).** Remplacer l'étoile par une punaise (même `PinIcon`, autre tracé) pour correspondre à « Épingler / Épinglées ». Effort S, risque nul. Fichier : `NoteCard.tsx`.
- **P5 — État « tâche créée » sur la ligne et annulation (B7, A5).** Désactiver « → Tâche » après création (clé `note_id` + libellé déjà créé) ou proposer « Annuler » dans le toast. Effet : fin du doublon silencieux. Effort S. Risque : faible. Fichiers : `NoteCard.tsx`, éventuellement `notes.ts`.
- **P6 — Harmoniser « Suggestion » dans l'assistant (B6).** « Propose des tags… » → « Suggère… », « Proposition » (types internes inchangés) → libellés visibles « Suggestion ». Effort S, risque nul ; à faire avec Revue. Fichier : `AssistantNoteModal.tsx` (+ `AssistantRevueModal.tsx`). Dépend : arbitrage GLOSSARY (écrire que « Assistant IA » est le nom de l'entrée).
- **P7 — Documenter le périmètre de Notes (C1, C2).** Ajouter à `PRODUCT.md` un paragraphe Notes (texte ou checklist, couleur, épingle, tags partagés, Note → Tâche, assistant IA) et trancher `?tag=idees` (le supprimer s'il est mort). Effort S, risque nul. Fichiers : `PRODUCT.md`, `NotesGrid.tsx` si suppression.

À ne pas remettre en cause (déjà tranché) : grille Keep à deux colonnes, filtrage 100 % client (09-02), checklist stockée avec le type non modifiable en édition, palette fixe de 8 teintes, pas de glisser-déposer, suppression différée avec « Annuler » (GLOSSARY).

## Pistes inter-modules
- Tâches : afficher « Depuis la note … » avec lien dans la carte d'une tâche portant `note_id` (aujourd'hui seulement une mention texte dans `notes`).
- Courses vs Notes (checklists) : si Vincent veut garder les deux, une action « Envoyer aux Courses » depuis une checklist serait cohérente avec Menus → Courses ; sinon clarifier l'usage dans PRODUCT.md.
- Recherche globale : ouvrir directement la feuille de la note trouvée (`?note=<id>`).
- Gestion des tags (renommer / supprimer) uniquement dans Tâches, partagés avec Notes : l'exposer depuis Réglages ou la rendre accessible depuis Notes.
- Assistant IA : trois entrées similaires (Notes, Revue, Documents) avec vocabulaire non unifié (« Assistant IA », « Trier », « Réorganiser ») : à harmoniser avec Documents.
- FAB : « Notes » au pluriel alors que les autres tuiles sont au singulier (module FAB).

## Ce qui n'a pas pu être testé
- Artefacts du faux Supabase : le banc a été remis à zéro en cours d'audit ; le mock ne contient plus le tag « #urgent » vu au premier passage, d'où les clics sur ce tag qui échouent (`edition-tache-assistant-suppression` étape 5, `recherche-filtre-suppression` étapes 6 et 8) : pas des bugs. Les tâches créées depuis une note n'apparaissent pas dans `/taches` du mock (capture `taches`), non concluant : la liste ne montre que la fixture « Tâche e2e du jour », donc A5 et le lien visuel Note → Tâche sont jugés d'après le code. Erreurs `POST /notes ERR_ABORTED` (actions annulées par le refetch) et 404 `speed-insights` : bruit du banc.
- Non vérifié visuellement : feuille d'aperçu de l'assistant (aucune clé Gemini sur le banc, seul l'écran de choix est vu), hors ligne réel (file Dexie pour coche/suppression, épingle sans file — I3 audit 11-12, lu dans le code), vibrations, gestes tactiles, iOS.
- Outil : Playwright du skill cherche Chromium 1194 ; copies des scripts avec `executablePath` vers 1243 dans le scratchpad (skill et code inchangés). Le skill n'a pas été modifié ; critique impeccable sautée comme demandé.
- Données mock modifiées par mes parcours (notes « Idees cadeau Lea » / « Courses week-end »), sans `--reset`. J'ai supprimé uniquement mes propres captures d'un essai raté dans `reports/audit/notes/parcours/`.
- Jugement d'usage : A1, B4 et C1 sont des jugements, à valider par Vincent.

## Résumé
- Module Notes cohérent et compact : un écran, trois feuilles, composants partagés avec le FAB.
- La plupart des défauts de l'audit design 11-12 sont déjà corrigés ; restent l'édition de checklist (écritures directes + « Annuler »), la suppression d'item sans annulation, l'étoile à la place d'une punaise et « → Tâche » répétable.
- Cohésion : doublon d'usage avec Courses, `taches.note_id` jamais relu, `?tag=idees` sans émetteur, périmètre absent de PRODUCT.md.
- 7 propositions (P1 à P7, surtout S), dont deux arbitrages pour Vincent (P1, P3).
- Rapport : `/home/user/Kilio/reports/refonte-modules/notes.md`.
