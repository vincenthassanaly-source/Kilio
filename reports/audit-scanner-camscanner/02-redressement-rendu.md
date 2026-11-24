# Audit scanner vs CamScanner : 02, redressement et rendu « Magique »

Audit en lecture seule du 2026-11-23. Aucun fichier du dépôt n'a été modifié, à l'exception de ce rapport.
Périmètre : `filtres.ts` (`magicColor`), `geometrie.ts`, `redressementPage.ts`, `redressementTexte.ts`, `aplatissage.ts`, `bordsPropres.ts`, `intrusions.ts`, `pdf.ts`, et la partie de `traitement.ts` qui suit le redressement.
Hors périmètre : détection et viseur (voir `01-detection-viseur.md`), OCR, nouveaux filtres.

Légende : **[mesuré]** = chiffre sorti du banc décrit au §1 ; **[code]** = lu dans le source (fichier:ligne) ; **[supposé]** = déduction ou connaissance générale non vérifiée ici, en particulier tout ce qui concerne le fonctionnement interne de CamScanner (algorithmes non publics).

---

## 0. En bref

| # | Constat | Gravité | Nature |
|---|---|---|---|
| C1 | La « protection du contenu coloré » remplace le fond estimé par **255**. Dans une ombre ou sous faible lumière, une photo, un logo ou un tampon deviennent un **bloc noir entouré d'un halo gris**. | Critique | mesuré + cause localisée |
| C2 | Le rapport d'aspect est faux dès qu'il y a de la perspective : A4 **+5 % à 8°** d'inclinaison, **+16 % à 15°**, **+46 % à 35°**. | Élevée | mesuré |
| C3 | La page redressée est plafonnée à **2000 px** (≈ 171 dpi sur A4). Le petit texte perd en lisibilité, et la qualité d'export « Élevée 2400 px » n'agrandit jamais rien : elle se contente de recompresser. | Élevée | mesuré |
| C4 | Faux positifs des garde-fous géométriques : `redresserParTranches` cisaille une page plate floue, et `aplatirLesLignes` **ondule un tableau** dès que la résolution monte. | Élevée | mesuré |
| C5 | Une ombre à bord net laisse une **bande grise diagonale**. Sous lampe chaude, le papier reste **crème** (gains de balance des blancs bridés). | Moyenne | mesuré |
| C6 | L'encre bleue d'une signature devient **noire** (chroma conservée : 12 %). Le tampon rouge perd la moitié de sa saturation. | Moyenne | mesuré |
| C7 | Jusqu'à 4 rééchantillonnages successifs (perspective, tranches, aplatissage, rotation). Chacun coûte environ 6 % de netteté. | Moyenne | mesuré |
| C8 | Tout le traitement tourne sur le thread principal, sans Worker : environ 0,6 à 0,9 s par page sur un PC (pic de l'ordre de 110 Mo), ce qui donne sur téléphone [supposé] 2 à 4 s d'interface figée par page. | Moyenne | mesuré (PC) / supposé (mobile) |

---

## 1. Méthode et banc

Les scripts sont dans le scratchpad de session, pas dans le dépôt : `/tmp/claude-0/-home-user-Kilio/7d0e1a82-1b80-57c0-82df-0b89f9439b6f/scratchpad/rendu02/` (`gt.mjs`, `banc.ts`, `aspect.ts`, `reech.mjs`, `magicParam.ts`, `variantes.ts`). Les sorties sont dans `out/` : JSON, PNG, mosaïques.

1. **Tests existants.** `vitest run src/lib/scanner` : 20 fichiers, **183 tests verts**. Le banc de détection donne une erreur de coins de 0,06 à 0,53 % de la diagonale. Le banc `filtres.banc.test.ts` passe. Il ne couvre pourtant ni une ombre posée sur une photo ou un tampon, ni une faible lumière, ni le rapport d'aspect, ni des fines encres colorées. C'est pour cela que C1, C2 et C6 passent inaperçus.
2. **Vérité terrain.** Une page A4 rendue à 300 dpi (2480×3508) par SVG avec `sharp`. Elle contient un titre gras, du texte serif de 10 pt, du texte fin de 6 pt, du texte gris « crayon » (luminance 138), un tableau à filets de 2 px, une barre noire en texte inversé, un surligneur jaune, un tampon rouge à 85 %, une signature bleue de 5 px, un logo en dégradé orange→bleu et une « photo » en dégradé. Le contenu est générique : aucune donnée personnelle.
3. **Photo simulée.** La page est projetée en sténopé (f = 3100 px, capteur 3000×4000) avec une inclinaison, un lacet et un roulis 3D, ce qui donne une vraie perspective et un vrai rapport d'aspect. S'y ajoutent une teinte de papier, une teinte de lumière, du vignettage, un dégradé, des ombres, un flou optique (σ 1,4 px), du bruit capteur, un JPEG d'appareil q90, puis la réduction à 3000 px comme `chargerImage` (`traitement.ts:20,48`).
4. **Pipeline Kilio, à l'identique.** `tailleSortie`, puis `redresserCv` (OpenCV.js 4.10, `INTER_CUBIC`, chargé dans Node), puis `nettoyerLesBords`, `effacerLesIntrusions`, `redresserParTranches`, `aplatirLesLignes`, `redresserLesLignes` et `magicColor` (`traitement.ts:165-186`). Viennent ensuite un JPEG 0,92 pour le brouillon et la recompression d'export (`jpegPourExport`, Élevée 2400/0,88 et Standard 1600/0,70). Le JPEG est produit par libjpeg-turbo via sharp, en 4:2:0, ce qui est proche de `canvas.toBlob` dans Chrome [supposé].
5. **Métriques.** Elles sont calculées à une échelle commune (1654×2339, ≈ 200 dpi) contre la vérité terrain redimensionnée :
   - fond (pixels à au moins 4 px de toute encre) : moyenne, écart-type σ, part sous 245, moyenne de la tuile 32 px la plus sombre (ombre résiduelle) ;
   - encre du corps de texte, contraste fond−encre ;
   - texte fin : rappel (part des pixels d'encre de la vérité terrain qui sortent sous 128) et niveau moyen ;
   - netteté : énergie de gradient rapportée à la vérité terrain ;
   - SSIM en niveaux de gris sur fenêtres 8×8 (page entière, bloc de texte, texte fin) ;
   - ΔE CIELAB et rapport de chroma par zone colorée ;
   - temps par étape (Node 22, CPU x86 de conteneur) ;
   - taille JPEG.
6. **Variantes prototypes** (copie paramétrée de `filtres.ts` dans le scratchpad) : `protection` (correctif de C1), `seuils` (NOIR 0,5, BLANC 0,9), `combo` (les deux, plus WB_MAX 1,7), `kilio-3000` (`tailleSortie(quad, 3000)`).

Limites : les scènes sont synthétiques, sans pli réel, sans papier glacé ni reflet, et sans vraie photo de téléphone. Les temps sont mesurés sur PC, pas sur mobile. Aucune sortie CamScanner n'a pu être produite, donc aucune comparaison directe chiffrée avec elle.

### Scènes

| Code | Scène |
|---|---|
| A | Bureau, lumière douce, inclinaison 8°, vignettage 0,25 |
| B | A + ombre douce de main sur le quart inférieur droit, qui couvre la photo |
| C | A + ombre à bord net (pénombre 6 px) qui traverse la page |
| D | Lampe chaude (bleu × 0,55), exposition 0,55, bruit σ 8, vignettage 0,4 |
| E | Perspective forte (inclinaison 35°, lacet 8°) |
| F | Verso visible par transparence (14 %) |
| G | Flou de bougé (σ 2,6) + bruit σ 6 |

---

## 2. Résultats mesurés (pipeline actuel, export « Élevée »)

| Scène | Taille sortie | Erreur d'aspect | Fond σ | Fond < 245 | Tuile la plus sombre | Encre | Texte fin (rappel) | Crayon (vérité 138) | SSIM page | SSIM texte fin | ΔE photo | ΔE tampon | Chroma signature |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 1484×2000 | +5,0 % | 0,64 | 0,06 % | 246 | 26 | 81 % | 82 | 0,903 | 0,873 | 21 | 39 | 0,12 |
| B ombre douce | 1484×2000 | +5,0 % | **12,1** | 3,0 % | **96** | 26 | 82 % | 83 | 0,871 | 0,873 | **70** | 41 | 0,04 |
| C ombre nette | 1484×2000 | +5,0 % | **8,9** | 1,6 % | **73** | 26 | 81 % | 82 | 0,881 | 0,865 | **59** | 39 | 0,13 |
| D faible lumière | 1484×2000 | +5,0 % | **42,4** | **7,8 %** | **0** | 20 | 82 % | 82 | **0,772** | 0,823 | 47 | **70** | 0,01 |
| E perspective 35° | **1987×1922** | **+46,2 %** | 0,59 | 0,03 % | 248 | 25 | **53 %** | 108 | 0,911 | 0,857 | 21 | 33 | 0,23 |
| F verso | 1484×2000 | +5,0 % | 1,75 | 0,54 % | 230 | 25 | 83 % | 80 | 0,899 | 0,873 | 22 | 40 | 0,13 |
| G flou + bruit | 1484×2000 | +5,0 % | **18,9** | 1,7 % | 35 | 151* | **12 %** | 236 | 0,807 | **0,656** | 16 | 66 | 0,01 |

\* Pour G, `redresserParTranches` s'est déclenché sur une page plate et a cisaillé l'image. L'encre est alors mesurée en partie hors de ses pixels de référence. Voir C4.

Taille par page [mesuré] : brouillon 0,92 = 354 à 865 Ko ; export Élevée 0,88 = 320 à 719 Ko ; export Standard 0,70 = 134 à 200 Ko. Le maximum vient de la scène D, bruitée.

Temps par étape [mesuré, PC] :

| Étape | Temps |
|---|---|
| perspective OpenCV (copies comprises) | 130 à 270 ms |
| `bords` | 12 à 30 ms |
| `intrusions` | 12 à 73 ms |
| `tranches` | 38 à 180 ms |
| `aplatir` | 32 à 265 ms |
| `rotation` | 31 à 66 ms |
| **`magicColor`** | **350 à 540 ms** |

Total : 0,6 à 0,9 s par page, hors encodage JPEG.

Mosaïques à regarder : `out/v_B.jpg` (photo noircie dans l'ombre), `out/mos_ACDG.jpg` (A, C, D, G actuels), `out/mos_prot.jpg` (correctif C1 sur B, C, D, puis kilio-3000 sur A, tableau ondulé).

Ce qui va bien [mesuré] :
- Sous lumière ordinaire (A, E, F), le papier est blanc pur (moyenne 254,9, σ < 1).
- Le noir de l'encre est franc (environ 25 sur 255, contraste de 229).
- Le texte gris « crayon » est assombri de 138 à 82 : c'est l'effet « encre renforcée » attendu d'un Magic Color.
- La barre noire inversée reste noire (2).
- Le surligneur jaune garde sa teinte (ΔE 8 à 9, chroma 0,89).
- Le verso par transparence est presque entièrement effacé (0,5 % de fond sous 245).
- La sortie brute est déjà nettement plus nette que la vérité terrain floutée (énergie de gradient ×1,1, effet du masque flou).

---

## 3. Constats détaillés

### C1 : la protection des couleurs noircit photos, logos et tampons dans l'ombre [mesuré, cause localisée]
- **Code** [code] : `filtres.ts:228-233`. Une cellule de la grille plus sombre que 0,8 × le papier global *et* saturée reçoit `grille.p[i] = 255`, avant la fermeture morphologique et le flou (`:235-236`). Le fond estimé y vaut donc 255, quel que soit l'éclairage local. Le rapport pixel/fond (`:245`) tombe alors à « valeur de l'ombre / 255 », et la courbe tranchée (`NOIR 0,42`, `:142`) envoie la zone au noir. Le flou de boîte (`rayon/2`) étale ce 255 autour d'elle et crée un **halo gris** (visible en B et C autour de la photo, et sous la signature).
- **Effet** [mesuré] :
  - B : photo ΔE 70 (contre 21 hors ombre), tuile la plus sombre à 96, fond σ 12.
  - D : le logo du coin supérieur gauche (dans le vignettage) devient une tache noire de plus de 150 px, le tampon un disque noir (ΔE 70, chroma 0,13), et la tuile la plus sombre tombe à 0.
  - C'est précisément le genre d'écart visible du premier coup d'œil face à CamScanner.
- **Correctif prototypé** (`protection`) : une cellule protégée prend le niveau de papier **voisin**, par diffusion depuis les cellules non protégées, au lieu de 255.

| Mesure | Actuel | Prototype |
|---|---|---|
| B : fond σ | 12,1 | 0,45 |
| B : tuile la plus sombre | 96 | 254 |
| B : ΔE photo | 70 | 9,5 |
| B : ΔE logo | 39 | 28 |
| B : SSIM | 0,871 | 0,911 |
| D : fond σ | 42,4 | 2,3 |
| D : SSIM | 0,772 | 0,838 |
| D : ΔE photo | 47 | 12 |
| D : ΔE tampon | 70 | 36 |
| A (sans ombre) : SSIM | 0,903 | 0,914 |

  Aucune régression sur A, E et F. Coût CPU négligeable : la grille fait environ 420 px de côté.

### C2 : rapport d'aspect faux sous perspective [mesuré]
- **Code** [code] : `geometrie.ts:95-106`. La sortie prend le plus long des deux côtés opposés, en largeur comme en hauteur. Sous perspective, le côté proche s'allonge et le côté fuyant raccourcit, et ce calcul n'en tient pas compte.
- **Mesure** [mesuré, `aspect.ts`] sur un A4 projeté (largeur/hauteur vraie = 0,707) :

| Inclinaison / lacet | Erreur `tailleSortie` | Erreur Zhang & He (focale estimée par les 4 coins) |
|---|---|---|
| 0° | 0 % | 0 % |
| 8° / 4° | +4,8 % | 0,0 % |
| 15° | +15,8 % | −0,2 % |
| 25° / 5° | +27,7 % | 0,0 % |
| 35° / 8° | **+45,6 %** (sortie 1890×1836, une feuille A4 rendue presque carrée) | 0,0 % |
| 45° | +75,6 % | −1,6 % (focale par défaut 0,8 × grand côté) |

- **Conséquence** : les lettres paraissent écrasées ou élargies. En perspective forte (scène E), le rappel du texte fin tombe à 53 %. `placerSurA4` (`pdf.ts:30-52`) centre ensuite l'image déformée dans un A4 vrai, avec des marges blanches.
- [supposé] CamScanner redonne aux pages leurs proportions réelles. Le symptôme « page écrasée » est donc un écart visible.

### C3 : résolution de sortie plafonnée à 2000 px, et « Élevée » trompeuse [mesuré]
- **Code** [code] : `geometrie.ts:19` (`COTE_MAX_REDRESSE_PX = 2000`). La source fait jusqu'à 3000 px (`traitement.ts:20`), et une page qui remplit la photo en couvre environ 2600 à 2900 : on jette donc 30 à 45 % des pixels utiles.
- Export : `PARAMS_QUALITE.elevee.coteMax = 2400` (`pdf.ts:10`), mais `jpegPourExport` n'agrandit jamais (`traitement.ts:192`). « Élevée » se résume donc à une **seconde compression JPEG** (de 0,92 à 0,88) d'une image de 2000 px. Le PRODUCT.md annonce pourtant « 2400 px ».
- **Mesure** (`kilio-3000`, même pipeline avec plafond à 3000, ce qui donne 1808×2437 pour la scène A) :

| Mesure | Plafond 2000 | Plafond 3000 |
|---|---|---|
| Rappel du texte fin 6 pt | 81 % | 95 % |
| Niveau moyen du texte fin | 60 | 34 |
| SSIM bloc de texte | 0,883 | 0,936 |
| SSIM texte fin | 0,873 | 0,939 |
| Scène G : rappel du texte fin | 12 % | 34 % |
| Scène G : SSIM bloc de texte | 0,656 | 0,910 |

  Le gain sur G vient aussi de l'absence du faux positif de C4.
- **Mais** passer à 3000 tel quel déclenche les faux positifs d'aplatissage (C4) sur 5 scènes sur 7. Le SSIM de la page entière baisse alors (0,903 → 0,879 sur A) et le **tableau ondule** (`out/mos_prot.jpg`, 4e vignette). Il faut donc corriger C4 *avant* d'augmenter la résolution.
- [supposé] CamScanner exporte en général à la résolution de la photo, de l'ordre de 2500 à 4000 px de long côté. Le petit texte y est mesurablement plus lisible que chez nous à 171 dpi.

### C4 : faux positifs des garde-fous géométriques [mesuré]
- `redresserParTranches` s'est déclenché sur la scène G : page plate, seulement floue et bruitée. Le texte se retrouve cisaillé et décalé, et le SSIM du bloc de texte tombe à 0,656, contre 0,910 dans la même scène sans le déclenchement. Le contrôle « n'applique que si mesure améliorée » (`redressementPage.ts:189-198`) compare deux mesures également bruitées, si bien qu'une amélioration apparente suffit. Le seuil `ECART_MIN_DEG = 0,6` (`:24`) est franchi par du bruit de mesure sur un texte flou.
- `aplatirLesLignes` s'est déclenché sur A, B, C, D et F dès que la page redressée fait environ 2437 px de haut, alors que ces pages sont planes. Le résultat ondule visiblement (tableau, dernière vignette de `out/mos_prot.jpg`). Les seuils `COURBURE_MIN = 0,004` × hauteur et `AMELIORATION_MAX = 0,6` (`aplatissage.ts:36,46`) ne sont pas indépendants de l'échelle d'analyse. Le facteur de réduction vers 900 px change la quantification des centres de colonnes, et la régression locale crée une courbure qu'elle « corrige » ensuite. Ce dernier point est [supposé] et n'a pas été isolé.
- À 2000 px et sur scènes nettes, aucun déclenchement intempestif sur A à F.

### C5 : bande d'ombre nette et papier crème sous lampe chaude [mesuré]
- **Ombre nette** (C), même avec le correctif C1 : fond σ 1,75, tuile la plus sombre à 231, une **bande grise diagonale** le long du bord de l'ombre (`out/mos_prot.jpg`, 2e vignette). Cause [code + supposé] : fermeture de rayon 5 % du côté (`filtres.ts:159,235`) puis flou de boîte de rayon/2 sur une grille d'environ 420 px. Le fond estimé suit mal un échelon d'éclairage plus raide que ce flou : le bord de l'ombre devient une rampe d'environ 2,5 % de page, que la courbe tranchée transforme en gris.
- **Lampe chaude** (D) : le papier reste crème même après le correctif C1. Cause [code] : les gains de balance des blancs sont bornés à `WB_MAX = 1,33` (`filtres.ts:168,216`), alors que la scène demande environ 1,5 sur le bleu. Le rattrapage « papier neutre » ne s'applique ensuite qu'aux pixels dont la chroma reste sous 28 à 70 (`:171-175`).
- [supposé] CamScanner « Magic Color » rend un papier blanc même sous lampe tungstène.

### C6 : couleurs des encres fines [mesuré]
- Signature bleue : chroma conservée à **0,01 à 0,23** selon la scène, autrement dit elle sort noire. Cause [code] : `couleur = lisser(COULEUR_MIN 30, COULEUR_MAX 70, max−min)` est calculé pixel par pixel (`filtres.ts:153,261`). Un trait fin de 3 à 5 px, adouci par l'optique, a une chroma inférieure à 30 sur ses bords comme à cœur : il reçoit la courbe « encre neutre ».
- Tampon rouge : chroma 0,46 à 0,57, ΔE 30 à 40, un rouge qui tire sur le brun.
- [supposé] CamScanner conserve l'encre bleue des stylos, ce qui est un critère visible sur les documents signés.

### C7 : rééchantillonnages en cascade [mesuré]
- La chaîne peut enchaîner `warpPerspective` cubique (`opencvScan.ts:235`), un cisaillement bilinéaire (`redressementPage.ts:173-186`), un champ vertical linéaire (`aplatissage.ts:241-255`) et une rotation bilinéaire (`redressementTexte.ts:186-217`). Chaque étape relit l'image déjà rééchantillonnée, en pleine résolution.
- Mesure (`reech.mjs`) : énergie de gradient de **0,94 après 1 passe bilinéaire, 0,89 après 2, 0,85 après 3, 0,82 après 4**. C'est un flou cumulatif qui adoucit le texte fin avant la netteté du filtre.

### C8 : coût CPU et mémoire, sur le thread principal [mesuré PC / calculé / supposé mobile]
- Il n'y a ni Worker ni OffscreenCanvas dans le scanner. `creerPage` est appelée depuis `valider` (`ScannerApp.tsx:128`).
- Mesuré sur PC : 0,6 à 0,9 s par page, dont environ 0,4 s pour `magicColor` à 3 Mpx. À 3000 px (4,4 Mpx), `magicColor` prend 0,57 s.
- [supposé] Un téléphone milieu de gamme est 3 à 5 fois plus lent, ce qui donne 2 à 4 s d'interface figée par page.
- Mémoire [calculé à partir de `filtres.ts`] : environ 36 octets par pixel au pic dans `magicColor`, soit l'entrée RGBA, trois plans Float32, les rapports, deux flous de boîte (tmp et out) et la sortie. Cela fait environ 107 Mo pour 1484×2000 et environ 160 Mo à 3000 px. Les étapes géométriques allouent chacune une copie RGBA.
- L'import en lot décode toutes les photos à 3000 px avant le recadrage (`ScannerApp.tsx:108-110`), soit environ 27 Mo par photo gardés en file.
- Double compression : la page traitée est encodée à 0,92 (`traitement.ts:184`), puis décodée et réencodée à 0,88 à l'export (`ExportPanel.tsx:54`), sans redimensionnement en « Élevée ». SSIM brut → export : 0,907 → 0,903 (A). La perte est faible, mais l'export ne gagne rien en échange.

### Constats mineurs
- **Liseré pointillé gris sur les bords de page** [mesuré, visible sur toutes les sorties] : le pixel de bord mélange papier et table, puis la courbe tranchée le noircit. [supposé] CamScanner rogne quelques pixels vers l'intérieur.
- **PDF toujours A4** (`pdf.ts:30-52`) : un ticket (rapport 0,3) ou une carte se retrouve centré dans un A4 avec de grandes marges. [supposé] CamScanner propose une taille de page qui suit l'image (« Auto »).
- **Épaississement des premiers mots de chaque ligne** [observé sur les mosaïques, non mesuré, cause non isolée] : il apparaît surtout du côté où le vignettage est le plus fort.

---

## 4. Ce que fait CamScanner « Magic Color », et l'écart avec Kilio

Les algorithmes de CamScanner ne sont pas publics : toute cette section est **[supposé]**, d'après le comportement visible de l'application.

| Brique | CamScanner (comportement observé) | Kilio | Écart mesuré |
|---|---|---|---|
| Normalisation d'illumination | Fond estimé localement, sans halo, y compris derrière les photos et les ombres nettes | Fermeture sur grille d'environ 420 px avec protection à 255 | C1 (critique), C5 |
| Blanc du papier | Blanc même sous lampe chaude | Gains de balance des blancs bridés à 1,33 | C5 (D crème) |
| Binarisation douce et contraste de l'encre | Texte noir épais, demi-tons gardés | Courbe en S, NOIR 0,42 / BLANC 0,8, netteté 1,1 | Correct en lumière normale ; texte fin perdu sur photo floue (G : 12 %) |
| Couleurs | Stylo bleu bleu, tampon rouge vif | Chroma pixel par pixel avec seuil 30 | C6 |
| Débruitage | Présent [supposé] | Aucun | D : le bruit remonte dès qu'on durcit les seuils (variante `seuils` : σ 49) |
| Géométrie | Proportions réelles, un seul rééchantillonnage [supposé] | Plus long côté, jusqu'à 4 rééchantillonnages | C2, C7 |
| Résolution d'export | Proche de la photo | 2000 px max | C3 |

---

## 5. Recommandations

Gain : élevé, moyen ou faible. Effort : S (moins d'une journée), M (1 à 3 jours), L (plus). Aucune nouvelle dépendance n'est indispensable : OpenCV.js est déjà chargé et offre `remap`, `bilateralFilter`, `morphologyEx`, `GaussianBlur` et `resize`, plus rapides que les boucles JS.

| # | Recommandation | Gain | Effort | Risque | Dépendances |
|---|---|---|---|---|---|
| R1 | **Corriger la protection des couleurs** (`filtres.ts:233`) : une cellule protégée prend le niveau de papier local, par diffusion ou convolution normalisée depuis les cellules non protégées, au lieu de 255. Ajouter au banc deux scènes de régression : photo dans une ombre, logo dans un coin vignetté. | **Élevé, mesuré** : B σ 12,1 → 0,45, ΔE photo 70 → 9,5 ; D σ 42 → 2,3, SSIM +0,07 ; aucune régression sur A, E, F | S | Faible (prototype testé sur 7 scènes ; à valider sur une grande photo pleine page, où peu de papier voisin existe) | Aucune |
| R2 | **Rapport d'aspect réel** dans `tailleSortie` (`geometrie.ts:95`) : estimer la focale et le rapport largeur/hauteur à partir des 4 coins (Zhang & He 2007). Repli sur une focale par défaut de 0,8 × grand côté, ou sur l'EXIF quand il existe. Puis « aimanter » à un format connu s'il est à moins de 3 % (A4 0,707, Lettre 0,773, carte 1,586). Garder le calcul actuel si l'estimation est instable (quadrilatère quasi rectangle ou focale aberrante). | **Élevé, mesuré** : erreur 5 → 0 % à 8°, 46 → 0 % à 35° | S à M | Faible à moyen (coins posés à la main qui ne correspondent pas à un vrai rectangle : à borner) | Aucune |
| R3 | **Corriger les faux positifs géométriques avant toute montée en résolution.** Rendre `COURBURE_MIN` et les seuils indépendants de l'échelle. Exiger un nombre minimal de lignes nettes et un gain absolu, pas seulement relatif. Refuser le cisaillement quand le texte est flou (énergie de gradient faible) ou quand l'éventail mesuré tient dans l'incertitude de mesure. Ajouter les scènes « page plate floue » et « page plate à 2400 px » comme tests de non-déclenchement. | **Élevé, mesuré** : G SSIM texte 0,656 → 0,910 sans le cisaillement ; supprime l'ondulation du tableau | M | Moyen (risque de ne plus corriger de vrais plis : garder les tests existants d'`aplatissage.test.ts`) | Aucune |
| R4 | **Monter la résolution de sortie** une fois R3 en place : plafond à 3000 px, ou taille native de la page dans la source. Faire de « Élevée » la taille native (et non plus 2400, qui ne fait rien aujourd'hui), et revoir le texte de PRODUCT.md. | **Élevé, mesuré** : texte fin 6 pt 81 → 95 %, SSIM texte fin 0,873 → 0,939 | S (après R3) | Moyen : mémoire (environ 160 Mo au pic) et temps ×1,5 ; à coupler avec R7 | Aucune |
| R5 | **Un seul rééchantillonnage** : calculer cisaillement, aplatissement et rotation sur l'image d'analyse, les composer en une carte de déplacement, et faire un unique `cv.remap(INTER_CUBIC)` depuis la **source** (3000 px) au lieu de rééchantillonner l'image déjà redressée. | Moyen, mesuré indirectement : jusqu'à 18 % de netteté récupérée quand 3 étapes s'appliquent | M | Moyen (refonte de l'ordre des étapes de `traitement.ts:182`) | Aucune (OpenCV présent) |
| R6 | **Fond plus local aux ombres nettes** : estimer le fond à deux échelles (fermeture courte d'environ 1,5 % pour suivre les bords d'ombre, longue de 5 % pour les blocs d'encre), en choisissant l'échelle selon le gradient du fond. Ou affiner le fond grossier par un filtre guidé sur la luminance. | Moyen, supposé (la bande de C et la tuile à 231 doivent disparaître) | M | Moyen (texte gras ou grands titres pris pour du fond, à tester sur la barre noire et le titre de 110 px) | Aucune |
| R7 | **Traitement dans un Web Worker** (OffscreenCanvas, buffers transférables), et ne décoder qu'une photo à la fois dans la file d'import. Remplacer les boucles JS les plus lourdes (flous de boîte, morphologie) par OpenCV. | Moyen (fluidité ; c'est aussi la condition de R4) | M | Faible à moyen (OpenCV à charger dans le Worker) | Aucune |
| R8 | **Encre colorée fine** : calculer la « couleur » sur une chroma lissée (fenêtre de 5 à 7 px) ou sur la cohérence de teinte du trait, plutôt que pixel par pixel. Abaisser `COULEUR_MIN` pour les pixels sombres dont la teinte est stable. | Moyen, supposé (signature bleue au lieu de noire, chroma actuelle 0,12) | S à M | Moyen (encre noire légèrement bleutée qui deviendrait bleue : le test « tache grise » existe déjà) | Aucune |
| R9 | **Balance des blancs et faible lumière** : relever `WB_MAX` (environ 1,6 à 1,7) en ne le faisant que si la zone « papier » est vaste et uniforme. Ajouter un débruitage léger de la luminance avant le rapport au fond (`bilateralFilter`, ou médiane 3×3 sur le rapport). Ne pas durcir NOIR et BLANC sans ce débruitage. | Moyen. Mesuré à rebours : durcir les seuils sans débruitage dégrade D (SSIM 0,772 → 0,549). Gain du débruitage supposé | M | Moyen (vrai papier coloré blanchi à tort) | Aucune |
| R10 | **Rogner une marge intérieure** d'environ 0,3 % ou 2 px après redressement, ou repeindre la première ligne et la première colonne en papier. | Faible (supprime le liseré pointillé visible sur toutes les sorties) | S | Très faible | Aucune |
| R11 | **Export** : ne pas réencoder quand rien n'est redimensionné (embarquer le JPEG du brouillon tel quel). Proposer une taille de page PDF « Auto » qui suit l'image pour les tickets et les cartes. | Faible (−0,4 point de SSIM évité, pages plus propres pour les tickets) | S | Faible | Aucune |

Ordre conseillé : **R1, puis R2, puis R10** (correctifs ciblés, vite visibles) ; ensuite **R3, puis R4 avec R7** ; enfin **R5, R6, R8, R9**.

---

## 6. Distinguer mesuré et supposé

- **Mesuré dans ce banc** :
  - C1 à C4 et C6 à C8 (sauf le temps sur mobile) ;
  - C5 pour l'ombre nette et pour la lampe chaude ;
  - les effets de R1, R2, R3 (contre-exemple G) et R4 ;
  - la perte par rééchantillonnage ;
  - les tailles JPEG et les temps sur PC.
- **Supposé** :
  - tout le comportement interne de CamScanner ;
  - les temps sur mobile ;
  - les gains de R5 (déduit de la perte par passe), R6, R8 et R9 (débruitage) ;
  - la cause exacte de l'aplatissage intempestif à 2400 px ;
  - l'épaississement des premiers mots.
- **Non couvert** : vraies photos de téléphone, papier glacé et reflets, plis réels, encres délavées, documents multi-couleurs (magazines), et comparaison directe avec une sortie CamScanner du même document.
