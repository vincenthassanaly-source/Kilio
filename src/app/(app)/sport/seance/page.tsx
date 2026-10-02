import { SeanceView } from "./SeanceView";

// Séance en direct : tout l'état vit sur le téléphone (Dexie, voir
// lib/sport/brouillon.ts), la page n'a donc aucune donnée serveur à attendre
// et reste utilisable sans réseau.
export default function SeancePage() {
  return <SeanceView />;
}
