import { screenTitle } from "@/lib/ui";
import { SportSkeleton } from "./SportAccueil";

export default function SportLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Sport</h1>
      <SportSkeleton />
    </div>
  );
}
