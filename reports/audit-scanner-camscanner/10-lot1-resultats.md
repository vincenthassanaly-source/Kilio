# Audit scanner vs CamScanner : 10, résultats du lot 1

Date : 2026-11-24. Mise en œuvre du lot 1 du plan (`00-plan-priorise.md`, §4) dans cet ordre : B1a, R1, D4a, D5, D1, D2, D3, R2, R3 (un commit par élément). Code touché : `src/lib/scanner/` et `src/app/(app)/scanner/`, plus la section Scanner de `PRODUCT.md`. Aucune nouvelle dépendance.

> **Toutes les mesures restent synthétiques** (scènes générées, Node sur un processeur de bureau, Chromium avec une fausse caméra et un processeur ralenti ×4). Aucune n'a été faite sur un vrai téléphone ni face à une vraie sortie CamScanner. Les chiffres valent comme comparaisons avant/après sur les mêmes scènes.

## Bancs utilisés

| Banc | Où | Ce qu'il mesure |
|---|---|---|
| `photo.banc.test.ts` (nouveau, versionné) | dépôt | chaîne photo de production (`pipeline.ts` = `detecterFeuilleAuto` avec `cv` injecté) sur les 13 scènes de référence + blanc sur blanc (×2), nappe à carreaux, coin hors champ, page plus haute que le champ, feuille à 45° ; erreur de coins **sans ordre**, IoU, comparaison au direct OpenCV 360 px |
| `filtres.banc.test.ts` (étendu) | dépôt | « Magique » sur des pages déjà redressées (`scenesEtendues.ts`) : photo dans une ombre de main, lampe chaude + logo dans un coin vignetté ; liseré des bords |
| Banc de détection 26 scènes (rapport 01 §2.2) | scratchpad `banc/live.test.ts` | direct maison, direct OpenCV, chaîne photo |
| Banc de rendu 02 (A4 300 dpi projeté en 3000×4000, 7 scènes A à G) | scratchpad `rendu02/banc.ts` | fond, ΔE, SSIM, rapport d'aspect, luminance des bords |
| Banc d'aspect (rapport 02 C2) | scratchpad `rendu02/aspect2.ts` | erreur de rapport largeur/hauteur de 0° à 45° |
| Banc navigateur (rapport 01 §2.3, en attendant B2) | scratchpad `nav/` (`entry2.ts`, `run2.cjs`, `analyse2.cjs`, `rejeu.ts`) | boucle identique à `Viseur.tsx` sur une vidéo `.y4m` 1280×720 (3 s immobile, 3 s de balayage, 2 s de tremblement, 2 s immobile), réseau 4G 12 Mbit/s et processeur ×4 par CDP |

Scratchpad : `/tmp/claude-0/-home-user-Kilio/7d0e1a82-1b80-57c0-82df-0b89f9439b6f/scratchpad/` (chiffres bruts dans `lot1/`). Il peut être effacé.

## Résultats par élément

