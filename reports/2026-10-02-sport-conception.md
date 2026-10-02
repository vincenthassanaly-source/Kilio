# Module Sport — dossier de conception (2026-10-02)

Statut : **proposition à valider, aucun code écrit**. Source de vérité produit/design : `PRODUCT.md` et `DESIGN.md` ; le code fait foi en cas de doute.

## 1. Cadrage (décisions déjà prises avec Vincent)

- Suivi de musculation « type Hevy », version 1 = le cœur : bibliothèque d'exercices, séance en direct, minuteur de repos, historique, routines, records personnels (PR), courbes de poids max et 1RM estimé (Epley).
- Bibliothèque fixe (~870 exercices, free-exercise-db, domaine public), traduite en français, 2 images par exercice jouées en boucle. Images dans Supabase Storage.
- Séance **local d'abord** (Dexie), synchronisée ensuite. Kg uniquement. Pas d'import Hevy, pas de supersets/dropsets/échauffement, pas de stats de volume par muscle, pas de social en V1.
- Routines PPL pré-créées. Pas de carte sur le tableau de bord en V1. Module dans la grille « Plus ».
- Mode Impeccable : **Operate** (tâche en salle, une main, mains moites). Monde visuel existant de Kilio conservé, aucun nouveau monde.

## 2. Faits du dépôt qui changent la conception

1. **Pas de poids du corps dans la nutrition.** La seule colonne « poids » trouvée est `poids_unite_g` (poids d'une unité d'aliment). Le « poids du corps partagé » n'a donc aucune source à réutiliser : le module Sport crée sa propre table `sport_poids_corps`, que la nutrition (bilan) pourra lire plus tard.
2. **La file hors-ligne actuelle abandonne une action après 3 échecs non réseau** (`flush-policy.ts`, `SEUIL_ABANDON_TENTATIVES`). Acceptable pour une coche de course, **inacceptable pour une séance entière** (perte de toutes les séries). La séance terminée reste donc dans Dexie, statut « à synchroniser », jusqu'à confirmation du serveur ; elle ne passe pas par la politique d'abandon.
3. **Pas de notification de fin de repos fiable en arrière-plan.** Une PWA suspendue ne peut pas déclencher de notification locale à l'heure, et Vercel ne permet pas d'attendre N secondes côté serveur. Voir §6.
4. `jour_type_ppl` est un enum `entrainement | repos` (le nom « ppl » est trompeur) géré par `app/actions/journal.ts`.
5. Conventions : migrations SQL manuelles dans `scripts/migration-<nom>-AAAA-MM-JJ.sql` (+ `-revert.sql`), RLS activé **sans policy** (accès via service role), pages en `Suspense` + `connection()` + `HydrationBoundary`, clés dans `src/lib/query/keys.ts`, garde d'invalidation du cache testée, routes à ajouter dans `e2e/routes.ts`.

## 3. Modèle de données

Identifiants des séances/séries générés **côté client** (uuid) et écrits par upsert : un rejeu ne crée pas de doublons.

| Table | Contenu |
|---|---|
| `sport_exercices` | `id` (slug free-exercise-db), `nom_fr`, `nom_en`, `muscle_principal`, `muscles_secondaires[]`, `equipement`, `categorie`, `niveau`, `instructions_fr[]`, `images[]` (chemins Storage), `type_mesure` (`poids_reps` par défaut, `reps`, `duree`, `poids_duree`) |
| `sport_exercice_prefs` | `exercice_id`, `repos_defaut_s` (réglable par exercice) |
| `sport_routines` / `sport_routine_exercices` | nom, ordre ; exercice, position, nb séries, reps cibles, repos |
| `sport_seances` | `id`, `routine_id?`, `nom`, `debut_at`, `fin_at`, `jour` (date Paris), `notes` |
| `sport_series` | `id`, `seance_id`, `exercice_id`, position, `poids_kg`, `reps`, `duree_s`, `repos_pris_s`, `fait_at` |
| `sport_poids_corps` | `jour` (clé), `poids_kg` |

Les PR, 1RM et courbes sont **calculés** (`src/lib/sport/compute.ts`, fonctions pures testées) à partir de `sport_series`, rien n'est stocké en double. 1RM = Epley `poids × (1 + reps/30)`, ignoré au-delà de 12 reps.

## 4. Architecture des écrans (mobile d'abord)

Sous-navigation `SegmentedControl` (motif existant) : **Séance · Historique · Exercices · Routines**.

