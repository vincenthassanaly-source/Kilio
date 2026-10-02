import { connection } from "next/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeServerQueryClient } from "@/lib/query/server-client";
import { queryKeys } from "@/lib/query/keys";
import { getCoursesItemsEnCache } from "@/lib/courses/cache";
import { CoursesView } from "./CoursesView";
import { screenTitle } from "@/lib/ui";

// Server Component async : précharge `courses` côté serveur (voir
// DashboardTachesCard.tsx pour le patron), hydraté avant que CoursesView ne
// prenne le relais côté client.
export default async function CoursesPage() {
  await connection();
  const queryClient = makeServerQueryClient();
  await queryClient.prefetchQuery({ queryKey: queryKeys.courses, queryFn: getCoursesItemsEnCache });

  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Courses</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CoursesView />
      </HydrationBoundary>
    </div>
  );
}
