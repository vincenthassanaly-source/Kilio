"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ErrorInline } from "@/components/ErrorInline";

/** Variante d'`ErrorInline` pour les Server Components : une fonction ne peut
 * pas leur être passée en `retry`, le bouton relance donc le rendu serveur
 * du segment (`router.refresh()`). */
export function ErrorInlineRefresh({ message, titre }: { message: string; titre?: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return <ErrorInline message={message} titre={titre} retry={() => startTransition(() => router.refresh())} />;
}
