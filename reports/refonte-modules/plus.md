# Cohérence interne — module Plus et accès aux modules (lecture seule, 2026-11-14)

Sources : code `src/app/(app)/plus/*`, `src/components/{ModulesGrid,BottomNav,TabSwipeWrapper}.tsx`, `src/lib/navigation/*`, `src/app/actions/preferences-navigation.ts`, `QuickAddFab.tsx`, `GlobalSearchBar.tsx`, `actions/recherche.ts`, `public/manifest.json`, GLOSSARY / PRODUCT / DESIGN, rapports `2026-09-04-preferences-navigation`, `2026-09-25-audit-navigation`, `2026-10-27-lot-4-coherence-navigation`, `2026-09-06-fix-bottomnav-plus-active`. Captures et scénarios : `reports/audit/plus/` (`ecrans/`, `scenarios/`, `parcours/acces-modules/`, `parcours/custom/`, `parcours/entrees/`).

## Résumé
- Plus est une grille unique de 16 tuiles (tous les modules, même ceux déjà épinglés), réordonnable à l'appui long ; la mécanique est solide mais peu lisible : aucune tuile n'indique qu'elle est déjà dans la barre du bas, et l'indice ne dit pas comment épingler (glisser).
- Douze modules sur seize ne s'atteignent qu'en 2 taps via Plus (barre par défaut) ; Agenda, Habitudes, Musculation, Réglages, Pharmacie, Opinions, Collection, Documents, Scanner n'ont aucun lien depuis Aujourd'hui, et la recherche ne couvre que 5 domaines et n'existe que sur Aujourd'hui.
- Regroupements incohérents : Réglages au milieu de la grille (ordre enregistré), Documents et Scanner séparés, Revue loin d'Agenda ; retour de Revue vers Aujourd'hui alors que Réglages et Journal reviennent vers Plus.
- Défauts réels vus au banc : les tuiles sont annoncées « bouton, triable » alors que ce sont des liens (`role="button"`), et l'épinglage n'a aucune alternative au geste (ni clavier, ni menu).
- 9 propositions (P1 à P9), surtout S ; aucune ne remet en cause un choix documenté, deux le frôlent et sont signalées.

## Inventaire des écrans
| Route | Rôle |
|---|---|
| `/plus` (`page.tsx`, `ModulesGrid`, `PlusEditBar`) | Titre « Plus », indice « Appui long… », grille 2 colonnes de 16 tuiles (icône teintée, nom, description), bouton « Terminé » en mode édition. `loading.tsx` : squelette à `NAV_ITEMS.length` tuiles. |
| Barre du bas (`BottomNav`) | 4 emplacements configurables + « Plus » toujours dernier. Défaut `/`, `/courses`, `/nutrition`, `/taches` (`registry.ts:24`). Masquée sur `/musculation/seance` et `/journal` (feuille du jour), `immersif.ts:7`. Onglet « Plus » actif sur tout module non épinglé (`BottomNav.tsx:130`). |
| Swipe entre onglets (`TabSwipeWrapper`) | Suit l'ordre de la barre ; exclu au milieu de `/agenda`, `/journal`, `/nutrition` (`TabSwipeWrapper.tsx:21`, bande haute seulement). |
| Aujourd'hui (`/`) | Seuls liens sortants : « Créer une habitude » (état vide), carte Repas → `/nutrition/journal`, carte Revue (repliée sauf le jour de revue). FAB « + » : Repas, Courses, Tâche, Événement, Note. Barre « Rechercher dans Kilio… » et « Ajoute… ». |
| Recherche globale | Notes, Tâches, Événements, Recettes, Courses (`GlobalSearchBar.tsx:23`). Montée uniquement sur `/` (`(app)/page.tsx:67`). |
| Raccourcis d'icône PWA | Ajouter une tâche, Nouvel événement, Nouvelle note (`manifest.json`). |
| Hors `(app)` | `/collection/partage` (cible de partage Android), non traité ici. |