| Élément | Critère (plan §4) | Avant | Après | Atteint |
|---|---|---|---|---|
| **B1a** | Les nouvelles scènes échouent sur le code actuel | — | blanc sur blanc 25,5 % et 24,9 %, nappe 24,0 %, coin hors champ 4,9 % (chaîne photo) ; vérité de la feuille à 45° dégénérée (deux coins identiques) ; photo dans l'ombre ΔE 71, σ du fond 18 ; faible lumière σ 83, tuile la plus sombre 2. Marquées `it.fails` dans le commit B1a, repassées en `it` par le correctif concerné | oui |
| | Reproduire le cisaillement de G (page plate floue) | — | **non reproduit** à petite échelle (page 700×990 floutée et bruitée : `redresserParTranches` ne se déclenche pas). Reste mesuré par le banc 02 (scène G) | **non** |
| | Comparaison des coins sans ordre ; scène 45° non dégénérée | — | `erreurCoinsSansOrdre`, `iouQuads` ; scène 45° : 4 coins distincts (après D5) | oui |
| **R1** | Scène B : σ du fond ≤ 4 | 12,13 | 0,45 | oui |
| | Scène B : tuile la plus sombre ≥ 245 | 96,0 | 253,8 | oui |
| | Scène B : ΔE photo ≤ 10 | 70,4 | 3,6 | oui |
| | Scène D : σ du fond ≤ 8 | 42,44 | 2,29 | oui |
| | A, E, F : SSIM sans baisse > 0,005 | 0,903 / 0,911 / 0,899 | 0,910 / 0,917 / 0,908 | oui |
| **D4a** | Blanc sur blanc ≤ 1,5 % et IoU ≥ 0,95 | 25,45 % (IoU 0,33) ; 24,94 % (IoU 0,52) | 0,35 % (IoU 0,991) ; 0,35 % (IoU 0,985) | oui |
| | Nappe à carreaux ≤ 1,5 % et IoU ≥ 0,95 | 23,95 % (IoU 0,39) | 0,20 % (IoU 0,990) | oui |
| | Coin hors champ ≤ 3 % | 4,89 % | 1,92 % | oui |
| | Page plus haute que le champ ≤ 1,5 % | 0,26 % | 0,26 % | oui |
| | `extension.test.ts`, `affinage.test.ts` verts | verts | verts | oui |
| | Chaîne photo jamais pire que le direct OpenCV | 3 scènes pires (01 §2.2) | 26 scènes : 21/26 → 24/26 sous 3 %, aucune régression ; **encore pire** que le direct sur coin hors champ (1,92 % contre 0,35 %) et reflet fort (13,2 % contre 8,4 %, les deux en échec) | **partiel** |
| **D5** | 4 coins distincts, carré tourné de 0 à 90° par pas de 5° | 45° : point en double | 19 angles : 4 coins distincts, convexes, sens horaire | oui |
| | Bancs inchangés | — | détection maison, OpenCV et chaîne photo identiques au centième | oui |
| **D1** | « Feuille repérée » sur un cadre faux, table claire, 4G + processeur ×4 : ≤ 5 % | 59,4 % (41/69) ; 4G seule 51,5 % | 14,0 % après D1 seul (retard du lissage pendant le balayage) ; **2,0 %** (1/49) après D3. 4G seule : 1,1 %. Le cas restant est le saut de la vidéo qui boucle | oui (avec D3) |
| | OpenCV prêt ≤ 1 s après l'ouverture du viseur, après 10 s sur `/scanner` en 4G froide | 7,6 s (8,7 s processeur ×4) | 33 ms (134 ms processeur ×4) | oui |
| | Cible 03 : froid ≤ 4 s en 4G depuis le montage de `/scanner` | — | 7,8 s (9,2 s processeur ×4) : limité par le téléchargement de 10,4 Mo | **non** (relève de D11) |
| **D2** | OpenCV bloqué : cadre proposé ≤ 1,5 s | jusqu'à 45 s (délai du chargeur) | 1,13 à 1,17 s (Node, photo 3000×2250 ; délai 1 s + détection maison). Non mesuré sur téléphone (le calcul maison y sera 3 à 5 fois plus lent) | oui (PC) |
| | Coin déplacé jamais écrasé (test de composant) | — | 3 tests : cadre maison puis OpenCV ; coin déplacé conservé ; « Photo entière » conservée | oui |
| **D3** | Jitter à l'arrêt ≤ 1,5 px pour une vidéo 1080p | 0,94 à 0,97 px (voir écart 3) | 0,00 à 0,16 px | oui |
| | Dérive lente : retard ≤ 2,5 % de la diagonale | erreur affichée 0,78 à 1,08 % (3,76 % en 4G + ×4, cadre maison) | 0,28 à 0,34 % | oui |
| | Même tracé hors Chrome (plus de transition CSS `d`) | transition CSS `d` (Chrome seulement) | `requestAnimationFrame`, 100 ms, rien si `prefers-reduced-motion` | oui (non vérifié sur un appareil Safari) |
| **R2** | Erreur d'aspect ≤ 1 % de 0° à 35° | +4,8 % (8°) … +45,6 % (35°) | ≤ 0,03 % (A4, aimanté) ; ≤ 0,25 % (format libre 0,6, non aimanté) | oui |
| | Repli : quadrilatère non projectif jamais pire que l'ancien calcul | — | 4 quadrilatères posés à la main : taille identique à l'ancien calcul (test unitaire) | oui |
| | Banc 02 : erreur d'aspect | +5,0 % (A–D, F, G), +46,2 % (E) | 0,0 % sur les 7 scènes | oui |
| **R3** | Luminance moyenne des 2 premières et dernières lignes et colonnes ≥ 245 sur les 7 scènes de 02 | 162,1 à 213,7 | 251,7 à 255,0 | oui |

Règle générale : les tests existants restent verts (suite du scanner : 206 → 266 tests), et aucune catégorie de scènes du banc 26 scènes ne recule (médianes identiques ou meilleures).

## Ce qui a changé, en bref

- `pipeline.ts` (nouveau) : chaîne photo pure, `cv` injecté ; `traitement.ts` l'appelle.
- `filtres.ts` : les cellules protégées (photo, logo, tampon) et un liseré de 2 cellules prennent le niveau du papier voisin par diffusion, au lieu de 255.
- `extension.ts` : un côté déjà sur un vrai bord ne bouge pas ; un côté étendu n'est gardé que s'il s'arrête sur un vrai bord ou sur le bord de la photo. `opencvScan.ts` : dans le vote photo, un cadre d'appoint collé au bord de l'image ne départage plus les analyses OpenCV. `affinage.ts` : un côté n'est posé sur le bord de la photo que si la page y continue sur 75 % de sa longueur (50 % avant).
- `geometrie.ts` : `ordonnerCoins` par tri angulaire ; `rapportReel` (Zhang et He) et `aimanterRapport` ; `tailleSortie` prend la taille de la photo.
- `suivi.ts` : filtre « One Euro » cadencé par l'instant réel, zone morte d'un pixel d'analyse, premier cadre maison à confirmer, `messageViseur`.
- `traitement.ts` : `prechargerOpenCvSiPossible` (temps libre, repli `setTimeout` sans `requestIdleCallback`, rien si `saveData`), détection maison en direct à 240 px par moyenne de blocs, course OpenCV / 1 s au recadrage.
- `bordsPropres.ts` : `rognerLeLisere` (0,3 % du grand côté, au moins 2 px).
- `ScannerApp.tsx` (préchargement), `Viseur.tsx` (moteur, confirmation, pastille, tracé animé par `requestAnimationFrame`), `EditeurCoins.tsx` (cadre OpenCV tardif, jamais sur un coin retouché).

