# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Utilisateur unique : Vincent, propriétaire et seul utilisateur de l'application. Kilio est une app personnelle mono-utilisateur (pas de multi-tenant, l'authentification multi-utilisateurs a été retirée) qu'il utilise au quotidien depuis son téléphone pour gérer sa vie personnelle : nutrition, budget, agenda, courses, tâches, habitudes, documents, notes, pharmacie (cours personnels).

## Product Purpose

Kilio est le "système d'exploitation personnel" de Vincent : une app unique qui centralise plusieurs domaines de vie (nutrition, budget, agenda, courses, habitudes, tâches, documents, notes, collection, pharmacie) plutôt que de jongler entre outils spécialisés indépendants. Le module Nutrition permet de suivre les repas du jour, calculer les macros (kcal, protéines, glucides, lipides) consommées vs. un objectif cible, et gérer une bibliothèque de recettes/aliments personnelle.

Le module **Pharmacie** est le cahier de cours personnel de Vincent (connaissances de pharmacie apprises au fil du temps) : cours structurés matière → chapitre → notion atomique (texte + tags), consultation rapide par sommaire et recherche plein texte (hors ligne compris), révision par cartes mémoire à répétition espacée (SM-2 simplifié). L'ajout se fait **uniquement par le chat** (skill `kilio-pharmacie-ajout`, désormais géré dans le dépôt de skills `KilaSkills` : Claude reformule, classe, crée les cartes et gère l'arborescence seul, en prévenant après coup) ; l'app sert à consulter, réviser, corriger ou supprimer une notion. Pas de journal brut ni de suivi de source : seule la version reformulée est conservée.

Pour le Journal Nutrition en particulier : l'objectif motivant le suivi est la **perte de poids / recomposition corporelle**. Le "succès" sur cet écran se mesure à la capacité de rester proche de l'objectif calorique et macro du jour (avec deux cibles distinctes : jour "repos" vs jour "entraînement", choisies d'après un planning hebdomadaire d'entraînement).

## Positioning

Kilio existe plutôt qu'un outil generique (MyFitnessPal, Cronometer, Yazio...) parce que tous les modules personnels de Vincent partagent les mêmes données : une recette utilisée dans le Journal Nutrition vient directement du module Recettes (mêmes ingrédients, mêmes macros calculées), et à terme d'autres modules (Courses, Placard, Budget) pourront se recouper avec la Nutrition. C'est l'intégration native entre modules — pas la richesse d'une base alimentaire tierce — qui est la valeur du produit.

## Operating Context

- Usage mobile en priorité : Vincent utilise le Journal Nutrition depuis son téléphone (PWA installée, icône maskable dédiée), typiquement en cuisine ou juste après un repas. Le desktop est secondaire.
- La saisie doit être rapide et à faible friction ("one-handed") : ajouter un repas ne doit pas demander plusieurs écrans ou une saisie longue.
- Le journal distingue deux types de jour (repos / entraînement) avec un objectif macro différent pour chacun — Vincent s'entraîne et adapte son alimentation en conséquence. Le type d'un jour se déduit d'un planning hebdomadaire fixe (jours d'entraînement cochés dans la section Objectifs du Journal) ; il n'y a plus de bascule quotidienne.
- L'app fonctionne aussi hors-ligne partiellement (Dexie en local, `src/lib/offline`) et envoie des notifications push (Edge Functions Supabase, `supabase/functions/`).

## Capabilities and Constraints

- Stack existant : Next.js 16 (App Router, Turbopack), React 19, Supabase (Postgres + client JS), Tailwind CSS v4, déployé sur Vercel.
- Le Journal Nutrition affiche : objectif du jour (kcal/protéines/glucides/lipides cible, éditable), résumé du jour (consommé vs. cible), liste des repas du jour (aliment ou recette, avec quantité et macros calculées).
- Les entrées de journal sont ajoutées "quasi exclusivement en écriture directe en base (hors Server Action)" selon un rapport récent — point à vérifier lors de la revue du flux de saisie.
- PWA installable, icône et manifest dédiés (vert olive foncé, lettre "K").
- Pas d'authentification multi-utilisateur (retirée) : l'app suppose un accès de confiance (usage perso).

