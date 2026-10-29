import { connection } from "next/server";
import { getDocuments } from "@/app/actions/documents";
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
  searchParams: Promise<{ vrac?: string; categorie?: string | string[] }>;
}) {
  await connection();
  const { vrac, categorie } = await searchParams;
  const [documents, categories] = await Promise.all([getDocuments(), getCategories()]);
  // `?categorie=Santé` (lien depuis l'écran Catégories) présélectionne le filtre.
  const categoriesInitiales = categorie === undefined ? [] : Array.isArray(categorie) ? categorie : [categorie];

  return (
    <PullToRefresh>
      <div className="flex flex-col gap-4">
        <h1 className={screenTitle}>Documents</h1>
        <DocumentsBrowser
          documents={documents}
          categories={categories.map((c) => c.nom)}
          vracInitial={vrac === "1"}
          categoriesInitiales={categoriesInitiales}
        />
      </div>
    </PullToRefresh>
  );
}
