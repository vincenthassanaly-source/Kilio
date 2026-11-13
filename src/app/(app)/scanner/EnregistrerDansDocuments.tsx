"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { enregistrerDocumentsVrac, preparerUploadsVrac } from "@/app/actions/documents-vrac";
import { showActionToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { televerserVersUrlSignee } from "@/lib/documents/televersement";
import { errorText, secondaryButton } from "@/lib/ui";

const LIEN_DOCUMENTS = "/documents?vrac=1";

function abonnerConnexion(notifier: () => void) {
  window.addEventListener("online", notifier);
  window.addEventListener("offline", notifier);
  return () => {
    window.removeEventListener("online", notifier);
    window.removeEventListener("offline", notifier);
  };
}

type Etat = { phase: "repos" } | { phase: "envoi" } | { phase: "erreur"; message: string } | { phase: "fait" };

/**
 * « Enregistrer dans Documents » : envoie le PDF généré vers Documents par le
 * même chemin que le partage Android (URL signée, pas de plafond de 4 Mo des
 * Server Actions). Le document arrive « en vrac », nommé d'après le fichier,
 * sans catégorie : le tri se fait ensuite dans Documents. Le scan, lui, reste
 * local jusqu'à ce geste ; le brouillon n'est jamais vidé ici.
 */
export function EnregistrerDansDocuments({ fichier }: { fichier: File }) {
  const router = useRouter();
  const enLigne = useSyncExternalStore(
    abonnerConnexion,
    () => navigator.onLine,
    () => true
  );
  const [etat, setEtat] = useState<{ fichier: File; etat: Etat } | null>(null);
  // L'état n'a de sens que pour le fichier qui l'a produit : un nouveau PDF repart de zéro.
  const courant: Etat = etat && etat.fichier === fichier ? etat.etat : { phase: "repos" };
  const definir = (suivant: Etat) => setEtat({ fichier, etat: suivant });

  async function envoyer() {
    definir({ phase: "envoi" });
    try {
      const preparation = await runAction(() => preparerUploadsVrac(["pdf"]), { silencieux: true });
      if (!preparation.ok) {
        definir({ phase: "erreur", message: preparation.error });
        return;
      }
      const { signedUrl, path } = preparation.data[0];
      await televerserVersUrlSignee(signedUrl, fichier, "application/pdf");

      const enregistrement = await runAction(() => enregistrerDocumentsVrac([{ path, nomOriginal: fichier.name }]), {
        silencieux: true,
      });
      if (!enregistrement.ok) {
        definir({ phase: "erreur", message: enregistrement.error });
        return;
      }
      definir({ phase: "fait" });
      showActionToast("Scan enregistré dans Documents", {
        label: "Voir dans Documents",
        onAction: () => router.push(LIEN_DOCUMENTS),
      });
    } catch (err) {
      definir({ phase: "erreur", message: err instanceof Error ? err.message : "L'envoi a échoué. Réessaie." });
    }
  }

  const envoiEnCours = courant.phase === "envoi";
  const libelle = envoiEnCours
    ? "Envoi vers Documents…"
    : courant.phase === "fait"
      ? "Enregistré dans Documents"
      : courant.phase === "erreur"
        ? "Réessayer l'envoi vers Documents"
        : "Enregistrer dans Documents";

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        className={secondaryButton}
        onClick={envoyer}
        disabled={!enLigne || envoiEnCours || courant.phase === "fait"}
        aria-describedby="scanner-documents-aide"
      >
        {libelle}
      </button>
      <p id="scanner-documents-aide" className="text-xs text-ink-3">
        {!enLigne
          ? "Hors connexion : Partager et Télécharger restent disponibles, pas l'envoi vers Documents."
          : courant.phase === "fait"
            ? "Le document est dans le vrac de Documents, à trier. Ton brouillon est conservé."
            : "Envoie le PDF dans Documents (en vrac, sans catégorie). Le scan reste sur cet appareil tant que tu n'appuies pas."}
      </p>
      {courant.phase === "fait" && (
        <button type="button" className={secondaryButton} onClick={() => router.push(LIEN_DOCUMENTS)}>
          Voir dans Documents
        </button>
      )}
      {courant.phase === "erreur" && (
        <p role="alert" className={errorText}>
          {courant.message}
        </p>
      )}
    </div>
  );
}
