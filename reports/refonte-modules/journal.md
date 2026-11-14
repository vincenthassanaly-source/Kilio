# Cohérence interne — module Journal (lecture seule, 2026-11-14)

Sources : `src/app/(app)/journal/*` (FeuilleView, FeuilleCanvas, BarreOutils, MenuFeuille, SaisieClavier, TranscriptionDialog, CalendrierView, VerrouGate, pages `/journal`, `/journal/[jour]`, `/journal/calendrier`), `src/app/(app)/reglages/VidageRow.tsx`, `src/lib/navigation/registry.ts`, GLOSSARY (Journal, Carnet, Supprimer, Effacer, Enregistrer, Annuler), PRODUCT (paragraphe Journal), DESIGN, `reports/2026-11-12-audit-design-journal.md`. Captures : `reports/audit/journal/` (ecrans/, parcours/, scenarios/). Scripts du skill lancés en copies (Chromium 1243 par `executablePath`), sans `--reset`.

## Résumé
- Module cohérent et bien borné : une feuille (stylo ou clavier) + un calendrier de relecture + un texte du jour, vocabulaire du GLOSSARY respecté (Journal, Calendrier, Effacer la feuille, Rappel du soir pour le Journal).
- Pas de bug d'usage vu sur le banc pour ce qui est testable (bascule Clavier, ajout d'une note, texte du jour, calendrier, jour passé).
- Écarts de cohérence : le « texte du jour » (la production réelle du module) n'est atteignable que par le menu « … » ; sur un jour passé le lien « Calendrier » est doublé par le retour « < Calendrier » ; « Effacer la feuille » demande une confirmation alors qu'elle est annulable, alors que « Valider » (irréversible) n'en a pas ; le nom interne « vidage » survit dans le code et la teinte.
- Aucun écran orphelin ni doublon de composant ; le rappel du soir vit dans Réglages (placement transverse normal).
- 6 propositions, toutes S ou M, aucune ne remet en cause un choix documenté (silhouette immersive, verrou, transcription à la demande).

## Inventaire des écrans
| Route | Rôle |
|---|---|
| `/journal` (`page.tsx` → `VerrouGate` → `FeuilleView`) | Feuille du jour. En-tête : retour « Plus », titre « Journal », date, statut d'enregistrement, bouton « Calendrier », menu « … » (Voir le texte, Effacer la feuille). Bascule Stylo / Clavier. Stylo : interrupteur « Écrire aussi au doigt », feuille lignée, barre flottante (stylo, gomme, 3 épaisseurs, annuler, rétablir, Transcrire). Clavier : zone de texte + « Ajouter ». Barre du bas masquée (choix documenté). |
| `/journal/[jour]` | Même `FeuilleView` pour un jour passé (retour « < Calendrier »). `notFound` si date invalide. Non résolue par le script (aucune feuille écrite dans le mock) ; ouverte à la main via `/journal/2026-10-10`. |
| `/journal/calendrier` | « Calendrier » : mois, vignettes des soirs écrits (point accent sinon), jours futurs inertes, compteur « N soirs écrits ce mois-ci ». Barre du bas visible. |
| Modales de `FeuilleView` | « Texte transcrit » (proposition) et « Texte du jour » (même composant `TranscriptionDialog`), « Effacer la feuille ? » (`ConfirmDialog`). |
| `VerrouGate` | Écran d'accès passkey, entoure les trois routes. |
| Hors module | Menu Plus (`registry.ts:256`, « Journal — Écrire à la main pour poser la journée »), Réglages › `VidageRow` « Rappel du soir pour le Journal », push du soir. Aucune entrée dans la recherche globale (voulu : journal intime). |

## Constats