Tableau d'accès (taps depuis Aujourd'hui, barre par défaut ; le banc a une barre personnalisée `/`, `/agenda`, `/taches`, `/notes`, voir « non testé ») :
| Module | Barre | Plus | Autres entrées |
|---|---|---|---|
| Courses, Nutrition, Tâches | 1 | 2 (doublon) | FAB, recherche, carte Repas, Menus › « Voir » |
| Agenda | 2 | oui | recherche (événements), Revue (jours) ; aucun lien depuis la frise d'Aujourd'hui |
| Habitudes | 2 | oui | lien seulement si aucune habitude |
| Notes | 2 | oui | FAB « Note », raccourci PWA, recherche (renvoie à la liste, pas à la note) |
| Musculation | 2 | oui | la carte Séances ne mène qu'à `/musculation/seance` (séance en cours) |
| Pharmacie, Opinions, Collection, Documents, Scanner, Journal, Réglages | 2 | oui | Scanner › Documents, Collection partage › Documents ; sinon aucune |
| Revue | 2 | oui | carte Revue d'Aujourd'hui (1 tap le jour de revue, sinon déplier puis toucher = 2) |

## Constats

### Axe A — parcours et hiérarchie
- A1 (haute) Neuf modules n'ont qu'une porte, Plus : Agenda, Habitudes, Musculation, Pharmacie, Opinions, Collection, Documents, Scanner, Journal et Réglages. Aujourd'hui ne lie ni l'Agenda (la carte « Journée » est une frise sans lien), ni Habitudes (lien seulement en état vide, `DashboardHabitudesSection.tsx:36-41`), ni Musculation (`SeancesCard.tsx:138` mène à la séance en cours uniquement). Cohérent avec « Plus = tout le reste », mais Agenda et Habitudes sont les compagnons directs de l'écran du jour. Preuve : relevé des liens de `/` (`parcours/entrees/`, sortie console du script).
- A2 (moyenne) La recherche « Rechercher dans Kilio… » n'est que sur Aujourd'hui (absente de `/plus`, `/notes`, `/courses`, `/taches`, vérifié) et ne couvre que 5 domaines sur 16 ; Collection, Documents, Habitudes, Opinions, Pharmacie, Musculation n'y sont pas. Les résultats Notes et Courses mènent à la liste, pas à l'élément (`recherche.ts:92,134,156`). Le placeholder promet plus que la fonction.
- A3 (moyenne) Mode édition : l'indice dit « Appui long … pour la réorganiser ou l'épingler en barre du bas » (`plus/page.tsx:20`) mais pas qu'il faut glisser la tuile sur la barre ; une fois en édition l'indice ne change pas (capture `parcours/custom/03-mode-edition.png`). Un tap sur une tuile en édition ne fait rien, sans retour (`ModulesGrid.tsx:41`, vérifié : l'URL reste `/plus`).
- A4 (moyenne) Aucune tuile ne signale qu'elle est déjà épinglée : Aujourd'hui, Agenda, Tâches, Notes apparaissent à la fois dans la barre et dans la grille (capture `ecrans/plus.clair.png`). Le doublon est un choix documenté (`registry.ts` commentaire sur `NAV_ITEMS`, rapport 09-04 : ne jamais perdre l'accès) ; c'est l'absence de marqueur qui manque.
- A5 (basse) Retour inégal : Réglages et Journal ont « Retour vers Plus », Revue a « Retour vers Aujourd'hui » (`revue/page.tsx:41`) alors que Revue est aussi une tuile de Plus ; les autres racines n'ont aucun retour (elles s'appuient sur la barre). Relevé `parcours/custom` : `retour=[/plus]` pour Réglages, `[/]` pour Revue, `[]` pour Pharmacie, Musculation, Opinions, Documents, Scanner.
- A6 (basse) Ordre du balayage et ordre de la barre coïncident, mais Plus reste hors balayage et les trois écrans à swipe interne (`/agenda`, `/journal`, `/nutrition`) n'acceptent le balayage que dans la bande du haut ; non signalé à l'utilisateur (l'astuce de Réglages dit « Balayer l'écran », `reglages/page.tsx:117`).
- Vu conforme : onglet « Plus » actif sur tout module non épinglé (le correctif du rapport `2026-09-06-fix-bottomnav-plus-active` tient : `pharmacie`, `musculation`, `opinions`, `documents`, `scanner`, `revue`, `reglages`, `habitudes`, `nutrition` tous `aria-current` sur `/plus` au banc) ; accès en 2 taps uniforme ; sortie du mode édition par « Terminé », tap dehors et retour système (`NavigationEditContext.tsx:104-143`, « Terminé » disparaît après clic, vérifié).

### Axe B — vocabulaire et gestes
- B1 (haute, accessibilité) Chaque tuile est un `<a href>` auquel dnd-kit impose `role="button"` et `aria-roledescription="sortable"` (`ModulesGrid.tsx:52`, relevé DOM des 16 tuiles). Un lecteur d'écran annonce « Collection, bouton, triable » au lieu d'un lien ; mon scénario `role=link[name=/Collection/]` n'a d'ailleurs rien trouvé. Aucune alternative au geste (le capteur est `PointerSensor` seul, `NavigationEditContext.tsx:145`) : ni clavier ni menu pour épingler.
- B2 (basse) Le titre de l'écran ne reprend pas toujours l'étiquette de la tuile : « Aujourd'hui » devient « Bonjour/Bonsoir », « Nutrition » devient « Carnet alimentaire » (conforme au GLOSSARY pour le Carnet, mais l'onglet et la tuile disent Nutrition). Pas une erreur, à savoir.
- B3 (basse) Descriptions de tuiles de registre : tutoiement dans Aujourd'hui (« Ta journée »), Agenda (« de tes tâches »), Habitudes (« de tes habitudes »), neutre ailleurs (« Liste de courses », « Notes libres ») ; « Réglages : Profil, apparence et préférences » est inexact (le profil se réduit à une ligne statique ; l'écran porte surtout les rappels, voir `reglages.md` B1).
- B4 (basse) FAB : libellés visibles « Notes · Événement · Tâches · Courses · Repas » (capture `parcours/entrees/02-fab-ouvert.png`), mélange singulier/pluriel et substantifs, alors que les `aria-label` suivent la charte (« Ajouter une tâche… ») sauf « Courses » (`QuickAddFab.tsx:231`) ; écart déjà relevé B3 du rapport Courses, à traiter ensemble.
- B5 (basse) GLOSSARY : « Journal » et « Revue » sont correctement nommés dans les tuiles et leurs descriptions (« Écrire à la main pour poser la journée », « Bilan, retards et 7 prochains jours ») ; « Bilan » est réservé à Nutrition mais la description de la tuile Revue l'emploie en tête (« Bilan, retards… »), ce que le GLOSSARY déconseille (« Bilan : pour désigner la Revue »). À remplacer par « Tâches terminées, retards, 7 prochains jours ».
- Vu conforme : « Terminé », « Plus », « Appui long », « épingler en barre du bas » cohérents entre `plus/page.tsx`, `reglages/page.tsx:78,120` et les toasts d'échec (« Échec de l'épinglage, réessaie. »).

