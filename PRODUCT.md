# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Utilisateur unique : Vincent, propriétaire et seul utilisateur de l'application. Kilio est une app personnelle mono-utilisateur (pas de multi-tenant, l'authentification multi-utilisateurs a été retirée) qu'il utilise au quotidien depuis son téléphone pour gérer sa vie personnelle : nutrition, agenda, courses, tâches, habitudes, documents, notes, pharmacie (cours personnels).

## Product Purpose

Kilio est le "système d'exploitation personnel" de Vincent : une app unique qui centralise plusieurs domaines de vie (nutrition, agenda, courses, habitudes, tâches, documents, notes, collection, pharmacie) plutôt que de jongler entre outils spécialisés indépendants. Le module Nutrition permet de suivre les repas du jour, calculer les macros (kcal, protéines, glucides, lipides) consommées vs. un objectif cible, et gérer une bibliothèque de recettes/aliments personnelle.

Le module **Pharmacie** est le cahier de cours personnel de Vincent (connaissances de pharmacie apprises au fil du temps) : cours structurés matière → chapitre → notion atomique (texte + tags), consultation rapide par sommaire et recherche plein texte (hors ligne compris), révision par cartes mémoire à répétition espacée (SM-2 simplifié). L'ajout se fait **uniquement par le chat** (skill `kilio-pharmacie-ajout`, désormais géré dans le dépôt de skills `KilaSkills` : Claude reformule, classe, crée les cartes et gère l'arborescence seul, en prévenant après coup) ; l'app sert à consulter, réviser, corriger ou supprimer une notion. Pas de journal brut ni de suivi de source : seule la version reformulée est conservée.

Pour le Journal Nutrition en particulier : l'objectif motivant le suivi est la **perte de poids / recomposition corporelle**. Le "succès" sur cet écran se mesure à la capacité de rester proche de l'objectif calorique et macro du jour (avec deux cibles distinctes : jour "repos" vs jour "entraînement"). Un jour est "entraînement" quand une séance planifiée est cochée faite, ou quand Vincent bascule le bouton haltère d'Aujourd'hui (table `jours_entrainement`).

