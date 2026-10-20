import { Suspense } from "react";
import { getToday } from "../today";
import { FeuilleChargement } from "./FeuilleChargement";
import { FeuilleView } from "./FeuilleView";

// Les Server Actions de la feuille s'exécutent avec la durée de cette page : la
// transcription par Gemini (plusieurs images) dépasse les 10 s par défaut.
export const maxDuration = 60;

// Le jour est une donnée de requête : lu sous Suspense, jamais figé dans la
// coquille statique (voir ../today.ts).
async function FeuilleDuJour() {
  const jour = await getToday();
  return <FeuilleView key={jour} jour={jour} aujourdhui={jour} retour={{ href: "/plus", libelle: "Plus" }} />;
}

export default function VidagePage() {
  return (
    <Suspense fallback={<FeuilleChargement />}>
      <FeuilleDuJour />
    </Suspense>
  );
}
