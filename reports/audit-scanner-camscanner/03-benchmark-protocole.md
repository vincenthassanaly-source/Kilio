# Audit scanner vs CamScanner — 03 · Benchmark : état de base, protocole, harnais

Date : 2026-11-23. Périmètre : `src/lib/scanner/` et `src/app/(app)/scanner/`. Rapport d'audit seulement : aucun fichier du dépôt n'a été modifié hors de ce rapport. Les mesures viennent de scripts temporaires (hors dépôt, dans le scratchpad de la session) qui importent le code de production tel quel.

Objectif : un protocole de mesure **reproductible** qui dise, chiffres à l'appui, de combien Kilio est loin de CamScanner sur trois axes (détection des bords, stabilité du cadre en direct, rendu) et si une modification le rapproche ou l'éloigne.

---

## 1. Ce qui existe aujourd'hui

### 1.1 Bancs et tests présents

| Fichier | Ce qu'il mesure | Métrique | Seuil |
|---|---|---|---|
| `detection.banc.test.ts` | détecteur maison **brut** (`reduirePourDetection` + `detecterQuadrilatere`) sur 12 scènes + 1 cas limite | erreur max d'un coin en % de la diagonale, durée | < 3 % (limite : < 6 % si un cadre est proposé) |
| `opencvScan.banc.test.ts` | `detecterDocumentCv` (OpenCV.js, une seule échelle 480 px), mêmes scènes | idem | idem |
| `filtres.banc.test.ts` | filtre « Magique » sur 2 pages synthétiques + la carte redressée | luminance/saturation du papier, encre < 90, teinte conservée (< 12°) | seuils absolus par critère |
| `scenes.ts` | générateur pur de scènes 640×480 (perspective, bois, ombre portée verticale, bord de table, bruit, flou 3×3), graine fixe | — | — |
| `suivi.test.ts` | règles de lissage du cadre live (moyenne exp., maintien 3 images, confirmation ×2) | tests unitaires de logique | — |
| autres `*.test.ts` | tests unitaires par étape (extension, affinage, intrusions, aplatissage, redressement…) | assertions ponctuelles | — |
| `e2e/` | rien sur le scanner : `/scanner` n'apparaît que dans `routes.ts` (navigation instantanée) | — | — |

### 1.2 État de base mesuré (`npx vitest run src/lib/scanner`)

20 fichiers, **183 tests verts** en 16 s (Node, CPU de la session, pas un téléphone).

| Scène (640×480) | Maison brut | OpenCV 480 | ms maison / ms OpenCV |
|---|---|---|---|
| feuille blanche sur table claire | 0,19 % | 0,30 % | 171 / 76 |
| petite carte sur table claire | 0,53 % | 0,51 % | 64 / 22 |
| carte sombre sur table claire | 0,12 % | 0,51 % | 59 / 21 |
| feuille sur fond sombre (témoin) | 0,06 % | 0,24 % | 75 / 29 |
| feuille sur grain de bois | 0,14 % | 0,34 % | 39 / 31 |
| ticket étroit sur tissu | 0,15 % | 0,19 % | 34 / 25 |
| feuille avec ombre portée | 0,14 % | 0,28 % | 32 / 20 |
| perspective forte | 0,19 % | 0,24 % | 27 / 20 |
| feuille presque plein cadre | 0,13 % | 0,24 % | 64 / 42 |
| feuille tournée de 25° | 0,16 % | 0,21 % | 55 / 24 |
| carte devant un bord de table | 0,14 % | **2,62 %** | 27 / 51 |
| ticket bruité sur table claire | 0,17 % | 0,26 % | 62 / 30 |
| feuille très peu contrastée (limite) | 0,25 % | 0,65 % | — |

Lecture : sur ses propres scènes, le banc est **saturé**. Tout passe très en dessous du seuil de 3 %, sauf OpenCV sur « carte devant un bord de table » (2,62 %, à 0,4 point du seuil). Un banc saturé ne peut plus guider le travail pour rattraper CamScanner.

### 1.3 Angles morts

