"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Installation PWA best-effort : une erreur ici ne doit pas casser l'app.
      });
    }
  }, []);

  return null;
}
