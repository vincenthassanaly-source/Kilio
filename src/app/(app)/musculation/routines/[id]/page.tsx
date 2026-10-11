import { connection } from "next/server";
import { estUuid } from "@/lib/uuid";
import { RoutineEditeur } from "./RoutineEditeur";

// `/musculation/routines/nouvelle` crée une routine ; `/musculation/routines/<uuid>` la modifie.
export default async function RoutinePage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  return <RoutineEditeur routineId={estUuid(id) ? id : null} />;
}
