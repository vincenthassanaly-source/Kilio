"use client";

import { useEffect } from "react";
import "./globals.css";

// Dernier filet : erreur dans le layout racine lui-même (error.tsx ne le
// couvre pas). Remplace le layout racine : doit fournir <html>/<body> et
// importer les styles globaux. Pas de police ni de thème de l'app ici (le
// script de thème vit dans le layout) : rendu au thème clair par défaut.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-full flex-col items-center justify-center gap-4 bg-background px-4 text-center text-ink">
        <title>Kilio — erreur</title>
        <p className="text-lg font-semibold">Une erreur est survenue</p>
        <p className="max-w-sm text-sm text-ink-3">
          Quelque chose s&apos;est mal passé de notre côté. Vous pouvez réessayer.
        </p>
        <button
          type="button"
          onClick={retry}
          className="rounded-2xl bg-kcal px-4 py-2.5 font-semibold text-on-kcal"
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
