import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { getObjectif } from "@/app/actions/objectifs";
import { ObjectifDetailView } from "./ObjectifDetailView";

// Server Component async : précharge côté serveur (même patron que
// objectifs/page.tsx), hydraté avant que ObjectifDetailView ne prenne le relais côté
// client. Évite l'aller-retour Server Action déclenché après hydratation.
export default async function ObjectifDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connection();
  const queryClient = makeServerQueryClient();
  await queryClient.prefetchQuery({ queryKey: queryKeys.objectif(id), queryFn: () => getObjectif(id) });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ObjectifDetailView id={id} />
    </HydrationBoundary>
  );
}