### Axe C — cohésion fonctionnelle
- C1 (moyenne) Grille en ordre libre, sans groupes : l'ordre enregistré place Réglages entre Habitudes et Pharmacie, et les modules ajoutés après (Pharmacie, Musculation, Opinions, Journal, Revue, Documents, Scanner) s'empilent à la fin (capture `parcours/custom/01-bas-de-grille.png`). Le rapport 09-25 avait déjà proposé de sortir Réglages du milieu et laissé la décision ouverte (ordre personnel en base).
- C2 (moyenne) Paires liées mais éloignées : Documents et Scanner (même teinte `--accent-documents`, `registry.ts:279,286` ; Scanner › Documents existe, Documents › Scanner non) ; Revue et Agenda (même teinte agenda) ; Journal (carnet du soir) et Revue (point de la semaine) sans lien entre eux.
- C3 (moyenne) Dédoublonnage de l'épinglage : déposer sur la barre un module déjà épinglé ailleurs produit localement un doublon (`NavigationEditContext.tsx:170` remplace sans échanger), puis la relecture serveur le remplace silencieusement par un autre module (`preferences.ts:36-47`). Lu dans le code, non reproduit : l'écriture aurait touché le faux Supabase partagé.
- C4 (basse) Aucune réinitialisation : une barre personnalisée ne se remet à `/`, `/courses`, `/nutrition`, `/taches` que par un nouveau glisser-déposer ; la ligne enregistrée peut contenir des entrées mortes (le banc, copie d'une ligne réelle, liste encore `/objectifs`, filtrée à la lecture, `preferences.ts:23-28`).
- C5 (basse) Réglages est une destination de contenu (tuile pinnable) et à la fois « système » ; on ne peut pas l'épingler utilement sans perdre un module quotidien. À trancher avec C1.
- C6 (basse) Un seul point d'entrée vers « Personnaliser la navigation » : Réglages › Préférences, qui renvoie à `/plus` (lien circulaire : Plus ⇄ Réglages, chacun disant à l'autre de partir). Voir `reglages.md` C3.

## Propositions