## Brand Commitments

- Nom : **Kilio**. Renommage depuis l'ancien nom "Nutricio" terminé (voir `reports/2026-08-29-renommage-kilio.md`) — plus aucune occurrence dans le code (`src/`, `public/`) au 2026-09-27.
- Identité visuelle actuelle du logo : squircle avec effet "chrome"/métal sur la lettre "K", dégradé vert olive foncé (`#111C10` → `#5A7A4E`/`#3D5A32`/`#2B4023` → `#111C10`), fond vignette très sombre (`#011a10`). Couleur d'accent nutrition existante : `--accent-kcal` (vert), déjà utilisée pour la nav active et les boutons.
- `theme_color` du manifest PWA harmonisé avec le fond réel de l'app (`#f7f5ec` clair / `#071212` sombre) depuis le correctif T16 (`reports/2026-09-25-vague-2-audit-impeccable.md`) : la meta `theme-color` suit désormais dynamiquement le thème choisi (`src/lib/theme.ts`, `src/app/layout.tsx`) au lieu d'une valeur figée déconnectée du logo. Ancien désaccord (`#166534`) résolu.

## Evidence on Hand

- Code source complet du module Nutrition (`src/app/(app)/nutrition/`, `src/lib/nutrition/compute.ts`).
- Design system documenté et généré via `impeccable` : `DESIGN.md` (tokens couleurs/typo/rounded/composants), tenu à jour par l'outillage `.impeccable/` — à régénérer via `impeccable document` plutôt qu'à éditer à la main.

### Statut des rapports (`reports/*.md`)

Ce sont des **journaux de bord d'itérations passées**, pas une documentation de référence : chaque fichier capture le contexte et les décisions d'un chantier ponctuel à sa date, et peut devenir obsolète dès qu'un chantier ultérieur revient dessus (ex. le renommage Kilio et le correctif `theme_color` ci-dessus, décrits comme "non résolus" dans d'anciens rapports, sont en réalité déjà réglés dans le code actuel). Deux séries coexistent :
- `reports/*.md` : convention retenue depuis fin août 2026, un fichier par chantier daté, couvrant tous les modules — c'est la série active.

**Règle** : `PRODUCT.md` et `DESIGN.md` sont les seules sources de vérité produit/design à jour. Un rapport ne remplace jamais ces docs — toute décision produit ou design encore valide issue d'un rapport doit être répercutée ici (ou dans `DESIGN.md` via `impeccable`) au moment où elle est prise ; sinon elle reste une trace historique sans garantie d'exactitude actuelle. En cas de doute entre un rapport et le code, **le code fait foi**.

## Product Principles

1. Un seul utilisateur, zéro friction de compte : pas de logique multi-tenant, pas d'onboarding — optimiser pour l'usage répété quotidien d'une seule personne qui connaît déjà l'app.
2. Mobile d'abord : les écrans du quotidien (Journal en tête) sont conçus et jugés sur leur usage téléphone en situation réelle (en cuisine, après un repas), pas sur desktop.
3. Intégration inter-modules plutôt que profondeur d'un seul module : la valeur de Kilio vient de la cohérence des données entre Nutrition, Recettes, Courses, Budget, etc.
4. Saisie rapide avant tout : réduire le nombre de taps et d'écrans pour enregistrer un repas est une priorité produit, pas un détail.
5. Cohérence visuelle de marque : le vert olive foncé et le "K" du logo sont des repères d'identité récents et volontaires — à respecter dans toute évolution visuelle.

## Accessibility & Inclusion

Pas de contrainte d'accessibilité formelle documentée (utilisateur unique et connu). Contrainte d'usage confirmée : priorité à une saisie mobile rapide et réalisable à une main.
