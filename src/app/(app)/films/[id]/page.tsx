import { notFound } from "next/navigation";
import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getFiche } from "@/app/actions/films";
import { lireResultat } from "@/lib/films/lire";
import { queryKeys } from "@/lib/query/keys";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { FicheFilmView } from "./FicheFilmView";

// La fiche est préchargée côté serveur (TMDB en cache + statut dans la liste)
// puis relue côté client via TanStack Query.
export default async function FichePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: brut } = await params;
  const id = /^\d{1,9}$/.test(brut) ? Number(brut) : 0;
  if (id <= 0) notFound();

  await connection();
  const queryClient = makeServerQueryClient();
  await queryClient.prefetchQuery({ queryKey: queryKeys.filmsFiche(id), queryFn: () => lireResultat(getFiche(id)) });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FicheFilmView id={id} />
    </HydrationBoundary>
  );
}
