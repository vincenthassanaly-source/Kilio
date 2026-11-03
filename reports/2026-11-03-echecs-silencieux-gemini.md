# Échecs silencieux : modules Gemini et API externes — 2026-11-03

Revue **en lecture seule** (agent `silent-failure-hunter`, puis vérification du constat H1 à la main). Aucun code applicatif n'est modifié, aucun test exécuté. Elle complète `2026-11-02-revue-securite-gemini.md`.

Question posée : quand une API tombe ou répond mal, l'utilisateur est-il informé, ou l'affichage disparaît-il / se présente-t-il comme un résultat normal ?

## Verdict

Le cœur Gemini est sain : `appelerGemini` (`src/lib/gemini/appel.ts`) ne perd rien (429 distingué, détail et journal sur chaque échec), toutes les actions renvoient `ok:false` ou `statut:"echec"`, et les composants clients lus affichent l'erreur et le quota.

Les défauts sont ailleurs : (1) une lecture serveur qui échoue est traitée comme « feuille vide » dans « Vider ma tête » et peut écraser des données, (2) une réponse Gemini **valide mais vide ou mal formée** est présentée comme un résultat normal, (3) les Edge Functions de notification consomment le jour avant d'envoyer et journalisent presque rien.

## Haute

**H1 — Échec de lecture de la feuille = « feuille vide » (risque de perte de données). Vérifié à la main.**
- `chargerServeur` (`src/app/(app)/vider-ma-tete/FeuilleView.tsx:102-116`) renvoie `null` si `getFeuille` renvoie `ok:false`, lève, ou dépasse 4 s (`DELAI_SERVEUR_MS`), sans message ni journal.
- `choisirFeuille` (`src/lib/vidage/local.ts:93-102`) : sans copie locale ni réponse serveur, elle renvoie une feuille **vide** (`source: "vide"`).
- Si l'utilisateur écrit alors, `ecrireFeuilleLocale` marque `a_envoyer: 1`, puis `envoyerEnAttente` (`local.ts:132-162`) appelle `enregistrerFeuille`, qui **remplace toute la feuille du jour** (« dernier écrit gagne », `vidage.ts:80`, upsert des traits `:116-121`). Le manuscrit du serveur est perdu sans que l'utilisateur ait su qu'il n'avait pas été chargé.
- **Conditions réelles** : il faut qu'il n'existe aucune copie locale du jour (autre appareil, cache vidé, ou feuille purgée par `purgerAnciennes` au bout de `JOURS_CONSERVES` jours) **et** que le serveur échoue ou dépasse 4 s (plausible en réseau mobile lent). Avec une copie locale en cache, c'est elle qui est affichée, donc le risque est un écrasement par une version plus ancienne plutôt qu'une feuille blanche.
- **Effet voisin** : `setTranscription(serveur?.transcription ?? null)` (`FeuilleView.tsx:179`) met le texte du jour à `null` dès que le serveur n'a pas répondu, donc le menu « Voir le texte » disparaît et le texte semble inexistant. Et si une copie locale est en attente d'envoi (`a_envoyer === 1`, ligne 170), le serveur n'est **jamais** interrogé : le texte du jour est masqué même en ligne.
- *Correctif minimal* : distinguer « pas de ligne » (`ok` avec `traits: []`) de « lecture échouée » ; en cas d'échec, afficher un bandeau « Feuille non chargée, réessaie » et bloquer l'écriture (ou fusionner) ; charger le texte du jour séparément de la feuille locale.

## Moyenne

**M1 — Réponse Gemini valide mais vide ou mal formée, présentée comme un résultat normal.**
- Documents : `src/lib/documents/reorganisation.ts:110-111` renvoie `[]` si `documents` est absent ; `ReorganiserModal.tsx:246-249` affiche « Ton classement est déjà cohérent ».
- Collections : `src/lib/collection/reorganisation.ts:161` (même repli), `ReorganiserCollectionsModal.tsx:268` : « Ton rangement est déjà cohérent ».
- Recherche de documents : `src/lib/documents/recherche.ts:110-111` renvoie `[]` si `ids` n'est pas un tableau ou si tous les ids sont inconnus ; l'action répond `ok({ids: []})` (`documents-recherche.ts:109`) et `DocumentsBrowser.tsx:376` affiche « Aucun document ne correspond à ta question ».
- Impact : l'utilisateur conclut que le document n'existe pas ou que tout est rangé.
- *Correctif* : `lireReponse*` renvoie `null` quand la forme est invalide et l'action fait `fail("Réponse de Gemini inutilisable. Réessaie.")` ; seul un tableau vide **valide** donne « aucun résultat ».

