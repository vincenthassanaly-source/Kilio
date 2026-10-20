import { Suspense } from "react";
import { notFound } from "next/navigation";
import { estJourValide } from "@/lib/vidage/jours";
import { getToday } from "../../today";
import { FeuilleChargement } from "../FeuilleChargement";
import { FeuilleView } from "../FeuilleView";
import { VerrouGate } from "../VerrouGate";

// Voir ../page.tsx : la transcription par Gemini dépasse les 10 s par défaut.
export const maxDuration = 60;

async function FeuilleDuJourChoisi({ params }: { params: Promise<{ jour: string }> }) {
  const { jour } = await params;
  if (!estJourValide(jour)) notFound();
  const aujourdhui = await getToday();
  return (
    <VerrouGate>
      <FeuilleView
        key={jour}
        jour={jour}
        aujourdhui={aujourdhui}
        retour={{ href: "/vider-ma-tete/calendrier", libelle: "Calendrier" }}
      />
    </VerrouGate>
  );
}

export default function VidageJourPage({ params }: { params: Promise<{ jour: string }> }) {
  return (
    <Suspense fallback={<FeuilleChargement />}>
      <FeuilleDuJourChoisi params={params} />
    </Suspense>
  );
}
