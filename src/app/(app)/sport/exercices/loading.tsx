import { screenTitle } from "@/lib/ui";
import { ExercicesSkeleton } from "./ExercicesSkeleton";

export default function ExercicesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Exercices</h1>
      <ExercicesSkeleton />
    </div>
  );
}
