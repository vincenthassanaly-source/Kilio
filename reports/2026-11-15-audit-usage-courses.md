# Audit d'usage — module Courses (2026-11-15)

Audit joué sur un build de production contre le faux Supabase local (`e2e/mock-supabase.mjs`, seed fictif `e2e/seed-audit/courses.mjs`). Aucune donnée réelle, aucun appel à la base réelle ni à Gemini. Sorties : `reports/audit/courses/` (`index.html`, `ecrans/`, `parcours/`, `scenarios/`).

> État du rapport : première version poussée tôt (quota instable). Les sections 4 et 5 sont complétées au fil de l'eau ; ce qui manque est écrit en clair.

## 1. Périmètre

**Route** : `/courses` (seul écran du module, plus son `loading.tsx`). Capturé au repos en mobile clair et sombre (`ecrans/courses.clair.png`, `ecrans/courses.sombre.png`).

**Seed fictif** : 16 articles « à prendre » répartis sur 9 rayons (dont un libellé de 95 caractères et des libellés hors dictionnaire) et 8 articles « pris » avec `termine_le` (dont un doublon, pour les suggestions d'habituels).

**Parcours joués** (7, une capture après chaque étape, 144 étapes, toutes réussies) :

| Parcours | Thème | Ce qu'il couvre |
|---|---|---|
| `01-ajout-multiple` | clair | carte d'ajout, 3 articles d'un coup avec virgule décimale (« 1,5 L de lait »), ajout simple enchaîné, « Fermer », rechargement |
| `02-cocher-decocher` | clair | cocher « pris », déplier « Articles pris », rechargement, décocher, double clic sur la coche |
| `03-supprimer-annuler` | clair | « Supprimer » + « Annuler » (réinsertion), rechargement, suppression sans annuler (toast expiré), rechargement |
| `04-supprimer-pris-sombre` | sombre | « Supprimer les articles pris » + « Annuler », rechargement, puis suppression définitive |
| `05-limites-sombre` | sombre | champ vide, séparateurs seuls, libellé > 100 caractères, 100 caractères sans espace, doublon (casse différente), suggestions d'habituels, remise dans la liste d'un article pris, double clic sur « Ajouter », retour arrière |
| `06-renommer` | clair | renommer, renommage vide, renommer vers un libellé déjà présent, Échap, rechargement |
| `07-liste-vide` | clair | état vide, ajout depuis le vide, mot de 100 caractères sans espace, « Tout est dans le chariot ! », retour à l'état vide |

**Écritures du faux Supabase** : toutes attendues et uniques (un `POST` par ajout avec `created_at` croissants, un `PATCH` par coche ou renommage, `DELETE` par id, réinsertion `POST on_conflict=id` à l'« Annuler »), sauf le double clic sur la coche (voir B3).

**Non testé** (le dire plutôt que le supposer) :
- base réelle, déclencheur `set_termine_le` et valeurs par défaut de la base (le faux Supabase ne les a pas) ;
- hors-ligne réel : la file Dexie (`src/lib/offline`) a été **lue**, pas exécutée (voir § 2, « Lecture du chemin hors-ligne ») ;
- « Envoyer aux Courses » depuis Nutrition › Menus (pas de table de menus dans le mock) : lu dans le code uniquement ;
- modale d'ajout du bouton rapide (FAB) hors `/courses`, recherche globale ;
- vibration, tirer pour rafraîchir, balayage entre onglets, clavier virtuel, zoom iOS au focus ;
- nettoyage automatique des articles pris (Réglages) ;
- aucune fonction IA dans ce module.

## 2. Problèmes

### Bugs

**B1 — Les articles envoyés par les Menus (« Nom, quantité ») tombent dans « Autres » — gravité moyenne, confiance haute**
- Écran : `/courses`, liste par rayon. Capture : `parcours/02-cocher-decocher/07-screenshot.png` et `parcours/04-supprimer-pris-sombre/04-screenshot.png` (« Blanc de poulet, 600 g » sous « Autres »).
- Attendu : « Blanc de poulet, 600 g » sous « Boucherie/Poisson/Traiteur » (le mot-clé `poulet` est dans le dictionnaire).
- Observé : rangé dans « Autres ».
- Cause : `classerParRayon` découpe le libellé normalisé sur les espaces seulement (`src/lib/courses/compute.ts:365`), donc le mot devient `poulet,` (virgule collée) et ne correspond plus au mot-clé entier (`compute.ts:372`). Or c'est exactement le format produit par `libellesCoursesDepuisMenu` : `` `${c.nom}, ${quantité}` `` (`src/lib/menus/compute.ts:133` et `:119`). Tout article venu d'un menu dont le mot-clé est le dernier mot du nom (« Poulet, 600 g », « Riz, 200 g », « Tomates, 4 ») est donc mal classé. Même effet pour toute ponctuation collée à la main (« lait. », « (pain) »).
- Limite de la preuve : reproduit avec un article saisi au format des Menus ; l'envoi depuis Menus lui-même n'a pas été exécuté (mock).

**B2 — « Œufs » (l'exemple donné par l'app) est rangé dans « Autres » — gravité basse à moyenne, confiance haute**
- Écran : `/courses`. Capture : `parcours/02-cocher-decocher/07-screenshot.png` (« Œufs » sous « Autres »), à rapprocher du placeholder « Ex. lait, œufs, pain » (`parcours/05-limites-sombre/25-screenshot.png`) et de l'état vide « lait, œufs, pain » (`parcours/07-liste-vide/04-expect_text.png`).
- Attendu : « Crémerie/Fromage » (mots-clés `oeuf`, `oeufs`).
- Observé : « Autres ».
- Cause : `cleDoublon` retire les accents par NFD (`compute.ts:48-55`), ce qui ne décompose pas la ligature `œ` : « Œufs » devient `œufs`, jamais `oeufs`. Le dictionnaire contient `bœuf` en double mais pas `œuf`/`œufs` (`compute.ts:292-298`). Conséquence voisine, non corrigée ici : « oeufs » et « œufs » ne sont pas vus comme doublons à l'ajout.

**B3 — Double tap sur la coche : deux écritures identiques et une coche qui saute — gravité basse, confiance moyenne**
- Étape : `02-cocher-decocher`, étapes 15 à 19 (`parcours/02-cocher-decocher/17-screenshot.png`).
- Attendu : un seul `PATCH` (le bouton est censé être désactivé pendant la mutation), ou deux `PATCH` opposés.
- Observé : deux `PATCH {"coche":true}` sur le même article. L'état final est cohérent (article pris, en base et à l'écran après rechargement).
- Cause probable : `disabled={toggleMutation.isPending}` (`CourseItemRow.tsx:248`) n'est appliqué qu'au rendu suivant, et `mutationFn` lit `!item.coche` de la fermeture (`CourseItemRow.tsx:61`) : le second clic part avec la même valeur, pendant que `onMutate` inverse une seconde fois le cache optimiste (`:80-82`). Reproduit avec un double clic synthétique (deux clics à quelques millisecondes) ; **non établi** pour un double tap humain (150 à 300 ms) : mesure à refaire, voir § 5.

### Design

Aucun défaut de rendu constaté : pas de débordement horizontal sur les 144 étapes, libellé de 95 caractères et mot de 100 caractères sans espace correctement repliés (`parcours/07-liste-vide/11-screenshot.png`, `19-screenshot.png`), clair et sombre cohérents, toasts lisibles. Les points discutables sont en § 3.

### Libellés

Aucune erreur de charte : « Ajouter », « Fermer », « Supprimer », « Annuler », « à prendre », « Articles pris », « Supprimer les articles pris » sont conformes à `GLOSSARY.md`. Le sous-titre de la carte d'ajout est maintenant « Un ou plusieurs articles, séparés par une virgule » (l'ancienne proposition P2 de `reports/refonte-modules/courses.md` est donc déjà appliquée).