## Écarts et risques résiduels

1. **Cisaillement de G non reproduit dans le dépôt** (B1a). La page plate floue et bruitée de 700×990 px ne déclenche pas `redresserParTranches`. Le défaut reste visible dans le banc 02 (scène G avant R2). Avec R2, la scène G n'est plus redressée à la même taille et `redresserParTranches` ne s'y déclenche plus : SSIM du bloc de texte 0,656 → 0,874. C'est une coïncidence de taille, pas un correctif : le garde-fou R4 (lot 2) reste à faire.
2. **Faible lumière : bruit amplifié** (désaccord X1 du plan). Après R1, les taches noires ont disparu (tuile la plus sombre 2 → 226 sur la page de test du dépôt), mais σ du fond y reste à 33, au-dessus de 8. Sur la scène D du banc 02, mesurée à une échelle commune après export, σ passe bien sous 8 (2,3). Le test du dépôt garde ce cas en `it.fails`, avec un renvoi à R9 (débruitage conditionnel, lot 2). X1 est donc tranché : un écart subsiste après R1, et R9 se justifie.
3. **Jitter « avant » corrigé**. Le rapport 01 annonçait environ 5 px à l'arrêt. En rejouant ses enregistrements, ce chiffre inclut le saut de la vidéo quand elle reboucle. Avec une mesure qui l'exclut, l'ancien suivi tremblait de 0,63 à 0,65 px sur 720p, soit environ 0,95 px en 1080p : le critère de 1,5 px était déjà tenu. Le gain de D3 porte surtout sur le retard en mouvement (0,8 à 1,1 % → 0,3 %) et sur la part de cadres faux affichés. Les vidéos synthétiques n'ont pas de vrai bruit de capteur : le jitter mesuré sur un téléphone sera plus élevé.
4. **« Jamais pire que le direct » pas tenu partout** (D4a). Sur le coin hors champ, la chaîne photo reste à 1,9 % (sous les 3 % demandés) contre 0,35 % pour le direct. La page visible y est un pentagone, que l'extension approche moins bien. Sur le reflet fort, les deux échouent (13,2 % contre 8,4 %) : c'est l'objet de D10 (lot 2).
5. **Délai du recadrage** (D2) : 1,13 à 1,17 s sur PC. Sur un téléphone, la détection maison sur 3000 px prend 3 à 5 fois plus longtemps ; le total peut donc dépasser 1,5 s. Le délai d'attente (1 s) est une constante (`ATTENTE_OPENCV_RECADRAGE_MS`) à réduire si la mesure sur téléphone le demande.
6. **Préchargement** : 10,4 Mo téléchargés à la première visite de `/scanner`, même sans scan (décision utilisateur), sauf si `saveData` est actif. L'initialisation d'OpenCV reste une tâche bloquante de 500 à 600 ms avec le processeur ×4. Elle a désormais lieu pendant un temps libre de la page liste, pas dans le viseur. Le socle Worker (W, lot 2) reste nécessaire.
7. **R2** : le centre optique est supposé au milieu de la photo. Une image recadrée avant import fausse l'estimation de la focale. Les garde-fous (focale entre 0,5 et 2 fois le grand côté, écart au plus d'un facteur 1,6 avec l'ancien calcul) ramènent alors à l'ancien calcul, sans garantir le bon rapport. Au-delà d'environ 40° d'inclinaison, c'est aussi l'ancien calcul qui s'applique.
8. **Safari** : toutes les API nouvelles sont détectées avant usage (`navigator.connection`, `requestIdleCallback` avec repli `setTimeout`, `matchMedia`, `requestAnimationFrame`). Le repli sans `requestIdleCallback` ni `navigator.connection` est couvert par un test. Rien n'a été vérifié sur un appareil Safari.
9. **D5** : près de 45°, l'ordre des coins peut basculer d'une détection à l'autre (le départ est le coin qui minimise x+y). Le suivi y voit alors un cadre lointain et attend sa confirmation. C'était déjà le cas avant ; le changement n'a pas été mesuré en direct.

## Vérifications finales

- `npx vitest run` (suite complète) : 272 fichiers, 2722 tests verts (120 s). Un seul cas reste marqué `it.fails`, avec un renvoi au lot 2 : faible lumière σ ≤ 8 (R9). Aucun test n'a été désactivé ni assoupli pour passer. Le seul seuil changé est celui que B1a avait posé pour la page faible lumière : il est remplacé par « plus de tache noire » (tuile ≥ 200), et l'ancien seuil reste en `it.fails`.
- `npm run lint` : aucun problème.
- `npm run build` : réussi (`/scanner` statique).