Menus de la semaine (Nutrition → Menus, table `menus_repas`) : Vincent planifie ses repas du lundi au dimanche, 4 créneaux par jour (petit-déj, déjeuner, collation, dîner). Un créneau contient une recette (`quantite` = portions) ou un aliment (`quantite` en g/ml, comme `journal_repas`). Deux entrées : dans l'app (« + » du créneau, même sélecteur que le Journal) et par le chat, où Claude écrit directement dans `menus_repas` (une ligne = date, `moment`, `aliment_id` ou `recette_id`, `quantite`, `mange` à faux). Le tap sur la coche « mangé » crée l'entrée du Journal correspondante et la relie (`journal_repas_id`) ; décocher ou « Annuler » la supprime. « Envoyer aux Courses » additionne les ingrédients des repas pas encore mangés de la semaine (une recette compte `quantite / portions` fois ses ingrédients) et les ajoute en libellés texte (« Poulet, 600 g ») sans dupliquer ce que la liste contient déjà ; le calcul vit dans `src/lib/menus/compute.ts`. Chaque jour compare le menu prévu (kcal et macros) à la cible du type de jour : repos par défaut, entraînement via le bouton haltère du jour (même statut `jours_entrainement` qu'Aujourd'hui) ; même ton neutre que le Journal (ambre jusqu'à +10 %, alerte au-delà, protéines jamais en alerte), et un jour libre suspend la comparaison. « Copier la semaine précédente » reporte les repas de la semaine d'avant, tous « à manger », et n'est proposé que sur une semaine vide.

Score du jour (carte « Score du jour » en tête d'Aujourd'hui) : un anneau et une ligne par domaine ayant un objet ce jour-là, moyenne à poids égal, sans jugement ni mot « retard ». Tâches : faites sur total des tâches dont l'échéance est aujourd'hui. Nutrition : progression vers la cible kcal du type de jour, pleine jusqu'à +10 % puis décroissante jusqu'à +30 % ; exclue si le journal est vide, si le jour est libre ou sans cible. Sport : exclu un jour de repos sans séance, 0 % un jour d'entraînement sans séance enregistrée, 100 % dès qu'une séance est faite. Habitudes : actives du jour, faites sur total (une habitude hebdomadaire ne compte que si elle est faite aujourd'hui). Un domaine sans objet n'apparaît pas et ne pèse pas ; sans aucun domaine, la carte disparaît. Le calcul vit dans `src/lib/aujourdhui/score.ts`, sur les données déjà préchargées par l'écran (aucune requête en plus).

Jours fériés (France métropolitaine) : purement informatifs. L'API Etalab (calendrier.api.gouv.fr, sans clé) est lue côté serveur une fois par année absente (le 1er janvier sert de témoin) et copiée dans la table `jours_feries` (`scripts/migration-jours-feries-2026-10-17.sql`, action `src/app/actions/jours-feries.ts`, parsing dans `src/lib/feries/compute.ts`). Ils s'affichent dans les vues Jour, Semaine, Mois et Liste de l'Agenda et en tête d'Aujourd'hui (pastille « Jour férié · nom »). Ils ne changent aucune règle : tâches, habitudes, score du jour, récurrences et flux ICS les ignorent. Une panne de l'API ou de la base les fait simplement disparaître, sans message d'erreur.

Vider ma tête (`/vider-ma-tete`, entrée du menu Plus) : le carnet du soir de Vincent, pour poser la journée **à la main au S Pen**, sans rien avoir à en faire ensuite (pas de tri, pas de tâche créée, pas de transcription : c'est précisément ce qui a rendu l'ancienne Inbox pesante). Une feuille par jour (`feuilles_vidage`, une ligne par jour, `scripts/migration-vider-tete-2026-10-19.sql`), à défilement vertical sans fin qui s'agrandit sous le dernier trait. Les traits sont stockés en vectoriel (JSON `{ e: épaisseur 1-3, p: [x, y, pression, …] }`, coordonnées logiques sur une largeur de 1000, simplifiés avant stockage ; `src/lib/vidage/traits.ts`) : l'encre suit le thème clair/sombre. Outils : stylo (3 épaisseurs), gomme par trait (aussi le bouton du stylet), annuler / rétablir ; le stylet écrit et le doigt fait défiler (option « Écrire aussi au doigt »). La feuille est écrite sur le téléphone à chaque trait (Dexie, `vidage_feuilles`) puis envoyée après une pause d'écriture, au retour du réseau ou en quittant l'app (`VidageSync`) ; une copie locale non envoyée prime toujours sur le serveur. Un aperçu PNG par feuille vit dans le bucket **privé** `vider-tete` (URL signées de 1 h, jamais publiques : journal intime) et sert de vignette au calendrier « Relire ». Les anciennes feuilles sont gardées sans limite et relisibles ; une feuille entièrement effacée disparaît. Rappel push du soir (21 h par défaut, réglable dans Réglages, `envoyer-rappel-vidage` + cron) envoyé seulement si la feuille du jour est encore vide. Les écrans d'écriture masquent la barre du bas (comme la séance de musculation) et sont exclus du balayage entre onglets. **Transcription** (menu « … » de l'en-tête, avec « Effacer la feuille ») : à la demande seulement, jamais automatique, le bouton envoie toute la feuille à l'API Gemini (`src/lib/gemini/appel.ts` accepte des `images`) en tranches PNG de 1000 × 1400 px avec recouvrement, 8 tranches au plus (`src/lib/vidage/transcription.ts`, rendu dans `apercu.ts`). Le texte est une copie fidèle (`[illisible]` en cas de doute), enregistré dans `feuilles_vidage.transcription` (`scripts/migration-vidage-transcription-2026-10-20.sql`), relisible et modifiable dans « Voir le texte » (les corrections sont enregistrées en fermant, `transcription_modifiee` demande confirmation avant qu'une retranscription ne les écrase) et supprimable sans toucher à l'écriture. Il est effacé dès que les traits de la feuille changent (le serveur compare dans `enregistrerFeuille` ; renvoyer la même feuille ne l'efface pas) et avec la feuille. Chaque transcription envoie l'écriture à Google (clé gratuite partagée avec le Réveil, quota signalé par un message dédié).

Modules retirés : le Budget (code retiré le 2026-10-05, tables supprimées par `scripts/migration-suppression-budget-2026-10-05.sql`) et l'Inbox / capture rapide (retirés le 2026-10-15, table supprimée par `scripts/migration-suppression-inbox-2026-10-15.sql`). Le lien `taches.note_id` est conservé.