**P1 — Rendre les tuiles lisibles aux technologies d'assistance et épinglables sans geste**
- Changement : retirer `role="button"` / `aria-roledescription` des tuiles (garder le lien), et ajouter une action « Épingler en barre… » (menu ou feuille avec les 4 emplacements) déclenchée par le même mode édition ; ajouter `KeyboardSensor` si on garde dnd-kit.
- Effet : un lien annoncé comme lien ; l'épinglage possible au clavier et d'une main sans glisser sur 4 cibles.
- Effort M. Risque : moyen (gestes dnd-kit et clic en édition). Fichiers : `ModulesGrid.tsx`, `NavigationEditContext.tsx`, test e2e à ajouter. Dépendances : aucune ; sert P2 et P3.

**P2 — Dire quelles tuiles sont épinglées et comment épingler**
- Changement : petit marqueur « Barre du bas » sur les 4 tuiles épinglées ; en mode édition, remplacer l'indice par « Glisse une tuile sur la barre du bas pour l'épingler, ou entre les tuiles pour la déplacer ».
- Effet : doublon barre/grille compris d'un coup d'œil ; geste d'épinglage découvrable.
- Effort S. Risque : faible. Fichiers : `ModulesGrid.tsx`, `plus/page.tsx`, `PlusEditBar.tsx`. Dépendances : aucune.

**P3 — Mettre de l'ordre dans l'ordre par défaut, sans toucher à l'ordre perso**
- Changement : ordonner `NAV_ITEMS` par familles (au quotidien : Aujourd'hui, Agenda, Tâches, Habitudes, Nutrition, Courses, Musculation ; savoir et écrit : Notes, Journal, Revue, Pharmacie, Opinions ; fichiers : Collection, Documents, Scanner) et placer Réglages en dernier ; option plus nette : sortir Réglages de la grille (pastille engrenage dans l'en-tête de Plus, à droite de « Terminé »).
- Effet : paires liées voisines (Documents/Scanner, Journal/Revue) ; « système » séparé du contenu.
- Effort S (ordre) ou M (engrenage). Risque : l'ordre enregistré en base prime ; l'effet ne se verrait qu'après réinitialisation (voir P8). Signale le rapport 09-25 §3 (option 2, non tranchée). Fichiers : `registry.ts`, éventuellement `plus/page.tsx`, `reglages/page.tsx`. Dépendances : P8.

