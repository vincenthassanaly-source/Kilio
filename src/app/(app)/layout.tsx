import { Suspense } from "react";
import { BottomNav } from "@/components/BottomNav";
import { BackNavigationHandler } from "@/components/BackNavigationHandler";
import { SeanceFlottante } from "@/components/SeanceFlottante";
import { Providers } from "@/app/providers";
import { TabSwipeWrapper } from "@/components/TabSwipeWrapper";
import { NavigationEditProvider } from "@/lib/navigation/NavigationEditContext";
import { getPreferencesNavigationResolues } from "@/lib/navigation/preferences";

// Server Component : lit les préférences de navigation (en cache, donc
// résolues dans la coquille statique : la barre du bas s'affiche
// instantanément et dans l'ordre personnalisé) et les passe en props à
// NavigationEditProvider, qui les garde en state client (mises à jour
// ensuite via les Server Actions updateOrdreGrillePlus /
// updateModulesBarreBasse). ModulesGrid et BottomNav
// vivent dans deux sous-arbres différents de ce layout (children vs. rendu
// direct) mais partagent ce même Provider, seul point commun des deux —
// voir reports/2026-09-04-preferences-navigation.md.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ordreGrillePlus, modulesBarreBasse } = await getPreferencesNavigationResolues();

  return (
    <Providers>
      <div className="relative flex h-full flex-1 flex-col bg-background">
        {/* NavigationEditProvider, TabSwipeWrapper et BottomNav lisent
            usePathname(), inconnu au build sur les routes à paramètre
            dynamique (/objectifs/[id], /documents/[id]…) : seul cas où cette
            frontière s'active (chargement initial de ces routes). Partout
            ailleurs le chemin est connu au prérendu et tout reste dans la
            coquille statique. */}
        <Suspense fallback={null}>
          <NavigationEditProvider initialOrdreGrillePlus={ordreGrillePlus} initialModulesBarreBasse={modulesBarreBasse}>
            <TabSwipeWrapper>{children}</TabSwipeWrapper>
            <BottomNav />
            {/* Frontière propre : le minuteur de repos de SeanceFlottante lit
                Date.now() au rendu, valeur que Cache Components traite comme
                dynamique. Sans elle, la frontière ci-dessus devenait dynamique
                et la barre du bas comme toute la page sortaient du HTML
                statique (rendu seulement côté client, erreur React #419).
                SeanceFlottante rend null tant qu'aucune séance n'est lue. */}
            <Suspense fallback={null}>
              <SeanceFlottante />
            </Suspense>
            <BackNavigationHandler />
          </NavigationEditProvider>
        </Suspense>
      </div>
    </Providers>
  );
}
