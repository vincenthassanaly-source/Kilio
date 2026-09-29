"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ErrorState";

// Error boundary du groupe (app) : ne couvre que le contenu de la page
// (le `<main>` de TabSwipeWrapper) — BottomNav et ThemeToggle, rendus par
// le layout parent, restent visibles même quand cette page plante.
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState retry={retry} />;
}
