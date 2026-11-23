# Audit Scanner vs CamScanner, partie 1 : viseur en direct et détection des bords

Audit seul, 2026-11-23 : aucun fichier de code n'a été modifié. Fichiers lus : `Viseur.tsx`, `suivi.ts`, `detection.ts`, `opencvScan.ts`, `extension.ts`, `affinage.ts`, `capture.ts`, `opencv.ts`, `traitement.ts`, `EditeurCoins.tsx` (le passage où la détection est appelée), `public/sw.js`. Contexte lu : `AGENTS.md`, `PRODUCT.md` (Scanner), `reports/refonte-modules/scanner.md`, `reports/2026-11-12-audit-design-scanner.md`. Aucun des deux rapports n'avait lu ni mesuré les algorithmes de détection.

Légende : **[M]** mesuré ici (chiffres reproductibles, scripts cités à la fin), **[C]** lu dans le code (fichier:ligne), **[S]** supposition à confirmer sur un vrai téléphone.

## Résumé

- **Le viseur se dégrade surtout dans les premières secondes, avant qu'OpenCV soit prêt.** Pendant ce temps, la détection maison tourne à 180 px. Sur une feuille posée sur une table claire, dans Chromium avec une fausse caméra, elle propose un cadre **faux 9 fois sur 10** (10/105 détections justes), mais affiche quand même « Feuille repérée » [M]. Au premier usage en 4G (12 Mbit/s), OpenCV met **7,6 s** à être prêt, et **8,7 s** avec le processeur ralenti ×4 [M].
- **Une fois OpenCV prêt, le cadre est juste et stable sur les scènes simples** : 100 % de détections justes, 7,5 détections/s sur ordinateur, 5,5/s avec le processeur ralenti ×4 [M]. Les écarts avec CamScanner restent : cadre en retard (≈ 200 ms de retard mesuré, plus 140 ms de transition CSS), léger tremblement à l'arrêt (5 à 11 px sur 1280×720), pas de capture automatique, peu de consignes à l'écran, et des gels du fil principal jusqu'à **591 ms** pendant l'initialisation d'OpenCV [M].
- **La détection des bords sur la photo est parfois moins bonne que celle du viseur.** Le recadrage refait une détection depuis zéro, sans repartir du cadre vu en direct. L'étape « extension » (`extension.ts`) fait passer une feuille blanche sur table blanche de 0,4 % à **23,8 %** d'erreur, alors que le viseur OpenCV la trouvait à 0,7 % [M].
- **Cas qui échouent partout** sur les scènes synthétiques : reflet fort sur un bord, feuille posée sur un cahier plus grand. Le viseur OpenCV n'affiche aucun cadre quand la page dépasse du champ [M]. CamScanner annonce une détection des bords par IA [source 1].
- **Priorités** : (1) précharger OpenCV plus tôt et ne plus afficher de cadre maison non confirmé, (2) passer la détection en direct dans un Worker, (3) ajouter la capture automatique sur cadre stable, avec un cadre animé, (4) donner le cadre du viseur au recadrage et encadrer `extension.ts`. Un modèle d'apprentissage profond est la seule piste pour les reflets et les fonds chargés, mais son coût est élevé (L).

## 1. Comment fonctionne le viseur aujourd'hui [C]

