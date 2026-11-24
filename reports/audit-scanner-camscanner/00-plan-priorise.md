# Audit scanner vs CamScanner : 00, plan priorisé

Date : 2026-11-23. Ce document fusionne les trois rapports du dossier (`01-detection-viseur.md`, `02-redressement-rendu.md`, `03-benchmark-protocole.md`) en un plan de travail. Aucun fichier de code n'a été modifié.

Cadre fixé par l'utilisateur :
- les priorités sont la **détection des bords** et le **redressement/rendu** ; le défaut le plus visible est le **viseur en direct** ;
- le périmètre du rendu se limite à la **qualité du filtre « Magique »** : pas de nouveau filtre, pas d'OCR ;
- les dépendances lourdes sont permises si elles sont **chargées à la demande** ;
- il n'y a **pas encore de photos de référence** CamScanner/Kilio. La seule paire partielle disponible contient des données personnelles : rien n'en est repris ici.

> **Avertissement sur les chiffres.** Toutes les mesures des trois rapports sont **synthétiques**. Elles viennent de scènes générées, de Node sur un processeur de bureau, et de Chromium avec une fausse caméra et un processeur ralenti ×4. **Aucune n'a été faite sur un vrai téléphone**, ni avec un vrai capteur, ni face à une vraie sortie CamScanner. Elles valent comme ordres de grandeur et comme comparaisons avant/après, pas comme écart chiffré avec CamScanner. Les scripts de mesure sont dans le scratchpad de la session, pas dans le dépôt : ils peuvent disparaître, d'où le lot B1 ci-dessous.

---

## 1. Résumé exécutif

1. Le viseur déçoit surtout dans les premières secondes. Tant qu'OpenCV (10,4 Mo) n'est pas prêt, le détecteur maison à 180 px affiche « Feuille repérée » sur un cadre faux. Sur table claire, le cadre est faux à environ 90 % ; OpenCV met 7,6 à 8,7 s à être prêt en 4G froide.
2. Une fois OpenCV chargé, le cadre en direct est juste, mais il traîne (≈ 200 ms + 140 ms de CSS), tremble à l'arrêt (≈ 0,3 à 0,8 % de la diagonale) et gèle l'interface jusqu'à 591 ms. Il n'y a pas de capture automatique.
3. Le recadrage photo fait parfois **pire** que le direct. `extension.ts` pousse le cadre dans un fond clair : « blanc sur blanc » passe d'environ 0,5 % à environ 24 % d'erreur. Le cadre vu dans le viseur n'est pas réutilisé.
4. Dans « Magique », le défaut critique est la protection des couleurs (`filtres.ts:233`, fond forcé à 255) : une photo, un logo ou un tampon devient un bloc noir dans une ombre. Le correctif prototypé est de taille S, et son effet a été mesuré.
5. La géométrie de sortie est fausse en perspective : l'erreur d'aspect est de +5 % à 8° et de +46 % à 35°. La page est aussi plafonnée à 2000 px, et « Élevée 2400 px » ne fait que recompresser.
6. Les garde-fous du redressement local et de l'aplatissage se déclenchent à tort (page floue, résolution plus haute). Il faut les **corriger avant de monter la résolution**.
7. Les bancs actuels sont saturés (183 tests verts) et ne testent pas la chaîne de production. Le premier pas est un banc qui la rejoue.
8. Lot 1 (taille S, environ 1 à 2 semaines) : banc de régression, correction de la protection des couleurs, bridage de l'extension, viseur honnête avant OpenCV, lissage adaptatif, rapport d'aspect.
9. Lot 2 (M) : garde-fous, Worker, montée en résolution, capture automatique, encres fines, balance des blancs et débruitage, banc navigateur.
10. Lot 3 (L) : vraies photos face à CamScanner, OpenCV allégé, un seul rééchantillonnage, modèle de bords (DocAligner) chargé à la demande. Ce lot ne démarre qu'avec des photos réelles.

---

## 2. Vérification par échantillonnage

J'ai relu les fichiers aux lignes citées et relancé `npx vitest run src/lib/scanner` : **20 fichiers, 183 tests verts, 10,4 s**.