Séances de sport (écran Aujourd'hui) : Vincent n'a pas de planning horaire. Chaque jour, l'écran propose Push, Pull et Legs avec leurs routines A/B/C en pastilles ; toucher une pastille lance la routine. Une routine, et son type, est « faite cette semaine » dès qu'un entraînement correspondant est enregistré depuis lundi (la semaine repart de zéro le lundi) ; une séance libre reçoit son type à la fin. Le compteur indique les types faits sur 3. Le ton reste neutre : rien n'est jamais « en retard ».

Jours libres et alertes (nutrition) : le plafond kcal quotidien reste la règle. Vincent dispose de 2 jetons « jour libre » par semaine (lundi → dimanche), à poser le jour même ou la veille, jamais après coup ; un jour libre suspend la limite (pas d'alerte, affiché « libre » au Bilan, hors taux, sans casser la série) et se retire tant qu'il n'est pas passé. Comme les repas sont souvent saisis directement en base (via Claude), une Edge Function lit le journal chaque minute et envoie, une fois par jour : une alerte à 85 % de la limite kcal (ou au dépassement), et un rappel de saisie à 20:00 si le journal est vide. Les deux se règlent dans Réglages.

Pesée et bilan de la semaine : Vincent relève son poids et son tour de taille (le meilleur indicateur de la graisse abdominale) en 10 secondes, depuis le Bilan nutrition ou la carte « Pesée de la semaine » qu'Aujourd'hui propose quand aucun relevé n'a été saisi depuis 7 jours (table `mesures_corps`). La synthèse de la semaine (kcal moyens des jours évalués contre leur limite, séances faites / prévues, poids lissé sur 7 jours, tour de taille, chacun comparé à la semaine d'avant) s'affiche en tête du Bilan et dans la Revue hebdo, et part en notification le dimanche à 18:00 (Edge Function `envoyer-bilan-hebdo`, réglable). Les jours libres, vides et la journée en cours n'entrent pas dans la moyenne kcal. Le calcul vit dans `supabase/functions/envoyer-bilan-hebdo/compose.ts`, réexporté par `src/lib/sante/compute.ts` : l'écran et la notification affichent les mêmes chiffres. Ton neutre, sans jugement.

Suivi de lecture des propositions de partis (Opinions → Partis) : Vincent lit les programmes au fil du temps et doit retrouver où il en est. Chaque proposition porte deux marqueurs indépendants, `lu` (case cochée à la main, jamais automatique au scroll) et `favori` (étoile « à relire / à garder »), stockés sur `opinions_propositions` (`scripts/migration-opinions-suivi-2026-10-19.sql`) et donc partagés entre appareils. Dans un parti ouvert, une barre collante affiche la progression « N/M lues » du programme choisi, un bouton « Prochaine non lue », les filtres cumulables « Non lues » et « Favoris » et des chips de thème (compteur lues/total, tap = saut au thème). L'en-tête de chaque carte parti affiche aussi « N/M lues ». Les filtres ne changent ni les barres d'axes ni le calcul de proximité, qui portent toujours sur toutes les propositions.

## Positioning

Kilio existe plutôt qu'un outil generique (MyFitnessPal, Cronometer, Yazio...) parce que tous les modules personnels de Vincent partagent les mêmes données : une recette utilisée dans le Journal Nutrition vient directement du module Recettes (mêmes ingrédients, mêmes macros calculées), et à terme d'autres modules (Courses, Placard) pourront se recouper avec la Nutrition. C'est l'intégration native entre modules — pas la richesse d'une base alimentaire tierce — qui est la valeur du produit.

## Operating Context

- Usage mobile en priorité : Vincent utilise le Journal Nutrition depuis son téléphone (PWA installée, icône maskable dédiée), typiquement en cuisine ou juste après un repas. Le desktop est secondaire.
- La saisie doit être rapide et à faible friction ("one-handed") : ajouter un repas ne doit pas demander plusieurs écrans ou une saisie longue.
- Le journal distingue deux types de jour (repos / entraînement) avec un objectif macro différent pour chacun — Vincent s'entraîne et adapte son alimentation en conséquence. Le type d'un jour vient des séances cochées faites (planning des séances d'Aujourd'hui) ou de la bascule du bouton haltère ; l'ancien planning hebdomadaire fixe a été supprimé.
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
3. Intégration inter-modules plutôt que profondeur d'un seul module : la valeur de Kilio vient de la cohérence des données entre Nutrition, Recettes, Courses, etc.
4. Saisie rapide avant tout : réduire le nombre de taps et d'écrans pour enregistrer un repas est une priorité produit, pas un détail.
5. Cohérence visuelle de marque : le vert olive foncé et le "K" du logo sont des repères d'identité récents et volontaires — à respecter dans toute évolution visuelle.

## Accessibility & Inclusion

Pas de contrainte d'accessibilité formelle documentée (utilisateur unique et connu). Contrainte d'usage confirmée : priorité à une saisie mobile rapide et réalisable à une main.
