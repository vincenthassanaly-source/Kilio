# Kilio

Application personnelle mono-utilisateur (PWA, mobile d'abord) qui centralise nutrition, agenda, courses, tâches, habitudes, documents, notes, collection, pharmacie, musculation et le carnet « Vider ma tête ». La description produit complète est dans [`PRODUCT.md`](PRODUCT.md), le design system dans [`DESIGN.md`](DESIGN.md).

**Stack** : Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres, Storage, Edge Functions), TanStack Query, Dexie (cache et file hors ligne). Déployé sur Vercel, branche par défaut `kiliomain`.

> Cette version de Next.js a des changements incompatibles : lire [`AGENTS.md`](AGENTS.md) et les guides de `node_modules/next/dist/docs/` avant de coder.

## Démarrer

```bash
npm ci
npm run dev        # http://localhost:3000
```

Il faut un fichier `.env.local` (jamais commité). Variables lues par le code :

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé de service, **côté serveur uniquement** : toutes les lectures et écritures passent par elle |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clé publique des notifications push |
| `GEMINI_API_KEY` | Transcription de « Vider ma tête » et Réveil |
| `VIDAGE_SESSION_SECRET` | Secret de session (32 caractères minimum) ; sans lui, « Vider ma tête » reste fermé |
| `AGENDA_FEED_TOKEN` | Jeton du flux ICS de l'agenda |

Les Edge Functions lisent en plus `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` (secrets Supabase).

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | Types de routes puis `tsc --noEmit` |
| `npm test` | Tests unitaires (Vitest, mode watch ; `npx vitest run` pour une passe unique) |
| `npm run test:instant` | Banc e2e de navigation instantanée, avec un faux Supabase (voir [`instant-nav.rig.md`](instant-nav.rig.md)) |
| `npm run analyze` | Analyse du poids des bundles |
| `npm run knip` | Détection de code inutilisé |

La CI (`.github/workflows/ci.yml`) lance lint, typecheck et Vitest (job `verifier`), puis le banc e2e (job `e2e`).

## Structure

- `src/app/(app)/<module>/` : pages et composants de chaque module (`loading.tsx` quand la page attend des données).
- `src/app/actions/` : Server Actions par domaine, avec leurs tests.
- `src/lib/<domaine>/` : logique métier (calculs purs dans `compute.ts`, hors ligne, Gemini, vidage…).
- `src/lib/offline/` : cache Dexie et file des écritures hors ligne (voir `flush-policy.ts` pour les règles de rejeu et d'abandon).
- `supabase/functions/` : Edge Functions (notifications push, nettoyage), appelées par `pg_cron`. Elles ne sont **pas** déployées par la CI : après une modification, les redéployer sur Supabase.
- `scripts/` : migrations SQL datées, appliquées à la main (voir ci-dessous).
- `reports/` : journaux d'audit et de décisions, datés ; le code fait foi.

## Base de données

Le schéma initial n'est pas versionné dans ce dépôt : la base de production est la référence. Les fichiers `scripts/migration-*.sql` sont des changements datés, sans outil de suivi : vérifier l'état réel de la base avant d'en rejouer un. La sécurité par ligne (RLS) est activée sur toutes les tables de `public` sans règle d'accès : seule la clé de service lit et écrit. Les buckets de stockage sont publics (lecture par adresse), sauf `vider-tete`.
