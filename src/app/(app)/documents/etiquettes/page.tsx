import { connection } from "next/server";
import { getEtiquettes } from "@/app/actions/documents";
import { eyebrow, screenTitle } from "@/lib/ui";
import { AddEtiquetteToggle } from "./AddEtiquetteToggle";
import { EtiquettesManager } from "./EtiquettesManager";
import { BackLink } from "@/components/BackLink";

export default async function EtiquettesPage() {
  await connection();
  const etiquettes = await getEtiquettes();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className={eyebrow}>Documents</p>
        <h1 className={screenTitle}>Étiquettes</h1>
        <BackLink href="/documents">Documents</BackLink>
      </div>

      <AddEtiquetteToggle />
      <EtiquettesManager etiquettes={etiquettes} />
    </div>
  );
}
