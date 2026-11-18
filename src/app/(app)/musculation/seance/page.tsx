import { SeanceView } from "./SeanceView";

// Pas de `connection()` : la séance vit entièrement sur le téléphone (Dexie).
// La page est donc statique et s'ouvre sans aller-retour serveur, même avec un
// réseau très mauvais en salle.
export default function SeancePage() {
  return <SeanceView />;
}