### Artefacts du faux Supabase et du banc (pas des bugs)

- `GET /_vercel/speed-insights/script.js` 404 et erreur MIME associée : script Vercel absent hors Vercel.
- `GET /notes?_rsc=…`, `/nutrition?_rsc=…` `ERR_ABORTED` : préchargements de la barre du bas annulés par la navigation.
- `POST /courses` `ERR_ABORTED` après chaque écriture : requêtes d'action serveur interrompues par le rafraîchissement qui suit (`revalidatePath`) ; l'écriture est bien reçue par le faux Supabase à chaque fois (vérifié dans `/__writes`).
- `POST jours_feries` au premier chargement : écriture d'un autre module (agenda), hors périmètre.
- Barre du bas sans « Courses » (onglet « Plus » surligné) : préférences du mock, pas le défaut documenté dans `PRODUCT.md`.
- Le mock n'applique ni les valeurs par défaut (`coche`, `termine_le`) ni le déclencheur `set_termine_le` : un article coché pendant l'audit n'a pas de `termine_le`, donc l'ordre des suggestions d'habituels par récence n'est pas vérifiable ici.
- Le script du skill ne trouvait pas son Chromium (build 1194 attendu, 1243 installé) : j'ai lancé des copies des scripts avec `executablePath` depuis le scratchpad, dépôt inchangé.

