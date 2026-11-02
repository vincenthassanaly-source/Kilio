import { notFound } from "next/navigation";
import { getDocument } from "@/app/actions/documents";
import { getCategories } from "@/app/actions/documents-categories";
import { DocumentDetail } from "./DocumentDetail";

// La description d'un document (Gemini) est calculée par une Server Action
// appelée depuis cette page : elle hérite de cette durée maximale.
export const maxDuration = 60;

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [document, categories] = await Promise.all([getDocument(id), getCategories()]);

  if (!document) {
    notFound();
  }

  return <DocumentDetail document={document} categories={categories.map((c) => c.nom)} />;
}