**M2 — Tri du vrac et titrage : une réponse illisible devient une proposition cochée par défaut.**
- Tri : `src/lib/documents/tri.ts:101-109` (nom inchangé, catégorie « Autre » ou `null`) ; `TriVracModal.tsx:119` met `coche: doublon === null`.
- Titrage : `src/lib/collection/titrage.ts:65-73` (titre actuel ou « Sans titre ») ; `TitrageModal.tsx:121` met `coche: true`.
- Scénario : Gemini renvoie `{}` ; un document passe de « vrac » à « Autre », ou un élément est renommé « Sans titre ».
- *Correctif* : `lireReponseTri` et `lireReponseTitrage` renvoient `null` quand `nom`, `categorie` ou `titre` manquent, l'action répond `echec`.

**M3 — Recherche de documents : documents non couverts et fiches périmées sans avertissement.**
- `documents-recherche.ts:54` limite à `DOCUMENTS_MAX_RECHERCHE = 150` documents (les plus récents) ; `ResultatRecherche` n'a pas de champ `tronque`, et les plus anciens ne sont jamais cherchés alors que l'écran dit « Aucun document ne correspond ».
- Lignes 70-92 : si le rattrapage échoue (`lecture.statut === "echec"`, quota compris), une fiche périmée reste utilisée sans être comptée dans `nonLus`.
- *Correctif* : ajouter `tronque` et l'afficher ; compter comme `nonLus` les fiches périmées dont le rattrapage a échoué ; remonter `quota`.

**M4 — Analyse de la semaine (Revue) : un module en échec est omis ou pris pour du vide.**
- `revue-assistant.ts:289-296` (`section`) et `395-413` : si les tâches lèvent et que les autres modules sont vides, `analyseVide` (`src/lib/revue/analyse.ts:158-167`) traite `null` comme vide et affiche « Rien à analyser pour l'instant », alors que c'est une panne. Si un seul module échoue, l'analyse est produite sans lui, avec seulement un `console.error`.
- *Correctif* : renvoyer la liste des modules illisibles et l'afficher ; faire échouer l'action si tous échouent.

**M5 — Revue : planning de travail illisible = « aucun horaire » pour Gemini.** `revue-assistant.ts:97-105` : `creneaux.data ?? []` donne `travail: []` pour chaque jour. La replanification peut suggérer des tâches sur des heures de travail sans que l'utilisateur sache que le planning n'a pas été lu.