1. **Le banc ne mesure pas le pipeline de production.** Pour une photo, la production appelle `detecterFeuilleAuto` : détection maison + `detecterDocumentRobuste` (4 échelles, vote) + `etendreAuxBordsDeLaFeuille` + `affinerLesCotes`. Les bancs ne testent que les détecteurs bruts. Mesure ci-dessous (§1.4) : sur « blanc sur blanc », OpenCV seul trouve les coins à **0,53 %** près, mais l'étape d'extension pousse les côtés jusqu'au bord de la photo, d'où **23,9 %** d'erreur (puis 24,9 % après affinage). Cette régression est invisible pour les bancs actuels.
2. **Scènes uniquement synthétiques** et toutes au même format (640×480, sauf cas limite). Il n'y a ni photo réelle, ni résolution de téléphone (12 Mpx réduits à 3000 px), ni compression JPEG, ni EXIF, ni objectif grand-angle (distorsion).
3. **Catégories absentes** : fond texturé fort, blanc sur blanc franc, ombre forte en travers du texte, reflet spéculaire, papier plié ou courbé, angles extrêmes (rotation ≥ 40°, trapèze fort), faible luminosité avec bruit ISO, doigts sur le bord, reçu très étroit et long, facture A4 en haute résolution, flou de bougé.
4. **Une seule métrique géométrique** (erreur max du pire coin). Il manque l'IoU, l'erreur moyenne en px, le taux d'échec et la distinction faux positif / absence. La métrique dépend aussi de l'ordre des coins (voir le point 8).
5. **Aucune mesure du direct.** Ni jitter, ni latence par image, ni temps jusqu'au cadre stable, ni taux de détection par image. `suivi.ts` n'est testé que sur sa logique.
6. **Aucune vérité terrain pour le rendu.** Le banc des filtres vérifie des seuils absolus sur 2 images (papier > 238, encre < 90). Il n'y a ni SSIM ou PSNR contre une page idéale, ni mesure de l'homogénéité du fond, de la netteté ou de la chaîne complète (`nettoyerLesBords` → `effacerLesIntrusions` → `redresserParTranches` → `aplatirLesLignes` → `redresserLesLignes` → `magicColor`).
7. **Aucun test bout-en-bout du viseur** (`getUserMedia`, boucle de 120 ms, overlay SVG) et aucune comparaison avec CamScanner.
8. **Risque géométrique repéré** : `ordonnerCoins` trie les coins par x+y et x−y. Pour un rectangle tourné de 45° pile, deux coins sont à égalité et le même point sort deux fois. La vérité terrain de la scène « rotation 45° » devient `…(292,410),(292,410)`, alors que la détection, elle, est juste. Le banc doit donc comparer les coins indépendamment de leur ordre (meilleure permutation cyclique), et il faut vérifier les appels de production (`opencvScan.ts:70/83`, `detection.ts:408/436`) avec un tri angulaire autour du barycentre.

### 1.4 Mesures complémentaires faites pour cet audit (scripts temporaires)

Pipeline photo = celui de `detecterFeuilleAuto`, reproduit à l'identique. « Live » = `detecterDocumentCv` sur une image réduite à 360 px, comme `detecterDepuisVideo` une fois OpenCV chargé.

**Détection** (erreur max en % de la diagonale ; pipeline photo : max % / moyenne en px / IoU) :

| Scène | Catégorie | Maison brut | OpenCV 480 | Pipeline photo | Live 360 |
|---|---|---|---|---|---|
| fond texturé fort (bois sombre, grain 40) | fond texturé | 0,12 | 0,27 | 0,22 / 1,5 / 0,987 | 0,39 |
| blanc sur blanc (écart ≈ 8 niveaux) | blanc sur blanc | 4,39 | 0,65 | **24,94 / 112,6 / 0,520** | 0,80 |
| ombre portée 60 % en travers | ombre | 4,40 | 0,30 | 0,42 / 1,7 / 0,987 | 0,32 |
| reflet spéculaire sur le coin HD | reflet | 15,25 | 9,30 | **9,30 / 19,7 / 0,857** | 9,40 |
| papier courbé (flèche 14 px) | courbé | 2,24 | 0,67 | 1,91 / 11,6 / 0,933 | 0,73 |
| papier plié en V (8 px) | plié | 0,69 | 0,24 | 0,73 / 3,7 / 0,974 | 0,26 |
| trapèze extrême (côtés 120/560 px) | angle extrême | ÉCHEC | ÉCHEC | **ÉCHEC** | ÉCHEC |
| rotation 45° sur bois | angle extrême | détection juste ; vérité dégénérée (§1.3, point 8) | | | |
| faible luminosité (×0,28, bruit ISO 10) | faible lumière | 0,14 | 0,30 | 0,16 / 0,8 / 0,995 | 0,26 |
| doigts sur le bord gauche | doigts | 0,12 | 0,27 | 0,24 / 1,6 / 0,986 | 0,26 |
| ticket ratio 0,2, bruité et flou | reçu étroit | 0,20 | 1,19 | 0,14 / 0,9 / 0,974 | 0,96 |
| facture A4 1600×1200 | facture A4 | 0,06 | 0,41 | 0,21 / 3,8 / 0,987 (471 ms) | 0,26 |
| flou de bougé horizontal 19 px | flou | 0,10 | 0,93 | 1,06 / 8,3 / 0,934 | 0,74 |
| carte devant un bord de table (référence) | référence | 0,14 | 2,62 | 1,28 / 6,1 / 0,888 | 2,62 |

Diagnostic étape par étape sur « blanc sur blanc » : maison 4,39 %, OpenCV 640 0,53 %, vote robuste 0,53 %, **extension 23,85 %**, affinage 24,94 %. L'extension prend le fond blanc pour la suite du papier. Le trapèze extrême est rejeté par conception (`RAPPORT_COTES_MIN = 0,35`, `ANGLE_MIN_DEG = 50`).

