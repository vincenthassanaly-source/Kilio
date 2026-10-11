import { connection } from "next/server";
import { estUuid } from "@/lib/uuid";
import { SeanceView } from "./SeanceView";

// `?seance=<id>` : séance planifiée à démarrer (lien « Commencer » d'Aujourd'hui
// et du rappel push). Tout autre contenu est ignoré : l'id vient de l'URL.
export default async function SeancePage({ searchParams }: { searchParams: Promise<{ seance?: string | string[] }> }) {
  await connection();
  const { seance } = await searchParams;
  const id = typeof seance === "string" && estUuid(seance) ? seance : null;
  return <SeanceView seanceId={id} />;
}
