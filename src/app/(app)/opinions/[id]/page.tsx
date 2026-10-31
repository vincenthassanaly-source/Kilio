import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { getIdee } from "@/app/actions/opinions";
import { IdeeView } from "./IdeeView";

// L'idée est préchargée côté serveur
// puis relue côté client via TanStack Query.
export default async function IdeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  const queryClient = makeServerQueryClient();
  await queryClient.prefetchQuery({ queryKey: queryKeys.opinionsIdee(id), queryFn: () => getIdee(id) });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <IdeeView id={id} />
    </HydrationBoundary>
  );
}
