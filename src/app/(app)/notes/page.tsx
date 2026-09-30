import { Suspense } from "react";
import { NotesGrid } from "./NotesGrid";
import { screenTitle } from "@/lib/ui";

type NotesSearchParams = Promise<{ action?: string; tag?: string }>;

// La lecture de `searchParams` (API dynamique) est isolée dans
// `NotesGridAvecAction`, sous <Suspense>, pour que la coquille statique
// (titre + NotesGrid dans son état par défaut) reste prérendue et servie
// instantanément : seule l'ouverture automatique du formulaire pour
// `?action=new` attend la requête (voir audit navigation, §"?action=new").
export default function NotesPage({ searchParams }: { searchParams: NotesSearchParams }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Notes</h1>
      <Suspense fallback={<NotesGrid />}>
        <NotesGridAvecAction searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NotesGridAvecAction({ searchParams }: { searchParams: NotesSearchParams }) {
  const { action, tag } = await searchParams;
  return <NotesGrid defaultOpen={action === "new"} defaultTag={tag} />;
}
