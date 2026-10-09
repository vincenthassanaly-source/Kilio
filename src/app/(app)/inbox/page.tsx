import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getInboxItems } from "@/app/actions/inbox";
import { queryKeys } from "@/lib/query/keys";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { screenTitle } from "@/lib/ui";
import { getToday } from "../today";
import { InboxView } from "./InboxView";

// Shell serveur : la liste est préchargée puis hydratée côté client (même
// patron que /aujourdhui et /revue).
export default async function InboxPage() {
  const today = await getToday();
  const queryClient = makeServerQueryClient();
  await queryClient.prefetchQuery({ queryKey: queryKeys.inbox, queryFn: getInboxItems });

  return (
    <div className="flex flex-col gap-4">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <h1 className={screenTitle}>Inbox</h1>
        <InboxView today={today} />
      </HydrationBoundary>
    </div>
  );
}
