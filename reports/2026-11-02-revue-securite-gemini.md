# Revue de sécurité des modules Gemini — 2026-11-02

Revue **en lecture seule** : aucun code applicatif n'est modifié. Elle porte sur tous les points d'entrée vers l'API Gemini et sur le verrou biométrique de « Vider ma tête », qui protège les données les plus sensibles que Gemini manipule (écriture manuscrite du journal intime).

Référence de jugement : `PRODUCT.md` (app mono-utilisateur, « accès de confiance », pas d'authentification multi-utilisateurs).

## Périmètre et méthode

**Lu en entier** : `src/lib/gemini/appel.ts`, `src/app/api/reveil/route.ts`, `src/app/actions/{saisie,documents-vrac,documents-recherche,notes-assistant,vidage,verrou}.ts`, `src/lib/vidage/verrou.ts`, `src/lib/documents/{indexation,decrire}.ts`, et les parties de `documents.ts` qui écrivent `document_fichiers`.

**Lu en partie seulement** (extraits, greps ciblés) : `revue-assistant.ts` (replanification, début de l'analyse de semaine), `collection-reorganisation.ts` (validation des identifiants), `lib/saisie/compute.ts` (prompt).

**Non lu** : `collection-titrage.ts`, `collection-rangement.ts`, `documents-reorganisation.ts`, le reste de `revue-assistant.ts`, et les clients (`ApercuSaisie`, modales). Leurs conclusions ci-dessous sont donc des inférences à partir du même schéma (`appelerGemini` + `createAdminClient`), à confirmer.

**Base de données** : conseillers de sécurité Supabase consultés (voir « Constats positifs »).

**Non vérifié** (voir fin) : la protection du déploiement Vercel, les variables d'environnement réelles, l'historique git à la recherche de secrets.

## Verdict

La clé Gemini est bien gardée et les réponses du modèle sont proprement bornées. Le vrai risque n'est pas dans l'appel à Gemini mais **autour** : l'enrôlement de la passkey est ouvert à qui arrive le premier, et rien n'authentifie les Server Actions ni ne limite durablement les appels. Tout dépend de savoir si l'URL de production est joignable par des tiers, ce que cette revue n'a pas pu établir.

## Constats

### Haut

**H1 — L'enrôlement de la passkey de « Vider ma tête » n'exige aucune preuve de propriété.**
`optionsInscription` et `verifierInscription` (`src/app/actions/verrou.ts:66`, `:86`) ne demandent ni session, ni code, ni secret : elles refusent seulement quand `vidage_passkey` contient déjà une ligne. Tant que la table est vide, **le premier appareil qui s'inscrit devient le propriétaire du journal intime**, et `verifierInscription` ouvre aussitôt la session de 15 minutes (`:118`).
Cette fenêtre existe à la première mise en service et à **chaque changement de téléphone**, la procédure documentée étant `delete from vidage_passkey;` puis « se réinscrire aussitôt » (`PRODUCT.md`). Un tiers qui connaît l'URL et surveille cette fenêtre peut enrôler sa propre passkey, puis lire toutes les feuilles et tous les textes. La clé primaire `id = 1` empêche seulement la course entre deux inscriptions, pas l'inscription d'un inconnu.
*Correctif proposé* : exiger un secret d'enrôlement à usage unique (ex. `VIDAGE_INSCRIPTION_CODE`, variable d'environnement comparée en temps constant) avant `optionsInscription`, ou ne permettre l'enrôlement que pendant une fenêtre ouverte à la main côté serveur. Coût faible, gain direct sur le point le plus sensible.

### Moyen

**M1 — Aucune Server Action n'est authentifiée, et toutes utilisent la clé `service_role`.**
Il n'y a ni `middleware`/`proxy`, ni garde d'accès global. Les identifiants des Server Actions sont embarqués dans les bundles JavaScript servis à tout visiteur : qui atteint le site peut les appeler, et chacune écrit avec `createAdminClient()` (RLS contourné). C'est cohérent avec le choix produit (« accès de confiance », `PRODUCT.md`), mais cela signifie que **la seule barrière réelle est la non-découvrabilité de l'URL ou une protection Vercel**, et que le verrou de « Vider ma tête » est la seule vraie porte (d'où H1). Pour Gemini, la conséquence directe est M2.
*À décider* : activer la protection de déploiement Vercel ou un garde-fou d'accès global (cookie signé, comme celui du vidage) sur toutes les Server Actions et routes `api/`.

**M2 — Plafond de débit incohérent et inefficace en serverless.**
Seules deux entrées ont un plafond : `saisie` (8 appels/min, `saisie.ts:24`) et `/api/reveil` (6/min, `route.ts:65`). Il s'agit d'un compteur **en mémoire par instance** : sur Vercel, chaque instance a le sien, ce que le commentaire du code reconnaît (« best effort »). Une dizaine d'autres entrées n'ont **aucun** plafond : recherche de documents, tri du vrac (boucle un appel par document, jusqu'à 40 s chacun), description, fiche d'indexation, transcription de feuille, les trois modes de l'assistant de notes, les trois fonctions de la Revue, et les trois actions de Collection. `rechercherDocuments` peut à elle seule déclencher jusqu'à `RATTRAPAGE_MAX` lectures Gemini avec téléchargement de fichiers (`documents-recherche.ts:71-77`).
Le quota gratuit étant **partagé** entre toutes les fonctions (`appel.ts:10`), épuiser le quota par une seule entrée désactive aussi le Réveil, la saisie et le tri. Le quota est gratuit, donc l'impact est une indisponibilité, pas un coût.
*Correctif proposé* : un seul compteur, dans `appelerGemini` (point de passage unique), adossé à la base (table de compteurs avec incrément atomique) plutôt qu'à la mémoire.

**M3 — `/api/reveil` : le filtre « inter-sites » se contourne.**
La route refuse les requêtes dont `sec-fetch-site` vaut `cross-site` (`route.ts:77`). Cet en-tête est posé par les navigateurs ; un client hors navigateur (`curl`, script) l'omet ou le falsifie. La garde ne protège donc que contre un site tiers ouvert dans un navigateur, pas contre un appel direct. La route n'écrit rien et n'accepte qu'une heure `HH:MM`, donc l'effet se limite à la consommation de quota (voir M2).

**M4 — Envoi de fichiers : URL signées sans limite de taille ni vérification de contenu.**
`preparerUploadsVrac` (`documents-vrac.ts:348`) émet jusqu'à 20 URL signées d'envoi vers le bucket **public** `documents-fichiers`, sans plafond de taille, et `enregistrerDocumentsVrac` vérifie seulement que le fichier **existe** (`:379`), pas qu'il s'agit d'une image ou d'un PDF. L'extension est imposée par le serveur (`.jpg`/`.pdf`), mais le contenu est celui que le client envoie. Conséquences : stockage de contenu arbitraire servi depuis un domaine Supabase public, et lecture en mémoire d'un fichier de taille quelconque par `telechargerPourGemini`, qui appelle `arrayBuffer()` **avant** de contrôler la taille (`indexation.ts:45-47`), contrairement à `analyserDocumentVrac` qui lit `content-length` d'abord (`documents-vrac.ts:188`).
*Correctif proposé* : limite de taille sur le bucket, contrôle de `content-length` avant lecture dans `telechargerPourGemini`, et vérification du type réel à l'enregistrement.

### Bas

**B1 — Les détails d'erreur de Google remontent à l'écran.** `resultat.detail` (statut HTTP et message de Google, jusqu'à 200 caractères) est inséré dans des messages d'erreur (`documents-recherche.ts:105`, `vidage.ts:188`, `saisie.ts:81`) et renvoyé tel quel par `/api/reveil` (`route.ts:115`). Le code vérifie que la clé n'y figure pas (clé en en-tête, jamais en paramètre d'URL, `appel.ts:79`), mais le message peut révéler le nom du modèle ou des champs du schéma. Pour un utilisateur unique c'est voulu (diagnostic) ; c'est une fuite d'information si l'URL est accessible à des tiers.

**B2 — Injection de prompt : surface réelle, impact borné.** Du texte non maîtrisé entre dans les prompts : la phrase de saisie (`"""${texte}"""`, `compute.ts:183`, délimiteur non échappé), le contenu des notes, et surtout les **fiches** produites par Gemini à partir de documents reçus par le partage Android (un PDF piégé peut contenir des instructions qui se retrouvent dans `documents_fiches`, puis dans le prompt de recherche). Les sorties sont contraintes par un schéma et **revérifiées** côté serveur (`normaliserReponse`, `lireReponseRecherche`, `lireReplanification`, `lireTags`), les identifiants sont comparés aux listes lues en base, et rien n'est écrit avant « Valider ». Impact résiduel : biais des résultats de recherche ou du tri, pas d'écriture ni de fuite.

**B3 — `updateReglagesVidage` n'exige pas la session du vidage** (`vidage.ts:313`). C'est documenté (« le réglage du rappel, hors module, reste accessible »). Il ne modifie que l'activation et l'heure du rappel, sans donnée sensible.

**B4 — Aucun en-tête de sécurité** (CSP, `X-Frame-Options`, etc.) dans `next.config.ts`. Hors périmètre Gemini ; noté pour mémoire.

## Constats positifs

- **Clé Gemini** : `process.env.GEMINI_API_KEY`, lue côté serveur seulement, jamais préfixée `NEXT_PUBLIC_`, envoyée en en-tête `x-goog-api-key` et non en paramètre d'URL (`appel.ts:71-81`), donc absente des journaux de requêtes.
- **Appel unique** : toutes les fonctions lues passent par `appelerGemini`, avec délai maximal, un seul nouvel essai sur 503, et jamais d'exception.
- **Pas de SSRF aujourd'hui** : les URL récupérées par le serveur (`document_fichiers.url`) sont toutes fabriquées côté serveur à partir de `getPublicUrl` (vérifié dans `documents.ts` et `documents-vrac.ts`) ; aucun chemin lu n'accepte une URL fournie par le client.
- **Validation des entrées** : identifiants contrôlés par expression régulière UUID, lots plafonnés (`LOT_MAX_APPLIQUE = 50`, 20 fichiers par envoi), textes tronqués, écritures conditionnées (`.eq("en_vrac", true)`).
- **Écriture après aperçu** : saisie, tri, notes, collections et réorganisation proposent, et n'écrivent qu'après validation explicite.
- **Module Vider ma tête** : bucket **privé** avec URL signées d'une heure, cookies `httpOnly`, `sameSite: strict`, `secure` en production, jeton signé avec expiration, `exigerSession()` en tête de chaque action de données, WebAuthn avec vérification utilisateur obligatoire, banc e2e désactivable seulement avec un drapeau qui n'existe pas en production.
- **Base de données** (conseillers Supabase, 2026-11-02) : toutes les tables, y compris `documents_fiches`, `documents_descriptions`, `feuilles_vidage` et `vidage_passkey`, ont RLS activé **sans politique** (accès refusé à `anon` et `authenticated`, seule la clé de service passe). Les seuls avertissements sont `pg_net` dans `public` (déjà connu, audit du 2026-09-14, point 7) et la protection contre les mots de passe compromis, sans objet car Supabase Auth n'est pas utilisé.

## Ce que cette revue n'a pas pu établir

1. **Protection du déploiement Vercel** : l'outil a trouvé le projet `kilio` mais `get_project` a répondu 404, donc le réglage « Deployment Protection » (et le domaine public) n'a pas été lu. **C'est la question dont dépendent M1, M2, M3 et la gravité réelle de H1.**
2. **Secrets dans l'historique git** : non recherché.
3. **Variables d'environnement** de production (`GEMINI_API_KEY`, `VIDAGE_SESSION_SECRET` de 32 caractères minimum) : non consultées.
4. **Tests** : la présence de tests pour les actions Gemini (`*.test.ts`) a été constatée, leur contenu n'a pas été évalué.
5. Les fichiers listés plus haut comme « non lus ».

## Suite proposée, par ordre

1. Vérifier la protection de déploiement Vercel (en une minute dans le tableau de bord) : c'est ce qui décide de l'urgence du reste.
2. **H1** : secret d'enrôlement pour la passkey.
3. **M2** : compteur partagé dans `appelerGemini`, adossé à la base.
4. **M4** : limite de taille et contrôle du contenu pour les envois de fichiers.
5. Relire les fichiers non lus ci-dessus.
6. Décider de **M1** (garde d'accès global) selon le résultat de l'étape 1.