### Axe A — parcours et hiérarchie
- A1 (moyenne) Le texte du jour, seul produit durable de la transcription et du clavier, n'a aucune présence sur l'écran : ni aperçu ni indicateur. On ne le trouve que par « … » › « Voir le texte » (`FeuilleView.tsx` ~l.419-428, `MenuFeuille.tsx:119-130` ; captures `parcours/clavier-texte/06`, `08`). Après « Ajouter », seul un toast confirme ; en rouvrant le Journal, rien n'indique qu'une note existe (capture après rechargement `…/11-screenshot.png`, mode Stylo identique à un jour vierge). Le calendrier, lui, n'a pas de marque propre pour un jour « texte seul » (point accent seulement si pas de vignette, `CalendrierView.tsx:124`).
- A2 (basse) Sur un jour passé, l'en-tête montre à la fois le retour « < Calendrier » et le bouton « Calendrier » (`journal/[jour]/page.tsx:20`, `FeuilleView.tsx` en-tête ; capture `calendrier-navigation/05`). Le bouton fait la même chose que le retour. À l'inverse, aucun moyen de revenir à aujourd'hui depuis un jour passé sans repasser par le Calendrier, ni de passer au jour précédent/suivant.
- A3 (basse) Un jour passé ressemble exactement à aujourd'hui (même titre « Journal », seule la date change, pas d'indice « jour passé »). On peut y écrire à la main ; c'est voulu (feuille par jour), mais l'identité du jour tient à une ligne d'eyebrow.
- A4 (basse) La barre du bas est masquée sur la feuille mais visible sur le Calendrier (capture `journal_calendrier.clair.png`) : conforme à PRODUCT/DESIGN (« écrans d'écriture »), à noter seulement parce que « Plus » est surligné sans que « Journal » soit une destination de la barre.
- A5 (basse) Le menu « … » est désactivé sur une feuille vide sans texte (`MenuFeuille.tsx:97`, capture `journal.clair.png`) : plus de cul-de-sac (déjà corrigé depuis l'audit 11-12), mais aucun indice de la raison.

### Axe B — vocabulaire et gestes
- B1 (moyenne) Gradient de risque inversé : « Effacer la feuille » passe par une boîte de confirmation (`FeuilleView.tsx` ~l.465) alors que l'action est annulable (bouton Annuler de la barre, texte de la boîte : « Tu pourras revenir en arrière… »), tandis que « Valider » d'une transcription, irréversible (vide la feuille, manuscrit perdu), se fait en un toucher avec seulement une phrase d'avertissement (`TranscriptionDialog.tsx:269`). Le GLOSSARY réserve les confirmations aux pertes de brouillon ; « Effacer » y est un terme déjà dérogatoire, mais la confirmation de l'effacement n'est documentée nulle part.
- B2 (basse) Verbe de validation : « Valider » (transcription) et « Ajouter » (clavier) produisent le même effet (ajout au texte du jour, toast identique « Texte ajouté à ta journée »). « Valider » est dans la liste `_Avoid_` de « Enregistrer » ; ici il n'y a pas de modification d'élément, donc pas une infraction stricte, mais le même geste porte deux verbes. PRODUCT l'écrit pareil (« Valider » pour les suggestions Gemini ailleurs : usage cohérent avec Suggestion).
- B3 (basse) Fermer la fenêtre « Texte du jour » enregistre silencieusement les corrections (toast « Texte enregistré ») : aucun bouton « Enregistrer », contrairement au patron « Enregistrer » du GLOSSARY. Le sous-texte l'annonce (« Tes corrections sont enregistrées en fermant ») ; geste voulu, mais unique dans l'app.
- B4 (basse) « Copier » est bouton secondaire en proposition et bouton primaire en « Texte du jour » (`TranscriptionDialog.tsx:275,284`) : même libellé, deux poids selon l'action principale ; défendable.
- B5 (basse) « Supprimer le texte » vs « Texte du jour supprimé · Annuler » : conforme au patron Supprimer différé (`FeuilleView.tsx` `supprimerTexte`). Rien à changer.
- B6 (basse) Nom interne : routes `/journal` mais code `vidage` (`src/lib/vidage`, `actions/vidage.ts`, `VidageRow`, `--accent-vidage`, table `feuilles_vidage`, bucket `vider-tete`, id HTML `heure-vidage`). Invisible pour l'utilisateur ; GLOSSARY interdit « Vider ma tête » en libellé visible, aucune occurrence visible trouvée (grep `Vider` dans le module : aucune).
- B7 (basse) Collision lexicale avec le Carnet : pour Vincent, « Journal » = écriture, « Carnet » = nutrition (GLOSSARY). Dans le code, `nutrition/journal`, `actions/journal.ts` (nutrition) et `journal/` (écriture) coexistent : risque de confusion pour les développeurs, pas visible dans l'UI. L'audit n'a trouvé aucun libellé « journal » désignant l'alimentation (Réglages dit « Journal » seulement pour l'écriture).
- B8 (basse) Libellés conformes relevés : « Calendrier », « Effacer la feuille », « Rappel du soir pour le Journal », « Mois précédent/suivant », « Écrire le N / Voir le N ».
- B9 (basse) Les statuts d'enregistrement (« Enregistré », « Gardé sur ton téléphone… ») sont maintenant dans l'en-tête et neutres (`FeuilleView.tsx` `statut`) : les points I2 de l'audit 11-12 sont corrigés dans le code.

### Axe C — cohésion fonctionnelle
- C1 (moyenne) Deux entrées d'écriture dans un module dont la promesse est « sans rien avoir à en faire ensuite » : le mode Clavier produit directement du texte (comme une transcription validée) alors que le stylo produit un manuscrit non transcrit. Les deux se rejoignent seulement dans « Texte du jour ». PRODUCT l'assume (bascule documentée), mais le texte du jour est un deuxième objet (A1) sans entrée propre au Calendrier.
- C2 (basse) « Transcription » est exposée dans la barre du bas (icône « TI », `BarreOutils.tsx`) alors que PRODUCT la place dans le menu « … » : écart de doc (le code a déplacé le bouton dans la barre, le menu ne contient plus que « Voir le texte » et « Effacer la feuille », commentaire `MenuFeuille.tsx:36-38`). À corriger dans PRODUCT, pas dans le code.
- C3 (basse) Le rappel du soir vit dans Réglages (`VidageRow`, avec sa propre icône et teinte `accent-vidage`) : placement transverse normal, mais le module lui-même ne le mentionne pas.
- C4 (basse) « Écrire aussi au doigt » est une préférence de réglage affichée en tête de l'écran d'écriture, au même poids visuel que les outils : réglage rare placé sur le chemin principal (`FeuilleView.tsx` ~l.447).
- Pas de doublon : `Modal`, `ConfirmDialog`, `SegmentedControl`, `Switch`, `BackLink` partagés ; `TranscriptionDialog` sert deux usages (proposition, texte du jour) sans duplication.
- Aucun écran orphelin : `/journal/[jour]` n'est atteint que par le Calendrier, voulu.

## Propositions

- **P1 — Rendre le texte du jour visible sur la feuille (A1, C1).** Sous l'en-tête, une ligne discrète « Texte du jour · 2 notes » (ou premier bloc tronqué) qui ouvre la même fenêtre ; et dans le Calendrier, marque spécifique pour un jour avec texte. Effet : on voit qu'une note existe sans passer par « … ». Effort M. Risque : faible, mais densité de l'écran d'écriture et vie privée (ne pas afficher d'extrait si on préfère la discrétion : choix de Vincent). Fichiers : `FeuilleView.tsx`, `MenuFeuille.tsx` (éventuellement retirer l'entrée), `CalendrierView.tsx`, `actions/vidage.ts` (`listerJoursEcrits` doit dire `aTexte`). Dépend : décision de Vincent sur l'aperçu.
- **P2 — Retirer le doublon « Calendrier » sur un jour passé (A2).** Sur `/journal/[jour]`, masquer le bouton « Calendrier » (le retour y mène déjà) ou le remplacer par « Aujourd'hui » pour revenir à la feuille du jour. Effort S, risque nul. Fichiers : `FeuilleView.tsx` (prop `retour`/`aujourdhui` déjà disponibles), tests `FeuilleView*.test.tsx`. Dépend : rien.
- **P3 — Aligner la confirmation sur le risque (B1).** Option 1 : retirer la boîte « Effacer la feuille ? » (l'action est annulable) et la remplacer par un toast « Feuille effacée · Annuler » rappelant le bouton Annuler ; option 2 : garder la boîte et ajouter une confirmation légère à « Valider » (irréversible). Recommandation : option 1 + la phrase d'avertissement actuelle sur « Valider ». Effort S-M. Risque : contredit la dérogation implicite « Effacer demande confirmation » (non documentée) : à valider. Fichiers : `FeuilleView.tsx`, `MenuFeuille.test.tsx`, `FeuilleView.suppression.test.tsx`, GLOSSARY. Dépend : accord de Vincent (moyen risque : feuille intime).
- **P4 — Un seul verbe pour l'ajout au texte du jour (B2).** « Valider » → « Ajouter au texte du jour » dans la proposition (ou garder « Valider » et le noter au GLOSSARY comme valable pour une suggestion Gemini). Effort S. Risque : tests `TranscriptionDialog.test.tsx`. Fichiers : `TranscriptionDialog.tsx`, GLOSSARY. Dépend : rien.
- **P5 — Mettre PRODUCT/GLOSSARY à jour (C2, B1, B3, B6).** PRODUCT : « Transcrire » est dans la barre d'outils, pas dans le menu « … » ; GLOSSARY : consigner la confirmation de « Effacer la feuille » (ou sa suppression si P3), l'enregistrement à la fermeture du texte du jour, et l'équivalence vidage = Journal pour les noms internes. Effort S, risque nul. Fichiers : `PRODUCT.md`, `GLOSSARY.md`. Dépend : P3.
- **P6 — Déplacer « Écrire aussi au doigt » (C4).** Dans le menu « … » ou, mieux, dans Réglages à côté de `VidageRow` ; l'écran d'écriture gagne une ligne. Effort S-M. Risque : la préférence est lue par `FeuilleCanvas` via `localStorage` (hors base) : un déplacement dans Réglages impose un partage de cette lecture. Fichiers : `FeuilleView.tsx`, `MenuFeuille.tsx`, `reglages/`. Dépend : rien. À arbitrer (l'accès rapide sur l'écran peut être voulu pour tester le stylet).

À ne pas faire (déjà tranché) : barre du bas masquée sur la feuille, verrou biométrique, transcription à la demande seulement, texte du jour séparé de la feuille, pas de recherche globale du Journal.

## Pistes inter-modules
- Réglages : le « Rappel du soir pour le Journal » pourrait renvoyer au Journal par un lien et regrouper le réglage « Écrire aussi au doigt » (P6).
- Aujourd'hui : ni carte ni indicateur « page du jour écrite ». Avec le rappel du soir conditionné à la feuille vide, un petit repère (« Journal du jour écrit ») serait cohérent avec le Score du jour, mais risque d'introduire un jugement ; choix de Vincent. Non retenu dans les propositions.
- Nutrition : le nom « journal » dans le code (`actions/journal.ts`, `nutrition/journal`) désigne le Carnet ; renommer en `carnet` lèverait la collision avec le module Journal (refactor transverse, effort L, aucun effet visible).
- Menu Plus : l'entrée « Journal » est bien décrite ; rien à changer.

## Ce qui n'a pas pu être testé
- **Verrou biométrique** : désactivé par le banc (`E2E_VERROU_DESACTIVE=1`) ; `VerrouGate` (inscription, code d'enregistrement, session de 15 minutes, reverrouillage au retour au premier plan, perte éventuelle d'un texte en cours) lu dans le code uniquement, ni testé ni simulé.
- **Tracé au stylet** : pointeurs de stylet, pression, gomme du bouton, défilement au doigt, inertie, annuler/rétablir après tracé : non testables avec Playwright de façon fiable ; seuls l'état de repos de la barre d'outils et de la feuille vide ont été capturés. Donc pas de test de l'effacement (la boîte « Effacer la feuille ? » n'a pas été ouverte : menu désactivé sur feuille vide), ni des vignettes d'aperçu du Calendrier (aucune feuille avec traits).
- **Transcription** : aucun appel à Gemini (interdit) ; la fenêtre « Texte transcrit » (mode proposition) n'a pas été vue, lue dans le code.
- **Hors ligne / synchro Dexie** : statuts « Gardé sur ton téléphone… » non reproduits.
- **Banc** : le faux Supabase n'a pas de fixtures `feuilles_vidage` visibles dans `e2e/mock-supabase.mjs` (0 occurrence) mais a accepté l'ajout d'une note (toast « Texte ajouté à ta journée », texte relu à 19:11 dans la fenêtre) ; cette écriture est dans le mock, qui a depuis été remis à zéro. La route `/journal/[jour]` n'a pas pu être résolue par le script (aucune feuille avec vignette) ; ouverte à la main. Erreurs console `/_vercel/speed-insights/script.js` 404 et `ERR_ABORTED` sur des POST/RSC annulés par la navigation : bruit du banc, pas des bugs. Essais de sélecteurs ratés (rôle `radio` au lieu de `button` pour Stylo/Clavier) corrigés dans `scenarios/clavier-texte.json`.
- Critique impeccable : sautée, comme demandé.

## Résumé
- Journal cohérent et bien borné (feuille, Calendrier, texte du jour) ; vocabulaire conforme au GLOSSARY, rien de visible ne parle encore de « vidage ».
- Principal écart : le texte du jour, produit réel du module, est invisible sans passer par « … » (P1).
- Gestes à aligner : confirmation d'« Effacer la feuille » alors qu'annulable vs « Valider » irréversible sans confirmation (P3), bouton « Calendrier » doublé sur un jour passé (P2).
- Docs à corriger (PRODUCT sur la place de « Transcrire », GLOSSARY sur les gestes du Journal) : P5.
- Verrou biométrique, tracé au stylet et transcription Gemini non testés ; rapport : `/home/user/Kilio/reports/refonte-modules/journal.md`.