| Constat (rapport) | Emplacement | Verdict |
|---|---|---|
| Boucle du viseur à 120 ms, 180 px sans OpenCV, sur le fil principal (01) | `Viseur.tsx:12-13`, `:113-139` | Exact |
| 360 px avec OpenCV ; `drawImage` direct et nouveau canvas à chaque image (01) | `traitement.ts:82`, `:135-145` | Exact |
| OpenCV préchargé seulement au montage du viseur (01) | `Viseur.tsx:64-66` (seul appel de `prechargerOpenCv`) | Exact |
| Délai maximal de 45 s ; fichier `/vendor/opencv.js` de 10 378 215 octets, mis en cache par le service worker (01) | `opencv.ts:10-12`, `public/sw.js:293-297`, `node_modules/@techstark/opencv-js/dist/opencv.js` | Exact |
| Suivi : α 0,45, seuil de proximité 6 %, 2 confirmations, premier cadre adopté tout de suite (01) | `suivi.ts:23-30`, `:53` | Exact |
| Transition CSS `d` 140 ms, Chrome seulement (01) | `Viseur.tsx:193-197` (commentaire) | Exact dans le code. Le comportement sur Safari **n'est pas testé** |
| Tolérances d'extension 0,9 et 32 (01) | `extension.ts:26-28` | Exact |
| Cadre rejeté si 3 coins ou plus touchent le bord (01) | `opencvScan.ts:136` | Exact |
| Trapèze rejeté : `RAPPORT_COTES_MIN` 0,35, `ANGLE_MIN_DEG` 50 (03) | `opencvScan.ts:20,23` | Exact |
| `detecterFeuilleAuto` attend OpenCV et ne reçoit pas le cadre du viseur (01) | `traitement.ts:95-116`, `ScannerApp.tsx:263` (`onCapture={(image) => …}`) | Exact |
| Protection des couleurs → `grille.p[i] = 255` (02, C1) | `filtres.ts:233` | Exact |
| NOIR 0,42 / BLANC 0,8, `COULEUR_MIN` 30, `WB_MAX` 1,33, `RAYON_FOND` 0,05 (02) | `filtres.ts:142-143,153,159,168` | Exact |
| `tailleSortie` prend le plus long de deux côtés opposés ; plafond de 2000 px (02, C2/C3) | `geometrie.ts:19`, `:95-106` | Exact |
| « Élevée » à 2400 px n'agrandit jamais (02, C3) | `pdf.ts:10`, `traitement.ts:192` (`Math.min(1, …)`) | Exact. PRODUCT.md annonce « 2400 px » à tort |
| Chaîne `nettoyerLesBords` → … → `redresserLesLignes` puis `magicColor`, sans Worker (02, C8) | `traitement.ts:177-182`, `ScannerApp.tsx:128` | Exact. Aucun `Worker` ni `OffscreenCanvas` dans le module |
| Seuils `ECART_MIN_DEG` 0,6, `COURBURE_MIN` 0,004, `AMELIORATION_MAX` 0,6 (02, C4) | `redressementPage.ts:24,26`, `aplatissage.ts:36,46` | Exact |
| `warpPerspective` en `INTER_CUBIC` (02, C7) | `opencvScan.ts:235` | Exact |
| `ordonnerCoins` trie par x+y et x−y (03, §1.3 point 8) | `geometrie.ts:32-41` | Exact : à 45° pile, un même point peut sortir deux fois |
| Import en lot : toutes les photos décodées avant le recadrage (02) | `ScannerApp.tsx:111-113` | Exact |
| Double compression à l'export (02) | `traitement.ts:181-182`, `ExportPanel.tsx:54` | Exact |

Constat ajouté en vérifiant, **non mesuré** : `chargerImage` réduit aussi la photo de 12 Mpx à 3000 px par un `drawImage` direct (`traitement.ts:56`). Si `drawImage` crée du repliement, comme le soupçonne le rapport 01, la source de la détection et du rendu en hériterait aussi.

### Désaccords entre rapports

| # | Sujet | 01 / 02 | 03 | Arbitrage proposé |
|---|---|---|---|---|
| X1 | Cause de l'échec en faible lumière | 02 : surtout la protection des couleurs. Avec le correctif C1, σ du fond passe de 42 à 2,3 (scène D, avec logo et tampon) | Bruit amplifié par la courbe, débruitage nécessaire (scène 640×480, σ 64) | Les scènes ne sont pas les mêmes. Faire d'abord R1, **remesurer la scène faible lumière de 03**, et ne lancer R9 que si l'écart reste |
| X2 | Débruitage : gain et effort | 02 R9 : gain moyen, effort M | 03 : gain élevé, effort faible | M par prudence : le débruitage doit être conditionné à une estimation du bruit et testé sur le texte fin |
| X3 | Détecteur maison à 360 px avant OpenCV | 01 mesure une dégradation à 360 px en 16:9 (bois : 0,24 % → 16,5 % ; blanc sur blanc : 0,5 % → 20,2 %) | Option 4 : « maison à 360 px plutôt que 180 » | **Suivre 01** : 240 px avec réduction par blocs, et cadre non affiché tant qu'il n'est pas confirmé. Écarter la piste 360 px |
| X4 | Blanc sur blanc, étape par étape | 0,4 → 23,8 → 25,5 % | 0,53 → 23,85 → 24,94 % | Générateurs différents, même conclusion : c'est l'extension la coupable |
| X5 | Maintien du cadre après une perte | Tableau : « 3 images » ; texte : « gardé 4 images » | — | Code (`suivi.ts:28,48`) : le cadre survit à 3 détections manquées et disparaît à la 4e |
| X6 | Place du modèle d'apprentissage | 01 R10 : carte de contours en direct (WebGPU) | 03 : DocAligner dans le **vote de la photo** seulement, trop lent en direct | Photo d'abord, derrière un drapeau. Le direct seulement si les mesures sur téléphone le permettent |
| X7 | Worker | 01 R2 : détection en direct | 02 R7 : traitement des pages | Un **socle Worker commun** (OpenCV chargé dans le Worker) sert les deux |
| X8 | Durée des tests | 10,7 s | 16 s | Sans importance. Remesuré ici : 10,4 s |