**M6 — Edge Functions : jour réservé avant l'envoi, jamais libéré, échecs non journalisés.**
- Bon modèle à copier : `supabase/functions/envoyer-bilan-hebdo/index.ts:90-98` (`echec` + `liberer`) et `envoyer-alertes-nutrition` (`liberer`, `console.error`).
- Défaut dans `envoyer-briefing-matin/index.ts:65-98`, `envoyer-revue-hebdo/index.ts:75-120` et `envoyer-rappel-vidage/index.ts` : une erreur après la réservation (lecture des tâches, événements ou abonnés) renvoie 500 mais le jour reste consommé ; l'échec d'envoi autre que 404/410 est avalé sans journal ; `sent: 0` est renvoyé en 200.
- `envoyer-rappels-taches/index.ts:266-278` : une erreur push hors 404/410 est ignorée et `marquer()` est quand même exécuté (le commentaire ligne 271 l'assume pour ne pas spammer), sans aucun journal ; le résultat de `marquer()` n'est pas vérifié.
- `envoyer-rappel-repos/index.ts:34-56` : `rappels_repos.envoye = true` posé avant tout, erreur de `push_subscriptions` ignorée (ligne 45), échecs d'envoi non journalisés (lignes 70-75).
- Toutes : clés VAPID absentes → JSON `{error}` en HTTP 200, indiscernable d'un succès pour `pg_cron`.
- *Correctif* : factoriser le schéma `liberer` de `bilan-hebdo`, ajouter `console.error` dans chaque `catch` d'envoi et chaque `return json({error})`, renvoyer 500 pour VAPID absent.

**M7 — Vrac : rollback non vérifié.** `documents-vrac.ts:399-402` : si l'insertion des fichiers échoue, le `delete` de nettoyage n'est pas vérifié ; des documents « en vrac » sans fichier peuvent rester, dont le tri échouera sur « Ce document n'a aucun fichier à analyser ».

## Basse

- **L1 — Suggestion de collection** (`src/app/collection/partage/choisir/ChoisirCollectionForm.tsx:53-61`) : un `ok:false` ou le quota produit le même état que « rien trouvé ». Correctif : message discret « Suggestion indisponible ».
- **L2 — Réveil** (`ReveilButton.tsx:68-80`) : une 502/504 HTML de Vercel fait lever `res.json()` et affiche « Connexion impossible » (trompeur). La route elle-même est correcte. Correctif : tester `res.ok` avant `json()`.
- **L3 — Messages trompeurs sur réponse illisible** : `notes-assistant.ts:128-133` (« aucun tag pertinent » pour une réponse mal formée), `revue-assistant.ts:277-279` (« aucune meilleure date »).
- **L4 — Téléchargement d'image silencieux** (`src/lib/collection/image.ts:42-56`) : renvoie `null` sans journal ; titrage et rangement continuent avec le texte seul (repli assumé en en-tête). Manque un `console.warn`.
- **L5 — Jours fériés** (choix documenté dans `PRODUCT.md`, mais sans trace) : `jours-feries.ts:24-37` n'a ni journal ni vérification de l'`upsert` ; en cas de panne, chaque lecture retente un `fetch` de 5 s ; `aujourdhui/page.tsx:51` fait `.catch(() => [])`, ce qui met `[]` en cache comme un succès et masque le badge jusqu'à l'expiration du cache.
- **L6 — Flux ICS** (`src/app/api/agenda/feed.ics/route.ts:43-46`) : 500 sans `console.error` ; une table absente donne un calendrier vide en 200 (choix assumé).
- **L7 — Réorganisation** : `collection-reorganisation.ts:226-233` (erreur de `prochainRang` ignorée), `:363-368` et `:413-416` (`delete` non vérifié), `documents-reorganisation.ts:282` (idem). Au pire une collection ou catégorie vide.
- **L8 — Indexation** : `indexation.ts:71` (`delete` de fiche non vérifié), `:76-80` (erreur de lecture ignorée → ré-indexation inutile). `planifierIndexation` et `indexerEnArrierePlan` sont **acceptables** : échecs journalisés, quota qui stoppe la boucle, recherche qui rattrape.
- **L9 — Vider ma tête** : `vidage.ts:68` et `307-308` (échec de `createSignedUrl(s)` sans journal), `:142` et `:266-269` (un `update` sur 0 ligne renvoie `ok()`).
- **L10 — Doublons** : `documents-vrac.ts:122` et `:240` désactivent la détection de doublons sans le dire en cas d'erreur de lecture.

## Vérifié correct

`appelerGemini` (délai, une relance sur 503, 429 distingué, message Google, `finishReason`) ; quota affiché dans `TriVracModal`, `TitrageModal`, `SaisieNaturelle`, `AssistantNoteModal`, `AssistantRevueModal`, `DescriptionModal`, `DocumentsBrowser` (`iaErreur`) et `FeuilleView` (toast via `runAction`) ; `runAction` transforme toute exception en toast ; `nonLus` de la recherche bien affichés quand le rattrapage échoue sans fiche préexistante ; notifications push côté client (`subscribe.ts` lève, l'abonnement navigateur est annulé si l'enregistrement échoue) ; `envoyer-bilan-hebdo`, `envoyer-alertes-nutrition`, `nettoyage-auto` remontent leurs erreurs.

## Limites de cette revue

- **H1** est vérifié à la main sur `FeuilleView.tsx`, `local.ts` et `vidage.ts`. **Tous les autres constats viennent de l'agent** et n'ont pas été relus un par un.
- Non lus : `memoriserFeuilleServeur` en détail, `AgendaView.tsx:148` et `AujourdhuiView.tsx:76` (comportement quand `getJoursFeries` échoue), `CalendrierView.tsx`, `NotificationsRow.tsx:1-55`, les fichiers `compose.ts` des Edge Functions.
- Aucun widget météo n'a été trouvé dans `src/` ni `supabase/`, bien que des rapports de septembre en mentionnent un : à confirmer qu'il a bien été retiré.
- Aucun test exécuté, aucun comportement reproduit en conditions réelles.

## Ordre de correction proposé

1. **H1** (perte de données possible dans le carnet intime).
2. **M1 et M2** : un même changement de convention (`lireReponse*` renvoie `null` si la forme est invalide), qui supprime les faux « aucun résultat » et les propositions cochées par défaut.
3. **M6** (rappels perdus sans trace), en copiant le schéma `liberer` de `envoyer-bilan-hebdo`.
4. **M3, M4, M5, M7**, puis les constats bas regroupés par fichier.