- **`/sport` — Séance.** Bandeau « Reprendre la séance » si un brouillon existe. Cartes des routines (Push / Pull / Legs) démarrables en un tap, « Séance vide », dernière séance résumée.
- **`/sport/seance` — Séance en direct** (plein écran, barre du bas masquée, écran maintenu allumé).
  - En-tête : chrono de séance, « Terminer ». Blocs par exercice avec vignette animée.
  - Ligne de série : n° · précédent · kg · reps · ✓. Valeurs **préremplies depuis la dernière séance**, boutons +/- larges dans la zone du pouce, clavier numérique natif. Valider = un tap.
  - **Barre de repos** collante en bas après chaque ✓ : compte à rebours, −15 s / +15 s, passer. Le repos réellement pris est enregistré.
  - Ajout d'exercice via feuille modale avec recherche et filtres par muscle.
  - Badge PR affiché à la validation d'une série qui bat un record.
- **`/sport/exercices` et `/sport/exercices/[id]`** : liste recherchable, filtres muscle/équipement ; fiche avec animation, consignes, muscles, records, courbes poids max et 1RM, historique de l'exercice.
- **`/sport/historique` et `/sport/historique/[id]`** : séances par date, détail et suppression.
- **`/sport/routines/[id]`** : éditeur (ajout/réordonnancement dnd-kit déjà présent, séries, reps, repos).

**Animation des exercices.** Deux images en fondu croisé (~900 ms) en CSS ; avec `prefers-reduced-motion`, première image fixe et bascule au tap. Images en WebP compressé, `loading="lazy"`, cache runtime du service worker (cache-first) pour l'affichage hors-ligne des exercices déjà vus.

## 5. Design (dans le monde existant)

- Couleur d'accent module `--module-sport` (formule `oklch(0.55 0.14 <teinte>)`), **identité passive uniquement** (icône, badge PR) ; tout le contrôle reste en vert Kcal (One Accent Rule). Teinte à fixer à l'implémentation après contrôle de contraste ; les teintes 25, 45, 65, 85, 150, 165, 200, 230, 265, 280, 305, 340 sont prises.
- Cibles tactiles ≥ 48 px pour les champs kg/reps et le ✓ en séance, chiffres en Sora, `tabular-nums`, aucune ombre nouvelle, rayons existants, texte ≥ 11 px.
- États à couvrir : première visite (aucune séance), bibliothèque en chargement/erreur, séance interrompue (reprise), hors-ligne, abandon de séance (confirmation), série à 0 kg (poids du corps), exercice sans image.

## 6. Risque assumé : notification de fin de repos

Choix de Vincent : notification de fin de repos. Ce qui est **fiable** : minuteur basé sur un horodatage (juste après suspension/reprise), écran maintenu allumé pendant la séance (Wake Lock), vibration + son à l'échéance quand l'app est au premier plan. Ce qui **ne l'est pas** : une notification push arrivant app en arrière-plan/verrouillée. Proposition : V1 avec Wake Lock + son/vibration ; push d'arrière-plan traité comme un essai séparé (mesure sur le téléphone de Vincent) avant de promettre quoi que ce soit.

## 7. Intégration nutrition

À la fin d'une séance contenant au moins une série validée, le jour passe en `entrainement` dans le journal **si besoin, jamais l'inverse** (une séance ne repasse jamais un jour en repos et ne touche pas un choix déjà « entraînement »).

## 8. Découpage en PR (chacune mergée vers `kiliomain` après lint, tsc, vitest)

1. **Fondations et bibliothèque** : migration + RLS + types, script d'import (`scripts/sport/` : traduction FR via Gemini avec relecture, compression et envoi des images dans Storage, seed SQL), pages exercices, entrée du registre de navigation, accent, route e2e.
2. **Séance en direct et routines** : brouillon Dexie, UI de séance, minuteur de repos, `enregistrerSeance` (upsert idempotent) + synchronisation dédiée, éditeur de routines, seed PPL, lien nutrition.
3. **Historique et progression** : historique, courbes poids max/1RM, détection des PR, poids du corps.

## 9. Décisions encore ouvertes

- Teinte de l'accent module (à choisir à l'implémentation, contraste vérifié en clair et en sombre).
- Poids du corps : saisie dans le module Sport (proposé) ; lecture par la nutrition plus tard.
- Notification de repos en arrière-plan : essai séparé (§6).
- Choix des exercices des routines PPL : proposés en PR 2 pour validation.
