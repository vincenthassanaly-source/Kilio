"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { enregistrerDocumentsVrac, preparerUploadsVrac } from "@/app/actions/documents-vrac";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { detecterFormat } from "@/lib/documents/detecterFormat";
import { televerserVersUrlSignee } from "@/lib/documents/televersement";
import { compresserImages } from "@/lib/images/compression";
import { lireFichiersEnAttente, oublierFichiersEnAttente } from "@/lib/partage/enAttente";
import { errorText, secondaryButton } from "@/lib/ui";

// Maximum d'une requête `preparerUploadsVrac` / `enregistrerDocumentsVrac`.
const TAILLE_LOT = 20;

type Pret = { fichier: File; type: "image" | "pdf"; mime: string; nomOriginal: string };

type Etat =
  | { phase: "envoi"; fait: number; total: number; message: string }
  | { phase: "erreur"; message: string };

function lots<T>(elements: T[], taille: number): T[][] {
  const resultat: T[][] = [];
  for (let i = 0; i < elements.length; i += taille) resultat.push(elements.slice(i, i + taille));
  return resultat;
}

async function preparer(fichiers: File[]): Promise<{ prets: Pret[]; ignores: number }> {
  const prets: Pret[] = [];
  let ignores = 0;
  for (const fichier of fichiers) {
    const octets = new Uint8Array(await fichier.slice(0, 12).arrayBuffer());
    const format = detecterFormat(fichier, octets);
    if (!format) {
      ignores += 1;
      continue;
    }
    if (format === "pdf") {
      prets.push({ fichier, type: "pdf", mime: "application/pdf", nomOriginal: fichier.name });
    } else {
      // Les images sont réduites côté client comme pour les autres destinations.
      const [compresse] = await compresserImages([fichier]);
      prets.push({ fichier: compresse, type: "image", mime: compresse.type || "image/jpeg", nomOriginal: fichier.name });
    }
  }
  return { prets, ignores };
}

/**
 * Destination « Documents (vrac) » du partage : les fichiers (photos, PDF) mis
 * de côté par le service worker partent directement vers le stockage par URL
 * signée (pas de plafond Vercel), puis deviennent des documents « en vrac » à
 * trier avec Gemini. Un « Réessayer » ne renvoie que les fichiers restants.
 */
export function EnvoiVersDocuments({ id, nb }: { id: string; nb: number }) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>({ phase: "envoi", fait: 0, total: nb, message: "Lecture des fichiers…" });
  const [essai, setEssai] = useState(0);
  // Survit aux « Réessayer » : fichiers pas encore enregistrés, et total de départ.
  const restantsRef = useRef<Pret[] | null>(null);
  const bilanRef = useRef({ total: 0, crees: 0, ignores: 0 });

  useEffect(() => {
    let annule = false;

    (async () => {
      try {
        if (restantsRef.current === null) {
          const fichiers = await lireFichiersEnAttente(id, nb);
          if (annule) return;
          if (fichiers.length === 0) {
            setEtat({ phase: "erreur", message: "Les fichiers partagés sont introuvables. Partage-les à nouveau." });
            return;
          }
          setEtat({ phase: "envoi", fait: 0, total: fichiers.length, message: "Préparation…" });
          const { prets, ignores } = await preparer(fichiers);
          if (annule) return;
          restantsRef.current = prets;
          bilanRef.current = { total: prets.length, crees: 0, ignores };
          if (prets.length === 0) {
            setEtat({ phase: "erreur", message: "Format de fichier non supporté (image ou PDF uniquement)." });
            return;
          }
        }

        const bilan = bilanRef.current;
        for (const lot of lots(restantsRef.current, TAILLE_LOT)) {
          if (annule) return;
          setEtat({ phase: "envoi", fait: bilan.crees, total: bilan.total, message: "Envoi…" });

          const preparation = await runAction(() => preparerUploadsVrac(lot.map((p) => p.type)), { silencieux: true });
          if (!preparation.ok) {
            setEtat({ phase: "erreur", message: preparation.error });
            return;
          }

          const envoyes: { pret: Pret; path: string }[] = [];
          let erreurEnvoi: string | null = null;
          for (const [index, pret] of lot.entries()) {
            if (annule) return;
            try {
              await televerserVersUrlSignee(preparation.data[index].signedUrl, pret.fichier, pret.mime);
              envoyes.push({ pret, path: preparation.data[index].path });
              setEtat({ phase: "envoi", fait: bilan.crees + envoyes.length, total: bilan.total, message: "Envoi…" });
            } catch (err) {
              erreurEnvoi = err instanceof Error ? err.message : "Envoi impossible.";
            }
          }

          if (envoyes.length > 0) {
            const enregistrement = await runAction(
              () => enregistrerDocumentsVrac(envoyes.map((e) => ({ path: e.path, nomOriginal: e.pret.nomOriginal }))),
              { silencieux: true }
            );
            if (!enregistrement.ok) {
              setEtat({ phase: "erreur", message: enregistrement.error });
              return;
            }
            bilan.crees += envoyes.length;
            const faits = new Set(envoyes.map((e) => e.pret));
            restantsRef.current = restantsRef.current.filter((p) => !faits.has(p));
          }
          if (erreurEnvoi) {
            const reste = restantsRef.current.length;
            setEtat({
              phase: "erreur",
              message: `${erreurEnvoi} ${reste} fichier${reste > 1 ? "s" : ""} non envoyé${reste > 1 ? "s" : ""}.`,
            });
            return;
          }
        }

        if (annule) return;
        await oublierFichiersEnAttente(id, nb).catch(() => {});
        const { crees, ignores } = bilanRef.current;
        showToast(
          `${crees} document${crees > 1 ? "s" : ""} ajouté${crees > 1 ? "s" : ""} au vrac` +
            (ignores > 0 ? ` (${ignores} fichier${ignores > 1 ? "s" : ""} ignoré${ignores > 1 ? "s" : ""})` : "")
        );
        router.push("/documents?vrac=1");
      } catch {
        if (!annule) setEtat({ phase: "erreur", message: "L'envoi a échoué. Réessaie." });
      }
    })();

    return () => {
      annule = true;
    };
    // `router` est stable ; seul `essai` relance volontairement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, nb, essai]);

  if (etat.phase === "erreur") {
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className={errorText}>{etat.message}</p>
        <button type="button" onClick={() => setEssai((n) => n + 1)} className={secondaryButton}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      <p className="text-sm text-ink" aria-live="polite">
        {etat.message} {etat.total > 0 && etat.message === "Envoi…" ? `${etat.fait} / ${etat.total}` : ""}
      </p>
      <div
        role="progressbar"
        aria-label="Progression de l'envoi"
        aria-valuemin={0}
        aria-valuemax={etat.total}
        aria-valuenow={etat.fait}
        className="h-2 overflow-hidden rounded-full bg-surface-alt"
      >
        <div
          className="h-full rounded-full bg-kcal transition-[width] duration-300 ease-out"
          style={{ width: `${etat.total === 0 ? 0 : (etat.fait / etat.total) * 100}%` }}
        />
      </div>
    </div>
  );
}
