const CACHE_NAME = "nutrition-app-shell-v4";
// Photos reçues par le partage natif (Web Share Target), mises de côté le
// temps que la page /collection/partage/choisir les compresse côté client
// (src/lib/images/compression.ts) puis les envoie par lots. Sans ce détour,
// les photos brutes partaient d'un bloc vers le Route Handler et butaient
// sur la limite de 4,5 Mo des fonctions Vercel.
const CACHE_PARTAGE = "kilio-partage-en-attente";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-badge-v2.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== CACHE_PARTAGE)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

// Network-first pour les pages ET les fetch internes du routeur Next.js (payloads
// RSC lors d'une navigation <Link>, qui ont mode "cors" et non "navigate") : sans
// ça, le cache-first servirait indéfiniment une version périmée d'une page après
// qu'une entrée ait été ajoutée côté serveur (ex: Supabase directement, sans passer
// par une Server Action de ce site). Cache-first réservé aux vrais assets statiques
// versionnés par build (_next/static) et aux icônes. Les appels Supabase (autre
// origine) ne passent pas ici.
async function mettreDeCotePartage(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.redirect("/collection/partage/choisir", 303);
  }
  const fichiers = formData.getAll("photos").filter((f) => f instanceof File && f.size > 0);
  const suite = new FormData();
  for (const champ of ["text", "url", "title"]) {
    const valeur = formData.get(champ);
    if (typeof valeur === "string") suite.set(champ, valeur);
  }

  if (fichiers.length > 0) {
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const cache = await caches.open(CACHE_PARTAGE);
      await Promise.all(
        fichiers.map((fichier, i) =>
          cache.put(
            `/__partage/${id}/${i}`,
            new Response(fichier, {
              headers: {
                "Content-Type": fichier.type || "application/octet-stream",
                "X-Nom-Fichier": encodeURIComponent(fichier.name || `photo-${i + 1}.jpg`),
              },
            })
          )
        )
      );
      suite.set("attente", id);
      suite.set("nb", String(fichiers.length));
    } catch {
      // Stockage indisponible : on retombe sur l'envoi direct des photos.
      for (const fichier of fichiers) suite.append("photos", fichier);
    }
  }

  // Le texte ou le lien (vidéo) continue vers le Route Handler, qui résout
  // ses métadonnées et redirige vers l'écran de choix de collection.
  return fetch("/collection/partage", { method: "POST", body: suite, redirect: "manual" });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    request.method === "POST" &&
    url.origin === self.location.origin &&
    url.pathname === "/collection/partage"
  ) {
    event.respondWith(mettreDeCotePartage(request));
    return;
  }

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/");

  if (!isStaticAsset) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
    )
  );
});

// Actions proposées sur les rappels de tâche (data.tacheId présent),
// pas sur les rappels de document. Les valeurs "reporter-*" correspondent
// aux clés attendues par /api/taches/[id]/reporter-rappel ; "marquer-fait"
// appelle /api/taches/[id]/marquer-fait.
const ACTIONS_REPORT_RAPPEL = [
  { action: "marquer-fait", title: "✓ Fait" },
  { action: "reporter-1j", title: "Demain" },
  { action: "reporter-1sem", title: "Semaine prochaine" },
];

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Kilio", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-badge-v2.png",
      data: { url: data.url || "/agenda", tacheId: data.tacheId || null },
      actions: data.tacheId ? ACTIONS_REPORT_RAPPEL : [],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  const { action, notification } = event;
  const url = notification.data?.url || "/agenda";
  const tacheId = notification.data?.tacheId;

  if (action === "marquer-fait" && tacheId) {
    notification.close();
    event.waitUntil(
      fetch(`/api/taches/${tacheId}/marquer-fait`, { method: "POST" }).catch(() => {
        // Hors-ligne ou requête échouée : la tâche reste non cochée, elle
        // sera à cocher depuis l'app comme d'habitude.
      })
    );
    return;
  }

  if (action.startsWith("reporter-") && tacheId) {
    notification.close();
    const delai = action.slice("reporter-".length);
    event.waitUntil(
      fetch(`/api/taches/${tacheId}/reporter-rappel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delai }),
      }).catch(() => {
        // Hors-ligne ou requête échouée : rien de plus à faire ici, la
        // tâche garde son rappel normal (rappel_envoye_le déjà posé, donc
        // pas de nouvelle notification tant que rappel_reporte_jusqua
        // n'est pas posé côté serveur).
      })
    );
    return;
  }

  notification.close();
  // Comparaison sur le pathname (pas l'URL complète) : une fenêtre déjà
  // ouverte sur /agenda est réutilisée même si son ?tache= diffère (ou est
  // absent) de celui de la notification cliquée, plutôt que d'ouvrir une
  // nouvelle fenêtre à chaque notification.
  const path = new URL(url, self.location.origin).pathname;
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(async (clients) => {
      // Ne réutiliser focus() que si la fenêtre est déjà au premier plan :
      // sur Android, appeler focus() sur une fenêtre PWA en arrière-plan ou
      // minimisée ne la ramène pas fiablement au premier plan (limite
      // Chromium connue) — elle est bien navigate()-ée en silence, mais
      // reste invisible tant que l'utilisateur ne relance pas l'app
      // lui-même. openWindow() est le seul chemin fiable pour ramener une
      // instance PWA existante au premier plan dans ce cas.
      const existing = clients.find((c) => c.focused && new URL(c.url).pathname === path);
      if (existing) {
        if ("navigate" in existing) {
          try {
            await existing.navigate(url);
          } catch {
            // navigate() peut échouer selon le navigateur : la fenêtre
            // existante est quand même mise au premier plan ci-dessous,
            // simplement pas repositionnée sur la bonne tâche/jour.
          }
        }
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
