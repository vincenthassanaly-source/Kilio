import { connection } from "next/server";
import { getDocuments, getEtiquettes } from "@/app/actions/documents";
import { getCategories } from "@/app/actions/documents-categories";
import { screenTitle } from "@/lib/ui";
import { DocumentsBrowser } from "./DocumentsBrowser";
import { PullToRefresh } from "@/components/PullToRefresh";

// Le tri du vrac appelle Gemini une fois par document (téléchargement du
// fichier + analyse) : jusqu'à 40 s par appel, au-delà du plafond par défaut.
export const maxDuration = 60;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ vrac?: string }>;
}) {
  await connection();
  const { vrac } = await searchParams;
  const [documents, etiquettes, categories] = await Promise.all([
    getDocuments(),
    getEtiquettes(),
    getCategories(),
  ]);

  return (
    <PullToRefresh>
      <div className="flex flex-col gap-4">
        <h1 className={screenTitle}>Documents</h1>
        <DocumentsBrowser
          documents={documents}
          etiquettes={etiquettes}
          categories={categories.map((c) => c.nom)}
          vracInitial={vrac === "1"}
        />
      </div>
    </PullToRefresh>
  );
}