**Stabilité live simulée** : 40 images par scène, tremblement de ±1 px, bruit capteur ±4 à chaque image. Le temps jusqu'au verrou est estimé à (images + 5) × (calcul + pause de 120 ms) ; Node sur desktop, à multiplier par 3 à 6 sur un téléphone milieu de gamme.

| Scène | Moteur | Détection/image | Jitter brut (px/image) | Jitter affiché (px) | Erreur affichée médiane | Images jusqu'au verrou | ms/image |
|---|---|---|---|---|---|---|---|
| feuille blanche / table claire | OpenCV 360 | 100 % | 2,84 | 1,05 | 0,31 % | 1 | 17 |
| feuille avec ombre portée | OpenCV 360 | 98 % | 1,76 | 0,67 | 0,33 % | 1 | 17 |
| feuille avec ombre portée | maison 180 (avant chargement d'OpenCV) | 100 % | 26,7 | 8,2 | **16,9 %** | **jamais** | 17 |
| blanc sur blanc | OpenCV 360 | 100 % | 2,08 | 0,76 | 0,80 % | 1 | 20 |
| blanc sur blanc | maison 180 | 90 % | 22,9 | 3,4 | **6,1 %** | **jamais** | 26 |
| faible luminosité | maison 180 | 100 % | 13,8 | 5,6 | 1,8 % | 1 | 19 |
| autres (carte, bois, ticket, doigts) | les deux | 100 % | 1,3 à 5,6 | 0,5 à 2,0 | < 1 % | 1 | 13 à 21 |

Lecture : avec OpenCV, le direct est stable sur du synthétique. Pendant les premières secondes, OpenCV (10,4 Mo) n'est pas encore chargé et le viseur utilise le détecteur maison à 180 px : sur une ombre ou du blanc sur blanc, le cadre affiché reste faux. Il n'existe **aucun verrouillage ni déclenchement automatique** (CamScanner capture seul quand le cadre est stable). On ne peut donc mesurer qu'un « temps jusqu'au cadre stable », pas un temps jusqu'à la capture.

**Rendu** : chaîne complète puis `magicColor`, comparée à la page idéale (même contenu, papier blanc pur, sans bruit ni ombre). Les coins sont soit la vérité terrain, soit ceux du pipeline photo.

| Scène | Coins | PSNR | SSIM | Contraste | Écart-type papier | Papier ≥ 245 |
|---|---|---|---|---|---|---|
| fond texturé fort | vérité / détectés | 19,2 / 16,8 dB | 0,904 / 0,881 | 255 / 255 | 0,0 / 0,0 | 100 / 100 % |
| ombre 60 % en travers | vérité / détectés | 18,6 / 14,5 | 0,912 / 0,834 | 255 / 254 | 0,1 / 7,6 | 100 / 100 % |
| reflet spéculaire | vérité / détectés | 19,0 / **9,3** | 0,922 / **0,664** | 248 / 128 | 0 / 54 | 100 / 94 % |
| blanc sur blanc | vérité / détectés | 19,4 / **7,9** | 0,928 / **0,592** | 255 / 27 | 0 / 66 | 100 / 92 % |
| faible luminosité | vérité | **10,7** | **0,231** | 213 | **64,5** | **56 %** |
| facture A4 1600×1200 | vérité / détectés | 21,8 / 16,3 | 0,863 / 0,828 | 255 / 252 | 0 / 12,7 | 100 / 100 % |
| flou de bougé | vérité / détectés | 20,3 / 14,5 | 0,893 / 0,831 | 254 / 251 | 6,1 / 26 | 99 / 98 % |
| papier courbé / plié | vérité | 6,0 / 6,8 | 0,44 / 0,49 | négatif | ≈ 90 | 80 à 86 % |

Lecture :
- Avec de bons coins, « Magique » blanchit bien le papier (100 % ≥ 245) et sature l'encre (0). Le PSNR plafonne vers 19 à 22 dB parce que l'encre idéale vaut 34, pas 0. Il faut donc juger le rendu sur une vérité **binarisée** (§3.3) plutôt qu'en PSNR brut.
- **Faible luminosité** : le filtre amplifie le bruit (papier à 214 de moyenne, écart-type 64, netteté ×14 par rapport à la vérité, ce qui veut dire du bruit et non du détail). C'est le seul cas où le rendu échoue même avec des coins parfaits. Il faut un débruitage avant la courbe.
- **Courbé / plié** : une métrique alignée pixel à pixel n'est pas adaptée (les lignes restent décalées de quelques px). Pour cette catégorie, mesurer la **rectitude des lignes** (§3.3).
- Toutes les grosses pertes de rendu viennent d'une **erreur de coins** (blanc sur blanc, reflet). La détection est le premier levier.

---

## 2. Jeu de test cible

### 2.1 Synthétique (dans le dépôt, déterministe)

Étendre `scenes.ts`, ou créer `scenes2` à côté pour ne pas casser les bancs actuels. Il faut des options de génération, des post-traitements purs, plusieurs résolutions et une vérité de rendu.

| Catégorie | Variantes (graine fixe) | Paramètre clé |
|---|---|---|
| Référence actuelle | les 13 scènes existantes | — |
| Fond de table texturé | bois sombre grain 40, tissu à motifs, carrelage à joints (droites parasites), journal sous la feuille | contraste du motif ≥ contraste du bord |
| Blanc sur blanc | écart papier/fond de 4, 8 et 15 niveaux, avec et sans ombre de contact | ΔL |
| Ombre portée | ombre de main ou de téléphone en travers du texte (60 %), ombre en coin, double ombre | force, orientation |
| Reflet | tache spéculaire saturée sur un coin, sur un bord, bande de néon | rayon, position |
| Plié / courbé | flèche de 6, 14 et 25 px, pli en V, page de livre (gouttière) | flèche |
| Angles extrêmes | rotation 40 / 45 / 60 / 90°, trapèze 0,35 / 0,25, vue rasante | rapport des côtés |
| Faible luminosité | ×0,4 et ×0,25 avec bruit ISO 6 à 14, dominante tungstène | gain, σ |
| Doigts sur le bord | 1 à 3 doigts sur un bord, pouce sur un coin, ongle clair | recouvrement |
| Reçu étroit | ratio 0,2 et 0,15, papier thermique gris, enroulé, sur fond clair | ratio |
| Facture A4 | 1600×1200 et 3000×2250, logo couleur, tableau, tampon | résolution |
| Flou | bougé 9 et 19 px, mise au point ratée (gaussien σ 2) | noyau |
| JPEG | toutes les scènes recompressées en qualité 0,7 | artefacts |

Chaque scène porte : `quad` vérité, catégorie, résolution et une **page idéale** (même contenu, papier 255, encre 0) pour le rendu. Les coins se comparent sans tenir compte de l'ordre.

### 2.2 Photos réelles fournies par l'utilisateur : protocole de capture

À donner tel quel à l'utilisateur :

> **Matériel** : ton téléphone habituel, CamScanner (version du Play Store, à noter) et Kilio sur le même téléphone. Lumière d'intérieur ordinaire, sauf mention contraire.
>
> **Documents** : 12 cas. Utilise de préférence des documents sans données personnelles (prospectus, notice, ticket de caisse anonyme, page de magazine, facture d'exemple imprimée). Sinon, masque nom, adresse et numéros avec un papier posé dessus **avant** la photo.
>
> | # | Cas | Mise en place |
> |---|---|---|
> | 1 | A4 blanc sur table en bois | vue de dessus, document entier visible |
> | 2 | A4 blanc sur table blanche ou plan de travail clair | idem |
> | 3 | A4 avec ombre de ton bras ou du téléphone en travers | lampe de côté |
> | 4 | A4 sous un plafonnier qui fait un reflet | papier glacé ou plastifié si possible |
> | 5 | A4 plié en deux puis déplié, et page de livre ouvert | — |
> | 6 | A4 pris en biais fort (environ 45° de côté) | — |
> | 7 | A4 tourné d'environ 45° sur la table | — |
> | 8 | A4 en faible lumière (lampe de chevet seule, flash coupé) | — |
> | 9 | A4 tenu à la main, doigts sur un bord | — |
> | 10 | ticket de caisse long et étroit, un peu froissé | — |
> | 11 | facture A4 avec logo couleur et tableau | — |
> | 12 | carte (fidélité, transport) sur fond texturé | — |
>
> **Pour chaque cas, dans cet ordre, sans bouger le document :**
> 1. **Photo brute** avec l'appareil photo du téléphone (pas CamScanner), en qualité maximale. C'est l'entrée commune aux deux apps.
> 2. **CamScanner** : scanne le document, laisse le recadrage automatique **sans le retoucher**, filtre « Magic Pro » (ou le filtre par défaut, à noter). Exporte en JPEG : la page recadrée « Original » **et** la page filtrée.
> 3. **Kilio** : importe la *photo brute* de l'étape 1 (bouton Importer) et exporte en JPEG qualité Élevée sans toucher aux coins. Puis refais une capture directe dans le viseur et exporte-la.
> 4. Note sur un papier : le nombre de retouches de coins qu'il aurait fallu dans chaque app (0, 1, 2 ou plus).
>
> **Vidéo du direct (10 s, 3 cas : 1, 2 et 8)** : filme avec l'appareil photo du téléphone, en 1080p à 30 i/s, en tenant le téléphone comme pour scanner. Pendant 2 s, approche-toi du document. Pendant 6 s, reste immobile au-dessus. Pendant 2 s, fais une légère dérive latérale. Puis **enregistre l'écran** pendant que tu fais le même geste dans CamScanner, déclenchement automatique activé, pour qu'on puisse compter le temps jusqu'à la capture automatique et le tremblement de son cadre.
>
> **Dépôt des fichiers** : un dossier par cas (`cas-01/photo.jpg`, `camscanner-original.jpg`, `camscanner-magic.jpg`, `kilio-import.jpg`, `kilio-direct.jpg`, `video.mp4`, `ecran-camscanner.mp4`), **sur ton ordinateur**, hors du dépôt Git (voir §4).

Vérité terrain : les 4 coins de chaque `photo.jpg` sont saisis une fois à la main avec un petit outil local. On peut réutiliser `EditeurCoins` et sa loupe ×3 dans une page de développement, ou utiliser un script qui affiche la photo et enregistre `verite.json`. Les coins réels se saisissent à ±3 px près sur 3000 px, soit environ 0,1 % de la diagonale.

---

## 3. Métriques et seuils de succès

Les seuils « cible » sont ceux qui donnent un avantage net en usage. Les seuils « parité » correspondent à ce que CamScanner obtient d'ordinaire ; ils seront à recaler sur les sorties réelles de CamScanner (§4.2).

### 3.1 Détection des bords

| Métrique | Définition | Parité | Cible |
|---|---|---|---|
| IoU | aire(inter) / aire(union) des quadrilatères (raster ou Sutherland–Hodgman) | ≥ 0,95 sur chaque cas | ≥ 0,97 en médiane |
| Erreur de coin max | pire coin, en % de la diagonale, sans tenir compte de l'ordre | ≤ 1,5 % | ≤ 0,8 % |
| Erreur de coin moyenne | en px, ramenée à une diagonale de 1000 px | ≤ 8 px | ≤ 4 px |
| Taux d'échec | null **ou** IoU < 0,90 | ≤ 10 % des photos réelles | ≤ 5 % |
| Faux positifs | cadre proposé avec IoU < 0,5 (pire que le cadre par défaut) | 0 sur la référence | 0 partout |
| Retouches nécessaires | nombre de coins à déplacer (erreur > 1 % de la diagonale) | ≤ CamScanner, cas par cas | — |
| Temps photo | `detecterFeuilleAuto` sur 3000 px, téléphone de référence | ≤ 1,5 s | ≤ 0,8 s |

Le seuil actuel du banc (3 %, soit 24 px sur 640×480) est trop lâche pour départager les versions. Passer à 1 % sur la référence synthétique et suivre les **régressions relatives** : une PR échoue si la médiane d'une catégorie se dégrade de plus de 0,2 point.

### 3.2 Stabilité du cadre en direct

| Métrique | Définition | Parité | Cible |
|---|---|---|---|
| Jitter affiché | déplacement moyen des coins affichés d'une image à l'autre, document immobile, en px pour une vidéo de 1080 px | ≤ 3 px | ≤ 1,5 px |
| Erreur affichée médiane | écart cadre affiché / vérité en phase immobile | ≤ 1,5 % | ≤ 1 % |
| Taux de détection par image | part des itérations où la détection renvoie un cadre | ≥ 90 % | ≥ 97 % |
| Temps jusqu'au cadre stable | de l'entrée du document dans le champ à 5 détections consécutives à < 2 % de la vérité | ≤ 1,0 s | ≤ 0,6 s |
| Latence de détection | durée d'une itération (capture, détection, `setDetection`), p50 et p95 | p95 ≤ 120 ms | p95 ≤ 60 ms |
| Retard en mouvement | écart du cadre en phase de dérive (lag du filtre) | ≤ 4 % | ≤ 2,5 % |
| Temps avant OpenCV | du montage du viseur à `openCvSiPret() !== null` (cache chaud / froid) | — | froid ≤ 4 s en 4G |
| Temps jusqu'à la capture auto | **sans objet aujourd'hui** (pas d'auto-capture) ; mesurer CamScanner pour fixer la cible d'une future fonction | — | ≤ CamScanner |

### 3.3 Rendu

| Métrique | Définition | Parité | Cible |
|---|---|---|---|
| F-mesure texte (style DIBCO) | encre détectée vs encre de la page idéale binarisée | ≥ 0,90 | ≥ 0,94 |
| PSNR binarisé | PSNR contre la page idéale binarisée (encre 0, papier 255) | ≥ 16 dB | ≥ 18 dB |
| SSIM luminance | fenêtres 8×8 | ≥ 0,85 | ≥ 0,90 |
| Contraste texte/fond | moyenne du papier − moyenne de l'encre (masque de la vérité, érodé de 2 px) | ≥ 200 | ≥ 230 |
| Homogénéité du fond | écart-type de la luminance du papier (marges de 3 % exclues) | ≤ 8 | ≤ 4 |
| Papier blanc | part du papier ≥ 245 | ≥ 95 % | ≥ 99 % |
| Netteté | variance du laplacien sortie / idéal, **et** énergie haute fréquence sur le papier seul (pour séparer le bruit de la netteté) | 0,9 à 1,6 sans bruit sur le papier | — |
| Couleur conservée | ΔE2000 moyen sur logo et tampon | ≤ 10 | ≤ 6 |
| Rectitude des lignes (courbé/plié) | écart-type vertical de la ligne de base de chaque ligne de texte, en px pour une page de 2000 px | ≤ 4 px | ≤ 2 px |
| Photos réelles, sans référence | contraste, homogénéité, papier ≥ 245, netteté | ≥ CamScanner − 5 % | ≥ CamScanner |
| Photos réelles vs CamScanner | SSIM entre la sortie Kilio et la sortie CamScanner recalées par homographie | ≥ 0,80 | — |

---

## 4. Harnais automatisable

### 4.1 Architecture de fichiers proposée

```
src/lib/scanner/banc/                       (versionné, synthétique uniquement)
  metriques.ts            IoU, erreurs de coins sans ordre, PSNR, SSIM, F-mesure, contraste,
                          homogénéité, netteté, rectitude des lignes (pur, sans DOM)
  metriques.test.ts       tests des métriques elles-mêmes (cas connus)
  scenesEtendues.ts       catégories du §2.1, post-traitements purs, page idéale
  pipeline.ts             appel de la chaîne de production SANS canvas : detecterPhoto(cv, img)
                          = même enchaînement que detecterFeuilleAuto ; rendrePage(img, quad)
                          = même chaîne que creerPage (à extraire de traitement.ts pour les partager)
  video.ts                séquences d'images synthétiques (approche, immobile, dérive) + vérité
                          par image, utilisées par le banc live Node et par l'export .y4m
  detection.banc.test.ts  (remplace les deux bancs) : pipeline photo + bruts, par catégorie
  live.banc.test.ts       simulation de suivi : detecterDocumentCv 360 / maison 180 + suivreCadre
  rendu.banc.test.ts      chaîne complète + magicColor vs page idéale
  seuils.json             seuils par catégorie (absolus + régression relative)
scripts/banc-scanner/
  generer-videos.mjs      exporte video.ts en .y4m (ffmpeg -f rawvideo -pix_fmt rgba … -pix_fmt yuv420p)
  rapport.mjs             agrège les JSON en un tableau Markdown (comparaison avec la dernière référence)
  local-reel.mjs          banc sur les photos réelles : lit $KILIO_BANC_DIR, écrit des métriques seules
  aligner-camscanner.py   (optionnel, local) homographie ORB/SIFT entre photo brute et sortie
                          CamScanner, pour en déduire le quadrilatère CamScanner
e2e/scanner/
  viseur-live.spec.ts     viseur sur caméra simulée, mesure jitter/latence/temps jusqu'au cadre stable
  import-photo.spec.ts    import d'une photo → coins proposés → export, sans réseau
playwright.scanner.config.ts   projet dédié (flags de fausse caméra, 1 worker, pas de retry)
banc-scanner-local/      (IGNORÉ PAR GIT) photos réelles, vérités, sorties CamScanner, résultats
```

Exécution :
- `npx vitest run src/lib/scanner/banc`, en CI, en 1 à 2 minutes. Le JSON de résultats sert d'artefact, et l'échec ne se déclenche que sur seuil absolu ou régression relative.
- `npx playwright test -c playwright.scanner.config.ts`, en local ou en CI sur demande. Il faut un build de production, comme `run-instant-rig.sh`.
- `node scripts/banc-scanner/local-reel.mjs`, **uniquement en local**, sur les photos de l'utilisateur.

### 4.2 Banc Node (vitest)

- OpenCV en Node comme `opencvScan.banc.test.ts` (`@techstark/opencv-js` via `createRequire`, `@vitest-environment node`) : même moteur qu'en production.
- Les fonctions de `traitement.ts` dépendent du canvas. Il faut extraire leur enchaînement pur (`detecterPhoto`, `rendrePage`) pour que le banc teste **exactement** la chaîne livrée. C'est ce manque qui a masqué la régression « blanc sur blanc ».
- Pour les photos réelles en Node : décodage JPEG sans canvas (`jpeg-js` ou `sharp` en devDependency) et réduction à 3000 px comme `chargerImage`, orientation EXIF comprise.
- Sorties : `resultats.json` (par scène : catégorie, métriques, durée) et un tableau Markdown dans la console, comme le rapport actuel.

### 4.3 Banc navigateur (Playwright + caméra simulée)

```ts
// playwright.scanner.config.ts (esquisse)
use: {
  ...devices["Pixel 7"],
  permissions: ["camera"],
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${process.env.SCANNER_VIDEO ?? "e2e/scanner/videos/blanche-table-claire.y4m"}`,
    ],
  },
}
```

- Chrome n'accepte que **.y4m** (ou .mjpeg) pour `--use-file-for-fake-video-capture`. Conversion d'une vidéo réelle : `ffmpeg -i video.mp4 -vf scale=1920:1080,fps=30 -pix_fmt yuv420p video.y4m`. Le fichier boucle à la fin, ce qui suffit pour la phase immobile.
- Mesure **sans modifier le code** : `page.evaluate` installe un `MutationObserver` sur l'attribut `d` du `<path>` de l'overlay et sur la pastille « Feuille repérée ». Chaque changement est horodaté (`performance.now()`), avec le `viewBox` (repère natif de la vidéo). La vérité par image est connue pour les vidéos synthétiques (`video.ts`). Pour une vidéo réelle, on saisit les coins sur quelques images clés et on interpole.
- Pour une mesure plus fine (latence par itération, moteur maison ou OpenCV, temps avant OpenCV), ajouter **plus tard** une télémétrie activée seulement par une variable d'environnement de test (`window.__scannerBanc`), sur le modèle d'`EXPOSE_TESTING_API`. Ce n'est pas nécessaire pour un premier jet.
- Réseau limité via CDP (`Network.emulateNetworkConditions`, profil 4G) et CPU ralenti (`Emulation.setCPUThrottlingRate` ×4) : cela approche un téléphone milieu de gamme et mesure le temps avant OpenCV en cache froid et en cache chaud (service worker).
- Second test : import d'une photo (`setInputFiles` sur l'input Importer), lecture des coins proposés dans `EditeurCoins` (poignées), comparaison à la vérité, puis export JPEG intercepté (`page.waitForEvent("download")`) et métriques de rendu sur le fichier.
- Le Chrome desktop n'est pas un téléphone : les chiffres absolus de latence restent indicatifs. Seule une mesure sur un appareil réel fait foi (§4.5).

### 4.4 Comparaison côte à côte avec CamScanner, sans données personnelles dans le dépôt

1. **Stockage hors dépôt** : `KILIO_BANC_DIR=~/kilio-banc-scanner` par défaut, en dehors du clone. Si un dossier dans le dépôt est préféré (`banc-scanner-local/`), l'ajouter à `.git/info/exclude` (local, jamais commité) **et** à `.gitignore` (à faire dans une PR dédiée, non faite ici puisque l'audit ne modifie rien). Le script local refuse de tourner si `git check-ignore` ne confirme pas que le dossier est ignoré.
2. **Nettoyage à l'entrée** : suppression des EXIF (GPS, modèle) par `exiftool -all=` ou un ré-encodage, et nommage anonyme `cas-01`… Ne jamais garder le nom d'origine du fichier.
3. **Coins de CamScanner** : CamScanner n'exporte pas ses coins. `aligner-camscanner.py` (local, OpenCV Python, ORB + RANSAC) recale `camscanner-original.jpg` sur `photo.jpg`. L'homographie inverse projette les coins de la page recadrée dans la photo et donne le quadrilatère CamScanner, qui se compare à la même vérité que Kilio (IoU, erreur de coins). Si le recalage échoue (inliers < 30), le cas est noté « non mesurable », pas en échec.
4. **Rendu** : métriques sans référence (contraste, homogénéité, papier ≥ 245, netteté, couleur) pour les deux sorties, plus un SSIM entre Kilio et CamScanner après recalage. On produit aussi une **planche locale** (photo, CamScanner, Kilio, carte des différences) en HTML dans le dossier ignoré, pour juger à l'œil.
5. **Direct** : sur l'enregistrement d'écran CamScanner, on compte les images de l'entrée du document à la capture automatique (`ffprobe` + repérage du flash ou du changement d'écran) pour fixer la cible du temps jusqu'au verrou. La même vidéo brute, convertie en .y4m, alimente Kilio via la caméra simulée.
6. **Ce qui peut entrer dans le dépôt** : uniquement les **chiffres agrégés** par cas anonyme (par exemple `reports/…/resultats-reels-AAAA-MM-JJ.md`), jamais une image, une miniature, un texte OCR ou un nom de fichier d'origine.

### 4.5 Appareil réel (référence de vitesse)

Une fois par lot : le même `viseur-live.spec.ts` sur Chrome Android, via `adb` et le débogage distant (Playwright `_android`, expérimental) ou à la main. Une page de développement affiche les p50 et p95 de latence et le temps avant OpenCV. On consigne le modèle de téléphone avec les chiffres.

---

## 5. Options algorithmiques (côté client)

| Option | Ce que c'est | Taille | Licence | Gain attendu | Effort | Risque |
|---|---|---|---|---|---|---|
| **Garder et corriger l'existant** (maison + OpenCV.js 4.10, déjà là) | corriger l'extension sur fond clair, ordre des coins sans ambiguïté, trapèze < 0,35 accepté si les droites sont fortes | 0 (OpenCV : 10,4 Mo, déjà chargé) | Apache-2.0 (OpenCV) | **élevé** sur les régressions mesurées : blanc sur blanc de 24,9 % à environ 0,5 % si l'extension est bridée ; pas de gain sur le reflet | faible | faible |
| **Reflet** : fusion de cadres robuste (droites de Hough sur les 3 côtés visibles + coin extrapolé), ou exclusion des zones saturées avant Canny | algorithme maison sur OpenCV | 0 | — | moyen : reflet de 9,3 % à < 1 % visé | moyen | moyen |
| **jscanify** 1.4.3 | contour le plus grand avec OpenCV.js (Canny, `findContours`, `approxPolyDP`) | ≈ 10 Ko de JS + OpenCV.js | MIT | **nul à négatif** : c'est un sous-ensemble de `detecterDocumentCv` (une seule passe, sans vote) ; utile seulement comme témoin dans le banc | faible | faible |
| **DocAligner** (DocsaidLab), ONNX `lcnet100` | réseau qui prédit directement les 4 coins (heatmaps), robuste aux fonds clairs, reflets et occultations | **4,8 Mo** (fp32 ; ≈ 1,3 Mo en int8 à vérifier), variante FastViT 83 Mo à exclure | Apache-2.0, code et poids utilisables commercialement (selon docsaid.org) | **élevé** sur blanc sur blanc, reflet, doigts et angles extrêmes ; à valider sur les photos réelles. Bon candidat **dans le vote** (`supplementaires`) plutôt qu'à la place | moyen (pré et post-traitement, worker) | moyen : poids du runtime, latence en direct (256 px, à mesurer ; probablement trop lent à 8 i/s sur un téléphone d'entrée de gamme, donc pour la photo seulement) |
| **onnxruntime-web** 1.31 (runtime pour DocAligner ou UVDoc) | moteur WASM / WebGPU | `ort-wasm-simd-threaded.wasm` **14,8 Mo** non compressé (≈ 3 à 4 Mo en brotli) ; variante JSEP/WebGPU 29,5 Mo | MIT | condition de toute option ONNX | moyen (COOP/COEP pour les threads, sinon mono-thread) | moyen : s'ajoute aux 10 Mo d'OpenCV ; chargement à la demande et service worker obligatoires |
| **UVDoc** (PaddleOCR), ONNX | aplatissement neuronal de page courbée ou pliée (grille de déplacement) | **31,7 Mo** | Apache-2.0 | moyen à élevé sur courbé/plié (rectitude des lignes), nul ailleurs ; option « Aplatir » à la demande, pas par défaut | élevé | élevé : poids, temps (plusieurs secondes sur un téléphone), artefacts sur les pages planes |
| **MediaPipe Tasks Vision** 1.2 | segmenteurs et détecteurs génériques | ≈ 10 Mo de WASM + modèle | Apache-2.0 | **faible** : aucun modèle « document » fourni ; il faudrait entraîner un segmenteur sur mesure | élevé | élevé |
| **Débruitage avant « Magique »** (`fastNlMeansDenoising` n'est pas dans OpenCV.js ; à la place un bilatéral ou une médiane 3×3 sur la luminance, conditionnés à l'estimation du bruit) | traitement classique | 0 | — | **élevé** en faible lumière : papier ≥ 245 de 56 % à > 95 % visé, écart-type du papier de 64 à < 8 | faible | faible (perte de traits fins si appliqué partout : à conditionner) |
| **Auto-capture** (verrou de stabilité : N images à jitter < 1,5 px et IoU > 0,98 entre elles) | logique au-dessus de `suivi.ts` | 0 | — | parité fonctionnelle avec CamScanner sur le temps jusqu'à la capture | faible à moyen | faible (désactivable) |
| SDK commerciaux (Scanbot, Dynamsoft, ML Kit Document Scanner) | — | — | propriétaires ; ML Kit est natif Android, pas web | élevé | — | **exclus** : licence payante, données, pas de web pour ML Kit |

Ordre recommandé, à confirmer par le banc :
1. Le harnais Node étendu (§4.2), qui teste le pipeline de production.
2. Brider `etendreAuxBordsDeLaFeuille` quand le fond est aussi clair que le papier, et ordonner les coins de façon robuste.
3. Débruitage conditionnel avant « Magique ».
4. Faire tourner le détecteur maison en direct à 360 px plutôt qu'à 180, ou précharger OpenCV dès l'ouverture du menu Plus, pour supprimer la fenêtre sans OpenCV.
5. Auto-capture.
6. DocAligner `lcnet100` dans le vote de la photo, derrière un drapeau, jugé sur les photos réelles.
7. UVDoc seulement si les photos réelles de pages courbées restent sous le seuil de rectitude.

---

## 6. Reproductibilité de ce rapport

- Base : `npx vitest run src/lib/scanner` (après `npm ci`), soit 183 tests verts et les tableaux du §1.2 imprimés par les bancs.
- Mesures du §1.4 : script temporaire `scanner.mesure.ts` et diagnostic `etapes.mesure.ts`, lancés avec une config vitest dédiée (environnement node) dans le scratchpad de la session. Ils importent les modules de production et une copie de `scenes.ts` qui exporte `fabriquerScene`. Ils ne sont pas versionnés ; le §4.1 décrit leur équivalent pérenne.
- Limites : CPU desktop sous Node (pas de téléphone), scènes synthétiques, pas encore de sortie CamScanner. Les seuils de « parité » du §3 sont des hypothèses à recaler dès que les 12 cas réels seront mesurés.