| Élément | Valeur | Source |
|---|---|---|
| Flux demandé | `facingMode: environment`, 1920×1080 « ideal » ; ni mise au point continue, ni lampe, ni zoom | `Viseur.tsx:78-81` |
| Boucle | séquentielle : détection, puis `setTimeout(120 ms)`, sur le fil principal (pas de Worker, pas de `requestVideoFrameCallback`) | `Viseur.tsx:12,113-139` |
| Réduction de l'image | `drawImage(video → canvas w×h)` direct, puis `getImageData` ; un nouveau canvas à chaque image | `traitement.ts:134-141` |
| Taille analysée sans OpenCV | 180 px sur le grand côté (soit **101×180** pour un flux portrait 1080×1920) ; détecteur maison `detecterQuadrilatere` | `Viseur.tsx:13`, `traitement.ts:145` |
| Taille analysée avec OpenCV | 360 px ; `detecterDocumentCv` à une seule échelle (le vote multi-échelles est réservé à la photo) | `traitement.ts:82,135,145` |
| Lissage | moyenne exponentielle α = 0,45 si l'écart est ≤ 6 % de la diagonale ; un saut plus grand doit être vu 2 fois ; cadre gardé 3 images après une perte | `suivi.ts:24-30` |
| Rendu du cadre | tracé SVG vert, transition CSS de la propriété `d` en 140 ms linéaire (Chrome seulement, le commentaire le dit ; ailleurs le cadre saute) | `Viseur.tsx:190-200` |
| Retour à l'utilisateur | pastille « Feuille repérée » / « Cherche la feuille… », éclair blanc à la prise | `Viseur.tsx:226-234` |
| Capture | bouton seul, sans capture automatique ; `takePhoto()` en pleine résolution si possible (Chrome Android), sinon image du flux | `capture.ts`, `Viseur.tsx:148-170` |
| OpenCV | ~10 Mo (`opencv.js`, WASM embarqué en base64), injecté **à l'ouverture du viseur seulement** ; mis en cache (cache-first) par le service worker après le premier chargement ; délai maximal 45 s | `Viseur.tsx:63-66`, `opencv.ts:10-12`, `sw.js:293-297` |
| Recadrage d'une photo | `detecterFeuilleAuto` : **attend `chargerOpenCv()`** (jusqu'à 45 s au premier usage), puis vote OpenCV sur 4 échelles plus la détection maison, puis extension, puis affinage. Le cadre vu dans le viseur n'est pas transmis | `traitement.ts:100-116`, `EditeurCoins.tsx:85`, `ScannerApp.tsx:263` |

## 2. Mesures

### 2.1 Tests du dépôt [M]

`npx vitest run src/lib/scanner` : **20 fichiers, 183 tests, tous au vert** (10,7 s). Les deux bancs passent :
- `detection.banc.test.ts` (maison, 240 px) : erreur maximale d'un coin de 0,06 % à 0,53 % de la diagonale sur les 12 scènes, plus 0,25 % sur le cas limite.
- `opencvScan.banc.test.ts` (OpenCV, 480 px) : de 0,19 % à 0,51 %, sauf « carte devant un bord de table » à **2,62 %**, juste sous le seuil de 3 %.

Limite : ces bancs ne testent ni les tailles du direct (180 et 360 px), ni le format 16:9, ni les reflets, les fonds chargés ou les documents partiels.

### 2.2 Banc complémentaire en Node : tailles du direct et scènes difficiles [M]

Mêmes scènes synthétiques (640×480), plus 13 scènes difficiles construites pour cet audit. Le tableau donne l'erreur maximale d'un coin en % de la diagonale (« ok » sous 3 %), puis le temps sur un cœur en Node. La vérité d'un document partiel est rognée au champ, donc approximative.

| Scène | Direct maison 180 px | Direct OpenCV 360 px | Photo (chaîne complète) |
|---|---|---|---|
| 13 scènes du banc existant | 13/13 ok | 13/13 ok | 13/13 ok |
| reflet sur le bord droit | 0,2 % ok | 0,2 % ok | 0,3 % ok |
| **reflet fort (lampe) bord haut** | 13,3 % KO | 8,4 % KO | 13,2 % KO |
| fond chargé (objets autour) | 0,2 % ok | 0,4 % ok | 0,2 % ok |
| **feuille sur un cahier plus grand** | 11,4 % KO | 11,3 % KO | 11,3 % KO (choisit le cahier) |
| nappe à carreaux | **23,7 % KO** | 0,5 % ok | **24,0 % KO** |
| lames de parquet (lignes fortes) | 7,1 % KO | 0,5 % ok | 0,2 % ok |
| blanc sur blanc | 5,4 % KO | 0,7 % ok | **25,5 % KO** |
| faible lumière, bruit fort | 0,2 % ok | 0,4 % ok | 0,4 % ok |
| flou de bougé (9 px) | 0,1 % ok | 0,4 % ok | 0,5 % ok |
| doigt sur le bord bas | 0,2 % ok | 0,2 % ok | 0,2 % ok |
| document partiel (coin hors champ) | 16,7 % KO | 0,3 % ok | 4,9 % KO |
| **page plus haute que le champ** | 10,0 % KO | **aucun cadre** | 0,3 % ok |
| petite feuille lointaine (15 % du champ) | 1,0 % ok | 0,3 % ok | 0,1 % ok |
| **Total sous 3 %** | **19/26** | **23/26** | **21/26** |
| Temps médian / max | 15 / 72 ms | 8 / 22 ms | 50 à 130 ms |

