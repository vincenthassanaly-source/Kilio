import { Suspense } from "react";
import { notFound } from "next/navigation";
import { estJourValide } from "@/lib/vidage/jours";
import { getToday } from "../../today";
import { FeuilleChargement } from "../FeuilleChargement";
import { FeuilleView } from "../FeuilleView";

async function FeuilleDuJourChoisi({ params }: { params: Promise<{ jour: string }> }) {
  const { jour } = await params;
  if (!estJourValide(jour)) notFound();
  const aujourdhui = await getToday();
  return (
    <FeuilleView
      key={jour}
      jour={jour}
      aujourdhui={aujourdhui}
      retour={{ href: "/vider-ma-tete/calendrier", libelle: "Calendrier" }}
    />
  );
}

export default function VidageJourPage({ params }: { params: Promise<{ jour: string }> }) {
  return (
    <Suspense fallback={<FeuilleChargement />}>
      <FeuilleDuJourChoisi params={params} />
    </Suspense>
  );
}
