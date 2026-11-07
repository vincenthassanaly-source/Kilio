# Audit global de l'app — 2026-11-07

Audit en lecture seule (6 passes parallèles : sécurité, accessibilité/UI, performance, qualité du code, parcours utilisateur, SEO/PWA), suivi de correctifs strictement sûrs (aucun changement de comportement ni de schéma).

Base de référence avant et après : `lint`, `typecheck`, 204 fichiers / 2360 tests Vitest et `build` verts. Audit statique : rien n'a été mesuré en navigateur, les impacts sont estimés.

## Correctifs appliqués

| Fichier | Changement | Origine |
| --- | --- | --- |
| `next.config.ts` | En-têtes `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `X-Robots-Tag` ; `no-cache` sur `/sw.js` | Sécurité I3, SEO |
| `src/app/robots.ts` (nouveau) + `layout.tsx` | `Disallow: /` et `robots: noindex` (app privée) | SEO |
| `src/components/ServiceWorkerRegister.tsx` | `updateViaCache: "none"` | PWA |
| `public/sw.js` | `Response.redirect` avec URL absolue (sinon `TypeError` dans le share target) | PWA |
| `DashboardHabitItem.tsx` | `aria-pressed` sur le bouton fait / pas fait | A11y I2 |

## À décider ou à traiter à la main (non appliqué)

1. **Critique — aucune authentification** sur les server actions et routes `/api`, tout passe par le client `service_role`. À confirmer : une protection Vercel (Deployment Protection) existe-t-elle ? Sinon, proxy avec cookie signé.
2. **Critique — Journal** (`FeuilleView.tsx:102-180`, `vidage.ts:116`) : une feuille ouverte vide après un timeout peut écraser la feuille serveur au sync.
3. Edge Functions appelables avec la clé anon publique (`scripts/migration-cron-rappels-taches-2026-09-01.sql:19`) : prévoir un secret dédié.
4. `saveSubscription` accepte n'importe quel endpoint push (SSRF aveugle) : liste blanche d'hôtes, à valider contre les services push réellement utilisés.
5. Pas de plafond de débit sur les actions Gemini ; limiteur de `saisie.ts` en mémoire donc inefficace en serverless.
6. Service worker : précache de 6,6 Mo d'animations, fallback `/` servi aux requêtes RSC, `addAll("/")` pouvant bloquer l'installation.
7. Parcours : double validation de série (séance flottante), doublons de `SaisieNaturelle` après « Annuler », file Dexie bloquée par une action en échec durable, invalidation de cache après mise en file hors ligne.
8. Décisions produit : fermeture des modales au tap sur le fond (`Modal.tsx:40`), renommage de course validé au `blur`, icône maskable dédiée, `viewportFit: "cover"`.
9. Tests manquants : `menus`, `musculation`, `saisie`, `rappel-repos`, `huiles`, `runAction`, `lib/offline/*`, `lib/scanner/*`.
10. Divers : `@vitest/coverage-v8` inutilisée (`package.json:51`), `npm audit` à lancer, framer-motion non lazy (51 fichiers).

Les rapports détaillés de chaque passe suivent, avec `fichier:ligne`, scénario et mention « correctif sûr ».


---

# Audit sécurité Kilio (lecture seule) - 2026-11-07

Contexte : app mono-utilisateur, sans authentification depuis le 2026-08-29. Toutes les tables ont la RLS activée sans policy (deny-all) et l'accès passe par la clé service_role côté serveur (src/lib/supabase/admin.ts). Les règles de stockage publiques ont été retirées le 2026-10-26. Le module Journal (vidage) est protégé par passkey WebAuthn + cookie signé (src/lib/vidage/verrou.ts), solide. Aucun secret en dur dans le code (seule la clé anon Supabase, publique par nature, figure dans scripts/migration-cron-rappels-taches-2026-09-01.sql:19). Aucun `eval`; un seul dangerouslySetInnerHTML (src/app/layout.tsx:58, script de thème statique, sans entrée utilisateur).

Modèle de menace réel : toute personne connaissant l'URL de production peut appeler les Server Actions (les identifiants d'action sont dans le JS public) et les routes API. Il n'y a aucun contrôle d'identité hors Journal. Le risque est donc : lecture/modification/suppression de TOUTES les données par un tiers qui trouve l'URL. Cela est connu et assumé par le choix "pas d'auth", mais c'est le risque dominant (voir C1).

## CRITIQUE

### C1. Aucune authentification sur ~70 modules d'actions et sur les routes API : accès total aux données pour quiconque trouve l'URL
- Fichiers : src/app/actions/*.ts (toutes sauf vidage.ts/verrou.ts), src/app/api/*, pas de src/proxy.ts ni middleware.
- Problème : créer/lire/supprimer tâches, notes, documents (fichiers publics), santé (sante.ts), pharmacie, opinions, etc., sans aucun secret. Les buckets sont publics (URL devinable par UUID seulement). Les données de santé et documents personnels sont exposés si l'URL fuit (historique navigateur partagé, lien partagé, référent, scan d'URL Vercel).
- Correctif proposé : activer Vercel Deployment Protection / Password Protection (réglage Vercel, sans toucher au code) ou ajouter un src/proxy.ts qui exige un cookie signé (sur le modèle de lib/vidage/jeton.ts) pour toute route sauf /api/agenda/feed.ics (jeton), /manifest.json, /sw.js, /icons. Attention : le service worker appelle /api/taches/*/ (même origine, cookie envoyé, OK) et le share-target POST doit rester joignable avec le cookie.
- Correctif sûr sans changement de comportement : non (introduit un écran/jeton de connexion; la protection Vercel change l'accès). À décider par le propriétaire.

## IMPORTANT

### I1. saveSubscription accepte n'importe quel endpoint : SSRF aveugle depuis les Edge Functions et spam push
- Fichier : src/app/actions/notifications.ts:15-30 (saveSubscription), envoi dans supabase/functions/envoyer-rappel-repos/index.ts:65 (et les 6 autres fonctions d'envoi).
- Problème : endpoint/p256dh/auth non validés. Un tiers peut enregistrer une URL arbitraire (ex. http://169.254.169.254/..., service interne); les Edge Functions y enverront un POST chiffré toutes les minutes. Aussi : deleteSubscription(endpoint) permet de désabonner un appareil.
- Correctif : valider `new URL(endpoint)` en https, hôte dans une liste blanche des services push (fcm.googleapis.com, updates.push.services.mozilla.com, *.notify.windows.com, web.push.apple.com, *.push.apple.com), longueurs max sur les clés base64url, limiter le nombre de lignes (ex. 10).
- Correctif sûr sans changement de comportement : oui (les navigateurs légitimes utilisent ces hôtes; garder la liste large ou valider seulement https + refuser IP/localhost pour limiter le risque de régression).

### I2. Edge Functions d'envoi/nettoyage invocables par quiconque détient la clé anon (publique, commitée)
- Fichiers : supabase/functions/*/index.ts (Deno.serve sans contrôle), clé anon dans scripts/migration-cron-rappels-taches-2026-09-01.sql:19.
- Problème : pg_cron les appelle avec la clé publishable comme Bearer; la vérification JWT par défaut de Supabase n'authentifie donc qu'un rôle anon, connu de tous. Un tiers peut déclencher nettoyage-auto (suppression des éléments faits au-delà du délai, comportement déjà prévu), forcer des envois push (rappels, briefing, bilans) et épuiser le quota. envoyer-rappel-repos attend l'échéance exacte (jusqu'à 6 s) : coût CPU/durée si appelée en boucle.
- Correctif : secret partagé dédié (ex. CRON_SECRET en Vault + secret de fonction), vérifié en tête de chaque Deno.serve (comparaison temps constant) et envoyé par les jobs pg_cron à la place de la clé publishable; ou désactiver verify_jwt et vérifier ce secret.
- Correctif sûr sans changement de comportement : non (exige de modifier les jobs pg_cron et de redéployer les fonctions de façon coordonnée, sinon les rappels s'arrêtent).

### I3. Pas d'en-têtes de sécurité (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy)
- Fichiers : next.config.ts (pas de headers()), vercel.json:1-4.
- Problème : clickjacking possible (l'app peut être mise en iframe, et les actions sont publiques), pas de CSP pour limiter un XSS futur, pas de HSTS explicite (Vercel en met un par défaut sur le domaine vercel.app).
- Correctif : ajouter `async headers()` dans next.config.ts : X-Content-Type-Options: nosniff, X-Frame-Options: DENY (ou CSP frame-ancestors 'none'), Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy limitée (camera=(self) pour le scanner, microphone=(self) si dictée, geolocation=()). CSP complète : à tester (script inline du thème layout.tsx:58, Next, blob: pour OpenCV/wasm, img-src Supabase).
- Correctif sûr sans changement de comportement : oui pour nosniff, X-Frame-Options, Referrer-Policy; non pour CSP (peut casser le scanner/OpenCV, le script inline, les vidéos).

### I4. Server Actions et routes appelant Gemini sans limite de débit : épuisement du quota gratuit
- Fichiers : src/app/actions/saisie.ts, documents-description.ts, documents-recherche.ts, documents-reorganisation.ts, documents-vrac.ts, notes-assistant.ts, revue-assistant.ts, collection-rangement.ts, collection-reorganisation.ts, collection-titrage.ts ; seule src/app/api/reveil/route.ts:73-88 a un plafond (en mémoire, par instance, contournable en serverless).
- Problème : un tiers peut vider le quota partagé (Gemini renvoie alors 429 à toutes les fonctions) ou, si la facturation est activée, générer des coûts. Les images peuvent être jusqu'à 4 Mo par appel.
- Correctif : limite globale persistante (compteur en base par fenêtre, via createAdminClient) dans un helper appelé en tête de chaque action Gemini; plafond de budget côté Google Cloud; garder le quota gratuit sans facturation.
- Correctif sûr sans changement de comportement : non (ajoute des refus 429 possibles; seuil à choisir).

### I5. Erreurs internes renvoyées au client
- Fichiers : src/app/api/taches/[id]/reporter-rappel/route.ts:42 (error.message Supabase), src/app/api/taches/[id]/marquer-fait/route.ts:29-30 (message d'exception brut), src/app/actions/notifications.ts:25,30 (throw new Error(error.message); en production Next masque les messages des Server Actions, donc faible), src/app/api/reveil/route.ts:111-116 et 135 (detail Gemini et attendu).
- Problème : divulgation de noms de tables/colonnes/contraintes Postgres à un appelant non authentifié.
- Correctif : journaliser côté serveur (console.error) et renvoyer un message générique ("Erreur serveur.").
- Correctif sûr sans changement de comportement : oui côté sécurité; non strictement pour reveil, dont l'écran affiche `detail` pour le diagnostic (garder en développement uniquement, ou le tronquer).

### I6. Routes API sans garde cross-site ni validation de taille : /api/rappel-repos et /api/taches/[id]/*
- Fichiers : src/app/api/rappel-repos/route.ts:11-21, reporter-rappel/route.ts:20-49, marquer-fait/route.ts:15-33.
- Problème : seule /api/reveil refuse `sec-fetch-site: cross-site`. Ces POST/DELETE (JSON, sans cookie requis) peuvent être déclenchés depuis n'importe quelle page web (CSRF/appel direct) : marquer une tâche faite (sur UUID connu), annuler le rappel de repos, programmer une notification avec titre/corps arbitraires (limités à 80/160 caractères, src/app/actions/rappel-repos.ts:29-30) poussée sur tous les appareils (message de phishing possible). Le Content-Type n'est pas vérifié, donc une requête "simple" cross-origin text/plain passe.
- Correctif : factoriser le garde de reveil/route.ts:74-76 (refuser cross-site; autoriser same-origin et same-site/none pour le service worker : le SW envoie same-origin) et l'appliquer aux 4 handlers.
- Correctif sûr sans changement de comportement : oui (le client et le SW font des requêtes same-origin).

## MINEUR

### M1. Service worker : url de notification non contrainte
- Fichier : public/sw.js:303,311,356-358 (`new URL(cible, self.location.origin)`; on n'utilise que le pathname pour matcher, mais l'ouverture de fenêtre utilise ensuite `cible`).
- Problème : un push forgé (si un endpoint attaquant est abonné, ou via I1/I6 pour le repos) pourrait contenir une URL absolue externe ouverte au clic. Les pushes sont signés VAPID, donc l'exploitation réelle nécessite la clé privée : risque faible. Vérifier la fin de ouvrirApp (non lue en détail).
- Correctif : ne conserver que les chemins relatifs commençant par "/" (et pas "//") : `const u = new URL(cible, origin); if (u.origin !== origin) -> "/agenda"`.
- Correctif sûr sans changement de comportement : oui.

### M2. Route share-target : limite et validation légères
- Fichier : src/app/collection/partage/route.ts:19-84.
- Constats positifs : seuls TikTok/YouTube (liste d'hôtes stricte) sont résolus côté serveur; redirect "error" pour les miniatures; type MIME `image/*` filtré avant upload; `attente` validé par regex; `nb` borné à 50. Réserves : (a) `tiktok.ts:45` suit les redirections de liens courts sans re-valider chaque saut (le résultat final est contrôlé mais la requête intermédiaire part vers l'hôte de redirection : SSRF aveugle limité, `fetch(url)` avec `redirect: "follow"`) ; (b) `type.startsWith("image/")` repose sur le type déclaré par le client, mais sharp ré-encode en JPEG (collections.ts:51,98), donc OK ; les PDF (documents-vrac) ne sont pas vérifiés par signature ; (c) pas de plafond sur le nombre/la taille de fichiers pour le chemin de secours (borné par les 4,5 Mo de Vercel).
- Correctif : (a) utiliser `redirect: "manual"` et re-valider chaque Location avec estHoteTiktok avant de suivre (max 3 sauts); (c) vérifier la signature "%PDF-" des PDF.
- Correctif sûr sans changement de comportement : oui pour (a) et (c) (les liens courts TikTok redirigent vers tiktok.com).

### M3. Chargement de fichiers via URL stockée en base (fetch(ligne.url))
- Fichiers : src/app/actions/documents-vrac.ts:95,183 ; src/lib/documents/indexation.ts:43.
- Problème : fetch d'URL lues en base (document_fichiers.url). Elles sont construites côté serveur par getPublicUrl (documents-vrac.ts:392) à partir de chemins validés par CHEMIN_FICHIER : pas d'URL client directe, donc pas de SSRF exploitable aujourd'hui. À surveiller si une action accepte un jour une URL client.
- Correctif : défense en profondeur : vérifier que `new URL(url).origin === new URL(NEXT_PUBLIC_SUPABASE_URL).origin` avant fetch; plafonner la taille lue (indexation.ts:43-45 lit tout le corps avant de contrôler le total).
- Correctif sûr sans changement de comportement : oui.

### M4. Rate limit de /api/reveil en mémoire, non partagé
- Fichier : src/app/api/reveil/route.ts:62-71.
- Problème : contournable (plusieurs instances, redémarrages à froid); garde `sec-fetch-site` contournable hors navigateur (curl n'envoie pas l'en-tête).
- Correctif : voir I4 (compteur persistant).
- Correctif sûr sans changement de comportement : non.

### M5. WebAuthn : origine déduite des en-têtes Host/X-Forwarded-*
- Fichier : src/lib/vidage/verrou.ts:114-121.
- Problème : rpID/origin viennent d'en-têtes de la requête. Sur Vercel ces en-têtes sont posés par la plateforme, donc risque faible ; un hôte forgé ne contourne pas la signature de la passkey.
- Correctif : fixer rpID/origin par variables d'environnement (WEBAUTHN_RP_ID, WEBAUTHN_ORIGIN) avec repli sur l'existant.
- Correctif sûr sans changement de comportement : oui (si les variables sont absentes, comportement actuel).

### M6. Clé anon Supabase et URL du projet commitées
- Fichiers : scripts/migration-cron-rappels-taches-2026-09-01.sql:19, next.config.ts:11 (URL du projet en dur).
- Problème : non secret (rôle anon, RLS deny-all, vérifié par le rapport reports/2026-09-14-audit-supabase-best-practices.md), mais combiné à I2 elle ouvre les Edge Functions. Rien à rotater tant que la RLS reste activée partout.
- Correctif : après I2, la clé n'a plus de valeur d'accès ; vérifier périodiquement `get_advisors(security)` pour toute nouvelle table sans RLS (les migrations suppression-auth ont désactivé la RLS sur 5 tables ; confirmer qu'elle a été réactivée par migration-enable-rls-deny-all-2026-09-11.sql, qui date d'avant la suppression de l'auth du 29/08 ? non : 11/09 vient après, OK).
- Correctif sûr sans changement de comportement : oui (simple vérification).

### M7. Dépendances et configuration
- `npm audit` non exécuté (lecture seule, pas de réseau garanti) ; à lancer : `npm audit --audit-level=high`.
- next.config.ts:42-52 : bodySizeLimit 4mb pour toutes les Server Actions, acceptable ; pas de `allowedOrigins` (Next compare Origin et Host par défaut, protection CSRF des Server Actions active).
- vercel.json : uniquement la région; pas de cron Vercel, pas de headers.
- Correctif sûr sans changement de comportement : oui.

## Points vérifiés sans anomalie
- Injection PostgREST : src/lib/supabase/like.ts (échappement LIKE + guillemets) utilisé dans recherche.ts:42,67 ; src/app/api/agenda/feed.ics/route.ts:35 n'interpole que des dates calculées côté serveur.
- Flux ICS : jeton secret comparé en temps constant (lib/agenda/ics.ts:60), 404 si absent, no-store. Réserve : jeton en query string (apparaît dans les logs d'accès/historique des clients d'agenda), inévitable pour les clients d'abonnement.
- UUID validés (estUuid) dans les routes /api/taches/[id]/*.
- Clé Gemini en en-tête (appel.ts:88-91), jamais dans une URL ni un message.
- Aucun usage de innerHTML/eval; ICS échappé (echapperTexte).
- Uploads d'images ré-encodés avec sharp (supprime les charges actives); URLs signées d'upload avec chemins UUID générés côté serveur (documents-vrac.ts:352-360).

---

# Audit accessibilité + UI/UX (lecture seule) - Kilio

Périmètre : `src/components`, `src/app/(app)/**`, `globals.css`, `lib/ui.ts`. Méthode : lecture de PRODUCT.md et DESIGN.md, puis grilles web-design-guidelines, ecc:accessibility (WCAG 2.2), make-interfaces-feel-better et impeccable (critique). Inspection statique par greps et scripts, plus lecture ciblée. Aucun rendu navigateur : les contrastes sont jugés d'après les tokens documentés, sans mesure.
Les numéros de ligne viennent de la version lue. Les fichiers marqués "(heuristique)" sont à confirmer.
Dépôt non modifié. Seul ce fichier a été écrit.

## Bilan global

Base saine, avec un travail a11y déjà abouti.
- `Modal` : portal, focus piégé, Échap, retour du focus, `aria-labelledby`, bouton Fermer de 44 px (`Modal.tsx:36-66`, `useDialogFocus`).
- `Switch` et `CheckToggle` : zones de tap de 44 px, `aria-checked` / `aria-pressed` (`Switch.tsx:17-26`, `CheckToggle.tsx:40-47`).
- `ToastHost` : `role="status"` avec `aria-live="polite"` (`ToastHost.tsx:24-25`).
- Mouvement : `prefers-reduced-motion` global (`globals.css:584`).
- Mobile : `lang="fr"`, zoom non bloqué, champs à 16 px en pointeur grossier (`globals.css:650`).
- `BottomNav` : `aria-current` et `aria-label` (`BottomNav.tsx:97,171`).
- Graphique musculation : `role="img"` et alternative tableau (`GraphiqueProgression.tsx:69,170`).
- Aucun `transition-all`, aucun `onClick` sur div/span, aucun `outline-none` sans anneau de remplacement (sauf cas listés plus bas).
Aucun constat critique bloquant. Les constats ci-dessous sont surtout des champs sans libellé et quelques états non annoncés.

## CRITIQUE

Aucun constat critique.

## IMPORTANT

### I1. Champs de saisie sans nom accessible (placeholder seul)
Le placeholder n'est pas un libellé fiable (WCAG 1.3.1, 3.3.2, 4.1.2). Le lecteur d'écran perd le nom dès que le champ est rempli. Les champs de `HuileEditeur` sont, eux, entourés par `<Champ libelle>`, ce qui est un faux positif probable à confirmer (heuristique).

Champs confirmés sans `aria-label` ni `<label>` :
- `nutrition/recettes/[id]/EtapesManager.tsx:34,41,48` : titre, consigne et astuce de l'étape (édition). Idem pour la création `:153-155`.
- `nutrition/recettes/[id]/IngredientsLibresManager.tsx:43,49,147,148`.
- `nutrition/recettes/[id]/IngredientManager.tsx:47` : champ quantité sans nom, avec unité en `<span>` voisin. Même chose en `:183`.
- `nutrition/recettes/RecettesList.tsx:72` : `type="search"` avec placeholder seul.
- `habitudes/HistoriqueView.tsx:65` : `<select>` sans nom accessible.
- `notes/NoteForm.tsx:105` : libellé d'item de checklist en édition (`defaultValue`) sans nom.
- `GlobalSearchBar.tsx:145` : `role="combobox"` sans `aria-label` (nom de repli = placeholder).
À vérifier même motif (heuristique) : `documents/DocumentsBrowser.tsx:~295` (champ de recherche, le `<select>` voisin est libellé), `AddCourseForm.tsx:244,269`, `taches/TachesView.tsx:299`, `taches/AddTaskForm.tsx:252`, `collection/AddCollectionToggle.tsx:42`, `collection/[id]/CollectionHeader.tsx:66`, `collection/[id]/TitrageModal.tsx:260,269`, `notes/NotesGrid.tsx:100`, `pharmacie/huiles-essentielles/HuilesAccueil.tsx:62`, `pharmacie/referentiel/ReferentielAccueil.tsx:46`, `objectifs/[id]/ObjectifSuiviEtapes.tsx:169`.

Correctif proposé : ajouter `aria-label` repris du placeholder (ou de la ligne de contexte). Pour la quantité d'ingrédient, utiliser `aria-label={\`Quantité de ${ingredient.aliment.nom}\`}`.
Correctif sûr : oui (attribut seul, aucun effet visuel ni logique). Revérifier les cas "à vérifier" avant d'ajouter, pour ne pas doubler un `<label>` existant.

### I2. Bascule d'habitude sans état annoncé
`DashboardHabitItem.tsx:80-86` : `<button>` dont le nom est le nom de l'habitude, sans `aria-pressed` alors qu'il bascule fait / pas fait. L'état n'est visible que par l'anneau de progression. L'état "fait" n'est donc annoncé nulle part. Pour une habitude `quantifiee`, le bouton est `disabled` sans explication (`:82`).
Correctif : `aria-pressed={fait}` pour les types non quantifiés. Pour les quantifiés, ajouter un `sr-only` du type "3 sur 5" et expliquer que ce n'est pas cochable ici. Une habitude "quantifiée" est décochable depuis la fiche, à confirmer.
Correctif sûr : oui pour `aria-pressed` ; non pour le texte de remplacement des quantifiées (décision produit sur le wording).

### I3. Fermeture d'une feuille par clic sur le fond (perte de saisie)
`Modal.tsx:40` : `onClick={onClose}` sur le fond. Un tap hors de la feuille ferme sans confirmation. Les formulaires longs rendus dans `Modal` perdent la saisie : `HuileEditeur`, `RecetteForm`, `NoteForm`, `TitrageModal`, `ReorganiserModal`. Risque de perte accidentelle (WCAG 3.3.4) sur un usage à une main.
Correctif : prop `fermerSurFond?: boolean` (défaut `true`). La passer à `false` sur les éditeurs à saisie longue, ou demander confirmation si le formulaire est modifié.
Correctif sûr : non. Cela change un comportement de produit (à valider avec Vincent) ; l'ajout de la prop sans changer le défaut est sûr.

### I4. Texte sous le plancher 11 px dans l'Agenda (exception DESIGN.md)
`agenda/TimeGrid.tsx:119` (commentaire sur `text-[9px]/[10px]`), `agenda/TacheBlock.tsx:77` (`text-[10px]`), `agenda/WeekView.tsx:212,218` (`text-[10px]`), `aujourdhui/EvenementBlock.tsx:32` (`text-[10px]`).
Documenté comme exception ("grilles denses de l'Agenda, 9-10 px, texte ink-2"), mais `aujourdhui/EvenementBlock` n'est pas une grille dense : l'exception ne le couvre pas. Lisibilité faible sur mobile, sans équivalent au zoom du texte (WCAG 1.4.4 / 1.4.12).
Correctif : passer `EvenementBlock` à `text-micro` (11 px) ; garder 9-10 px uniquement dans `TimeGrid` si la densité l'exige.
Correctif sûr : oui pour `EvenementBlock` (vérifier la hauteur minimale du bloc) ; non pour l'Agenda (arbitrage densité contre lisibilité).

### I5. Renommage inline qui valide au `blur`
`courses/CourseItemRow.tsx:236-246` : l'`<input>` de renommage porte bien un `aria-label`, mais la validation se fait sur `onBlur` (`commitRename`). Un tap ailleurs (ou la disparition du clavier virtuel) enregistre un texte partiel sans retour. Pas de zone de tap visible pour valider ni annuler au tactile.
Correctif : à étudier avec Vincent, garder le blur mais ajouter un bouton valider / annuler de 44 px, ou conserver le comportement et le documenter.
Correctif sûr : non (comportement).

## MINEUR

### M1. Pas de lien d'évitement (skip link)
`src/app/layout.tsx` et `src/app/(app)/layout.tsx` : aucun "Aller au contenu" (WCAG 2.4.1). Intérêt limité pour une PWA mobile mono-utilisateur, mais utile au clavier externe.
Correctif : lien `sr-only focus:not-sr-only` vers `<main id="contenu">`.
Correctif sûr : oui.

### M2. Icônes décoratives non masquées dans `icons.tsx`
`components/icons.tsx` : 1 seul `<svg` repéré pour 2 occurrences d'`aria-hidden`. Plusieurs icônes passent par des composants qui masquent déjà l'icône ; à confirmer icône par icône (heuristique). Les `<svg>` en ligne dans les boutons (ex. `Modal.tsx:70`, `AjoutRepasPanneau.tsx:97`) portent déjà `aria-hidden`.
Correctif : vérifier que le composant d'icône pose `aria-hidden="true"` par défaut.
Correctif sûr : oui.

### M3. Annonce des erreurs de formulaire
Le toast d'erreur est annoncé via `role="alert"` (`ToastHost.tsx:~72`). Les erreurs de champ doivent utiliser `role="alert"` sous le champ, comme prévu dans DESIGN.md ; non vérifié formulaire par formulaire. `aria-invalid` et `aria-describedby` ne sont pas systématiques (grep non exhaustif).
Correctif : ajouter `aria-invalid` et `aria-describedby` sur les champs en erreur.
Correctif sûr : oui, mais à faire formulaire par formulaire.

### M4. Placeholders en `--ink-3`
`globals.css:297-300` : placeholders à `--ink-3` (`oklch(0.52 …)`), documenté ≥ 4,5:1 sur `surface-alt`. Conforme d'après DESIGN.md (non mesuré ici). Rien à faire sauf mesure au rendu.
Correctif sûr : sans objet.

### M5. Cibles tactiles des vignettes de `PhotosGrid` et `CopierLienVideoButton`
`collection/[id]/PhotosGrid.tsx:183`, `CopierLienVideoButton.tsx:47` : pastilles visuelles de 28 px (`h-7 w-7`) dans un `<button>` parent. La cible effective dépend du bouton englobant : non vérifiable statiquement. Le 24 px minimum WCAG 2.2 (2.5.8) est respecté dans tous les cas.
Correctif : confirmer que le bouton englobant fait 44 px ; sinon ajouter `zoneTap44`.
Correctif sûr : oui.

### M6. `ToastHost` : libellé du bouton d'action surchargé
`ToastHost.tsx:47-53` : `aria-label={toast.action.ariaLabel ?? toast.action.label}` n'ajoute pas le contexte du message (ex. "Annuler" sans dire quoi). L'action reste annoncée juste après le texte du toast, ce qui limite l'impact.
Correctif : `ariaLabel` explicite dans les appels ("Annuler la suppression de …").
Correctif sûr : oui.

### M7. Cohérence DESIGN.md
- Bouton de la grille du `GraphiqueProgression` (`:133`) : `onPointerDown` sur un `<rect>` sans équivalent clavier évident ; des cercles focalisables existent juste après (`:136+`), donc couvert.
- `VideoFeed.tsx:169`, `ApercuPage.tsx:234` : `<img>` natifs avec `alt=""` (miniature décorative) et `alt` descriptif : conformes.
- `focus:border-kcal/60` + `focusRing` sur `input` (`lib/ui.ts:29`) : conforme à la règle "focus-visible".
- Écrans plein écran (Viseur, EditeurCoins, ApercuPage, VideoFeed, ImageLightbox) : `role="dialog"` + `aria-modal` ; vérifier qu'ils utilisent bien `useDialogFocus` (non lu en détail pour Viseur et EditeurCoins).
Correctif sûr : non applicable (vérifications).

## Fit-and-finish (make-interfaces-feel-better)

Rien à corriger de façon générique : `tabular-nums` présent dans 55 fichiers, `text-wrap: balance/pretty` global, pas de `transition-all`, zones de tap étendues (`zoneTap44`), un seul jeu d'ombres. Deux points à observer au rendu : alignement optique des icônes "+" dans `AjoutRepasPanneau.tsx:97` et rayons concentriques de `ToastHost` (pilule `rounded-full` avec bouton interne `rounded-full` + `pr-1`, déjà cohérent).

## Critique UX (impeccable, mode critique uniquement)

- Cohérence forte avec DESIGN.md : un accent, deux polices, rayons croissants, `SegmentedControl` unique.
- Risque principal pour l'usage "une main en cuisine" : perte de saisie par tap sur le fond de `Modal` (I3) et validation au blur (I5).
- États : 17 `loading.tsx` et des squelettes dédiés ; états vides présents dans ~107 fichiers (grep "Aucun/Aucune"), non évalués un par un.
- Le suivi de l'état des habitudes (I2) est le seul écart d'information entre vue et lecteur d'écran sur l'écran le plus ouvert (Accueil).

## Priorisation suggérée

1. I1 (libellés des champs) : correctif sûr, un seul lot.
2. I2 `aria-pressed` et M1 skip link : sûrs.
3. I4 `EvenementBlock` en `text-micro` : sûr après contrôle de hauteur.
4. I3 et I5 : décisions produit à valider avant de toucher au code.

---

# Audit performance Kilio (lecture seule) - Next 16.3.3 / React 19.2

Portée : lecture du code (docs Next 16 consultées : cache components, partial prefetching, images) et du skill vercel-react-best-practices. Aucun build ni mesure exécuté : les impacts sont estimés, à confirmer avec `npm run analyze`.

Constat général : base déjà très soignée (Cache Components + partialPrefetching, prefetch TanStack hydraté, `fetchAllRows` paginé, `use cache` avec tags, OpenCV/pdf-lib/pdfjs en import dynamique, formulaires en `dynamic`, devtools exclus du bundle prod, Promise.all systématique sur les pages). Peu de vrais problèmes.

## Critique
Aucun constat critique.

## Important

### I1. Mosaïque Collections : charge TOUTES les photos de TOUTES les collections pour en garder 4
- Fichier : src/app/actions/collections.ts:135-151 (`getCollectionsAvecApercu`)
- Impact : la requête embarque `collection_items(url, thumbnail_url, type, ordre)` pour chaque collection, puis `.slice(0, 4)` en JS et `.length` pour `nb_photos`. Volume de lignes et payload croissants avec la galerie (plafond PostgREST de 1000 lignes : au-delà, `nb_photos` et les aperçus deviennent silencieusement faux). Aucun `fetchAllRows` ici contrairement aux autres lectures.
- Correctif : RPC/vue SQL (4 premières lignes par `row_number() over (partition by collection_id order by ordre)` + `count(*)` groupé), ou deux requêtes : `collection_items` filtré `ordre < 4` et un comptage groupé.
- Correctif sûr sans changement de comportement : non (nécessite une migration SQL ou deux requêtes ; attention à l'égalité sur `ordre` si les ordres ne sont pas contigus, préférer row_number).

### I2. Le service worker précache ~6,6 Mo d'animations à l'installation (+ OpenCV 10 Mo à la demande)
- Fichier : public/sw.js:8-90 (install, `cache.addAll(FICHIERS_ANIMATIONS)`), 65 exercices x (.webm + .webp)
- Impact : à la première visite / à chaque nouvelle version du SW (CACHE_ANIMATIONS est versionné séparément, donc pas de re-téléchargement à chaque déploiement : bon point) ~6,6 Mo en concurrence avec le chargement initial, y compris sur données mobiles, même si l'utilisateur n'ouvre jamais Musculation. `skipWaiting()` + `addAll` dans le même `waitUntil` retarde l'activation du SW.
- Correctif : ne pas inclure les animations dans `install.waitUntil` ; les précacher à la demande (message `postMessage` depuis la page Musculation ou `requestIdleCallback`), ou limiter à celles des routines de l'utilisateur. Le cache-à-la-lecture existe déjà dans `repondreAnimation`.
- Correctif sûr sans changement de comportement : non (change le moment où le hors-ligne devient disponible pour Musculation).

### I3. Service worker : toute navigation / payload RSC passe par `fetch` réseau sans bénéfice cache, et `/` est le seul repli hors-ligne
- Fichier : public/sw.js:~194-216 (`!isStaticAsset` -> `fetch(request).catch(() => caches.match...)`)
- Impact : le SW intercepte chaque requête same-origin (RSC, prefetch partiel, API) et ajoute un hop SW (quelques ms par requête, démarrage du SW à froid sur mobile) alors qu'il ne met jamais ces réponses en cache : le fallback `caches.match(request)` ne trouvera jamais rien sauf pour `/`. Les prefetch de `<Link>` (très nombreux avec partialPrefetching) payent ce coût.
- Correctif : ne pas appeler `respondWith` pour les requêtes non statiques sauf `request.mode === "navigate"` (le fallback hors-ligne ne sert que là) ; laisser le navigateur gérer le reste. Optionnel : `navigationPreload`.
- Correctif sûr sans changement de comportement : oui pour les requêtes non-navigate (le `catch` renvoie de toute façon `/` HTML pour un fetch RSC, ce qui est plutôt un bug latent) ; vérifier avec e2e hors-ligne.

### I4. framer-motion complet chargé dans le bundle de l'app entière (pas de LazyMotion)
- Fichiers : src/app/providers.tsx:6 (`MotionConfig`), src/components/BottomNav.tsx:6, Modal.tsx, ToastHost.tsx, SegmentedControl.tsx, ModulesGrid.tsx ... (51 fichiers importent `motion`/`AnimatePresence`)
- Impact : `motion` embarque toutes les fonctionnalités (~30+ Ko gz) dans le chunk du layout (BottomNav, ToastHost, Modal sont dans le layout `(app)`), donc dans le JS critique de chaque page, ce qui pèse sur TTI/TBT mobile.
- Correctif : `LazyMotion features={domAnimation} strict` dans Providers + remplacer `motion.*` par `m.*` (import `framer-motion/m`) ; `domMax` seulement là où `layout`/drag sont utilisés (SegmentedControl, ModulesGrid, listes avec `layout`). À valider avec `npm run analyze`.
- Correctif sûr sans changement de comportement : non strictement (refactor large et `layout`/drag exigent domMax ; risque de régression visuelle, tests e2e requis).

## Mineur

### M1. `select("*")` superflus sur des tables lues souvent
- Fichiers : src/app/actions/taches.ts:845 (`"*"` + jointures, ~tâches entières incl. descriptions, paginé), src/lib/courses/cache.ts:23, src/app/actions/habitudes.ts:183,204,273, src/app/actions/courses.ts:14, src/app/(app)/nutrition/recettes/[id]/page.tsx:23-35 (`aliments` toute la table), src/app/(app)/nutrition/journal/JournalJour.tsx:37, MenusSemaine.tsx:44, bilan/BilanContenu.tsx:45 (`objectifs_nutritionnels` x4 pages), src/lib/navigation/preferences.ts:66.
- Impact : faible (tables petites, mono-utilisateur, plusieurs sont en `use cache`), mais payload RSC/hydratation gonflé pour tâches et aliments.
- Correctif : lister les colonnes réellement utilisées (typage `Tables<>` à ajuster). Sûr : oui si les colonnes sont recensées par typecheck (`npm run typecheck`), sinon risque d'oubli.

### M2. Boucles d'UPDATE séquentielles (N+1 en écriture)
- Fichiers : src/app/actions/collection-titrage.ts:131-146, src/app/actions/documents-vrac.ts:304-325, src/app/actions/collection-reorganisation.ts:404-416 (annulation), src/app/actions/documents-reorganisation.ts:170-190 (par catégorie, acceptable).
- Impact : N allers-retours Supabase en série (~30-80 ms chacun depuis cdg1) pour titrage/tri en vrac de dizaines d'éléments : plusieurs secondes sur action rare. Pas sur chemin de rendu.
- Correctif : `Promise.all` par lots de 5-10 (ou `upsert` en masse avec les colonnes concernées / RPC). Sûr : oui avec `Promise.all` borné, à condition de préserver `raison ??=` et le comptage (ordre d'erreurs non déterministe sinon) ; non pour `upsert` (sémantique des filtres `.eq("en_vrac", true)`).

### M3. `<img>` natif sur vignettes externes et animations locales
- Fichiers : src/components/VideoFeed.tsx:169 (miniatures YouTube/TikTok hors remotePatterns, `loading` absent), src/app/(app)/journal/CalendrierView.tsx:122 (déjà `loading="lazy"`, bucket privé signé : justifié), src/app/(app)/musculation/AnimationExercice.tsx:53,64,97 (webp locales : justifié).
- Impact : VideoFeed rend un `<img>` par vidéo de la collection (toutes montées, `snap` plein écran) sans `loading="lazy"`/`decoding="async"` : tout se télécharge à l'ouverture.
- Correctif : ajouter `loading="lazy" decoding="async"` sur VideoFeed:169. Sûr : oui. (Ne pas migrer vers next/image : domaines externes variables.)

### M4. `<video preload="auto" autoPlay>` pour chaque exercice d'une séance
- Fichier : src/app/(app)/musculation/AnimationExercice.tsx:14-28 (utilisé par ExerciceBloc.tsx)
- Impact : une séance de 6-8 exercices charge/décode 6-8 WebM en parallèle (140-175 Ko chacun, depuis le cache SW ensuite) et fait tourner autant de décodeurs vidéo en boucle sur mobile (batterie, CPU).
- Correctif : `preload="metadata"` + démarrage via IntersectionObserver (play seulement quand visible) ; le `poster` sert de repli. Sûr : oui visuellement, mais test sur iOS recommandé.

### M5. Page client entière sans données serveur : pharmacie
- Fichier : src/app/(app)/pharmacie/[matiereId]/[chapitreId]/page.tsx:1 (`"use client"` sur un `page.tsx`, snapshot Dexie/offline). 261 fichiers `use client` sur 572 : cohérent avec l'architecture offline-first (snapshot Dexie), donc pas de réduction facile.
- Impact : faible ; pas de rendu serveur du contenu, mais volontaire (lecture hors-ligne).
- Correctif : aucun requis. Si besoin, extraire le titre/coquille en Server Component. Sûr : n/a.

### M6. TanStack Query : réglages cohérents, deux points à surveiller
- src/app/providers.tsx:30-38 : `staleTime 30s`, `refetchOnWindowFocus:false`, `retry:1` : correct. src/app/providers.tsx:49-52 : `invalidateQueries()` global après chaque rejeu offline refetch toutes les queries actives (acceptable car ciblé sur la reconnexion).
- src/app/(app)/agenda/AgendaView.tsx:105,110, aujourdhui/AujourdhuiView.tsx:65,70, journal/CalendrierView.tsx:41 : `staleTime: 0` (+ `refetchOnMount:"always"`) : refetch Server Action à chaque montage même juste après l'hydratation du prefetch serveur (hydratation marque les données `dataUpdatedAt` serveur ; avec staleTime 0 un refetch immédiat double l'appel réseau). Commenté comme voulu (écritures hors app), mais coût : 1 aller-retour Server Action supplémentaire par ouverture.
- Correctif : `staleTime: 5_000` sur ces queries (ou `initialDataUpdatedAt`) pour éviter le double fetch immédiat tout en gardant la fraîcheur. Sûr : non (change la fraîcheur perçue ; à valider avec le skill planning-travail).

### M7. AppResumeRefresh : `router.refresh()` à chaque retour au premier plan > 30 s
- Fichier : src/components/AppResumeRefresh.tsx:36-47
- Impact : rejoue tous les rendus serveur de la page (déjà atténué par seuil 30 s). Acceptable ; envisager un seuil plus haut (2-5 min) ou le limiter aux pages sensibles. Sûr : non (choix produit, fraîcheur après écriture externe).

### M8. Divers déjà corrects (pas d'action)
- Fonts : next/font/google avec `weight` + `subsets` restreints (src/app/layout.tsx:6-16) : OK.
- Images Supabase via next/image avec `sizes` (PhotosGrid:166, CollectionMosaic) et `unoptimized` limité aux miniatures vidéo externes : OK. Vérifier qu'aucune `<Image fill>` LCP n'a besoin de `priority` (aucun `priority` dans le dépôt : les images sont derrière des Suspense/clients, probablement pas LCP).
- SpeedInsights dans le layout racine : composant léger chargé après hydratation (OK).
- `setInterval` : tous nettoyés (TimeGrid:271, useHeureCourante:18, SeanceView:46, useMinuteurRepos:79, VerrouGate:99, FeuilleView:218) - non vérifié ligne à ligne pour les cleanups, à contrôler si fuite suspectée.
- Dexie : un seul `OfflineDB` (src/lib/offline/db.ts), snapshots clé/valeur ; pas de problème repéré dans la lecture partielle (non audité en profondeur : requêtes `toArray()` sur `scannerPages` contiennent des Blobs, à ne pas charger tous en mémoire).
- vercel.json : région cdg1 alignée Supabase (à confirmer côté projet Supabase).

## Ordre de traitement suggéré
1. I3 (SW non-navigate), M3 (lazy img) : gains rapides, sûrs.
2. I1 (aperçu collections) : correctif de fond, scaling + exactitude.
3. I2 (précache animations différé) puis I4 (LazyMotion) après mesure `npm run analyze`.
4. M1, M2, M4 en opportuniste.

---

# Audit qualité du code - Kilio (lecture seule)

Méthode : `npx knip` (knip.json), grep ciblés (catch vides, any, dates), relecture de src/app/actions et src/lib. Les commandes `typecheck`, `lint` et `vitest` n'ont PAS été lancées : cet audit ne les couvre pas.

## Knip
Un seul résultat : devDependency inutilisée `@vitest/coverage-v8` (package.json:51). Aucun fichier, export ni type mort. `src/lib/supabase/types.ts` et `public/sw.js` sont ignorés dans knip.json, donc exclus de l'analyse.

## Critique

1. **Aucune authentification sur les server actions** (src/app/actions/*.ts, src/lib/supabase/admin.ts:4-9)
   - Problème : toutes les actions utilisent `createAdminClient()` (clé service_role, RLS contournée). Il n'existe ni `middleware.ts` ni `proxy.ts`. Seul `verrou.ts` (journal) vérifie une session. Toute personne qui connaît l'URL peut appeler les actions (lecture, écriture, suppression) et les routes `/api/*` (rappel-repos, taches/[id]/...). `notifications.ts:15-33` accepte un endpoint arbitraire.
   - Correctif proposé : ajouter un proxy Next (cookie de session signé ou protection Vercel/Basic Auth) et vérifier la session dans les actions, ou au minimum dans les routes `/api` et les actions destructrices. À confirmer d'abord : une protection en amont (Vercel Protection, Access) peut déjà exister, ce qui ferait baisser la gravité. Le dépôt ne le montre pas.
   - Correctif sûr : non (change le comportement d'accès, nécessite une décision de conception).

## Important

2. **Limiteur de débit en mémoire module** (src/app/actions/saisie.ts:25-33)
   - Problème : `appelsRecents` est un état mutable par instance. Sur Vercel serverless, chaque instance a son propre compteur, donc le plafond ne protège pas le quota Gemini (le commentaire dit « best effort »). Il est contournable en pratique.
   - Correctif : compteur en base (table + upsert) ou Upstash/KV.
   - Correctif sûr : non.

3. **Non-null assertions sur les variables d'environnement** (src/lib/supabase/admin.ts:6-7)
   - Problème : `process.env.X!` sans validation. En cas de variable absente, l'erreur apparaît tard et de façon opaque (client créé avec `undefined`).
   - Correctif : valider une fois (throw explicite avec le nom de la variable) dans `createAdminClient`.
   - Correctif sûr : oui.

4. **Casts `as unknown as` sur les résultats Supabase** (src/lib/musculation/serveur.ts:615,635,659,718 ; src/app/actions/documents-vrac.ts:123 ; documents-recherche.ts:56)
   - Problème : les jointures sont typées à la main, donc les types peuvent diverger du schéma sans erreur de compilation. `types.ts` est exclu de knip et a été régénéré le 2 nov. 2026, mais le dépôt ne contient pas de dossier migrations pour vérifier la cohérence.
   - Correctif : utiliser les types déduits de `.select()` avec `QueryData`, ou valider avec un schéma (zod) aux frontières. Ajouter un script CI qui régénère `types.ts` et échoue s'il y a un diff.
   - Correctif sûr : non (refactor typé à valider).

5. **Fallback `[]` trompeur sur erreur de lecture** (src/app/actions/saisie.ts:55 pour `tags`)
   - Problème : l'erreur de lecture des tags est transformée en liste vide sans trace. Le modèle peut alors ignorer des tags existants sans que l'utilisateur le sache. L'intention est documentée dans le code. Les autres cas de ce type (retours `null`/`false`/`0` dans lib/collection/*, lib/pharmacie/cache.ts, lib/vidage/local.ts, lib/musculation/brouillon.ts) sont à loguer au minimum.
   - Correctif : `console.warn` structuré, ou information remontée à l'appelant.
   - Correctif sûr : oui (ajout de log uniquement).

6. **Trous de couverture de tests sur de la logique critique**
   - Server actions sans test : `menus.ts` (230 l.), `musculation.ts` (185), `huiles.ts` (104), `recette-etapes.ts`, `recette-ingredients*.ts`, `objectifs-nutritionnels.ts`, `briefing.ts`, `saisie.ts` (validation et normalisation de la sortie Gemini), `rappel-repos.ts` (bornes de dates, 18-24), `nettoyage.ts`, `notifications.ts`, `jours-feries.ts`, `planning-travail.ts`, `seances.ts`, `entrainement.ts`, `preferences-navigation.ts`.
   - lib sans test : `lib/offline/db.ts` (115 l.) et `useOnlineSync.ts` (file de rejeu), `lib/actions/runAction.ts` (gestion d'erreurs centrale, 63 l.), `lib/actions/suppressionDifferee.ts`, `lib/documents/indexation.ts` (142), `lib/documents/decrire.ts`, `lib/scanner/traitement.ts` (203) et `scenes.ts` (296), `lib/musculation/brouillon.ts` et `demarrer.ts`, `lib/navigation/registry.ts`, `lib/nutrition/saisie-repas.ts`.
   - Correctif : écrire d'abord les tests de `runAction`, de la file hors ligne, de `rappel-repos`, de `saisie` et de `menus`. Le paquet `@vitest/coverage-v8` est installé mais jamais configuré (aucune section coverage dans vitest.config.ts) : soit le configurer, soit le retirer.
   - Correctif sûr : oui (ajout de tests et de config coverage).

## Mineur

7. **Fuseau Europe/Paris : points à surveiller** (aucun bug avéré)
   - Les calculs `toISOString().slice(0,10)` sur des dates construites en UTC (src/lib/date/iso.ts:33, src/lib/evenements/compute.ts:101, src/lib/musculation/stats.ts:287, src/app/actions/habitudes.ts:197-199) sont corrects : l'entrée est un `YYYY-MM-DD` ancré en UTC.
   - `new Date().toISOString()` pour `updated_at` (actions/*) est un horodatage UTC attendu, donc correct.
   - Vérifier que `aujourdhuiParis()` (src/lib/date/paris.ts:26) est la seule source de « aujourd'hui » : les actions comme `getSemaineSeances(today)` (seances.ts:11) et `habitudes.ts` font confiance à la date fournie par le client (le fuseau du navigateur pourrait différer). Correctif : recalculer ou borner côté serveur.
   - Correctif sûr : non.

8. **Catch vides** (acceptables, mais à documenter ou loguer)
   - src/components/BackNavigationHandler.tsx:98,107 (sessionStorage) : `catch {}` sans commentaire.
   - src/lib/theme.ts:33 (`catch (e) {}`, script inline) et :49.
   - `.catch(() => {})` : src/hooks/useViewTransitionNavigate.ts:244, src/lib/offline/useOnlineSync.ts:66, src/lib/musculation/useWakeLock.ts:41, src/lib/push/subscribe.ts:52,64, src/app/(app)/journal/VerrouGate.tsx:94.
   - Cas plus sensible : src/app/collection/partage/choisir/EnvoiVersDocuments.tsx:135 et PhotosPartageesEnAttente.tsx:69,153 (`oublierFichiersEnAttente`). Un échec de nettoyage laisse des fichiers en attente sans signal.
   - Correctif : ajouter un commentaire expliquant le choix, ou un `console.warn` dans les cas de partage.
   - Correctif sûr : oui.

9. **`any` / suppressions de lint**
   - Un seul `any` : src/lib/offline/queue.ts:20-21 (`ActionFn = (...args: any[])`), justifié par la disposition eslint ; alternative `unknown[]` avec générique.
   - 17 `eslint-disable react-hooks/exhaustive-deps` (AgendaView.tsx:178,190 ; TimeGrid.tsx:112 ; WeekView.tsx:106 ; AddTaskForm.tsx:207,248 ; TitrageModal.tsx:133 ; RecettesList.tsx:63 ; DescriptionModal.tsx:67 ; TriVracModal.tsx:150 ; AssistantRevueModal.tsx:176 ; DestinationPartage.tsx:128 ; EnvoiVersDocuments.tsx:151). Chacun peut cacher un état périmé.
   - Correctif : revue au cas par cas, ajouter une justification après `--`.
   - Correctif sûr : non.

10. **Actions qui lèvent et actions qui renvoient `ActionResult`** (incohérence de contrat)
   - `notifications.ts`, `pharmacie.noterCarte`, `courses.ts` lèvent ; `nettoyage.ts`, `briefing.ts` renvoient `fail`. C'est volontaire pour la file hors ligne (commentaire dans pharmacie.ts:39-42, `runAction` normalise les deux), mais `getSemaineSeances` et `get*Reglages` lèvent à la lecture sans filet visible.
   - Correctif : documenter la règle dans lib/actions/result.ts.
   - Correctif sûr : oui.

11. **Écritures multiples non transactionnelles** (src/app/actions/courses.ts:131-150)
   - Problème : l'insertion puis les réactivations sont des appels séparés. En cas d'échec en cours de route, l'état est partiel (insérés mais non réactivés) alors que l'erreur est levée.
   - Correctif : fonction RPC Postgres transactionnelle. Faible risque pour un usage mono-utilisateur.
   - Correctif sûr : non.

12. **devDependency inutilisée** : retirer `@vitest/coverage-v8` (package.json:51) ou configurer la couverture. Correctif sûr : oui.

## Points vérifiés sans anomalie
- `JSON.parse` (src/lib/gemini/appel.ts:127, src/lib/vidage/jeton.ts:26) : à confirmer dans un try/catch (vidage/jeton.ts retourne `null` sur échec, ligne 30).
- Pas de `@ts-ignore` ni `@ts-expect-error` dans le code applicatif.
- Les actions testées vérifient `error` de Supabase systématiquement ; les seules sans gestion visible sont les wrappers en lecture seule (`seances.ts`, `documents-description.ts`) qui délèguent à des fonctions lib.

---

# Audit des parcours utilisateur (click-path) — Kilio — 2026-11-07

Lecture seule : aucun fichier du dépôt n'a été modifié. Méthode du skill `click-path-audit` : cartographie de l'état partagé (étape 1), puis trace de chaque point de contact (étape 2) en cherchant annulation séquentielle, course asynchrone, fermeture périmée, transition manquante, chemin mort, interférence d'effet.

Périmètre : aujourd'hui, agenda, tâches, habitudes, courses, notes, journal (feuille manuscrite), musculation (séance flottante), nutrition, pharmacie/révision, QuickAddFab, SaisieNaturelle, PullToRefresh, TabSwipeWrapper, file hors ligne Dexie.

Les audits précédents (`reports/2026-09-25-click-path-audit.md`, `reports/2026-09-26-click-path-audit-medium.md`) ont déjà traité 19 constats. Ce document ne les répète pas, sauf quand un constat reste ouvert (CLICK-PATH-401/402, repris en I-2).

Légende « correctif sûr » : oui = correctif local, sans décision produit, sans effet de bord attendu ; non = touche l'ordre de rejeu, un contrat serveur ou un choix de design.

---

## Étape 1 — Cartographie de l'état partagé

Kilio n'a pas de store Zustand. L'état partagé tient dans cinq mécanismes.

1. **Cache TanStack Query** (`src/lib/query/keys.ts`, `src/app/providers.tsx`), `staleTime` 30 s, pas de refetch au focus. Clés partagées entre écrans :
   - `taches` : /taches, /agenda, /aujourdhui, dashboard, QuickAddFab, ApercuSaisie, SelectionBar, PlanDuJour.
   - `courses` : CoursesList, AddCourseForm (aussi dans QuickAddFab), CourseItemRow, ArchivedCoursesSection, `undo.ts`, EnvoyerCoursesBouton.
   - `notes` : NotesGrid, NoteCard, NoteForm, QuickAddFab.
   - `habitudes(date)` : HabitudesView, HabitudeCard, DashboardHabitudesSection, DashboardHabitItem.
   - `resume-nutrition`, `evenements`, `seances`.
2. **File Dexie `pending_actions`** (`src/lib/offline/queue.ts`), rejouée par `useOnlineSync` : `taches`, `notes`, `courses`, `habitudes`, `pharmacie`. Après rejeu, `invalidateQueries()` global (`providers.tsx:58`).
3. **Autres tables Dexie à rejeu propre** : `musculation_brouillon` et `musculation_a_envoyer` (`lib/musculation/brouillon.ts`), `vidage_feuilles` (`lib/vidage/local.ts`), `cache_lecture` (pharmacie).
4. **Magasins module-niveau** : `lib/taches/masquees.ts` (tâches masquées pendant un toast « Annuler »), `toast-store.ts`, variables de `rappelRepos.ts`.
5. **Historique du navigateur** : `useBackClose` (pushState/back) et `goBackSteps`, utilisés par QuickAddFab, NoteCard, AddTaskToggle, Aujourd'hui, Agenda… ; `BackNavigationHandler` corrige les popstate. Avec `cacheComponents: true`, Next garde jusqu'à 3 routes cachées dans des `<Activity>`.

### Actions à effet de bord sur un état qu'elles ne possèdent pas (« resets dangereux »)

| Action | Effet de bord | Conséquence |
|---|---|---|
| `onSettled: invalidate` des mutations courses, notes, habitudes sans garde `enfile` | Refetch du cache pendant qu'une écriture est encore en file Dexie | Retour arrière visuel de l'état optimiste (I-2) |
| `invalidateQueries()` global dans `useOnlineSync` | Remplace tout le cache par le serveur | Correct si la file est vide ; masque les échecs d'un rejeu partiel |
| `useBackClose` (nettoyage de l'effet) | Appelle `history.back()` quand `active` est vrai | Peut défaire une navigation si le nettoyage survient parce qu'une route passe sous `Activity` (I-10) |
| `ecrireBrouillon` dans `demarrer*` | Écrase la clé unique « courant » | Perte de la séance en cours (I-6) |
| `enregistrerFeuille` (serveur) | Remplace la feuille entière | Écrase la version serveur par une feuille locale partie d'un état vide (C-1) |
| `flushQueue` : `break` sur échec non réseau | Bloque aussi les actions des autres modules | Sync retardée ≥ 10 min (I-1) |

---

## Résumé chiffré

| Sévérité | Nombre |
|---|---|
| Critique | 1 |
| Important | 14 |
| Mineur | 14 |

Les constats sont classés ci-dessous. « À confirmer » signifie que le défaut se lit dans le code mais que je n'ai pas pu l'exécuter (audit en lecture seule).

---

# CRITIQUE

## C-1 — Journal : une feuille locale partie d'un état vide peut écraser la feuille du serveur
- **Fichiers** : `src/app/(app)/journal/FeuilleView.tsx:102-116` (`chargerServeur`, délai 4 s), `:165-180` (chargement) ; `src/lib/vidage/local.ts:93-103` (`choisirFeuille`) et `:147-150` (`ecrireFeuilleLocale`, `a_envoyer: 1`) ; `src/app/actions/vidage.ts:116-121` (`upsert` qui remplace tous les traits).
- **Pattern** : Dead Path / transition manquante (l'état « serveur injoignable » est confondu avec « feuille vide »).
- **Scénario** :
  1. Aucune copie locale du jour : première ouverture sur cet appareil, stockage purgé, ou jour de plus de 7 jours (`purgerAnciennes`).
  2. Le serveur répond après plus de 4 s (réseau faible) ou est injoignable. `chargerServeur` renvoie `null`, `choisirFeuille` renvoie `source: "vide"`, le canvas s'ouvre vide sans avertissement.
  3. L'utilisatrice écrit un trait. `ecrireFeuilleLocale` marque `a_envoyer: 1` avec ce seul trait.
  4. `VidageSync` envoie la feuille entière. Le serveur remplace les traits : toute la feuille déjà écrite plus tôt ce soir-là est perdue, sans erreur.
- **Correctif proposé** :
  - Distinguer « vide confirmé » de « inconnu » : `source: "inconnu"` quand le serveur n'a pas répondu et qu'il n'y a pas de copie locale.
  - Dans ce cas, à la première écriture, relire le serveur avant d'envoyer. Ou envoyer avec une version attendue (`updated_at` lu) et refuser si elle a changé. Ou afficher une bannière « version du serveur non chargée » et bloquer l'envoi.
- **Correctif sûr : non** — change le contrat `enregistrerFeuille` (version attendue) et l'écran de chargement.
- Probabilité faible, perte entière et silencieuse.

---

# IMPORTANT

## I-1 — File hors ligne : une action qui échoue durablement bloque toutes les autres pendant au moins 10 minutes
- **Fichiers** : `src/lib/offline/queue.ts:143-162` (`break` après tout échec non réseau sous le seuil) ; `src/lib/offline/flush-policy.ts:103-106` (abandon seulement si au moins 3 échecs ET au moins 10 min, `DELAI_MIN_ABANDON_MS`).
- **Pattern** : Async Race / Sequential Undo (la file garde l'ordre global alors que les modules sont indépendants).
- **Scénario** :
  1. Hors ligne, l'utilisatrice coche une tâche (`setTacheFait` mis en file).
  2. La tâche est supprimée depuis un autre appareil.
  3. Au rejeu, `setTacheFait` lève une erreur : `.single()` ne trouve aucune ligne (`actions/taches.ts:~566`). C'est une erreur non réseau, donc `reessayer_plus_tard` puis `break`.
  4. Les coches de courses, notes et habitudes enregistrées après cette action restent bloquées jusqu'à ce que l'action poison ait 3 échecs et 10 minutes d'ancienneté.
  5. Pendant ce temps l'écran affiche l'état optimiste, qui disparaît au rechargement.
- **Correctif proposé** : sur échec non réseau sous le seuil, passer à l'action suivante (`continue`) au lieu de `break`, en gardant l'ordre seulement pour les actions du même module et de la même cible (premier argument). Compter la tentative sans stopper le reste.
- **Correctif sûr : non** — modifie la sémantique d'ordre de rejeu (par exemple `deleteCourseItem` après `toggleCourseItem` du même article). À tester avec `queue.test.ts`.

## I-2 — Invalidation sans garde « en file » : l'état optimiste saute en arrière au retour réseau (courses, notes, habitudes)
- **Fichiers** :
  - Courses : `CourseItemRow.tsx:131` (`deleteMutation.onSettled: invalidate`) et `:181` (`updateMutation`), `ArchivedCoursesSection.tsx:67`, `AddCourseForm.tsx:150-154` (la mutation renvoie `null` quand elle est mise en file, puis invalide).
  - Notes : `NoteCard.tsx:99, 145, 171` (`itemMutation`, `deleteMutation` mises en file mais invalidées quand même).
  - Habitudes : `DashboardHabitItem.tsx:69-72` (invalide toujours) ; `HabitudeCard.tsx:99, 140, 157` (valeur et suppression : `invalidate()` même après mise en file).
  - Le motif correct existe déjà : `CourseItemRow.tsx:80-82`, `TasksList.tsx:409-411`, `HabitudeCard.tsx:87-89` (`if (!resultat?.enfile) invalidate()`).
- **Pattern** : Async Race / interférence d'effet entre le refetch de reconnexion et `flushQueue`.
- **Scénario** :
  1. Hors ligne, ajout de « lait » (courses). L'article `temp-…` s'affiche, `onSettled` invalide : le refetch est mis en pause par TanStack.
  2. Retour réseau : le refetch en pause part en même temps que `flushQueue`. Il lit le serveur avant le rejeu et efface l'article `temp-` (ou ré-affiche une note supprimée, ou décoche un item).
  3. L'élément réapparaît seulement après `onSynced` (`providers.tsx:58`).
  4. Sur réseau captif (navigateur « en ligne », écriture refusée), le refetch réussit tout de suite : l'article supprimé hors ligne revient à l'écran, alors que la suppression est en file.
  5. Plusieurs parcours se contredisent selon le module : tâches, habitudes (carte) et coche courses sont protégés, pas les autres.
  6. CLICK-PATH-401/402 (invalidation courses non coordonnée) reste ouvert : un toggle déclenché pendant un « Ajouter » en vol invalide sans condition et efface l'article `temp-`.
- **Correctif proposé** : renvoyer `{ enfile: boolean }` de chaque `mutationFn` de ces modules et n'invalider que si `!enfile`. Pour courses, étendre la garde `isMutating({ mutationKey: ["courses"] })` d'`AddCourseForm` à toutes les mutations (`mutationKey` partagé).
- **Correctif sûr : oui** pour notes, habitudes et suppression/renommage courses (patron déjà en place ailleurs). **Non** pour la coordination globale courses (décision déjà demandée en 401).

## I-3 — SaisieNaturelle : « Annuler » après un ajout partiel garde la phrase et provoque des doublons
- **Fichiers** : `src/app/(app)/ApercuSaisie.tsx:353-384` (`valider`), `:402` (`onTermine(false)`) ; `src/app/(app)/SaisieNaturelle.tsx:76-82`.
- **Pattern** : Missing State Transition.
- **Scénario** :
  1. L'utilisatrice écrit « dentiste jeudi 14h, appeler Marie, acheter du pain » : 3 éléments dans l'aperçu.
  2. « Valider » : 2 sont créés, le 3e échoue. `restants` n'a plus que le 3e, mais `onTermine` n'est pas appelé.
  3. Elle appuie sur « Annuler » : `onTermine(false)` laisse `texte` intact (`if (ajoute) setTexte("")`).
  4. Elle revalide la même phrase : les 2 éléments déjà créés sont recréés.
- **Correctif proposé** : mémoriser dans `ApercuSaisie` si au moins un élément a été créé (`useRef` ou état) et appeler `onTermine(true)` sur « Annuler » et à la fermeture dans ce cas.
- **Correctif sûr : oui**.

## I-4 — SaisieNaturelle : une tâche créée peut être relancée en doublon quand une sous-tâche lève une exception
- **Fichier** : `src/app/(app)/ApercuSaisie.tsx:336-350`.
- **Pattern** : Missing State Transition (l'unité d'échec est trop large).
- **Scénario** : `createTache` réussit, puis `createSousTache` lève (réseau). Le `catch` global renvoie `{ erreur: MESSAGE_ECHEC }` : la tâche, pourtant créée, reste dans l'aperçu avec « L'ajout a échoué ». En réessayant, elle est recréée.
- **Correctif proposé** : envelopper chaque `createSousTache` dans son propre `try/catch` (compté dans `sousTachesEnEchec`) et ne jamais renvoyer d'erreur une fois `r.id` obtenu.
- **Correctif sûr : oui**.

## I-5 — SaisieNaturelle : fermer l'aperçu pendant « Ajout… » n'arrête pas la boucle et peut fermer un autre aperçu
- **Fichiers** : `src/app/(app)/ApercuSaisie.tsx:353-384` ; `src/app/(app)/SaisieNaturelle.tsx:74` (`onClose={() => setApercu(null)}`, actif pendant `enCours`), `:76-82`.
- **Pattern** : Stale Closure / Async Race.
- **Scénario** : pendant `enCours`, le bouton « Annuler » est désactivé, mais la croix et le fond de la Modal restent actifs. L'aperçu se ferme, la boucle `for` continue (le composant démonté n'arrête rien) et crée les éléments restants. À la fin, `onTermine(true)` appelle `setApercu(null)` et `setTexte("")` : si l'utilisatrice a relancé une saisie entre-temps, son nouvel aperçu se ferme et son texte est effacé.
- **Correctif proposé** : désactiver `onClose` de la Modal tant que `enCours`, ou garder un jeton d'annulation (`useRef`) et ignorer `onTermine` si le composant a été fermé.
- **Correctif sûr : oui**.

## I-6 — SaisieNaturelle : le retour système quitte la page au lieu de fermer l'aperçu
- **Fichier** : `src/app/(app)/SaisieNaturelle.tsx:74` (aucun `useBackClose`). `src/components/Modal.tsx` ne gère pas l'historique.
- **Scénario** : aperçu ouvert et modifié, geste ou bouton retour Android : navigation hors du tableau de bord, aperçu et modifications perdus. Tous les autres panneaux (QuickAddFab, NoteCard, AddTaskToggle, Agenda) ferment sur retour.
- **Correctif proposé** : `useBackClose(apercu !== null, () => setApercu(null))` et `onClose={() => history.back()}`, comme `QuickAddFab.tsx:301`.
- **Correctif sûr : oui**.

## I-7 — Séance flottante : un double tap sur « Valider » valide deux séries
- **Fichier** : `src/components/SeanceFlottante.tsx:100-114` (`valider`), bouton `:154-162`.
- **Pattern** : Async Race (lecture-modification-écriture sans verrou).
- **Trace** : `lireBrouillon()` → `prochaineSerie(courant)` → `basculerSerie` → `ecrireBrouillon`. Le deuxième tap relit la base. Si le premier `put` est terminé, la « prochaine série » est la suivante : deux séries validées, le repos recalé sur la seconde. Si la lecture précède l'écriture, c'est la même série qui est validée deux fois sans effet.
- **Scénario** : en salle, double tap involontaire : une série jamais faite est comptée (volume, records, reps).
- **Correctif proposé** : `useRef` verrou (`enCours`), désactiver le bouton jusqu'à la fin de l'écriture ; ou passer la série visée (`suivante.serieId`) à `valider` et ignorer si elle est déjà faite.
- **Correctif sûr : oui**.

## I-8 — Séance : ajout d'un exercice sans retour visuel ni garde → doublons d'exercice sur réseau lent
- **Fichiers** : `src/app/(app)/musculation/seance/SeanceView.tsx:306-310` (`onChoisir` ferme le sélecteur puis attend), `:317-323` (remplacement) ; `src/lib/musculation/demarrer.ts:279-292` (`exerciceDepuisCatalogue`, deux appels réseau sans délai maximal).
- **Scénario** : réseau faible en salle. Après le choix « Squat », le sélecteur se ferme et rien ne se passe jusqu'à la réponse (aucun indicateur). L'utilisatrice croit au raté et choisit encore « Squat » : l'exercice est ajouté deux fois. Les `catch` avalent les erreurs mais aucun délai maximal n'est posé, donc l'attente peut être longue.
- **Correctif proposé** : ajouter l'exercice tout de suite sans précédents/records (déjà prévu : « ne jamais empêcher de s'entraîner »), puis enrichir quand les données arrivent ; sinon un état de chargement avec garde anti double choix et `Promise.race` avec un délai (3 s).
- **Correctif sûr : oui** pour la garde et le délai ; l'enrichissement différé touche le brouillon (à tester).

## I-9 — Musculation : les points d'entrée écrasent un brouillon existant ; la garde n'est que dans l'UI
- **Fichiers** : `src/lib/musculation/demarrer.ts:70, 79, 99` (`ecrireBrouillon(..., true)` sans vérification) ; gardes UI seulement : `SeancesCard.tsx:73, 134` (`Boolean(enCours)`), `RoutinesSection.tsx:127, 148`, `DemarrerSeance.tsx:21-38`, `EntrainementDetailView.tsx:40`.
- **Pattern** : Conditional Dead Path.
- **Scénario** :
  1. `useBrouillonEnCours()` vaut `undefined` pendant la première lecture Dexie, donc `Boolean(enCours)` est faux et les pastilles sont actives.
  2. Un tap très rapide, ou un autre onglet/fenêtre de la PWA (les événements `kilio:musculation-brouillon` ne traversent pas les fenêtres), lance `demarrerDepuisRoutine`.
  3. La séance en cours est remplacée sans confirmation.
- **Correctif proposé** : dans chaque `demarrer*`, lire d'abord `lireBrouillon()` et lever une erreur (ou renvoyer l'existant) s'il y en a un ; traiter `undefined` comme « pas encore prêt » (bouton désactivé).
- **Correctif sûr : oui**.

## I-10 — Pharmacie/Révision : une note refusée par le serveur fait avancer la carte sans jamais la réécrire
- **Fichier** : `src/app/(app)/pharmacie/revision/RevisionView.tsx:96-120` (`noter`).
- **Pattern** : Missing State Transition.
- **Trace** : mise à jour optimiste de la file, du bilan et du cache (`modifierSnapshot` écrit aussi la copie Dexie), puis `noterCarte`. Sur erreur non réseau, seul un toast « La note n'a pas pu être enregistrée » : aucune file, aucun retour en arrière.
- **Scénario** : incident serveur pendant une révision. La carte avance à l'écran et dans la copie locale ; la progression SRS n'est jamais enregistrée ; l'utilisatrice n'a plus de moyen de renoter cette carte pendant la séance. Si `enqueueAction` lève (Dexie indisponible), l'exception n'est pas attrapée (rejet non géré).
- **Correctif proposé** : sur toute erreur, mettre en file (le rejeu et son garde-fou d'idempotence existent côté serveur) ; envelopper `enqueueAction` dans un `try/catch` avec toast ; sinon restaurer la carte et la remettre dans la file.
- **Correctif sûr : oui**.

## I-11 — Habitudes : saisie et suppression hors ligne sans état optimiste (anneau ≠ champ, carte « supprimée » toujours visible)
- **Fichier** : `src/app/(app)/habitudes/HabitudeCard.tsx:118-141` (`enregistrerValeur`), `:144-159` (`supprimer`), `:23-33`.
- **Scénario A** : hors ligne, saisie de « 8 » sur une habitude quantifiée. L'appel échoue, la valeur est mise en file mais le cache n'est pas modifié (contrairement à `toggleMutation`). `valeurInput` affiche 8, l'anneau et « objectif atteint » restent sur l'ancienne valeur ; `cleServeur` ne change pas, donc rien ne se resynchronise.
- **Scénario B** : suppression hors ligne : la carte reste affichée. Une deuxième suppression met une deuxième action en file (aucune déduplication).
- **Correctif proposé** : passer `enregistrerValeur` par une `useMutation` à mise à jour optimiste (comme `toggleMutation`, avec `enfile`) ; masquer la carte localement à la mise en file de `supprimerHabitude`.
- **Correctif sûr : oui**.

## I-12 — FAB « + » et séance flottante occupent le même emplacement (à confirmer visuellement)
- **Fichiers** : `src/app/(app)/QuickAddFab.tsx:131-134` (`fixed right-4 z-40`, `bottom: calc(env(safe-area-inset-bottom) + 90px)`) ; `src/components/SeanceFlottante.tsx:127-128` (conteneur `fixed inset-x-0 z-40`, `bottom: … + 88px`, barre `max-w-md` presque pleine largeur sur téléphone). Le composant de la séance est rendu après les pages dans `layout.tsx`, donc au-dessus à `z-index` égal.
- **Scénario** : séance en cours, ouverture de l'accueil, d'Aujourd'hui ou de /taches : le « + » (colonne de droite) et son menu sont recouverts par la barre flottante, y compris sa zone vide (le conteneur couvre toute la largeur). Le bouton « Valider » de la barre est à l'endroit où le doigt cherche le « + ».
- **Correctif proposé** : relever `bottom` du FAB (ou de la barre) quand une séance est en cours (variable CSS posée par `SeanceFlottante`), et passer `pointer-events: none` sur le conteneur pleine largeur de la barre.
- **Correctif sûr : non** — décision de design, à valider sur appareil.

## I-13 — `useBackClose` appelle `history.back()` quand une route est masquée par `Activity` (hypothèse à tester)
- **Fichier** : `src/hooks/useBackClose.ts:28-40` (le nettoyage de l'effet fait `history.back()` si l'entrée est poussée). Contexte : `next.config.ts` `cacheComponents: true`, doc `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md` (les pages quittées sont masquées avec `<Activity>`, effets nettoyés).
- **Scénario hypothétique** : ouvrir le formulaire inline « + Ajouter une tâche » (ou le renommage d'une note, un panneau de Courses…) puis toucher un onglet de la barre du bas. Le nettoyage de l'effet de la page masquée appelle `history.back()` juste après le `pushState` de la navigation : retour à la page précédente au lieu de la destination, ou correction par `BackNavigationHandler`.
- **Pourquoi à tester** : je n'ai pas pu l'exécuter. Les modales plein écran couvrent la barre du bas, mais pas les formulaires inline (`AddTaskToggle`, `AddCourseToggle`, `AddNoteToggle`, `TaskCard` en édition, formulaire d'ajout du journal).
- **Correctif proposé** : n'appeler `history.back()` dans le nettoyage que si `history.state?.backCloseToken === token` (l'entrée est toujours la nôtre) ; ajouter un test e2e « ouvrir un formulaire inline puis changer d'onglet ».
- **Correctif sûr : non** — changer ce hook touche tous les panneaux de l'app ; à valider avec e2e.

## I-14 — NoteCard : l'assistant IA empilé sur la lecture ne ferme pas avec le retour
- **Fichier** : `src/app/(app)/notes/NoteCard.tsx:65` (`useBackClose(mode !== "closed")`), `:359` (`setAssistantOuvert(true)` sans nouvelle entrée), `:377-388`. `AssistantNoteModal.tsx` n'a pas d'entrée d'historique propre.
- **Pattern** : état UI incohérent (deux couches, une seule entrée d'historique).
- **Scénario** : lecture → « Assistant IA » → retour système : l'entrée de la lecture est consommée, `mode` passe à `closed` (la lecture se ferme), mais `assistantOuvert` reste vrai : l'assistant reste affiché seul, au-dessus de la liste, et le retour suivant quitte /notes.
- **Correctif proposé** : `useBackClose(assistantOuvert, () => setAssistantOuvert(false))` dans NoteCard (même motif que les deux entrées empilées de QuickAddFab), et `onClose={() => history.back()}`.
- **Correctif sûr : oui**.

---

# MINEUR

## M-1 — Agenda/QuickAddFab en mode direct : `goBackSteps(2)` après un événement quitte la page
- **Fichier** : `src/app/(app)/QuickAddFab.tsx:72, 332-338`. `lireRaccourci` accepte `?ajout=evenement` même en mode `direct` (/taches) ; il n'y a alors qu'une entrée d'historique (celle du formulaire). `onSaved` fait `goBackSteps(2)` : le second `back` quitte /taches. Le manifest ne cible que `/?ajout=evenement` (mode normal), donc latent.
- **Correctif** : `goBackSteps(direct ? 1 : 2)`, ou ignorer `ajout=evenement` en mode direct. **Sûr : oui**.

## M-2 — Séance : écriture du brouillon abandonnée si `terminerSeance` échoue après `clos.current = true`
- **Fichier** : `src/app/(app)/musculation/seance/SeanceView.tsx:143-155`, `:96-101`. Les modifications faites entre le début de `finir()` et l'échec ne sont pas réécrites (l'effet ne repart qu'au prochain changement). `abandonner()` (`:183-188`) ne gère pas l'échec de `effacerBrouillon` (rejet non géré, écran bloqué).
- **Correctif** : réécrire `b` dans le `catch` ; `try/catch` dans `abandonner`. **Sûr : oui**.

## M-3 — NoteForm : l'éditeur d'items refait un rollback global et n'a pas de file hors ligne
- **Fichier** : `src/app/(app)/notes/NoteForm.tsx:46-68`. Régression partielle du correctif CLICK-PATH-603 : `onError` restaure tout le tableau `notes` (`:64`) et la mutation n'a pas `networkMode: "always"` (aucune mise en file, contrairement à `NoteCard.itemMutation`). Auto-réparé par l'invalidation de `onSettled`, donc effet bref ; hors ligne, la coche reste « en pause » et se perd à la fermeture de l'app.
- **Correctif** : réutiliser `itemMutation` de NoteCard (patron par élément + file). **Sûr : oui**.

## M-4 — Courses : un ajout depuis le FAB sans cache charge un cache partiel
- **Fichier** : `src/app/(app)/courses/AddCourseForm.tsx:100-125`. Si la requête `courses` n'est pas encore chargée (modale du FAB sur le tableau de bord), `onMutate` annule la requête puis écrit `[…, nouveaux]` à partir de `[]` : le cache ne contient que les nouveaux articles. Hors ligne, /courses n'affiche alors que ces articles.
- **Correctif** : si `old` est `undefined`, ne pas écrire de cache optimiste. **Sûr : oui**.

## M-5 — Courses : « Annuler » après une suppression mise en file hors ligne
- **Fichiers** : `CourseItemRow.tsx:112-126`, `undo.ts:17-50`. Le toast « supprimé » (avec « Annuler ») s'affiche même quand la suppression est seulement en file ; l'annulation met `restoreCourseItems` en file derrière `deleteCourseItem`. Le résultat final est correct, mais deux actions inutiles restent en file et le message ne dit pas que rien n'est parti.
- **Correctif** : retirer l'action `deleteCourseItem` de la file à l'annulation plutôt qu'ajouter une restauration. **Sûr : non** (touche la file).

## M-6 — Tâches : une suppression en file reste masquée jusqu'au rejeu ; au rechargement hors ligne, la tâche réapparaît
- **Fichiers** : `src/app/(app)/taches/TasksList.tsx:58-68, 448-452` ; `src/lib/taches/masquees.ts` (variable de module, perdue au rechargement). Hors ligne, rechargement : la tâche « supprimée » revient (cache serveur) et peut être cochée ; si l'action est ensuite abandonnée, elle reste masquée jusqu'au prochain chargement.
- **Correctif** : à la mise en file, inscrire l'id dans un petit stockage (Dexie) relu au démarrage pour initialiser `masquees`. **Sûr : non** (nouveau stockage).

## M-7 — Aujourd'hui : coche depuis le tableau de bord sans « Annuler »
- **Fichiers** : `src/app/(app)/DashboardTaskItem.tsx:37-72` contre `TasksList.tsx:415-434`. Même geste, comportement différent selon l'écran. Pas de bug de données, mais incohérence pour une tâche récurrente cochée par erreur (l'échéance avance, aucun retour simple depuis Aujourd'hui).
- **Correctif** : extraire le toast « Annuler » dans un hook partagé. **Sûr : non** (choix produit).

## M-8 — Création sans identifiant client : une réponse perdue puis « Réessayer » crée un doublon
- **Fichiers** : `src/app/(app)/taches/AddTaskForm.tsx:~128-141` (enveloppe réseau de `createTache`), `notes/NoteForm.tsx:257-266`, `aujourdhui/AjoutRapideTache.tsx:76-89`. Si le serveur a écrit mais que la réponse est perdue, le message « n'a pas été enregistrée » est faux et le réessai duplique.
- **Correctif** : id généré côté client (uuid) passé à l'insertion (`upsert on conflict do nothing`). **Sûr : non** (contrat serveur).

## M-9 — Tâches : monter/descendre une sous-tâche ignore les sous-tâches masquées par « Annuler »
- **Fichier** : `src/app/(app)/taches/TasksList.tsx:134, 206-216`. Les boutons utilisent l'index parmi les sous-tâches visibles ; `reordonnerSousTaches` agit sur la liste complète (masquée comprise) : un clic peut ne rien changer visuellement. Très court (6 s).
- **Correctif** : désactiver monter/descendre tant que `masquees.size > 0`. **Sûr : oui**.

## M-10 — SaisieNaturelle/ApercuSaisie : détails d'état
- Le texte tapé pendant l'interprétation est effacé quand l'ajout se termine (`SaisieNaturelle.tsx:78`, `setTexte("")` sans comparer). **Sûr : oui**.
- Les champs de l'aperçu restent modifiables pendant `enCours` ; les modifications sur un élément en échec sont perdues (`ApercuSaisie.tsx:382` remet `restants` capturés avant). **Sûr : oui** (désactiver le formulaire pendant l'envoi).

## M-11 — PullToRefresh : geste commencé en haut de page puis remonté, et décalage du contenu pendant un glissement diagonal
- **Fichier** : `src/components/PullToRefresh.tsx:45-67, 114-121`. La condition `scrollTop === 0` n'est testée qu'au `touchstart` : un geste « remonter puis redescendre » peut déclencher un rafraîchissement alors que la page n'est plus en haut. L'indicateur pousse le contenu (hauteur = distance) pendant tout glissement vers le bas, y compris un swipe diagonal destiné à `TabSwipeWrapper` (décalage jusqu'à 70 px, pas de rafraîchissement sous le seuil).
- **Correctif** : annuler (`pulling = false`) dès que `scrollTop > 0` dans `touchmove` ; ne pas ouvrir l'indicateur tant que le mouvement vertical ne domine pas. **Sûr : oui**.

## M-12 — PullToRefresh sur le tableau de bord : aucun `onRefresh`
- **Fichier** : `src/app/(app)/page.tsx:59`. Sans callback, seul `router.refresh()` part ; les cartes alimentées par TanStack (tâches, habitudes, nutrition) se mettent à jour seulement si les prefetch serveur sont plus récents que le cache client. /aujourdhui n'a pas de PullToRefresh du tout.
- **Correctif** : passer `onRefresh={() => queryClient.invalidateQueries()}`. **Sûr : oui**.

## M-13 — Modales et boîtes de dialogue sans entrée d'historique
- Sans `useBackClose`/`history.back` (vérifié par recherche) : `components/ConfirmDialog.tsx` (donc « Quitter la séance ? », « Terminer la séance ? »), `journal/TranscriptionDialog.tsx`, `notes/AssistantNoteModal.tsx` (voir I-14), `revue/AssistantRevueModal.tsx`, `musculation/RoutinesSection.tsx`, `EntrainementDetailView.tsx`, `documents/*Modal.tsx`, `collection/*Modal.tsx`.
- Le retour système quitte la page au lieu de fermer la boîte. Aucune perte de données dans la séance (le brouillon est sur le téléphone), mais comportement différent des autres panneaux.
- **Correctif** : brancher `useBackClose` dans `Modal` et `ConfirmDialog` (prop `ouvert`). **Sûr : non** (impact transversal).

## M-14 — Habitudes : `habitudesActives` jamais invalidée
- **Fichiers** : `HabitudeCard.tsx:36-40`, `AddHabitudeToggle`, `queryKeys.habitudesActives`. Créer ou archiver une habitude n'invalide pas la liste proposée au rattachement dans `ObjectifForm.tsx:58-59` (30 s de décalage).
- **Correctif** : ajouter `invalidateQueries({ queryKey: queryKeys.habitudesActives })` dans les `onSaved`/`supprimer`. **Sûr : oui**.

---

# Vérifié et sans défaut retenu

- `TabSwipeWrapper` : les routes à swipe interne (`/agenda`, `/journal`) sont exclues ; la bande haute réutilise `handleSwipe` sans double détection ; `useSwipeHorizontal` ignore le multi-doigts, les poignées de drag et les zones `data-swipe-zone`.
- `PullToRefresh` : ignore les poignées de drag et le multi-doigts ; `Modal` isole les événements tactiles (pas de rafraîchissement depuis une feuille).
- `QuickAddFab` : les deux `useBackClose` empilés (menu puis formulaire) se ferment correctement avec `goBackSteps(2)` en mode normal.
- `ajouterArticlesCourses` est idempotent côté serveur (déduplication par libellé), donc sûr au rejeu ; `noterCarte` a sa garde `dernier_passage` ; `setTacheFait` a sa garde `cochageDejaApplique` ; `enregistrerEntreeHabitude` est un `upsert` ; les séances de musculation sont idempotentes par `id`.
- Deep-link `?tache=` de l'agenda : la page hydrate `taches` côté serveur, donc l'effet de lecture voit les paramètres avant leur nettoyage (pas de course réelle).
- Minuit : `AppResumeRefresh` relance `router.refresh()` à minuit (heure de Paris) ; `TachesView` recalcule aussi « aujourd'hui ».
- `JournalEntriesList` (suppression d'un repas) invalide bien `catalogueJournal` et `resume-nutrition` ; `useAjoutRepasTermine` fait de même pour l'ajout.
- `EnvoyerCoursesBouton`, `useReporterTaches`, `SelectionBar`, `PlanifierPanneau`, `PlanDuJourCard` invalident `courses` / `taches` après succès.

---

# Priorités suggérées

1. **C-1** (perte de feuille) : décision de design puis garde de version.
2. **I-7, I-9, I-10, I-3/I-4/I-5/I-6** : correctifs locaux sûrs, à faire en un lot « fiabilité des gestes ».
3. **I-2** : généraliser la garde `enfile` (lot sûr), puis trancher la coordination courses (401/402).
4. **I-1** : poison de file, à traiter avec ses tests.
5. **I-13** : écrire d'abord le test e2e (formulaire inline ouvert puis changement d'onglet) avant tout changement de `useBackClose`.
6. **I-12** : vérification visuelle sur appareil.

Aucun test n'a été exécuté (audit statique en lecture seule).

---

## Passe SEO / PWA (résumé)

- Aucun `robots.ts` ni noindex avant cet audit (corrigé). Métadonnées minimales : titre unique « Kilio », aucun `metadata` par page (correctif sûr : `title.template` + titres par page).
- Manifest valide (`public/manifest.json`) ; icône `any maskable` combinée sur un PNG à coins transparents, `kilio-icon-maskable.svg` non référencé ; description décalée par rapport à l'app ; ajouter `id: "/"`.
- Service worker : `Response.redirect` relatif (corrigé) ; pas de repli si le réseau tombe pendant le POST du share target (à tester sur Android) ; précache `addAll` atomique.
- `error.tsx` / `global-error.tsx` / `not-found.tsx` / `loading.tsx` conformes à Next 16.3 (`retry`).
