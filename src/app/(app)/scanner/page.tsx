import { screenTitle } from "@/lib/ui";
import { ScannerApp } from "./ScannerApp";

// Page entièrement statique : le scanner travaille uniquement dans le
// navigateur (caméra, canvas, IndexedDB). Aucune donnée serveur.
export default function ScannerPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Scanner</h1>
      <ScannerApp />
    </div>
  );
}
