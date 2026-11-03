"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { PageBrouillon } from "@/lib/scanner/brouillon";
import { genererPdf, PARAMS_QUALITE, type QualitePdf } from "@/lib/scanner/pdf";
import { nomFichierSur, nomsPagesJpeg, partager, peutPartager, telecharger, telechargerTous } from "@/lib/scanner/partage";
import { jpegPourExport } from "@/lib/scanner/traitement";
import { card, errorText, input, label, primaryButton, secondaryButton, sectionTitle } from "@/lib/ui";

type Format = "pdf" | "jpeg";

function nomParDefaut(): string {
  const d = new Date();
  const jour = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  return `Scan ${jour}`;
}

/** Réglages d'export, génération locale puis partage / téléchargement. */
export function ExportPanel({ pages, onVider }: { pages: PageBrouillon[]; onVider: () => Promise<void> }) {
  const [nom, setNom] = useState(nomParDefaut);
  const [format, setFormat] = useState<Format>("pdf");
  const [qualite, setQualite] = useState<QualitePdf>("standard");
  const [fichiers, setFichiers] = useState<File[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmerVidage, setConfirmerVidage] = useState(false);
  const [videEnCours, setVideEnCours] = useState(false);

  // Tout changement de réglage invalide les fichiers déjà prêts.
  function modifier<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setFichiers(null);
    };
  }

  async function generer() {
    setEnCours(true);
    setErreur(null);
    try {
      const { coteMax, jpeg } = PARAMS_QUALITE[qualite];
      const jpegs: Uint8Array[] = [];
      for (const p of pages) jpegs.push(await jpegPourExport(p.traite, coteMax, jpeg));
      if (format === "pdf") {
        const octets = await genererPdf(jpegs, nom.trim() || undefined);
        setFichiers([new File([octets as BlobPart], nomFichierSur(nom, "pdf"), { type: "application/pdf" })]);
      } else {
        const noms = nomsPagesJpeg(nom, jpegs.length);
        setFichiers(jpegs.map((octets, i) => new File([octets as BlobPart], noms[i], { type: "image/jpeg" })));
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "La génération a échoué.");
    } finally {
      setEnCours(false);
    }
  }

  async function envoyer() {
    if (!fichiers) return;
    setErreur(null);
    try {
      await partager(fichiers, nom.trim() || "Scan");
    } catch {
      setErreur("Le partage a échoué : utilise « Télécharger ».");
    }
  }

  async function telechargerFichiers() {
    if (!fichiers) return;
    if (fichiers.length === 1) telecharger(fichiers[0]);
    else await telechargerTous(fichiers);
  }

  async function vider() {
    setVideEnCours(true);
    try {
      await onVider();
      setFichiers(null);
      setConfirmerVidage(false);
    } finally {
      setVideEnCours(false);
    }
  }

  const partageDispo = fichiers !== null && peutPartager(fichiers);
  const pluriel = pages.length > 1 ? "s" : "";

  return (
    <section className={`${card} flex flex-col gap-4`} aria-label="Exporter">
      <h2 className={sectionTitle}>Exporter</h2>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="scanner-nom" className={label}>Nom du fichier</label>
        <input id="scanner-nom" className={input} value={nom} onChange={(e) => modifier(setNom)(e.target.value)} maxLength={80} />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className={label}>Format</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["pdf", "PDF"], ["jpeg", "Images JPEG"]] as const).map(([valeur, texte]) => (
            <button
              key={valeur}
              type="button"
              aria-pressed={format === valeur}
              onClick={() => modifier(setFormat)(valeur)}
              className={format === valeur ? primaryButton : secondaryButton}
            >
              {texte}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className={label}>Qualité</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["standard", "Standard"], ["elevee", "Élevée"]] as const).map(([valeur, texte]) => (
            <button
              key={valeur}
              type="button"
              aria-pressed={qualite === valeur}
              onClick={() => modifier(setQualite)(valeur)}
              className={qualite === valeur ? primaryButton : secondaryButton}
            >
              {texte}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-3">Élevée donne des fichiers plus lourds et plus nets.</p>
      </fieldset>

      {!fichiers ? (
        <button type="button" className={primaryButton} onClick={generer} disabled={enCours || pages.length === 0}>
          {enCours
            ? "Génération…"
            : format === "pdf"
              ? `Créer le PDF (${pages.length} page${pluriel})`
              : `Créer ${pages.length} image${pluriel}`}
        </button>
      ) : (
        <div className="flex flex-col gap-2" role="status">
          <p className="text-sm text-ink-2">
            {fichiers.length === 1
              ? `${fichiers[0].name} · ${(fichiers[0].size / 1024 / 1024).toFixed(2)} Mo`
              : `${fichiers.length} images prêtes`}
          </p>
          {partageDispo && (
            <button type="button" className={primaryButton} onClick={envoyer}>
              Partager / enregistrer
            </button>
          )}
          <button type="button" className={partageDispo ? secondaryButton : primaryButton} onClick={telechargerFichiers}>
            Télécharger
          </button>
          <button type="button" className={secondaryButton} onClick={() => setConfirmerVidage(true)}>
            Vider le brouillon
          </button>
        </div>
      )}

      {erreur && <p role="alert" className={errorText}>{erreur}</p>}

      <ConfirmDialog
        open={confirmerVidage}
        titre="Vider le brouillon ?"
        confirmer={`Supprimer ${pages.length} page${pluriel}`}
        enCours={videEnCours}
        onConfirm={vider}
        onClose={() => setConfirmerVidage(false)}
      >
        Les pages scannées seront effacées de cet appareil. Assure-toi d&apos;avoir enregistré le fichier exporté : rien n&apos;est stocké en ligne.
      </ConfirmDialog>
    </section>
  );
}
