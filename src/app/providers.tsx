"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { ToastHost } from "@/components/toast/ToastHost";
import { useOnlineSync } from "@/lib/offline/useOnlineSync";
import { SportSync } from "@/lib/sport/SportSync";

// Import dynamique plutôt que statique : `process.env.NODE_ENV` est figé au
// build, donc en production cette branche devient `null` et le bundler élimine
// l'appel `import()` avec elle — @tanstack/react-query-devtools ne fait plus
// partie d'aucun chunk client de prod, sans dépendre du tree-shaking du
// bundler sur ce package (contrairement à un simple rendu conditionnel d'un
// import statique).
const ReactQueryDevtools =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("@tanstack/react-query-devtools").then((m) => m.ReactQueryDevtools), { ssr: false })
    : null;

// App mono-utilisateur, données modifiées uniquement via ce client : pas
// besoin de refetch agressif au focus/reconnect. `staleTime` évite un
// refetch réseau superflu à chaque navigation entre deux pages déjà
// visitées récemment ; les mutations invalident explicitement les query
// keys concernées pour rester à jour après une écriture.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(getQueryClient);
  // Écoute online/offline et rejoue la file d'attente offline (voir
  // src/lib/offline/) au retour en ligne, pour toute l'app.
  // Après un rejeu qui a synchronisé OU abandonné au moins une action, on
  // invalide tout : la file couvre plusieurs modules (tâches, notes,
  // courses, habitudes), un refetch parti à la reconnexion a pu lire l'état
  // serveur avant le rejeu, et un abandon peut laisser un article optimiste
  // fantôme à l'écran (voir flush-policy.ts).
  useOnlineSync(() => {
    queryClient.invalidateQueries();
  });

  // `reducedMotion="user"` (T10) : sous « Réduire les animations » du
  // système, framer-motion coupe les translations, échelles et `layout` de
  // toute l'app (seule l'opacité reste animée), sans dépendre de chaque
  // composant appelant `useReducedMotion`.
  return (
    <MotionConfig reducedMotion="user">
    <QueryClientProvider client={queryClient}>
      {children}
      <SportSync />
      <ToastHost />
      {ReactQueryDevtools && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
    </MotionConfig>
  );
}
