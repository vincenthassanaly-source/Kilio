# Prompt Claude Design — refonte visuelle de Kilio

Colle le bloc ci-dessous dans Claude Design. Connecte d'abord le dépôt (lien dans le prompt).

---

```text
Tu es directeur artistique / product designer senior. Je veux que tu fasses évoluer le design de mon application Kilio : maquettes interactives + direction de design, que je ferai ensuite implémenter dans le code (Next.js).

## 1. Le projet

Kilio est ma PWA mobile personnelle, mono-utilisateur, en français : mon « système d'exploitation personnel ». Elle centralise nutrition (journal, macros, recettes, menus, bilan), agenda, courses, tâches, habitudes, objectifs, documents, notes, collection, musculation et pharmacie (cahier de cours + cartes de révision). Sa valeur : l'intégration des données entre modules. Les modules Budget et Inbox ont été retirés : ne les redessine pas.

Usage : quotidien, sur téléphone (PWA installée), souvent à une main, en cuisine ou en salle de sport. Le desktop est secondaire (colonne unique, pas de layout dédié). Priorité à la saisie rapide, avec peu de taps.

Dépôt (lis-le, c'est la source de vérité) : https://github.com/vincenthassanaly-source/kilio (branche par défaut : kiliomain)

Fichiers à lire avant tout :
- DESIGN.md : design system actuel, « Le Tableau de Bord Doux » (tokens OKLCH, typographie, formes, élévation, composants, règles nommées).
- PRODUCT.md : produit, utilisateur, principes, engagements de marque.
- src/app/globals.css : tokens réels (@theme inline Tailwind v4, mode sombre via classe .dark).
- src/components/ : composants partagés (BottomNav, ModulesGrid, SegmentedControl, ProgressRing, Modal, etc.).
- src/app/(app)/ : les écrans (routes ci-dessous).
- public/icons/kilio-logo.svg : le logo.
Le code fait foi. Les fichiers de reports/ peuvent être obsolètes.

## 2. État actuel (à respecter comme point de départ)

- Stack UI : Next.js 16, React 19, Tailwind CSS v4, framer-motion. Composants maison, pas de shadcn.
- Palette OKLCH, neutres teintés (aucun gris pur) : fond ivoire (~#f7f5ec), surface quasi blanche, encre vert-noir. Un accent unique `--accent-kcal` ≈ #00794d (« One Accent Rule » : seule couleur interactive primaire). Fond sombre ≈ #071212.
- Macros sémantiques : protéines bleu, glucides jaune, lipides magenta. Alertes graduées : ambre (dépassement ≤10 %), rouge (>10 %).
- Teinte passive par module (agenda, habitudes, courses, objectifs, collection, documents).
- Typo : Sora (titres, chiffres-clés) + Inter (le reste). Titre d'écran 28px, texte min 11px, champs ≥16px.
- Formes : rayons croissants (12→26px, pill), bordure 1px, ombre unique, cibles tactiles ≥44px, `active:scale-[0.97]`.
- Navigation : barre basse flottante + bouton « Plus » ; sous-navigation nutrition ; transitions directionnelles.
- Ton : calme, doux, jamais anxiogène ni culpabilisant (pas de mot « retard »).

## 3. Ce que je reproche au design actuel

1. Esthétique datée / générique : ça ressemble à un template, sans identité mémorable.
2. Ergonomie et lisibilité : hiérarchie visuelle, densité, navigation à améliorer.
3. Incohérence entre écrans : styles, espacements et composants qui varient d'une page à l'autre.

## 4. Direction demandée

Ambiance : **minimale et précise, style outil pro haut de gamme** (type app de productivité soignée), mais sans devenir froide : on garde les neutres teintés et la douceur. Peu de couleurs, une densité maîtrisée, une typographie nette, des chiffres-clés lisibles d'un coup d'œil, des détails d'exécution précis (alignements, rayons, états, micro-transitions). Choisis UN détail mémorable cohérent avec l'app et applique-le partout (par exemple le traitement des chiffres-clés ou des anneaux de progression).

Marge de liberté :
- **Intouchable** : le logo « K » effet chrome en dégradé vert olive foncé (voir public/icons/kilio-logo.svg) et le vert de marque (accent ≈ #00794d).
- **Libre de repenser** : layout, hiérarchie, typographie (tu peux proposer mieux que Sora + Inter si tu justifies), fonds, rayons, ombres, composants, iconographie, navigation, animations.
- Pars de DESIGN.md comme base et fais-le évoluer plutôt que de l'ignorer. Pour chaque règle de DESIGN.md que tu changes, signale-le dans une liste « écarts avec DESIGN.md » avec la raison (DESIGN.md est généré par l'outil impeccable : je le régénérerai après implémentation, il ne faut pas supposer qu'on l'édite à la main).
- Si tu changes une règle d'accessibilité (contraste 4,5:1 en texte et 3:1 pour les contrôles, cibles 44px, champs 16px, prefers-reduced-motion), dis-le explicitement. Le défaut est de les conserver.
- Garde le sens des couleurs sémantiques des macros et des alertes gradées. Tu peux ajuster les teintes exactes.

## 5. Contraintes plateforme

- Mobile d'abord (≈390×844), usage à une main : actions principales dans la zone du pouce, barre basse.
- Maquette **mode clair ET mode sombre** pour chaque écran.
- Interface et contenus en français.
- Doit rester réalisable en Tailwind CSS v4 avec des tokens CSS (variables), sans bibliothèque de composants tierce.

## 6. Écrans à maquetter (priorité)

1. **Accueil (/) + Aujourd'hui (/aujourdhui)** : grille des modules, carte « Score du jour », séances Push/Pull/Legs. Les deux portes d'entrée quotidiennes.
2. **Nutrition : journal (/nutrition/journal)** : l'écran le plus dense (macros, repas, anneaux de progression, objectifs repos/entraînement, sous-navigation nutrition).
3. **Musculation : séance en cours (/musculation/seance)** : saisie rapide des séries à une main, contexte salle de sport.
4. **Pharmacie : cahier de cours et révision (/pharmacie, /pharmacie/revision)** : lecture longue, cartes de révision, usage d'étude.

Regarde aussi les autres routes pour que la direction se généralise : /agenda, /courses, /taches, /habitudes, /objectifs, /documents, /notes, /collection, /plus, /reglages, /revue, et les états erreur / vide / chargement.

## 7. Livrables attendus

1. **Direction de design** (courte) : intention, 3-5 principes, et le « détail mémorable » choisi.
2. **Design system mis à jour** : tokens (couleurs clair/sombre, typo, espacements, rayons, ombres, mouvement) et composants clés (carte, liste, bouton, champ, segmented control, switch, modal, barre de navigation, anneau de progression, toast, états vides/erreur/skeleton) avec leurs états.
3. **Maquettes interactives** des 4 écrans prioritaires, en clair et en sombre, avec les transitions et micro-interactions importantes.
4. **Liste « écarts avec DESIGN.md »** : ce qui change, pourquoi, et l'impact sur le code existant (tokens à modifier, composants à refaire).
5. **Notes d'implémentation** : ordre conseillé pour appliquer le redesign dans le code (tokens d'abord, puis composants partagés, puis écrans).

## 8. Façon de travailler

- Lis d'abord le dépôt et les fichiers listés en section 1, puis résume en quelques lignes ce que tu as compris du système actuel avant de proposer quoi que ce soit.
- Si un choix change fortement l'identité (typo, fond, navigation), propose-le clairement avec la raison plutôt que de le glisser silencieusement.
- Évite les clichés génériques d'IA (dégradés violets, cartes à ombres partout, emojis décoratifs). Préfère la précision et la retenue.
```
