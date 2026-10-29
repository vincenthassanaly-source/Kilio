import { connection } from "next/server";
import { getCategoriesAvecCompte } from "@/app/actions/documents-categories";
import { BackLink } from "@/components/BackLink";
import { eyebrow, screenTitle } from "@/lib/ui";
import { CategoriesManager } from "./CategoriesManager";

export default async function CategoriesPage() {
  await connection();
  const categories = await getCategoriesAvecCompte();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className={eyebrow}>Documents</p>
        <h1 className={screenTitle}>Catégories</h1>
        <BackLink href="/documents">Documents</BackLink>
      </div>

      <CategoriesManager categories={categories} />
    </div>
  );
}
