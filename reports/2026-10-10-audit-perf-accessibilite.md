# Audit accessibilité et performance — 2026-10-10

Suite de `2026-10-09-audit-tests.md`. Environnement : build de production local
(`next start`), données du faux Supabase du rig e2e (latence simulée de 400 ms par
appel), Chromium headless. Les chiffres de performance sont donc **indicatifs** :
ils servent à comparer les écrans et à repérer les postes coûteux, pas à fixer un
objectif absolu.

## Accessibilité (axe-core 4.10, WCAG 2.0/2.1/2.2 A et AA + bonnes pratiques)

16 écrans × 2 thèmes (clair, sombre), viewport mobile 390 px : **32 pages auditées**.

| Règle | Gravité | Éléments | Écrans | Statut |
|---|---|---|---|---|
| `color-contrast` | sérieuse | 12 | 7 (thème clair uniquement) | **À décider** (voir ci-dessous) |
| `page-has-heading-one` | modérée | 1 | `/reglages` | Faux positif : voir « Artefact du faux serveur » |
| `label-content-name-mismatch` (Lighthouse, WCAG 2.5.3) | — | blocs d'événements | Agenda, Aujourd'hui | **Corrigé** |

Lighthouse (accessibilité) : 100 sur l'accueil, l'agenda, les courses et les notes ;
96 sur les tâches et le journal (le contraste ci-dessous).

### Contraste du vert de marque (thème clair) — décision de design

Le vert `--accent-kcal: oklch(0.55 0.14 165)` (≈ `#008a5d`) est juste sous le seuil AA
de 4,5 : 1 :

| Usage | Ratio mesuré | Seuil |
|---|---|---|
| Texte blanc sur fond vert (bouton primaire, onglet actif, FAB) | 4,38 à 4,44 | 4,5 |
| Texte vert sur fond ivoire (liens « Gérer… », boutons texte) | 4,02 à 4,37 | 4,5 |
| Texte vert sur le vert pâle (badge « 640 kcal/portion ») | 3,66 à 3,69 | 4,5 |

Le thème sombre est conforme. La plus petite correction qui satisfait les trois cas est
`--accent-kcal: oklch(0.495 0.14 165)` (≈ `#00794d`) : blanc 5,45 ; ivoire 5,00 ; vert
pâle 4,52. C'est une teinte un peu plus profonde, visible sur tous les boutons et onglets.
Le fichier `DESIGN.md` définit ce vert comme la couleur d'accent unique : **non modifié
sans accord**.

## Corrigé

- `src/app/(app)/aujourdhui/EvenementBlock.tsx` : le nom accessible d'un bloc d'événement
  commençait par « Événement Titre, de 09:00 à 10:00 » alors que le texte visible est
  « 09:00 Titre ». Une personne utilisant la commande vocale ne pouvait pas le désigner en
  disant ce qu'elle lit. Il commence maintenant par le texte visible
  (« 09:00 Titre, événement de 09:00 à 10:00. Modifier »). Deux assertions e2e adaptées.

## Artefact du faux serveur (pas un défaut de l'app)

`/reglages` semblait n'avoir aucun titre de niveau 1. En réalité la page plantait au rendu
(`getReglagesBriefing` lisait la table `reglages_briefing`, absente du faux Supabase) et
affichait l'écran d'erreur. La fixture a été ajoutée à `e2e/mock-supabase.mjs`. L'erreur
console `/_vercel/speed-insights/script.js` (404) est aussi propre au contexte local : ce
script n'existe que sur Vercel.

## Performance (Lighthouse 12, émulation mobile : 4G lente, CPU ralenti 4×)

| Écran | Perf | LCP | TBT | CLS |
|---|---|---|---|---|
| Agenda | 95 | 2,7 s | 130 ms | 0 |
| Journal | 89 | 3,6 s | 110 ms | 0 |
| Notes | 83 | 4,6 s | 130 ms | 0 |
| Courses | 82 | 4,6 s | 160 ms | 0 |
| Tâches | 81 | 4,8 s | 160 ms | 0 |
| Accueil | 67 | 4,3 s | **750 ms** | 0,014 |

Accessibilité 96 à 100, bonnes pratiques 96, SEO 100 partout.

- **LCP.** L'élément est le titre de la page ; le TTFB est correct (455 ms), mais le délai de
  rendu atteint 3,9 à 4,4 s : le coût vient de l'exécution JavaScript côté client sous CPU
  ralenti, pas du réseau.
- **Accueil.** Le Total Blocking Time (750 ms) et le temps d'exécution JavaScript (2 s) sont
  les deux plus gros postes : c'est l'écran à regarder en priorité.
- **JavaScript inutile.** Environ 72 Kio de JavaScript non utilisé et 13 Kio de JavaScript
  « legacy » sur tous les écrans.
- **Décalages de mise en page.** CLS nul sauf l'accueil (0,014, négligeable).

## Non traité

- Contraste du vert de marque (décision de design, voir plus haut).
- Réduction du JavaScript de l'accueil et du JavaScript inutile : chantier dédié, à mesurer
  sur un vrai appareil ou sur Vercel avant d'optimiser (les mesures précédentes sont dans
  `2026-10-04-mesure-performance.md`).
- Défaut visuel déjà signalé : article de courses affiché en double pendant ~150 ms après un
  ajout (test `fixme` dans `e2e/courses.spec.ts`).