### Lecture du chemin hors-ligne (code seulement, rien d'exécuté)

Lu : `src/lib/offline/{queue,flush-policy,useOnlineSync,db}.ts` et les replis `enqueueAction` de `AddCourseForm.tsx`, `CourseItemRow.tsx`, `ArchivedCoursesSection.tsx`, `undo.ts`. Constats de lecture, à confiance moyenne tant qu'ils ne sont pas rejoués :
- chaque mutation Courses force `networkMode: "always"` et met l'action en file sur erreur réseau ; les articles créés hors ligne (`temp-…`) ont leur coche, leur renommage et leur suppression désactivés (`CourseItemRow.tsx:37`, `:248`, `:281`, `:296`), ce qui évite de mettre en file une action irrécupérable ;
- une suppression mise en file hors ligne affiche quand même le toast « supprimé · Annuler » (`CourseItemRow.tsx:121`), et « Annuler » met alors en file une réinsertion : l'ordre de rejeu (suppression puis réinsertion) redonne bien l'article ;
- point à vérifier en vrai : après un ajout hors ligne, `onSettled` invalide la liste (`AddCourseForm.tsx:150-154`) alors que la coche hors ligne s'en garde explicitement (`CourseItemRow.tsx:89-91`). Si le réseau revient juste avant le rejeu, le refetch pourrait effacer un instant les articles `temp-…`. Non reproduit, non classé comme bug.

## 3. Propositions (pas de code)

**P1 — Renommer vers un libellé déjà présent crée un doublon silencieux.**
Constat : renommer « Courgettes » en « Tomates cerises » donne deux lignes « Tomates cerises » (`parcours/06-renommer/16-screenshot.png`), alors que l'ajout refuse le même cas avec « déjà dans la liste ». Options : (a) laisser (texte libre, cas rare) ; (b) refuser avec le même message que l'ajout ; (c) fusionner les deux lignes. Recommandation : (b), cohérent avec l'ajout, sans rouvrir le choix « article = texte libre ».

**P2 — « oeufs » et « œufs » ne sont pas reconnus comme le même article à l'ajout.**
Constat : la clé de dédoublonnage ne rapproche pas `œ` de `oe` (`compute.ts:48-55`). Options : (a) laisser ; (b) traiter `œ`/`æ` dans `cleDoublon`. Recommandation : (b), mais à décider à part car la clé sert aussi à l'envoi depuis les Menus (zone partagée).

**P3 — Couleur de la coche (violet du module au lieu du vert Kcal).**
Déjà relevé dans `reports/refonte-modules/courses.md` (B1/P1), toujours visible (`parcours/07-liste-vide/19-screenshot.png`). À reconsidérer seulement : `DESIGN.md` dit que les teintes de module ne remplacent pas le vert comme couleur interactive. Recommandation inchangée : trancher (aligner ou documenter l'exception).

**P4 — « Supprimer » répété sur chaque ligne.**
Constat : sur 16 lignes, la colonne de droite répète 16 fois « Supprimer » (`ecrans/courses.clair.png`) et pèse autant que les libellés. Choix assumé dans le code (libellé visible plutôt qu'icône muette, `CourseItemRow.tsx:298-302`). Options : (a) laisser ; (b) estomper davantage ; (c) icône avec nom accessible. Recommandation : (a) ou (b) ; ne pas passer à l'icône sans décision explicite.

**P5 — Position du toast « Annuler ».**
Constat : le toast se pose au-dessus de la barre du bas et recouvre une ligne de la liste (`parcours/04-supprimer-pris-sombre/07-screenshot.png`). Composant partagé. Recommandation : laisser, signalé pour mémoire.

**P6 — Le compteur ne dit rien des articles pris.**
Constat : « 16 articles à prendre » en tête, et les pris sont tout en bas d'une longue liste ; en magasin, on ne voit pas l'avancement sans défiler. Options : (a) laisser ; (b) « 3 pris sur 19 » à côté du compteur. Recommandation : (b) si l'avancement compte pour l'usage, sinon (a).

## 4. Critique impeccable

À venir (non lancée au moment de ce premier envoi).

## 5. Corrections

À venir. Prévu : une PR pour le classement par rayon (B1 et B2, même fonction `classerParRayon`), et une mesure du double tap humain avant de décider d'une PR pour B3.
