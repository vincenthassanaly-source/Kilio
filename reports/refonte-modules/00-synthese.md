# Synthèse transversale — cohérence des modules Kilio

Date : 2026-11-14. Source : 17 rapports d'agents (un par module, `reports/refonte-modules/<module>.md`), plus `plus` et `reglages` traités par un même agent. Axes jugés : A parcours et hiérarchie, B vocabulaire et gestes (charte du `GLOSSARY.md`), C cohésion fonctionnelle. Lecture seule : aucun code n'a été modifié.

Cette synthèse reprend les constats des rapports. Elle n'a pas été revérifiée indépendamment, et chaque rapport dit ce qui n'a pas pu être testé (faux Supabase sans données, caméra, push, verrou biométrique, gestes tactiles).

## Verdict

Les modules sont globalement cohérents : suppressions annulables, retours « parent logique », états vide, erreur et chargement présents, la plupart des défauts de l'audit design du 11-12 déjà corrigés. Les écarts sont petits et se répètent d'un module à l'autre. Le vrai chantier est entre modules (accès, doublons, documentation), pas dans leur agencement interne.

128 propositions au total (P1… par module), presque toutes d'effort S.

| Module | Propositions | Point saillant |
|---|---|---|
| agenda | 9 | vue non mémorisée, Liste en doublon partiel de Tâches, création par appui long non signalée |
| aujourdhui | 8 | trois entrées de création concurrentes, vestige de la fusion dans un message d'erreur |
| collection | 5 | « Décrire » s'ouvre seul après chaque ajout, routeur de partage logé sous collection |
| courses | 5 | module sain, coche violette hors charte, glossaire à corriger sur « Supprimer » |
| documents | 8 | « Trier » à double sens, glossaire muet sur Vrac et Catégorie |
| habitudes | 6 | « Supprimer » archive sans écran pour relire l'archive |
| journal | 6 | texte du jour caché derrière « … », confirmation incohérente entre Effacer et Valider |
| musculation | 9 | Historique inaccessible tant qu'aucune séance n'existe, bloc exercice en 3 versions |
| notes | 7 | édition de checklist écrit en base sous un bouton « Annuler », « → Tâche » répétable |
| nutrition | 12 | quantité d'un repas non corrigeable, ordre des moments incohérent |
| opinions | 6 | titres de modales hors charte, onglet perdu au retour |
| pharmacie | 8 | trois sous-produits sous un nom, ajout d'huile contraire à PRODUCT.md |
| plus | 9 | épinglage par geste caché, 9 modules à une seule porte, recherche sur 5 domaines sur 16 |
| reglages | 8 | barre du bas réglable ailleurs, 4 notifications sur 6 seulement |
| revue | 7 | « Bilan » hors charte, 4 boutons IA pour 3 synthèses |
| scanner | 6 | intro inexacte, Exporter loin de la liste |
| taches | 9 | report en 4 taps, trois sens de « du jour » |

## Thèmes transversaux

### 1. Vocabulaire hors charte qui se répète
- « + Ajouter… », « + Série », « + Séance passée » (nutrition, musculation) : préfixe « + » que la charte ne prévoit pas.
- « Valider » (aujourdhui, scanner) : en « Avoid » au glossaire. PRODUCT.md le documente pour l'aperçu de saisie, donc à arbitrer.
- « Modifier », « Éditer », « Fermer », « Planifier » (nutrition, opinions, agenda).
- Titres de modales de création (opinions : « Ajouter un parti », « Nouveau programme »).
- « Bilan » utilisé dans la Revue alors que le glossaire le réserve à Nutrition › Bilan (revue, plus).
- « Replanifier » (IA) contre « Reporter » (manuel), « Commencer » contre « Démarrer ».
- « Série » : mot trop proche de « Oui / non » (habitudes).

À faire : une passe unique sur les libellés avec le glossaire ouvert, plus l'ajout au glossaire des mots qui y manquent (Vrac, Catégorie, Reporter/Replanifier, Terminer).

### 2. « Annuler » manquant sur des gestes fréquents
- Modales d'agenda (croix seule), lien vidéo de collection, ajout d'un repas du Carnet, suppression d'un item de note, replanification IA de la Revue.
- À l'inverse, des confirmations qui ne devraient pas exister : « Effacer la feuille » du Journal demande une confirmation alors qu'elle est annulable, tandis que « Valider » une transcription, irréversible, n'en a pas.

### 3. « Supprimer » qui n'en est pas un
- Habitudes : l'action archive (`actif=false`) mais le toast dit « supprimée », et aucun écran ne relit l'archive. Décision de Vincent requise.
- Courses : supprime tout de suite et restaure par réinsertion, alors que le glossaire décrit un patron différé. Le glossaire est à corriger, pas le code.

