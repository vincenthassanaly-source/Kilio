"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { msAvantMinuitParis } from "@/lib/date/paris";

// Quand l'app repasse au premier plan (retour depuis l'arrière-plan sur mobile,
// restauration bfcache du navigateur), aucune navigation ni fetch RSC n'a lieu :
// React réaffiche simplement l'arbre déjà en mémoire. Si des données ont changé
// pendant que l'app était en arrière-plan (ex: écriture directe en base par une
// session Claude Code, sans passer par une Server Action de ce site qui
// déclencherait un revalidatePath), rien ne les rafraîchit sans ce listener.
// En dessous de cette absence, le retour au premier plan ne rafraîchit pas.
const ABSENCE_MIN_MS = 30_000;

export function AppResumeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();

    // Instant où l'app est passée en arrière-plan (null : on ne l'a pas vue
    // partir). Une absence courte (notification consultée, changement d'app)
    // ne relance pas tous les rendus serveur de la page : sur mobile, chaque
    // retour déclenchait sinon un rechargement complet.
    let masqueDepuis: number | null = null;
    const absenceCourte = () => masqueDepuis !== null && Date.now() - masqueDepuis < ABSENCE_MIN_MS;

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        masqueDepuis = Date.now();
        return;
      }
      // `masqueDepuis` reste posé : après une restauration bfcache, `pageshow`
      // et `visibilitychange` arrivent dans un ordre variable et jugent la
      // même absence.
      if (!absenceCourte()) refresh();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !absenceCourte()) refresh();
    };

    // App restée ouverte au premier plan à minuit (heure de Paris) : sans
    // ce minuteur, « aujourd'hui » (dashboard, Journal, Habitudes) resterait
    // la veille jusqu'au prochain retour de l'arrière-plan (constat T3).
    let minuteur: number | undefined;
    const programmerMinuit = () => {
      minuteur = window.setTimeout(() => {
        refresh();
        programmerMinuit();
      }, msAvantMinuitParis() + 2000);
    };
    programmerMinuit();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.clearTimeout(minuteur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