### Affirmations non vérifiées (à ne pas citer comme acquises)

- **Tout ce qui concerne CamScanner** : moteur des bords par IA, export à 2500-4000 px, papier blanc sous tungstène, encre bleue conservée, rognage des bords, PDF « Auto ». Cela vient des pages publiques ou de suppositions, sans aucune sortie CamScanner mesurée.
- **Temps sur téléphone** (×3 à ×5 par rapport au PC), rendu de la transition CSS `d` sur Safari iOS, rapport 4:3 de `takePhoto()`, qualité réelle de `drawImage` en forte réduction.
- **Cause exacte** de l'aplatissage intempestif à 2400 px et de l'épaississement des premiers mots.
- **Gains supposés** de 02 R5, R6, R8 et R9, et de 01 R6 (retard d'environ 150 ms visé) et R9 (OpenCV de 2 à 4 Mo).
- **Tailles et licences tierces** non revérifiées ici : DocAligner `lcnet100` (4,8 Mo, Apache-2.0 « selon docsaid.org »), onnxruntime-web 1.31 (WASM de 14,8 Mo), UVDoc (31,7 Mo). À confirmer avant tout ajout.

---

## 3. Recommandations fusionnées et dédupliquées

Préfixes : **B** = banc et mesure, **D** = détection et viseur, **R** = redressement et rendu « Magique », **W** = socle Worker. La colonne « Source » renvoie aux rapports d'origine.

| ID | Description | Source | Gain | Effort | Risque | Fichiers touchés | Dépend de |
|---|---|---|---|---|---|---|---|
| **B1a** | Scènes de régression dans les bancs existants : blanc sur blanc, nappe à carreaux, coin hors champ, photo dans une ombre, logo dans un coin vignetté, page plate floue. Ajouter une aide de test qui rejoue `detecterFeuilleAuto` avec `cv` injecté, et une comparaison des coins sans tenir compte de leur ordre | 01 R4, 02 R1/R3, 03 §1.3 | Élevé (condition des critères du Lot 1) | S | Faible | `scenes.ts` ou `scenesEtendues.ts`, `detection.banc.test.ts`, `opencvScan.banc.test.ts`, `filtres.banc.test.ts` | — |
| **B1b** | Harnais Node complet (03 §4.1-4.2) : `banc/metriques.ts` (IoU, coins sans ordre, SSIM, F-mesure, homogénéité, rectitude des lignes), `pipeline.ts` (`detecterPhoto`/`rendrePage` extraits **purs** de `traitement.ts`), `seuils.json` avec seuil absolu et régression relative (+0,2 point), sortie JSON | 03 §4 | Élevé | M | Faible (refactor de `traitement.ts` sans changement de comportement) | `src/lib/scanner/banc/*`, `traitement.ts` | B1a |
| **B2** | Banc navigateur Playwright avec fausse caméra `.y4m`, réseau 4G et processeur ×4 par CDP, mesures par `MutationObserver` sur le `<path>` (jitter, retard, temps jusqu'au cadre stable, part de cadres faux affichés, plus longue tâche bloquante) | 01 §2.3, 03 §4.3 | Élevé (mesure le défaut le plus visible) | M | Faible | `e2e/scanner/*`, `playwright.scanner.config.ts`, `scripts/banc-scanner/generer-videos.mjs` | B1b (`video.ts`) |
| **B3** | Photos réelles et comparaison avec CamScanner, **en local seulement** : dossier hors dépôt, EXIF retirés, recalage ORB pour retrouver les coins CamScanner, seuls les chiffres agrégés entrent dans le dépôt | 03 §2.2, §4.4-4.5 | Élevé (seule preuve réelle) | M | Moyen (données personnelles : refus de tourner si le dossier n'est pas ignoré par Git) | `scripts/banc-scanner/local-reel.mjs`, `aligner-camscanner.py`, `.gitignore` | B1b, photos de l'utilisateur |
| **D1** | Viseur honnête avant OpenCV : `prechargerOpenCv()` au montage de `ScannerApp` (et `requestIdleCallback` après une première visite) ; mode maison à 240 px avec réduction par blocs (`reduirePourDetection`) ; cadre maison affiché seulement après 2 détections concordantes ; pastille « Préparation de la détection… » | 01 R1, 03 option 4 (voir X3) | **Élevé** | S | Faible (quelques Mo téléchargés sans scan, voir Q1) | `ScannerApp.tsx`, `Viseur.tsx`, `traitement.ts` (`detecterDepuisVideo`), `suivi.ts` | — |
| **D2** | Recadrage sans attente : course entre `chargerOpenCv()` et un délai d'environ 1,5 s ; cadre maison d'abord, remplacé si OpenCV trouve mieux, jamais si l'utilisateur a déjà déplacé un coin | 01 R5 | Moyen | S | Faible | `traitement.ts:104-116`, `EditeurCoins.tsx` | — |
| **D3** | Lissage adaptatif de type One Euro, avec une zone morte d'environ 1 px d'analyse ; tracé animé par `requestAnimationFrame` au lieu de la transition CSS `d` | 01 R6 | Moyen (élevé pour la perception du viseur) | S | Faible (fonction pure) | `suivi.ts`, `Viseur.tsx` | — |
| **D4a** | Brider l'extension : un côté étendu n'est gardé que s'il s'appuie sur un contour (`appuiSurContours` ou test d'`affinage.ts`) ; sinon le cadre d'origine reste | 01 R4, 03 §5 | **Élevé** | S | Moyen (l'extension sert aux pages qui débordent du cadre) | `extension.ts` (+ tests) | B1a |
| **D4b** | Transmettre le cadre du viseur au recadrage : `onCapture(image, quadVu)` ramené au repère de la photo, utilisé comme candidat dans `consensusQuads` et comme repli | 01 R4 | Moyen à élevé | M | Moyen (rapport photo/flux de `takePhoto` à mesurer) | `Viseur.tsx`, `ScannerApp.tsx`, `EditeurCoins.tsx`, `traitement.ts`, `capture.ts` | D4a |
| **D5** | `ordonnerCoins` robuste par tri angulaire autour du barycentre | 03 §1.3 point 8 | Faible (justesse) | S | Faible | `geometrie.ts:32-41` (+ appels `opencvScan.ts:70,83`, `detection.ts:408,436`) | — |
| **W** | Socle Worker : un Worker dédié charge OpenCV (`importScripts`), reçoit des `ImageBitmap`/buffers transférables, avec repli sur le fil principal si `OffscreenCanvas` manque. Le chemin synchrone reste pour les tests | 01 R2, 02 R7 (voir X7) | Élevé | M | Moyen (mémoire d'OpenCV, Safari) | nouveau `src/lib/scanner/worker/*`, `opencv.ts` | — |
| **D6** | Détection en direct dans le Worker, cadencée par `requestVideoFrameCallback`, une seule image en vol | 01 R2 | Élevé | M | Moyen | `Viseur.tsx`, `traitement.ts` | W |
| **D7** | Capture automatique sur cadre stable : `autoCapture.ts` pur (écart < ~0,5 % de la diagonale pendant ~0,8 s, aire > 15 %, netteté), cadre blanc puis vert, anneau de compte à rebours, vibration, interrupteur « Auto », délai de garde, respect de `prefers-reduced-motion` | 01 R3, 03 §5 | **Élevé** | M | Moyen (prises non voulues) | `autoCapture.ts`, `suivi.ts`, `Viseur.tsx` | D3 (D6 conseillé) |
| **D8** | En direct, accepter une page qui dépasse du champ (3 ou 4 coins au bord) quand les côtés intérieurs s'appuient sur des contours ; consigne « Recule un peu » | 01 R7 | Moyen | S-M | Moyen (faux cadre égal au champ entier) | `opencvScan.ts:136`, `Viseur.tsx` | B2 |
| **D9** | Consignes d'après l'état mesuré (rapproche-toi, ne bouge plus, plus de lumière), lampe (`torch`), `focusMode: continuous`, analyse à 480 px une fois dans le Worker | 01 R8 | Moyen | S | Faible (fonctions détectées avant usage) | `Viseur.tsx`, `traitement.ts` | D6 (pour 480 px) |
| **D10** | Reflet par méthode classique : exclure les zones saturées avant Canny, ou bâtir le cadre sur 3 côtés et extrapoler le 4e coin ; accepter un trapèze sous 0,35 si les droites sont fortes | 03 §5 | Moyen | M | Moyen | `opencvScan.ts`, `detection.ts` | B1b |
| **D11** | OpenCV.js allégé (`core` + `imgproc`, `.wasm` séparé, `instantiateStreaming`), environ 2 à 4 Mo visés | 01 R9 | Moyen à élevé | M | Moyen (maintenance du binaire, fonctions manquantes) | `scripts/copier-opencv.mjs`, `opencv.ts`, `public/sw.js`, CI | W conseillé |
| **D12** | Modèle de bords chargé à la demande (DocAligner `lcnet100` ONNX via onnxruntime-web), d'abord comme voix **dans le vote de la photo** derrière un drapeau, mis en cache par le service worker ; en direct seulement si les mesures sur téléphone le permettent | 01 R10, 03 §5 (voir X6) | Élevé sur reflet fort, cahier, fond chargé | L | Élevé (poids, licence, téléphones sans WebGPU, COOP/COEP pour les threads) | `opencvScan.ts` (`supplementaires`), nouveau `modeleBords.ts`, `public/vendor/`, `sw.js` | W, B1b, B3 |
| **R1** | Protection des couleurs : une cellule protégée prend le niveau de papier **voisin** (diffusion ou convolution normalisée), au lieu de 255 | 02 R1 | **Élevé (critique)** | S | Faible (à valider sur une photo pleine page avec peu de papier) | `filtres.ts:228-236` | B1a |
| **R2** | Rapport d'aspect réel : focale estimée depuis les 4 coins (Zhang & He), repli sur une focale par défaut, aimantation à A4, Lettre ou carte à moins de 3 %, garde-fou si l'estimation est instable | 02 R2 | **Élevé** | S-M | Faible à moyen (coins posés à la main) | `geometrie.ts:95-106` (+ `traitement.ts`) | — |
| **R3** | Supprimer le liseré gris des bords : rogner environ 0,3 % ou 2 px vers l'intérieur, ou repeindre la première ligne et la première colonne | 02 R10 | Faible | S | Très faible | `traitement.ts` ou `bordsPropres.ts` | — |
| **R4** | Garde-fous géométriques indépendants de l'échelle : nombre minimal de lignes nettes, gain absolu et pas seulement relatif, refus du cisaillement sur un texte flou ou dans l'incertitude de mesure | 02 R3 | **Élevé** | M | Moyen (ne plus corriger de vrais plis) | `redressementPage.ts`, `aplatissage.ts` (+ tests) | B1a |
| **R5** | Monter la résolution de sortie : 3000 px ou taille native ; « Élevée » = native ; corriger PRODUCT.md | 02 R4 | **Élevé** | S (une fois R4 et W faits) | Moyen (mémoire ≈ 160 Mo au pic, temps ×1,5) | `geometrie.ts:19`, `pdf.ts:10`, `traitement.ts:192`, `PRODUCT.md` | **R4**, W/R10 |
| **R6** | Un seul rééchantillonnage : cisaillement, aplatissage et rotation calculés sur l'image d'analyse, composés en une carte, puis un `cv.remap` cubique unique depuis la source | 02 R5 | Moyen | M-L | Moyen (ordre des étapes de `traitement.ts:182`) | `traitement.ts`, `redressementPage.ts`, `aplatissage.ts`, `redressementTexte.ts`, `opencvScan.ts` | R4, B1b |
| **R7** | Fond plus local aux ombres nettes : deux échelles de fermeture (≈ 1,5 % et 5 %) ou filtre guidé | 02 R6 | Moyen (supposé) | M | Moyen (titres gras pris pour du fond) | `filtres.ts` | R1 |
| **R8** | Encres fines colorées : « couleur » calculée sur une chroma lissée (5 à 7 px) ou sur la cohérence de teinte ; seuil `COULEUR_MIN` abaissé pour les pixels sombres à teinte stable | 02 R8 | Moyen (supposé) | S-M | Moyen (encre noire bleutée qui deviendrait bleue) | `filtres.ts:153,261` | R1, Q5 |
| **R9** | Balance des blancs et faible lumière : `WB_MAX` relevé (≈ 1,6-1,7) seulement si le papier est vaste et uniforme ; débruitage léger et conditionnel de la luminance avant le rapport au fond. Ne pas durcir NOIR/BLANC sans ce débruitage | 02 R9, 03 §5 (voir X1, X2) | Moyen à élevé | M | Moyen (vrai papier coloré blanchi, traits fins perdus) | `filtres.ts:168,171-175,216` | R1 (puis remesure) |
| **R10** | Traitement des pages dans le Worker ; décoder une seule photo à la fois dans la file d'import ; remplacer les flous de boîte et la morphologie JS par OpenCV | 02 R7 | Moyen (fluidité) ; condition de R5 | M | Faible à moyen | `traitement.ts`, `filtres.ts`, `ScannerApp.tsx:104-130` | W |
| **R11** | *Hors priorité.* Export sans réencodage quand rien n'est redimensionné ; page PDF « Auto » pour tickets et cartes | 02 R11 | Faible | S | Faible | `ExportPanel.tsx`, `pdf.ts` | Q9 |
| **R12** | *Conditionnel.* UVDoc (aplatissement neuronal, ≈ 32 Mo) à la demande, seulement si les vraies pages courbées restent hors seuil après R4 | 03 §5 | Moyen sur courbé ou plié | L | Élevé | nouveau module | B3, W |

---

## 4. Lots ordonnés et critères d'acceptation

Les critères reprennent les métriques et les seuils de **parité** et de **cible** du rapport 03 (§3.1 à §3.3), mesurés sur les scènes et vidéos synthétiques tant que B3 n'existe pas. Un seuil marqué *(proposé)* n'est pas dans 03 : il est déduit des mesures de base de 01 ou 02. Règle générale pour chaque élément : les 183 tests existants restent verts, et aucune catégorie de scènes ne recule de plus de 0,2 point en médiane d'erreur de coin (03 §3.1).

### Lot 1 : quick wins (S), dans cet ordre

| Ordre | ID | Critère d'acceptation mesurable |
|---|---|---|
| 1 | **B1a** | Les nouvelles scènes **échouent** sur le code actuel (elles reproduisent : blanc sur blanc ≈ 24 %, photo dans l'ombre ΔE ≈ 70, cisaillement de G), puis deviennent les tests de régression des éléments suivants. Comparaison des coins sans ordre : la scène « rotation 45° » n'est plus dégénérée |
| 2 | **R1** | Scène B (02) : σ du fond ≤ 4 (cible 03 ; prototype 0,45), tuile la plus sombre ≥ 245 *(proposé)*, ΔE photo ≤ 10 (parité ; prototype 9,5). Scène D : σ du fond ≤ 8 (parité). Scènes A, E, F : SSIM sans baisse de plus de 0,005 |
| 3 | **D4a** | Chaîne photo : blanc sur blanc et nappe à carreaux avec erreur max ≤ 1,5 % et IoU ≥ 0,95 (parité) ; coin hors champ ≤ 3 % ; « page plus haute que le champ » toujours ≤ 1,5 % ; `extension.test.ts` et `affinage.test.ts` verts. Règle : la chaîne photo ne fait jamais pire que le direct OpenCV sur une scène |
| 4 | **D5** | Test unitaire : 4 points distincts en sortie pour un carré tourné de 0 à 90° par pas de 5° ; bancs inchangés |
| 5 | **D1** | Banc fausse caméra (protocole 01 §2.3, en attendant B2), table claire, 4G + processeur ×4 : part des images où « Feuille repérée » s'affiche sur un cadre faux (erreur moyenne > 1,5 %) **≤ 5 %** (aujourd'hui 51/53). Temps entre l'ouverture du viseur et OpenCV prêt, après 10 s passées sur `/scanner` en 4G froide : ≤ 1 s *(proposé)* ; cible 03 « froid ≤ 4 s en 4G » depuis le montage de `/scanner` |
| 6 | **D2** | OpenCV bloqué ou réseau 4G froid : un cadre proposé en ≤ 1,5 s à l'écran de recadrage, et un coin déplacé par l'utilisateur n'est jamais écrasé (test de composant) |
| 7 | **D3** | Document immobile : jitter affiché ≤ 1,5 px pour une vidéo de 1080 px (cible 03 ; aujourd'hui ≈ 5 px sur 720p). Dérive lente : retard ≤ 2,5 % de la diagonale (cible 03). Le même tracé animé sans transition CSS `d`, donc identique hors Chrome |
| 8 | **R2** | Banc d'aspect (02) : erreur ≤ 1 % de 0° à 35° (aujourd'hui +5 % à +46 %). Repli : sur un quadrilatère non rectangulaire posé à la main, l'erreur n'est jamais pire que celle de la méthode actuelle |
| 9 | **R3** | Sur les 7 scènes de 02 : luminance moyenne des 2 premières et 2 dernières lignes et colonnes ≥ 245 *(proposé)* |

### Lot 2 : chantiers moyens (M), ordre de dépendance

1. **B1b** puis **B2**. Le harnais rejoue la chaîne de production et sort un JSON par catégorie (03 §3). Le banc navigateur mesure jitter, retard, part de cadres faux, temps jusqu'au cadre stable et plus longue tâche. *Acceptation* : `npx vitest run src/lib/scanner/banc` en moins de 2 minutes, échec sur seuil absolu ou sur régression relative de plus de 0,2 point ; les chiffres du Lot 1 sont reproduits à ±10 % près.
2. **R4, avant toute montée en résolution.** *Acceptation* : la scène G ne déclenche plus `redresserParTranches` (SSIM du bloc de texte ≥ 0,90, aujourd'hui 0,656). Les pages planes A à F rendues à 2400 et 3000 px ne déclenchent pas `aplatirLesLignes` (0 sur 6, aujourd'hui 5 sur 7). Les tests de vrais plis d'`aplatissage.test.ts` et de `redressementPage.test.ts` restent verts. Rectitude des lignes ≤ 4 px sur courbé et plié (parité 03).
3. **W**, puis **R10** et **D6**. *Acceptation* (B2, processeur ×4) : plus longue tâche bloquante du fil principal ≤ 100 ms pendant l'ouverture du viseur et pendant le traitement d'une page *(proposé ; aujourd'hui jusqu'à 591 ms)*. Détections ≥ 10 par seconde *(proposé)*. Latence p95 ≤ 120 ms (parité), ≤ 60 ms (cible). Un seul décodage de photo en mémoire pendant un import en lot.
4. **R5** (une fois R4 et R10 faits). *Acceptation* : rappel du texte fin 6 pt ≥ 95 % et SSIM du texte fin ≥ 0,93 (prototype 02 : 95 % et 0,939). Pic mémoire mesuré ≤ 200 Mo *(proposé)*. Aucun déclenchement d'aplatissage sur les pages planes (critère de R4 refait à la nouvelle taille). PRODUCT.md mis à jour.
5. **D7** (une fois D3 fait, D6 conseillé). *Acceptation* : temps jusqu'au cadre stable ≤ 1,0 s (parité), ≤ 0,6 s (cible). **Aucune prise automatique** pendant les phases de balayage et de tremblement des vidéos B2. Prise en moins de 1,5 s *(proposé)* dans la phase immobile. Réglage désactivable.
6. **R8**, **R9**, **R7** (une fois R1 fait ; R9 seulement si X1 confirme un écart après R1). *Acceptation* : ΔE2000 tampon et logo ≤ 10 (parité), ≤ 6 (cible). Chroma de la signature bleue ≥ 0,6 *(proposé ; aujourd'hui 0,01 à 0,23)*, le test « tache grise » restant neutre. Faible lumière (scène 03) : papier ≥ 245 sur ≥ 95 % et σ du papier ≤ 8 (parité). Scène C de 02 : tuile la plus sombre ≥ 245 et pas de bande diagonale ; le titre gras et la barre noire restent noirs (encre ≤ 40 *(proposé)*). F-mesure du texte ≥ 0,90 (parité) sur toutes les scènes.
7. **D4b**, **D8**, **D9**. *Acceptation* : sur les vidéos B2, le cadre proposé au recadrage n'est jamais pire que le dernier cadre affiché. « Page plus haute que le champ » en direct : un cadre avec erreur ≤ 3 %, et 0 faux cadre « champ entier » sur la référence (faux positifs = 0, 03 §3.1). D9 : chaque commande caméra a un repli silencieux, vérifié par un test de composant.
8. **D10** (reflet classique, à tenter avant le modèle). *Acceptation* : reflet sur un coin ≤ 1,5 % (aujourd'hui 9,3 %), sans régression ailleurs.

### Lot 3 : gros chantiers (L)

1. **B3**, dès que des photos réelles existent (protocole 03 §2.2, 12 cas). C'est un préalable à toute décision de modèle. *Acceptation* : taux d'échec Kilio ≤ 10 % (parité) ; nombre de retouches de coins ≤ celui de CamScanner, cas par cas ; métriques de rendu sans référence ≥ CamScanner − 5 %. Les seuils de parité de 03 sont recalés sur les vraies sorties CamScanner. Aucune image ni nom de fichier d'origine dans le dépôt.
2. **D11** (OpenCV allégé). *Acceptation* : fichier ≤ 4 Mo, OpenCV prêt en ≤ 0,5 s avec un cache chaud et le processeur ×4 *(proposé ; aujourd'hui 1,9 s)*, bancs de détection identiques à ±0,05 point.
3. **R6** (un seul rééchantillonnage). *Acceptation* : énergie de gradient du texte fin ≥ +10 % quand 3 étapes s'appliquent *(proposé, d'après la perte par passe mesurée en 02)*, rectitude des lignes inchangée.
4. **D12** (modèle de bords à la demande). *Acceptation* : reflet fort et « feuille sur un cahier » ≤ 1,5 % (aujourd'hui 8,4 à 13,3 %) ; taux d'échec sur photos réelles ≤ 5 % (cible) ; aucune régression sur la référence ; modèle et runtime téléchargés seulement à la première détection photo ; temps photo sur le téléphone de référence ≤ 1,5 s (parité 03).
5. **R12** (UVDoc), seulement si B3 montre une rectitude des lignes au-delà de 4 px sur les vraies pages courbées après R4.

---

## 5. Risques de régression et tests à ajouter

| Risque | Éléments concernés | Test à ajouter |
|---|---|---|
| Une page qui déborde du cadre redevient « résumée à son bloc de texte » une fois l'extension bridée | D4a | Garder `extension.test.ts` et ajouter « page plus haute que le champ » et « page qui déborde à droite » au banc photo |
| Faux cadre « champ entier » en direct | D8 | Scène « table vide » et « mur uni » : 0 cadre proposé |
| Viseur muet plus longtemps (cadre maison masqué jusqu'à confirmation) | D1 | B2 : temps jusqu'au premier cadre juste ≤ 1,0 s, avec et sans OpenCV |
| Préchargement de 10 Mo sur données mobiles | D1, D11 | Mesure réseau dans B2 : aucun téléchargement si `navigator.connection.saveData` *(si retenu, voir Q1)* |
| Prises automatiques non voulues | D7 | Vidéos « balayage », « main qui tremble » et « document qui entre dans le champ » : 0 prise ; délai de garde testé en pur |
| Zone sans papier voisin (photo pleine page) mal estimée par la nouvelle protection | R1 | Scène « photo couvrant 80 % de la page » et « carte de visite colorée » |
| Vrais plis plus corrigés après les nouveaux garde-fous | R4 | Garder les tests d'`aplatissage.test.ts` et `redressementPage.test.ts` ; ajouter « pli réel à 2400 px » (doit se déclencher) et « page plate à 3000 px » (ne doit pas) |
| Mémoire et lenteur à 3000 px, plantage d'onglet sur un téléphone modeste | R5, R10 | Banc mémoire (pic par page) ; B2 en processeur ×4 ; essai manuel sur téléphone (03 §4.5) |
| Encre noire bleutée qui devient bleue | R8 | Le test « tache grise » existe déjà ; ajouter « texte noir sous lumière froide » |
| Papier vraiment coloré blanchi | R9 | Scènes « papier rose » et « post-it jaune » : teinte conservée (< 12°, comme `filtres.banc.test.ts`) |
| Texte fin effacé par le débruitage | R9 | Rappel du texte fin 6 pt sans baisse de plus de 2 points sur A |
| Titres gras pris pour du fond (fermeture courte) | R7 | Titre de 110 px et barre noire inversée : encre ≤ 40 |
| Divergence entre le chemin Worker et le chemin synchrone | W, D6, R10 | Même scène traitée par les deux chemins : sorties identiques à 1 niveau près |
| Rapport d'aspect aberrant sur des coins posés à la main | R2 | Test « quadrilatère non projectif » : repli sur l'ancien calcul |
| Ordre des coins changé, poignées de l'éditeur inversées | D5 | `EditeurCoins.test.tsx` : chaque poignée garde sa position après ré-ordonnancement |
| Poids et licence d'un modèle tiers | D12, R12 | Contrôle CI de la taille de `public/vendor/*` ; licence consignée avant fusion |

---

## 6. Questions ouvertes à trancher

1. **Préchargement d'OpenCV** (10 Mo, ou 2 à 4 Mo après D11) dès l'ouverture de `/scanner`, même sans scan : acceptable sur données mobiles, ou seulement en Wi-Fi et en `saveData` désactivé, ou seulement après une première utilisation ?
2. **Capture automatique** : activée par défaut, ou interrupteur « Auto » désactivé par défaut ?
3. **Résolution d'export** : taille native de la photo (PDF environ deux fois plus lourd) ou plafond à 3000 px ? Faut-il garder deux qualités, et leurs noms ?
4. **Formats aimantés** (R2) : A4, Lettre et carte suffisent-ils ? Faut-il aussi les tickets ?
5. **Encre de stylo** (R8) : garder le bleu d'une signature, comme CamScanner semble le faire, ou garder une encre noire uniforme ?
6. **Papier coloré** (R9) : un papier vraiment rose ou jaune doit-il rester coloré ou être blanchi ?
7. **Modèle d'apprentissage** (D12) : accepter environ 5 Mo de modèle et 3 à 4 Mo compressés de runtime, chargés à la demande ? Accepter les en-têtes COOP/COEP (threads WASM), qui peuvent gêner d'autres modules ?
8. **Photos réelles** (B3) : quand, avec quel téléphone de référence, et où sur l'ordinateur (dossier hors dépôt) ? Peut-on produire 12 cas sans données personnelles (prospectus, notices, factures d'exemple) ?
9. **Export** (R11 : PDF « Auto », pas de réencodage) : dans le périmètre de ce chantier, ou plus tard ?
10. **UVDoc** (R12, ≈ 32 Mo) : à exclure d'office, ou à garder comme option conditionnelle ?
11. **iPhone / Safari** : quel niveau de prise en charge viser pour le viseur (Worker, `OffscreenCanvas`, lampe) ?