Ce que montre le tableau :
1. OpenCV à 360 px est le meilleur détecteur pour le direct, et il est aussi le moins cher.
2. La chaîne complète de la photo fait **moins bien** que le direct OpenCV sur trois scènes (nappe, blanc sur blanc, coin hors champ). En décomposant les étapes sur « blanc sur blanc » : maison 240 px 0,3 % → vote OpenCV 0,4 % → **après `extension.ts` 23,8 %** → après `affinage.ts` 25,5 %. L'extension pousse les côtés dans un fond aussi clair que le papier : les tolérances sont de 0,9 en luminance et 32 en couleur (`extension.ts:26-28`).
3. Le détecteur maison dépend beaucoup de la taille de l'image : en 16:9 portrait, sur grain de bois, il passe de 0,24 % à 180 px à **16,5 % à 360 px**, et en blanc sur blanc de 0,5 % à 20,2 %. OpenCV reste entre 0,3 % et 1 % à toutes les tailles (180, 240, 360, 480 px), en 2 à 12 ms.
4. Sur une photo de 3000×2250 px, `detecterFeuilleAuto` prend ≈ 0,6 s en Node, dont 0,51 à 0,6 s pour le vote OpenCV sur 4 échelles. Sur téléphone, compter ≈ ×3 à ×5 [S].

### 2.3 Viseur rejoué dans Chromium avec une fausse caméra [M]

Méthode : une vidéo synthétique de 10 s en 1280×720 à 15 i/s, fichier `.y4m` passé à `--use-file-for-fake-video-capture`. Un code binaire incrusté donne la vérité image par image. Le scénario : 3 s immobile, 3 s de balayage lent (220 px et 6°), 2 s de main qui tremble (±5 px), 2 s immobile. Deux fonds : sombre et table claire. La boucle de `Viseur.tsx` est reproduite à l'identique : `detecterDepuisVideo(video, 180)`, puis `suivreCadre`, puis 120 ms de pause, avec le vrai chargeur `opencv.ts`. Le réseau et le processeur sont ralentis par CDP. Une détection est « juste » si l'erreur moyenne des coins est sous 1,5 % de la diagonale.

| Scénario | OpenCV prêt à | Détections/s | Détection (médiane / p95) | Justes sans OpenCV | Justes avec OpenCV | Plus longue tâche bloquante |
|---|---|---|---|---|---|---|
| Fond sombre, local | 0,50 s | 7,5 | 9 / 17 ms | 2/2 | 101/101 | 112 ms |
| Table claire, local | 0,39 s | 7,6 | 9 / 15 ms | 0/2 | 103/103 | 89 ms |
| Table claire, 4G 12 Mbit/s | **7,6 s** | 7,3 | 11 / 25 ms (maison) | **7/53 (cadre affiché faux 51/53)** | 48/48 | 131 ms |
| Table claire, 4G + processeur ×4 | **8,7 s** | 5,5 | 59 / 94 ms (maison), 43 / 67 ms (OpenCV) | 4/39 | 30/30 | **493 ms** |
| Fond sombre, processeur ×4 (comme une visite déjà en cache) | **1,9 s** | 5,7 | 43 / 77 ms | 3/3 | 68/68 | **591 ms** |
| Table claire, sans OpenCV | – | 7,5 | 10 / 16 ms | **10/105** | – | – |

