# Agenda : problèmes relevés (audit du 25 novembre 2026)

Instance isolée (app `localhost:3100`, faux Supabase `localhost:54321`, vue depuis l'espace réseau du PID 1275), Chromium sans interface, viewport mobile 390×844, `fr-FR`, `Europe/Paris`. Heure de l'instance pendant l'audit : environ 17 h 30-17 h 45.
8 parcours (115 étapes, une capture par étape), 8 écrans au repos (4 vues × clair/sombre), sondes ciblées (`sondes/sondes.json`).
Rapport visuel : `index.html` · critique : `critique.md`.

**Compte** : 0 bloquant · 1 majeur · 4 mineurs · 4 design. Six artefacts de l'environnement, listés à part (ils ne sont pas des bugs).

> **Note de méthode (artefact principal)** : dans l'espace réseau isolé, Chromium voit `navigator.onLine === false` (aucune interface réseau hors `lo`). L'app affiche alors « Hors ligne » et refuse la création de tâche (message hors-ligne, voir A1). Les parcours de référence (`parcours/`) ont donc été rejoués avec une copie du script `parcours.mjs` qui force `navigator.onLine = true` (`addInitScript`), comme sur un téléphone connecté. La passe d'origine du parcours tâche est conservée en preuve dans `preuves/06-tache-hors-ligne-artefact/`.

---

## Majeur

### M1. Semaine : les événements « journée entière » et les tâches sans heure sont invisibles à l'ouverture
- **Gravité** : majeur · **bug confirmé** (vu avec les fixtures d'origine, pas un artefact).
- **Où** : vue Semaine. Captures : `sondes/semaine-ouverture.png` (à l'ouverture) et `sondes/semaine-defilee-en-haut.png` (même vue, grille remontée à la main) ; `parcours/04-evenement-cas-limites/16-click.png` (la réunion « journée entière » créée juste avant n'apparaît pas) ; `parcours/08-grille-puces-semaine/08-click.png`.
- **Attendu** : comme en vue Jour (bande fixe au-dessus de la grille), la ligne « sans heure / journée entière » reste visible sous l'en-tête des jours quel que soit le défilement vertical.
- **Observé** : la grille s'ouvre défilée vers l'heure courante (`scrollTop` = 591 px, sonde `semaine-bande-sans-heure`) ; la pastille « Tâche e2e du jour » est à `top` = -302 px, hors du conteneur. La semaine paraît vide de 15 h à 23 h. Seul le libellé accessible du bouton de jour mentionne ces éléments.
- **Cause probable** : `src/app/(app)/agenda/WeekView.tsx:305-312` : la bande est un `<button>` non collant dans le conteneur défilant (`WeekView.tsx:246-248`, `overflow-auto`), alors que l'en-tête de jour juste au-dessus est `sticky top-0` (`WeekView.tsx:288`). Le défilement initial (`WeekView.tsx:174-179`, `useInitialScroll` dans `TimeGrid.tsx:142-151`) la sort donc du cadre. Même chose pour l'espaceur de la gouttière (`WeekView.tsx:256-257`), qui n'est pas collant non plus.
- **Correctif proposé** :
  ```diff
  --- a/src/app/(app)/agenda/WeekView.tsx
  +++ b/src/app/(app)/agenda/WeekView.tsx
  @@ -255,4 +255,4 @@
               <div className="sticky left-0 z-20 bg-surface">
  -              <div className="h-11 border-b border-line" />
  -              <div className="border-b border-line/60" style={{ height: UNSCHEDULED_BAND_HEIGHT }} />
  +              <div className="sticky top-0 z-20 h-11 border-b border-line bg-surface" />
  +              <div className="sticky top-11 z-20 border-b border-line/60 bg-surface" style={{ height: UNSCHEDULED_BAND_HEIGHT }} />
                 <TimeGutter zoom={zoom} />
  @@ -309,3 +309,3 @@
                       onClick={() => onSelectDay(day)}
  -                    className="flex flex-wrap items-center gap-0.5 overflow-hidden border-b border-line/60 px-0.5 py-0.5"
  +                    className="sticky top-11 z-10 flex flex-wrap items-center gap-0.5 overflow-hidden border-b border-line/60 bg-surface px-0.5 py-0.5"
                       style={{ height: UNSCHEDULED_BAND_HEIGHT }}
  ```
  (`top-11` = 44 px, la hauteur `h-11` de l'en-tête de jour. Les blocs horaires doivent garder un `z-index` inférieur à 10 pour passer sous la bande.)
- **Test Playwright de non-régression** (à ajouter dans `e2e/agenda.spec.ts`, qui fournit déjà `ouvrirAgenda` et `choisirVue`) :
  ```ts
  test("Semaine : la bande sans heure reste visible à l'ouverture, même tard dans la journée", async ({ page }) => {
    await ouvrirAgenda(page, "17:40");
    await choisirVue(page, "Semaine");
    const grilleSemaine = page.locator("[data-swipe-ignore]");
    // La grille s'est bien défilée vers l'heure courante…
    await expect.poll(() => grilleSemaine.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
    // …et la tâche sans heure du jour reste dans le cadre visible.
    const puce = grilleSemaine.getByText("Tâche e2e du jour", { exact: true });
    await expect(puce).toBeInViewport();
    const [cadre, boite] = await Promise.all([grilleSemaine.boundingBox(), puce.boundingBox()]);
    expect(boite!.y).toBeGreaterThanOrEqual(cadre!.y + 44); // sous l'en-tête de jour collant
  });
  ```

---

## Mineurs

### m1. Jour et Semaine : la matinée est masquée sans aucun signal
- **Gravité** : mineur · **comportement confirmé** (choix d'ouverture sur « maintenant », sans repère de ce qui est hors champ).
- **Où** : `ecrans/agenda-jour.clair.png`, `parcours/01-vues-clair/04-click.png`. À 17 h 40, la grille Jour montre 16 h à 23 h ; le « Rendez-vous e2e » de 9 h n'est signalé nulle part. Même chose en Semaine.
- **Attendu** : savoir d'un coup d'œil qu'il existe des éléments plus tôt, par un repère cliquable.
- **Observé** : rien n'indique d'éléments au-dessus du cadre.
- **Cause** : `DayView.tsx:170-175` et `WeekView.tsx:174-179` → `computeInitialScrollMinutes({ showCurrentTime })` ; `TimeGrid.tsx:142-151` garantit seulement de ne *couper* aucun bloc, pas de les montrer.
- **Correctif proposé** : dans `DayView`, compter les blocs dont la fin précède le haut visible et afficher un repère au-dessus de la grille :
  ```diff
  +      {blocsAuDessus > 0 && (
  +        <button type="button" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
  +          className="text-caption font-semibold text-kcal">↑ {blocsAuDessus} plus tôt</button>
  +      )}
  ```

### m2. « Le titre est requis. » reste affiché une fois le titre saisi
- **Gravité** : mineur · **bug confirmé**.
- **Où** : `parcours/04-evenement-cas-limites/11-click.png` (titre long saisi, le message rouge est toujours là).
- **Attendu** : le message disparaît dès que le champ n'est plus vide.
- **Observé** : il ne disparaît qu'à la soumission suivante.
- **Cause** : `src/app/(app)/_accueil/EvenementForm.tsx:70` (`titreManquant`) n'est remis à `false` que dans `handleSubmit` (`EvenementForm.tsx:86`) ; `onChange` (`EvenementForm.tsx:119`) ne le touche pas.
- **Correctif proposé** :
  ```diff
  -          onChange={(e) => setTitre(e.target.value)}
  +          onChange={(e) => {
  +            setTitre(e.target.value);
  +            if (titreManquant && e.target.value.trim()) setTitreManquant(false);
  +          }}
  ```

### m3. Tap sur un jour du Mois, puis Retour : on quitte l'Agenda
- **Gravité** : mineur · **comportement confirmé** (cohérent avec la règle « Retour = parent logique », mais contraire à l'attente d'un drill-down).
- **Où** : `parcours/07-navigation-retour-clavier/15-click.png` (Mardi 1 décembre, ouvert depuis le Mois), puis `17-back.png` (URL `/`, écran Aujourd'hui).
- **Attendu** : Retour ramène au Mois d'où l'on vient.
- **Observé** : Retour mène à `/` (`BackNavigationHandler`).
- **Cause** : `AgendaView.tsx:124-127` (`setView` : changement ponctuel sans entrée d'historique) et `AgendaView.tsx:264-267` (`selectDay`).
- **Correctif proposé** : mémoriser la vue d'origine et la restaurer au Retour par `useBackClose` :
  ```diff
  +  const [vueAvantJour, setVueAvantJour] = useState<ViewKey | null>(null);
  +  useBackClose(vueAvantJour !== null && view === "jour", () => { setVueChoisie(vueAvantJour); setVueAvantJour(null); });
     function selectDay(date: Date) {
  +    if (view !== "jour") setVueAvantJour(view);
       setSelectedDate(date);
  ```

### m4. Création d'événement sans insertion optimiste
- **Gravité** : mineur · **confirmé**, sans gravité fonctionnelle.
- **Où** : `parcours/03-creer-evenement/11-expect_text.png` (toast « Événement ajouté », grille encore vide à 19 h), puis `12-expect_text.png` (le bloc apparaît une fraction de seconde après).
- **Cause** : `AgendaView.tsx:510-514` : `onSaved` invalide `queryKeys.evenements` sans `setQueryData`.
- **Correctif proposé** : insérer l'événement renvoyé par `createEvenement` dans le cache de la plage courante avant l'invalidation (même patron que la tâche : mutation optimiste TanStack).

---

## Design

- **d1. Le FAB recouvre le texte d'aide et la fin du contenu au repos.** `parcours/01-vues-clair/11-click.png` et `07-navigation-retour-clavier/12-press.png` : « Appui long sur la grille pour ajouter un événeme[+] ». Fichiers : `AgendaView.tsx:422-425` (FAB fixé à `bottom: 90px`), `DayView.tsx:291-295` (aide). Proposition : réserver un `padding-bottom` égal au FAB plus la nav en fin de contenu de l'Agenda, ou centrer l'aide avec une marge droite de 72 px.
- **d2. Deux écritures de l'heure** : gouttière « 06h / 07h » (`TimeGrid.tsx:230`, `padStart(2, "0")`) contre repères de créneau « 8h30 » (`TimeGrid.tsx:175`). Proposition : `{hour}h` sans zéro de tête partout.
- **d3. Gestes invisibles** : swipe de période, pincement-zoom, appui long et raccourcis clavier ne sont annoncés que par une phrase (Jour) et un `title` (FAB). Une aide d'une ligne au premier usage, ou un menu « ⋯ » listant les raccourcis, suffirait.
- **d4. La Semaine montre 3,5 jours sur 7** (défilée sur aujourd'hui, `WeekView.tsx:199-208`) : lundi et mardi sont hors champ à l'ouverture, seul un léger dégradé le signale. Choix documenté, mais le titre « 23 nov. – 29 nov. » promet 7 jours.

---

## Artefacts de l'environnement (ce ne sont pas des bugs)

| # | Observé | Pourquoi c'est un artefact | Preuve |
|---|---------|----------------------------|--------|
| A1 | Pastille « Hors ligne » sur tous les écrans ; création de tâche refusée (« Connexion impossible : la tâche n'a pas été enregistrée… »), aucune écriture en base | `navigator.onLine === false` dans l'espace réseau isolé, sans interface réseau (vérifié par sonde). Le comportement de l'app est d'ailleurs **correct** hors ligne : saisie conservée, message clair (`AddTaskForm.tsx:139-141`) | `preuves/06-tache-hors-ligne-artefact/08-expect_text.png` |
| A2 | `HTTP 404 /_vercel/speed-insights/script.js` + erreur console MIME à chaque chargement | Script fourni par Vercel en production seulement | toutes les étapes `goto` / `reload` |
| A3 | « Tâches terminées (1) » (« Acheter des timbres ») encore présente dans le parcours 08, après `/__reset` | Le reset vide le faux Supabase mais pas le cache serveur `"use cache"` (`src/lib/taches/cache.ts:14-20`, `revalidate: 60`) ni le `staleTime: 30_000` client (`src/app/providers.tsx:34`). **État d'un parcours passé dans le suivant, signalé sans modifier le code.** En réel, ce cache est expiré par les écritures in-app ; une écriture hors app (edge function, autre appareil) peut rester invisible environ 60 à 90 s, borne voulue d'après le commentaire du fichier | `parcours/08-grille-puces-semaine/03-click.png` |
| A4 | Champs date/heure en `11/25/2026`, `06:00 PM` | Format des contrôles natifs de Chromium sans interface (langue de l'interface, pas `locale`) ; sur un téléphone en français : `25/11/2026`, `18:00` | `parcours/03-creer-evenement/04-click.png` |
| A5 | `POST /agenda net::ERR_ABORTED` au rechargement | Server Action de lecture en vol, annulée par le `reload` ; sans effet | `parcours/01-vues-clair` étape 8 |
| A6 | Overlay /impeccable : « Overused font: Inter » | Inter est imposé par DESIGN.md : faux positif | `sondes/impeccable-overlay-*.png` |

---

## Vérifié et conforme (pas de problème)

Création d'événement (titre, heure, durée, rappel) avec POST conforme ; persistance après rechargement ; modification (PATCH) ; suppression différée avec « Annuler » (DELETE seulement à l'expiration du toast) ; titre vide et titre fait d'espaces refusés ; double clic sur « Ajouter » : **une seule** écriture ; titre très long : tronqué proprement en puce, passe à la ligne en Liste ; création et cochage de tâche (POST puis PATCH `fait: true` après le délai d'annulation), section « Tâches terminées » ; vue mémorisée après rechargement (Liste) ; Retour ferme la feuille sans quitter l'Agenda ; raccourcis `e`, `n` (focus sur le titre), `m`, ← / → ; Échap ferme le menu du FAB et rend le focus au FAB ; appui long sur la grille : ouvre « Nouvel événement » à l'heure du créneau (19:00), un tap simple n'ouvre rien ; tap sur la puce de tâche sans heure : surbrillance et défilement vers la carte ; tap sur un événement (Jour, Semaine, Liste) : ouvre « Modifier l'événement » ; aucun débordement horizontal ; cibles tactiles ≥ 44 px (le cercle de coche de 22 px a une zone élargie, `hitSlop`) ; clair et sombre lisibles ; détecteur /impeccable : 0 constat dans le code.

---

## Ce qui n'a pas pu être testé

- **Base réelle Supabase** : seul le faux Supabase a été utilisé (aucune écriture réelle).
- **Gestes tactiles fins** : swipe horizontal de période, pincement-zoom (Jour/Semaine), défilement horizontal de la Semaine au doigt. Le script ne sait faire que tap, clic, molette ; l'appui long a été simulé à la souris.
- **Notifications et rappels push** (rappel « 15 min avant » enregistré en base, envoi non testé) et **deep-link `?tache=`** depuis une notification.
- **Flux iCalendar** `/api/agenda/feed.ics` : 404 sans le jeton `AGENDA_FEED_TOKEN` (comportement voulu), jeton inconnu dans l'instance.
- **Hors ligne réel** (file d'écritures Dexie et rejeu) : l'environnement est hors ligne *en permanence*, d'où le forçage en ligne ; la transition hors ligne → en ligne n'a pas été jouée.
- **Planning de travail** (bande des créneaux travaillés) et **jours fériés** : aucune fixture `horaires_travail_creneaux` ni `jours_feries` dans `e2e/mock-supabase.mjs`. **Fixture manquante, signalée sans la modifier.**
- **Événements récurrents** (édition d'une occurrence de série) et **chevauchements** de blocs : aucune fixture.
- **Instantané `.impeccable/critique/`** de la critique non écrit (hors de `reports/audit/agenda/`, seule zone autorisée).
- Le ressenti d'usage (calme, lisibilité) reste un jugement, signalé comme tel dans `critique.md`.
