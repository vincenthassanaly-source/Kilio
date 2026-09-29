"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ErrorState";

// Error boundary racine : couvre tout ce qui est hors du groupe (app),
// notamment le flux de partage natif Android (/collection/partage/*).
export default function RootError({
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
    <div
      className="flex-1 overflow-y-auto px-4"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 24px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
      }}
    >
      <ErrorState retry={retry} />
    </div>
  );
}