Sur le seul suivi du cadre, avec OpenCV :
- **À l'arrêt**, le cadre tremble de **0,33 %** de la diagonale entre deux images, soit ≈ 5 px sur 1280×720. Avec le processeur ×4, c'est 0,55 à 0,77 %, soit 8 à 11 px. Ce tremblement correspond à peu près à un pixel d'analyse (1 px à 360 px = 3,6 px vidéo).
- **Pendant le balayage lent** (73 px/s), le cadre a une erreur moyenne de 0,8 à 1,1 % et un **retard médian de 200 ms** (p95 267 ms avec le processeur ×4), auquel s'ajoute la transition CSS de 140 ms.
- **Après un déplacement franc** de 30 px, le cadre affiché converge en 3 détections, soit ≈ 400 à 550 ms (banc Node).
- **Perte de détection** : le cadre est gardé 4 images, soit ≈ 0,5 à 0,7 s avant de disparaître [C, `suivi.ts:28`].
- **Sur le fond clair sans OpenCV**, l'erreur maximale d'un coin a une médiane de 5,7 % (p90 12,8 %) : le côté haut s'accroche à une ligne de texte. La pastille affiche pourtant « Feuille repérée », car `suivi.ts` adopte tout de suite le premier cadre (`suivi.ts:53`).

