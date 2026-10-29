import { notFound } from "next/navigation";
import { getDocument, getEtiquettes } from "@/app/actions/documents";
import { getCategories } from "@/app/actions/documents-categories";
import { DocumentDetail } from "./DocumentDetail";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [document, etiquettes, categories] = await Promise.all([getDocument(id), getEtiquettes(), getCategories()]);

  if (!document) {
    notFound();
  }

  return <DocumentDetail document={document} etiquettes={etiquettes} categories={categories.map((c) => c.nom)} />;
}
