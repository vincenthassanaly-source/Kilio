# Module Pharmacie — 2026-09-30

Cahier de cours personnel : matière → chapitre → notion atomique, recherche, révision par cartes à répétition espacée. Ajout par le chat uniquement.

## Décisions (grilling + brief validés)
- Nouveau module dans Kilio (route `/pharmacie`), pas d'outil séparé.
- Arborescence gérée par Claude (création, renommage, fusion, déplacement), qui prévient après coup ; journalisée dans `pharma_historique`.
- Notions atomiques (titre, contenu, tags) ; pas de journal brut, pas de suivi de source, texte seul.
- Cartes créées automatiquement à l'ajout ; SM-2 simplifié, 4 notes (À revoir, Difficile, Bien, Facile).
- Modification et suppression d'une notion possibles dans l'app (l'original n'étant pas conservé).
- Hors ligne : instantané (arborescence, notions, cartes) copié dans Dexie (`cache_lecture`) ; les notes de révision hors ligne passent par la file existante (`pharmacie.noterCarte`).
- Migrations : appliquées via le MCP Supabase (`pharmacie_module`) et versionnées dans `scripts/` (convention du dépôt : `migration-*.sql` + `-revert.sql`).

## Fichiers
- Données : `scripts/migration-pharmacie-2026-09-30.sql` (+ `-revert.sql`), types dans `src/lib/supabase/types.ts`.
- Logique : `src/lib/pharmacie/` (`srs.ts`, `selecteurs.ts`, `cache.ts`, `format.ts`, `useSnapshotPharmacie.ts`), `src/app/actions/pharmacie.ts`.
- UI : `src/app/(app)/pharmacie/` (accueil + recherche, matière, chapitre + éditeur, révision).
- Skill `kilio-pharmacie-ajout` : désormais géré dans mon dépôt de skills `KilaSkills` (`plugin/skills/kilio-pharmacie-ajout/SKILL.md`), plus dans Kilio.
- Navigation : entrée `/pharmacie` dans `src/lib/navigation/registry.ts`, teinte passive `--accent-pharmacie` (teinte 355).

## À reporter dans DESIGN.md
`DESIGN.md` se régénère via `impeccable document` : y ajouter `module-pharmacie: oklch(0.55 0.14 355)` (clair) / `oklch(0.72 0.13 355)` (sombre) à la prochaine régénération.

## Écart par rapport au brief
La recherche est inline sur l'accueil (le champ remplace le contenu) plutôt qu'un écran dédié : plus rapide à une main et disponible hors ligne. Elle est locale (accents, casse, une faute de frappe tolérée) ; la fonction SQL `pharma_rechercher` sert au skill pour détecter les doublons.

## Sécurité (hors périmètre, à décider)
Le conseiller Supabase signale la RLS désactivée sur `journal_jours` et `objectif_habitudes`. Correctif proposé, non appliqué : `ALTER TABLE public.journal_jours ENABLE ROW LEVEL SECURITY; ALTER TABLE public.objectif_habitudes ENABLE ROW LEVEL SECURITY;` (l'app passe par la clé service, donc sans effet sur elle).