Pourquoi le détecteur maison échoue dans le navigateur alors qu'il réussit en Node [M] : sur 5 images extraites de la vidéo, réduites à 180×101, la réduction par moyenne de blocs (`reduirePourDetection`) donne 3,4 / 0,3 / 5,7 / 0,3 / 3,2 %. Une réduction bilinéaire sans préfiltre, comme `drawImage` [S], donne 4,7 / 0,5 / 5,5 / **14,0 / 11,3 %**. Deux causes s'additionnent : la résolution est trop faible (une feuille fait ~57×76 px d'analyse) et le sous-échantillonnage produit du repliement.

Limites du protocole : processeur de conteneur ralenti ×4, pas un vrai téléphone ; scènes synthétiques, sans vrai capteur, autofocus, compression ni reflets réels ; flux à 15 i/s ; `takePhoto` non testé. Les chiffres valent comme ordres de grandeur et comme comparaisons A/B.

## 3. Écart avec CamScanner, et causes probables

Côté CamScanner : l'application annonce une détection automatique des bords par IA, avec redressement de perspective [source 1], et propose une capture automatique (dont une variante « tourner la page » en mode livre) [source 2]. Le moteur exact n'est pas public. L'approche connue la plus proche est celle de Dropbox : un réseau de neurones détecte les contours, puis une transformée de Hough en tire les droites, en natif et en temps réel [source 3]. L'application native traite chaque image du flux à 15-30 i/s ou plus, avec mise au point et exposition gérées par le système [S].

| Écart ressenti | Cause probable dans Kilio | Statut |
|---|---|---|
| Cadre faux ou hésitant à l'ouverture | Détecteur maison à 180 px sur un `drawImage` direct ; OpenCV pas encore prêt (0,4 à 1,9 s par session, 7,6 à 8,7 s au premier usage en 4G) ; préchargement lancé seulement à l'ouverture du viseur ; premier cadre adopté sans confirmation | [M] + [C] |
| Le viseur « rame », la page se fige par moments | Détection sur le fil principal (43 à 59 ms par image avec le processeur ×4) ; initialisation d'OpenCV en une seule tâche bloquante (jusqu'à 591 ms) ; pause fixe de 120 ms, donc 5,5 à 7,5 détections/s au mieux | [M] |
| Cadre qui traîne derrière le document | Lissage exponentiel fixe (α 0,45) et transition CSS de 140 ms : ≈ 200 ms de retard plus 140 ms | [M] |
| Cadre qui frétille à l'arrêt | Résolution d'analyse de 360 px (1 px ≈ 3,6 à 5,3 px vidéo) et aucune zone morte dans `suivi.ts` | [M] |
| Sur Safari / iPhone, le cadre saute d'une position à l'autre | La transition sur la propriété CSS `d` ne fonctionne que dans Chrome (commentaire `Viseur.tsx:193-194`) | [C] ; support Safari [S] |
| Pas de cadre quand on scanne de près | `coinsAuBord >= 3` écarté (`opencvScan.ts:136`) ; aucune détection « page plus grande que le champ » en direct | [M] |
| Reflets et fonds chargés | Méthodes classiques (contours de Canny, seuil d'Otsu, droites de Hough) : un reflet efface le contour, un cahier offre un rectangle plus grand et plus net | [M] |
| « Le viseur l'avait trouvée, le recadrage non » | La photo est re-détectée sans le cadre du viseur ; `extension.ts` déborde sur un fond clair ; la photo plein capteur (4:3) n'a pas le cadrage du flux (16:9) | [M] + [C] |
| Recadrage lent la première fois | `detecterFeuilleAuto` attend OpenCV, jusqu'à 45 s (`traitement.ts:106`, `opencv.ts:12`) | [C] |
| Il faut viser puis appuyer | Pas de capture automatique ni de consignes (« rapproche-toi », « ne bouge plus », « plus de lumière »), pas de lampe | [C] |

## 4. Recommandations

Elles sont classées par rapport gain/effort. Aucune ne demande de stocker des données en ligne (règle du module).

### R1. Précharger OpenCV plus tôt et ne plus montrer de cadre maison non confirmé
- **Quoi** :
  - Appeler `prechargerOpenCv()` au montage de `ScannerApp` (dès l'ouverture de `/scanner`), et même pendant un temps libre (`requestIdleCallback`) après une première visite.
  - Avant qu'OpenCV soit prêt, analyser à 240 px avec une réduction par blocs (`reduirePourDetection`) plutôt qu'un `drawImage` direct à 180 px, ou demander `imageSmoothingQuality = "high"`.
  - En mode maison, n'afficher le cadre qu'après 2 détections concordantes, et afficher « Préparation de la détection… » plutôt que « Feuille repérée ».
- **Gain** : élevé pour la première impression. Les 7,6 s de détection fausse à 90 % deviennent un état neutre honnête, et OpenCV est souvent prêt avant l'ouverture du viseur.
- **Effort** : S. **Risque** : faible, au prix de quelques Mo téléchargés même sans scan au premier passage sur `/scanner`.
- **Dépendances** : aucune.

### R2. Passer la détection en direct dans un Worker
- **Quoi** :
  - `createImageBitmap(video)` ou `VideoFrame`, transféré à un Worker dédié qui charge OpenCV (`importScripts`) et fait la réduction (`OffscreenCanvas`) et la détection.
  - Cadencer avec `requestVideoFrameCallback` plutôt qu'une pause fixe, sans jamais avoir plus d'une image en vol.
- **Gain** : élevé. Plus de gel du fil principal (jusqu'à 591 ms mesurés) pendant l'initialisation, détection à 10-15 i/s possible, interface fluide pendant le chargement.
- **Effort** : M. **Risque** : moyen. Il faut gérer la mémoire d'OpenCV dans le Worker, prévoir un repli si `OffscreenCanvas` manque (Safari ancien [S]) et garder le chemin synchrone pour les tests.
- **Dépendances** : aucune (`comlink` en option).

### R3. Capture automatique sur cadre stable, avec un cadre animé
- **Quoi** :
  - Une fonction pure `stabilite(etatSuivi, historique)`, à placer dans `suivi.ts` ou un nouveau `autoCapture.ts`. Elle déclenche quand l'écart moyen des coins reste sous ~0,5 % de la diagonale pendant ~0,8 s, avec une aire au-dessus de ~15 % et une netteté suffisante (variance du laplacien, déjà calculable avec `cv`).
  - Le cadre passe de blanc (« cherche ») à vert (« verrouillé »), un anneau de compte à rebours s'affiche, puis la prise part, avec une vibration courte.
  - Un interrupteur « Auto » dans le viseur.
- **Gain** : élevé. C'est le geste qui distingue CamScanner, déjà proposé par l'audit design du 12-11 (point « Viseur plus rapide »).
- **Effort** : M. **Risque** : moyen (prises non voulues). Prévoir un seuil prudent, un délai de garde après chaque prise et le respect de `prefers-reduced-motion`.
- **Dépendances** : aucune. Elle profite de R2 (une cadence plus haute rend la stabilité plus fiable) et de R6.

### R4. Donner le cadre du viseur au recadrage et encadrer l'extension
- **Quoi** :
  - `onCapture(image, quadVu)`. Le cadre est ramené au repère de la photo : même rapport si c'est l'image du flux ; correction du champ si `takePhoto` renvoie du 4:3, à mesurer [S].
  - Ce cadre sert de candidat dans `consensusQuads` et de repli si la photo ne donne rien.
  - Dans `extension.ts`, une extension n'est gardée que si le nouveau côté s'appuie sur un contour : réutiliser `appuiSurContours` ou le test de `affinage.ts`. Sinon on garde le cadre d'origine.
  - Ajouter « blanc sur blanc » et « nappe à carreaux » au banc.
- **Gain** : élevé pour la détection des bords. « Blanc sur blanc » passe de 25,5 % à ~0,5 %, et les trois régressions photo du tableau 2.2 sont visées. Le cadre vu en direct ne disparaît plus au recadrage.
- **Effort** : S à M. **Risque** : moyen. L'extension a été ajoutée pour les pages qui débordent : il faut rejouer tout `extension.test.ts` et `affinage.test.ts`.
- **Dépendances** : aucune.

### R5. Ne pas faire attendre le recadrage après OpenCV
- **Quoi** : dans `detecterCoins` (`traitement.ts:104-116`), mettre en course `chargerOpenCv()` et un délai de ~1,5 s. Après ce délai, afficher le cadre maison, puis le remplacer si OpenCV arrive et trouve mieux (sans toucher à un cadre que l'utilisateur a déjà déplacé).
- **Gain** : moyen au premier usage, quand l'attente peut aller jusqu'à 45 s en réseau lent.
- **Effort** : S. **Risque** : faible.
- **Dépendances** : aucune.

### R6. Un lissage adaptatif et un rendu animé hors CSS
- **Quoi** :
  - Remplacer la moyenne exponentielle fixe par un filtre adaptatif (type « One Euro » : peu de lissage quand ça bouge, beaucoup à l'arrêt), avec une zone morte d'environ 1 px d'analyse.
  - Animer le tracé par `requestAnimationFrame`, avec interpolation et extrapolation courte, plutôt que la transition CSS `d` (Chrome seulement).
- **Gain** : moyen. Tremblement à l'arrêt visé : moins de 0,1 % (contre 0,33 à 0,77 %) ; retard en mouvement réduit de 340 ms à ~150 ms [S] ; même rendu sur iPhone.
- **Effort** : S. **Risque** : faible (fonction pure, testable comme `suivi.test.ts`).
- **Dépendances** : aucune.

### R7. Accepter une page qui dépasse du champ en direct
- **Quoi** : en direct, ne plus rejeter d'office un cadre dont 3 ou 4 coins touchent le bord (`opencvScan.ts:136`) quand les côtés intérieurs s'appuient sur des contours. Poser les côtés coupés sur le bord du champ, comme `affinage.ts` le fait déjà pour la photo, et afficher la consigne « Recule un peu ».
- **Gain** : moyen (scan de près, cas fréquent).
- **Effort** : S à M. **Risque** : moyen (faux cadre égal au champ entier). À garder sous la condition d'appui des côtés.
- **Dépendances** : aucune.

### R8. Davantage de retours à l'écran et de commandes caméra
- **Quoi** :
  - Consignes d'après l'état mesuré : aire trop petite (« Rapproche-toi »), mouvement (« Ne bouge plus »), luminance moyenne basse (« Plus de lumière »).
  - Bouton lampe, avec `applyConstraints({ advanced: [{ torch: true }] })` quand `getCapabilities().torch` le permet.
  - `focusMode: "continuous"` si disponible, et toucher pour mettre au point (`pointsOfInterest`) [S selon l'appareil].
  - Analyse à 480 px avec OpenCV quand le Worker existe : 12 ms contre 7 ms en Node, pour des coins plus fins.
- **Gain** : moyen. **Effort** : S. **Risque** : faible (fonctions détectées avant usage, repli silencieux).
- **Dépendances** : aucune.

### R9. Réduire le coût d'OpenCV (téléchargement et compilation)
- **Quoi** : construire une version d'OpenCV.js réduite aux modules `core` et `imgproc`, avec le `.wasm` en fichier séparé (plutôt qu'en base64 dans le JS), chargé par `WebAssembly.instantiateStreaming`. Visé : environ 2 à 4 Mo au lieu de 10,4 Mo, avec une compilation en flux qui ne bloque pas le fil principal [S].
- **Gain** : moyen à élevé au premier usage, et moyen à chaque session (0,4 à 1,9 s mesurées avant d'être prêt).
- **Effort** : M. Une chaîne Emscripten est nécessaire, en développement seulement. Le binaire construit est versionné ou produit en CI.
- **Risque** : moyen (maintenance de la version construite, fonctions manquantes).
- **Dépendances** : outil de build Emscripten (développement), plus de `@techstark/opencv-js` à terme.

### R10. Un modèle d'apprentissage profond pour les bords (piste longue)
- **Quoi** : un petit réseau qui produit une carte de contours ou de segmentation du document (dans l'esprit de HED, ou MobileNet + décodeur léger, de 1 à 5 Mo), en entrée 256 px, exécuté en WebGPU/WebGL. Il est suivi de l'étape de quadrilatère existante (droites de Hough ou `approxPolyDP`), comme chez Dropbox [source 3].
- **Gain** : élevé sur les cas qui échouent partout : reflet fort, document sur un autre papier, fond très chargé, très faible contraste. C'est l'écart de fond avec CamScanner [source 1].
- **Effort** : L. Il faut des données (photos annotées), un entraînement ou un modèle ouvert sous licence compatible, la conversion, et des mesures sur téléphone.
- **Risque** : élevé (poids à télécharger, autonomie, inférence sur les téléphones sans WebGPU, licence du modèle).
- **Dépendances** : `onnxruntime-web` ou `@tensorflow/tfjs` (avec son backend WebGL/WebGPU), plus le fichier du modèle dans `public/vendor/`, mis en cache par le service worker comme OpenCV.
- **Alternative hors web** : l'outil de scan de documents de Google ML Kit, natif Android, accessible seulement via une enveloppe native. Il sort du cadre PWA actuel.

### Ordre conseillé
R1, R5 et R6 (S, rapides) → R4 (qualité des bords) → R2 puis R3 (fluidité et capture automatique) → R7 et R8 → R9 → R10 si l'écart reste net sur de vraies photos.

## 5. Ce qui n'a pas été vérifié

- Aucune mesure sur un vrai téléphone ni avec un vrai capteur (autofocus, exposition, compression, reflets réels). Le ralentissement ×4 du processeur est une approximation.
- `takePhoto()` et le rapport entre la photo et le flux n'ont pas été mesurés.
- Le rendu de la transition CSS `d` sur Safari iOS est déduit du commentaire du code, pas testé.
- La qualité de `drawImage` lors d'une forte réduction est simulée en Node (bilinéaire sans préfiltre) ; à confirmer en comparant les pixels dans Chrome Android.
- Aucune comparaison côte à côte avec CamScanner sur les mêmes scènes : les capacités de CamScanner citées viennent de ses pages publiques.

## Sources

1. CamScanner, page d'accueil : « AI automatically detects edges, corrects perspective… » — https://www.camscanner.com/
2. CamScanner, blog, 2025-11-10, « Turn Page to Auto Capture » — https://blog.camscanner.com/2025/11/10/camscanner-introduces-turn-page-to-auto-capturefeature-for-effortless-document-digitization/
3. Dropbox Tech, « Fast and Accurate Document Detection for Scanning » (contours par réseau de neurones puis transformée de Hough) — https://dropbox.tech/machine-learning/fast-and-accurate-document-detection-for-scanning

## Reproduire les mesures

Scripts temporaires, hors dépôt (le dossier peut être effacé) : `/tmp/claude-0/-home-user-Kilio/7d0e1a82-1b80-57c0-82df-0b89f9439b6f/scratchpad/`
- `banc/live.test.ts` : tableau 2.2 et stabilité en Node. `banc/diag.test.ts` : étapes de la photo et tailles d'analyse en 16:9. `banc/frame2.test.ts` : moyenne de blocs contre bilinéaire. `banc/gros.test.ts` : photo de 3000 px. Lancement : `vitest run --root banc --config banc/vitest.config.mts`.
- `video/gen.ts` : génère les vidéos `.y4m`. `nav/entry.ts` : banc navigateur (boucle identique à `Viseur.tsx`). `nav/run.cjs <clair|sombre> <local|4g|4g-cpu4|cpu4|sanscv|sanscv-cpu4>` : lance Chromium. `nav/analyse.cjs` : calcule les indicateurs.
- Note technique : Chromium refuse le fichier de fausse caméra si son chemin contient `..` (« File memory map error ») : il faut un chemin absolu normalisé.
