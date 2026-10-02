"use client";

import { use } from "react";
import { RoutineEditeur } from "./RoutineEditeur";

// Shell client (même patron que /objectifs/[id]) : « nouvelle » crée une
// routine, un uuid modifie celle qui existe.
export default function RoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RoutineEditeur id={id} />;
}