**P4 — Ajouter les portes manquantes depuis Aujourd'hui**
- Changement : lien « Agenda » dans l'en-tête de la carte Journée (frise), « Voir tout » dans l'en-tête de la carte Habitudes même non vide, « Routines et progression » dans la carte Séances.
- Effet : Agenda, Habitudes, Musculation à 1 tap depuis l'écran du jour, sans épingler ; Plus redevient le tiroir des modules rares.
- Effort S. Risque : faible (densité de l'écran du jour, voir PRODUCT.md:23 « se lit en trois secondes » ; liens discrets). Fichiers : `DayTimeline.tsx`, `DashboardHabitudesSection.tsx`, `SeancesCard.tsx`. Dépendances : aucune.

**P5 — Aligner la recherche sur sa promesse**
- Changement, au choix : (a) placeholder honnête (« Rechercher notes, tâches, recettes… ») ; (b) ajouter Collection, Documents, Habitudes aux sources ; (c) monter la barre de recherche aussi en tête de Plus. Dans tous les cas, faire pointer Notes et Courses vers l'élément (`/notes?…`).
- Effet : on trouve un module ou un contenu par son nom depuis un seul endroit.
- Effort S (a), M (b, c). Risque : moyen pour (b) (requêtes supplémentaires, coût Supabase). Fichiers : `GlobalSearchBar.tsx`, `actions/recherche.ts`, `plus/page.tsx`. Dépendances : aucune.

**P6 — Un retour cohérent pour Revue**
- Changement : Revue revient vers l'écran d'où l'on vient (Plus ou Aujourd'hui), par exemple `?from=plus` posé par la tuile ou `router.back()` ; sinon uniformiser sur « Retour vers Plus ».
- Effet : plus de rupture entre Réglages/Journal (vers Plus) et Revue (vers Aujourd'hui).
- Effort S. Risque : faible (BackLink et View Transition directionnelle). Fichiers : `revue/page.tsx`, `BackLink.tsx` éventuellement. Dépendances : aucune.

**P7 — Échanger au lieu de dupliquer à l'épinglage**
- Changement : si la tuile glissée est déjà dans la barre, échanger les deux emplacements ; sinon remplacer comme aujourd'hui.
- Effet : plus jamais de doublon local puis de remplacement muet à la relecture.
- Effort S. Risque : faible ; ajouter un test dans `preferences.test.ts` / e2e. Fichiers : `NavigationEditContext.tsx:166-176`. Dépendances : aucune.

**P8 — Réinitialiser la navigation et purger la ligne**
- Changement : bouton « Rétablir l'ordre d'origine » (barre + grille) dans « Personnaliser la navigation » et nettoyage des hrefs morts à l'écriture.
- Effet : retour à un état connu après une expérimentation ; permet de rendre effectif P3.
- Effort S. Risque : faible (écriture de `preferences_navigation`). Fichiers : `actions/preferences-navigation.ts`, `reglages/page.tsx`, `NavigationEditContext.tsx`. Dépendances : place de la ligne dans `reglages.md` (P1/P2).

**P9 — Relier Documents et Scanner dans les deux sens, et réécrire quelques descriptions**
- Changement : action « Numériser » dans l'ajout de Documents ; descriptions de tuile sans tutoiement ni « Bilan » (B3, B5), et « Réglages : Rappels et apparence ».
- Effet : le flux « papier → PDF → Documents » démarre où on le cherche ; vocabulaire de la charte respecté.
- Effort S. Risque : faible ; PRODUCT.md décrit Scanner comme « entrée du menu Plus », la tuile reste. Fichiers : `documents/AddDocumentToggle.tsx`, `registry.ts`. Dépendances : aucune.

## Pistes inter-modules
- Réglages ⇄ Plus : « Personnaliser la navigation » devrait vivre à un seul endroit (voir `reglages.md` P1).
- Courses : le FAB l'appelle « Courses » (substantif) ; harmoniser avec la correction B3 du rapport `courses.md`.
- Aujourd'hui : P4 touche trois cartes de l'écran du jour ; à coordonner avec la refonte de ce module.
- Recherche : couvre Recettes (Nutrition) mais pas Aliments ni Menus ; à coordonner avec Nutrition.
- Journal et Revue : les rappels (Réglages) renvoient à « Plus › Journal » et « depuis Plus » (`VidageRow.tsx:79`, `RevueHebdoRow.tsx:80`) : si P4 ajoute des portes, ces phrases devront suivre.

## Ce qui n'a pas pu être testé
- Glisser-déposer réel sur la barre du bas (épinglage, échange, doublon, C3) : il écrit `preferences_navigation` du faux Supabase du banc partagé, que je n'ai ni modifié ni réinitialisé ; seul l'appui long (maintien souris 700 ms), le tap en édition, « Terminé » et le retour ont été joués. Le geste tactile fin et le S Pen restent à valider sur téléphone.
- La barre du banc (`/`, `/agenda`, `/taches`, `/notes`) vient d'une fixture copiée de la ligne réelle du 2026-09-24 : elle diffère du défaut documenté (PRODUCT.md:23) et l'état actuel de la vraie barre de Vincent est inconnu (base réelle interdite). Les tableaux de taps supposent le défaut.
- Raccourcis d'icône PWA et cible de partage : lus dans `manifest.json`, non joués (nécessitent l'app installée).
- Éléments du banc : le script `/_vercel/speed-insights/script.js` renvoie 404 et les `_rsc` annulés par la navigation apparaissent comme « requêtes échouées » ; ce sont des artefacts, pas des défauts.
- Lecteur d'écran réel pour B1 (conclu sur le DOM). Ressenti d'usage : jugement.
- Sous-pages des modules (Musculation › routines/stats, Nutrition › sous-onglets) : leur accessibilité depuis leur racine n'a pas été auditée ici.

## Résumé final
- Plus fonctionne et son accès est uniforme (2 taps), mais seule la barre et un geste caché l'organisent : pas de marqueur d'épinglage, pas de groupes, pas de réinitialisation.
- Plusieurs modules du quotidien (Agenda, Habitudes, Musculation) n'ont aucune porte depuis Aujourd'hui ; la recherche promet « Kilio » et couvre 5 domaines sur 16, seulement sur Aujourd'hui.
- À corriger en priorité : rôle `button` des tuiles et épinglage sans geste (P1), marqueurs et consigne d'épinglage (P2), portes depuis Aujourd'hui (P4), échange à l'épinglage (P7).
- Incohérences mineures : retour de Revue, descriptions tutoyées, « Bilan » dans la tuile Revue, libellés du FAB.
- Rapports : `/home/user/Kilio/reports/refonte-modules/plus.md` et `/home/user/Kilio/reports/refonte-modules/reglages.md`.