### 4. Accès et entrées de création
- Aujourd'hui a trois entrées de création concurrentes (barre « Ajoute… », bouton flottant, carte Repas qui ne fait que naviguer).
- Neuf modules n'ont qu'une porte, Plus, à 2 taps. Agenda n'est pas lié depuis Aujourd'hui, Habitudes seulement dans l'état vide.
- La recherche ne couvre que 5 domaines sur 16 et n'existe que sur Aujourd'hui. Pharmacie n'y apparaît pas.
- Plus : les modules épinglés restent dans la grille sans marqueur, l'épinglage n'a pas d'alternative au geste (ni clavier ni menu), pas de réinitialisation de la barre.

### 5. Doublons et frontières entre modules
- Agenda › Liste reprend `/taches` (mêmes cartes, « Sans date », archivées).
- Report d'une tâche : Aujourd'hui (2 taps), Revue (1 tap par tâche, 3 depuis Aujourd'hui), Tâches (4 taps minimum). Trois chemins, trois comportements.
- Pesée : saisie dans Aujourd'hui, bouton « Peser » dans le Bilan de Nutrition.
- Menus → Courses : dédoublonnage sur le libellé complet (conséquence du choix « article = texte libre », non rouvert).
- Notes et Courses : doublon d'usage possible. `taches.note_id` est écrit mais jamais relu.
- Scanner → Documents : envoi seulement en PDF, et Documents n'a aucune porte vers le Scanner.
- Le routeur de partage vit sous `collection/` alors qu'il sert aussi Tâche et Documents.
- Le Réveil est orphelin (aujourdhui). Les mots « retard » et « en retard » coexistent (taches, revue).
- Paramètres éclatés : cibles kcal dans Nutrition, jours libres dans Aujourd'hui, verrou dans le Journal, barre du bas dans Plus. « Personnaliser la navigation » renvoie vers Plus depuis Réglages : lien circulaire.

### 6. Documentation qui contredit le code
- PRODUCT.md : « Peser depuis le Bilan » (la pesée est saisie dans Aujourd'hui), « Transcrire dans le menu … » (il est dans la barre d'outils), « barre collante » (rendue non collante volontairement), Pharmacie « ajout uniquement par le chat » (les Huiles ont un formulaire d'ajout), périmètre de Notes non décrit.
- GLOSSARY.md : patron de « Supprimer » (Courses), confirmation d'« Effacer la feuille », mots manquants.

### 7. Couleurs de coche
- Courses : violet (`--accent-courses`), Habitudes : orange (`--accent-habitudes`), alors que `DESIGN.md:146` réserve le vert Kcal aux contrôles interactifs d'un module. À trancher explicitement dans DESIGN.md.

## Décisions qui vous reviennent

Ces points touchent un choix documenté ou demandent un arbitrage produit. Aucun n'a été tranché par les agents.

1. **Habitudes** : « Supprimer » archive. Dire la vérité (renommer en « Archiver » + écran des archives) ou supprimer vraiment ?
2. **Pharmacie** : garder ou retirer le formulaire d'ajout d'huile (contraire à PRODUCT.md:17) ? Exception de retour pour le Cours (retour vers les résultats de recherche) ?
3. **Taches** : renommer « Tâche du jour » (P3) ; sort des tags sans filtre (P7).
4. **Aujourd'hui** : « Valider » de l'aperçu de saisie, documenté dans PRODUCT.md.
5. **Collection** : ne plus ouvrir « Décrire » automatiquement (reprend l'audit du 11-12).
6. **Notes** : « Fermer » ou items différés (P1), tuile entièrement cliquable (P3).
7. **Revue** : réduire les 4 boutons IA (P5).
8. **Agenda** : statuer sur la vue Liste face à `/taches` (P7), tâches du jour avant la grille (P3).
9. **Couleurs de coche** : vert Kcal partout ou accents par module ?
10. **Navigation globale** : barre du bas réglable dans Réglages et Plus à la fois ? Groupes dans la grille ? Recherche étendue aux 16 domaines ?

## Ordre de refonte suggéré (une PR par module)

1. **Petits modules sans risque** : courses, collection, scanner, documents. Libellés, textes, glossaire.
2. **Modules à propositions S dominantes** : revue, notes, opinions, journal, agenda, taches, nutrition.
3. **Après vos décisions** : habitudes, pharmacie, aujourdhui, musculation.
4. **En dernier, transversal** : plus, reglages et la recherche globale, car ils dépendent des déplacements décidés ailleurs.

Chaque PR est fusionnée vers `kiliomain` après build, tests et lint verts (workflow du `CLAUDE.md`).

## Limites générales

- Le faux Supabase est quasi vide pour plusieurs modules (habitudes, musculation, collection, documents, pharmacie, opinions, revue) : des écrans entiers sont jugés d'après le code, marqués « non vérifié visuellement » dans les rapports.
- Banc partagé entre agents, remis à zéro en cours de route après une interruption (limite d'usage) : quelques clics en échec sont des artefacts.
- Non testable : caméra, push, passkeys, verrou du Journal, stylet, gestes tactiles, clé Gemini absente, hors-ligne réel.
- Les scripts du skill `kilio-audit-module` cherchent Chromium 1194 alors que seul le 1243 est installé : les agents ont utilisé des copies. À corriger dans le skill si ce banc doit servir de nouveau.
