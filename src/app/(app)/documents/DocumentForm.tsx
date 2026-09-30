"use client";

import { useId, useActionState, useEffect, useMemo, useRef, useState, startTransition } from "react";
import Image from "next/image";
import {
  createDocument,
  deleteDocumentFichier,
  updateDocument,
  type DocumentAvecFichiers,
  type DocumentFormState,
} from "@/app/actions/documents";
import type { Tables } from "@/lib/supabase/types";
import { errorText, input, label as labelClass, primaryButton } from "@/lib/ui";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { MESSAGE_HORS_LIGNE, estErreurReseau } from "@/lib/actions/runAction";
import { estPdf, genererApercuPdf } from "@/lib/pdf/apercuPdf";
import { ErreurLectureFichier, TAILLE_MAX_REQUETE_OCTETS, compresserFormData, formatTaille } from "@/lib/images/compression";

const initialState: DocumentFormState = { error: null };

// Ajoute au FormData l'aperçu (1re page, JPEG) de chaque PDF, sous les noms
// lus par uploadDocumentFichiers : `apercu:fichier_recto|verso`, et
// `apercu:fichiers:<n>` pour le n-ième fichier non vide de « fichiers ». Un
// rendu impossible n'ajoute rien : le PDF part quand même, avec son icône.
async function ajouterApercusPdf(formData: FormData) {
  async function ajouter(fichier: File, nom: string) {
    if (!(await estPdf(fichier))) return;
    const apercu = await genererApercuPdf(fichier);
    if (apercu) formData.append(nom, apercu, "apercu.jpg");
  }
  for (const champ of ["fichier_recto", "fichier_verso"]) {
    const fichier = formData.get(champ);
    if (fichier instanceof File && fichier.size > 0) await ajouter(fichier, `apercu:${champ}`);
  }
  const fichiers = formData.getAll("fichiers").filter((f): f is File => f instanceof File && f.size > 0);
  for (const [index, fichier] of fichiers.entries()) await ajouter(fichier, `apercu:fichiers:${index}`);
}

const CATEGORIES = ["Identité", "Véhicule", "Logement", "Santé", "Assurance", "Autre"] as const;

function FichierIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M3.8 16.5l5-5a1.8 1.8 0 0 1 2.5 0l3.4 3.4M14.5 12.7l1.4-1.4a1.8 1.8 0 0 1 2.5 0l2.4 2.4" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5h9l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z" />
      <path d="M9 13h6M9 16.5h4" />
    </svg>
  );
}

function FichierThumb({
  src,
  estImage,
  onRemove,
  removeLabel,
  disabled,
}: {
  src: string;
  estImage: boolean;
  onRemove: () => void;
  removeLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative h-14 w-14 shrink-0">
      {estImage ? (
        <Image
          src={src}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 rounded-2xl border border-line object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-alt text-ink-2">
          <PdfIcon />
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={removeLabel}
        // Zone de tap de 44 px centrée sur la pastille visible de 20 px.
        className="group absolute -right-3.5 -top-3.5 flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-60 focus-visible:outline-none"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-alert text-[11px] font-bold text-on-accent group-focus-visible:ring-2 group-focus-visible:ring-kcal group-focus-visible:ring-offset-2">
          ×
        </span>
      </button>
    </div>
  );
}

// Un emplacement de fichier dédié (Recto ou Verso), pour les étiquettes de
// type "recto_verso". L'input file reste toujours monté (avec son `name`)
// pour faire partie du FormData soumis, seul son affichage change selon
// qu'un fichier existant, une sélection locale en attente, ou rien n'est
// présent.
function RectoVersoSlot({
  label,
  name,
  existing,
  onRemoveExisting,
}: {
  label: string;
  name: "fichier_recto" | "fichier_verso";
  existing: Tables<"document_fichiers"> | null;
  onRemoveExisting: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function removeSelection() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        id={name}
        name={name}
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {existing ? (
        <FichierThumb
          src={existing.url}
          estImage={existing.fichier_type === "image"}
          onRemove={onRemoveExisting}
          removeLabel={`Supprimer le ${label.toLowerCase()}`}
        />
      ) : file && preview ? (
        <FichierThumb
          src={preview}
          estImage={file.type.startsWith("image/")}
          onRemove={removeSelection}
          removeLabel={`Retirer le ${label.toLowerCase()}`}
        />
      ) : (
        <label
          htmlFor={name}
          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl border-[1.5px] border-dashed border-line text-ink-2 transition-colors hover:bg-surface-alt"
          aria-label={`Ajouter le ${label.toLowerCase()}`}
        >
          <FichierIcon />
        </label>
      )}
      <span className="text-xs text-ink-3">{label}</span>
    </div>
  );
}

export function DocumentForm({
  document,
  etiquettes,
  onDone,
}: {
  document?: DocumentAvecFichiers;
  etiquettes: Tables<"etiquettes">[];
  onDone?: () => void;
}) {
  // Ids uniques par instance (T11) : formulaire rendu en ajout et en édition.
  const uid = useId();
  const action = document ? updateDocument : createDocument;
  // Photos compressées côté client avant l'envoi (vague 1, point
  // « uploads ») : recto + verso bruts dépassaient le plafond de 4 Mo des
  // Server Actions (requête rejetée, error boundary). Contrat T1 : toute
  // exception devient un message dans le formulaire, la saisie reste.
  const [state, formAction, pending] = useActionState<DocumentFormState, FormData>(async (precedent, formData) => {
    try {
      const taille = await compresserFormData(formData, ["fichiers", "fichier_recto", "fichier_verso"]);
      if (taille > TAILLE_MAX_REQUETE_OCTETS) {
        return {
          error: `Fichiers trop lourds (${formatTaille(taille)}, maximum ${formatTaille(TAILLE_MAX_REQUETE_OCTETS)} par envoi) : ajoute-les en plusieurs fois, ou réduis la taille des PDF.`,
        };
      }
      await ajouterApercusPdf(formData);
      return await action(precedent, formData);
    } catch (err) {
      console.error("Échec de l'enregistrement du document", err);
      // « Failed to fetch » / « Load failed » surviennent aussi en ligne
      // (requête rejetée ou coupée, souvent à cause du poids des photos) :
      // on n'annonce « hors ligne » que si le navigateur l'est vraiment.
      if (err instanceof ErreurLectureFichier) return { error: err.message };
      const horsLigne = typeof navigator !== "undefined" && navigator.onLine === false;
      // Détail technique ajouté au message : sans accès à la console du
      // téléphone, c'est le seul moyen de connaître la vraie cause.
      const detail = err instanceof Error ? ` (${err.name} : ${err.message})` : "";
      return {
        error: horsLigne
          ? MESSAGE_HORS_LIGNE
          : estErreurReseau(err)
            ? `L'envoi a échoué alors que tu es en ligne : fichiers trop lourds ou connexion instable. Réessaie avec des photos plus légères.${detail}`
            : `L'enregistrement du document a échoué. Réessaie.${detail}`,
      };
    }
  }, initialState);
  const prevPending = useRef(pending);
  const erreurRef = useRef<HTMLParagraphElement>(null);

  const [etiquetteId, setEtiquetteId] = useState(document?.etiquette?.id ?? "");
  const typeChamps = etiquettes.find((e) => e.id === etiquetteId)?.type_champs ?? "standard";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const previews = useMemo(() => selectedFiles.map((file) => URL.createObjectURL(file)), [selectedFiles]);
  const [existingFichiers, setExistingFichiers] = useState<Tables<"document_fichiers">[]>(
    document?.fichiers ?? []
  );
  const [fichiersMasques, setFichiersMasques] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      onDone?.();
    }
    prevPending.current = pending;
  }, [pending, state.error, onDone]);

  // Le message d'erreur apparaît au-dessus du bouton, sous la barre de
  // navigation fixe : on le ramène dans la zone visible.
  useEffect(() => {
    if (state.error) erreurRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state]);

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(e.target.files ?? []));
  }

  function removeSelectedFile(index: number) {
    const next = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(next);
    // Reconstruit le FileList de l'input à partir du tableau filtré : un
    // FileList n'est pas modifiable directement, DataTransfer est le
    // mécanisme standard pour repasser une sélection modifiée à l'input.
    const dataTransfer = new DataTransfer();
    next.forEach((file) => dataTransfer.items.add(file));
    if (fileInputRef.current) fileInputRef.current.files = dataTransfer.files;
  }

  // Suppression d'un fichier existant : masqué tout de suite, toast
  // « Annuler », retrait du Storage seulement à l'expiration du délai
  // (constat T2 : le × supprimait définitivement en un tap). Contrat T1 :
  // un échec réaffiche le fichier avec un toast, jamais error.tsx.
  function removeExistingFichier(fichier: Tables<"document_fichiers">) {
    const libelle = fichier.role === "recto" ? "Recto" : fichier.role === "verso" ? "Verso" : "Fichier";
    supprimerAvecAnnulation({
      texte: `${libelle} supprimé`,
      ariaLabel: `Annuler la suppression du ${libelle.toLowerCase()}`,
      masquer: () => setFichiersMasques((m) => new Set(m).add(fichier.id)),
      restaurer: () =>
        setFichiersMasques((m) => {
          const suivant = new Set(m);
          suivant.delete(fichier.id);
          return suivant;
        }),
      supprimer: () => deleteDocumentFichier(fichier.id),
      erreur: `Impossible de supprimer le ${libelle.toLowerCase()}. Réessaie.`,
      onSupprime: () => setExistingFichiers((fs) => fs.filter((f) => f.id !== fichier.id)),
    });
  }

  const fichiersVisibles = existingFichiers.filter((f) => !fichiersMasques.has(f.id));
  const existingRecto = fichiersVisibles.find((f) => f.role === "recto") ?? null;
  const existingVerso = fichiersVisibles.find((f) => f.role === "verso") ?? null;
  // Fichiers "orphelins" d'un rôle recto/verso si l'étiquette a été changée
  // après coup : gardés visibles (pas perdus) via la liste générique.
  const existingHorsRectoVerso = fichiersVisibles.filter((f) => f.role !== "recto" && f.role !== "verso");

  const aucunFichier =
    !document && fichiersVisibles.length === 0 && selectedFiles.length === 0 && !existingRecto && !existingVerso;

  return (
    <form
      // Pas de `action={formAction}` : React 19 remet à zéro un formulaire à
      // action après CHAQUE soumission, erreur comprise, ce qui effaçait la
      // saisie et les fichiers après un échec. Le `onSubmit` conserve les
      // champs ; la validation native (`required`) s'applique toujours.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-3"
    >
      {document && <input type="hidden" name="id" value={document.id} />}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-nom`} className={labelClass}>
          Nom
        </label>
        <input id={`${uid}-nom`} name="nom" required defaultValue={document?.nom} className={input} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-etiquette_id`} className={labelClass}>
          Étiquette (optionnel)
        </label>
        <select
          id={`${uid}-etiquette_id`}
          name="etiquette_id"
          value={etiquetteId}
          onChange={(e) => setEtiquetteId(e.target.value)}
          className={input}
        >
          <option value="">—</option>
          {etiquettes.map((etiquette) => (
            <option key={etiquette.id} value={etiquette.id}>
              {etiquette.nom}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={`${uid}-categorie`} className={labelClass}>
            Catégorie (optionnel)
          </label>
          <select id={`${uid}-categorie`} name="categorie" defaultValue={document?.categorie ?? ""} className={input}>
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={`${uid}-date_echeance`} className={labelClass}>
            Échéance (optionnel)
          </label>
          <input
            id={`${uid}-date_echeance`}
            name="date_echeance"
            type="date"
            defaultValue={document?.date_echeance ?? ""}
            className={`${input} w-full min-w-0`}
          />
        </div>
      </div>

      {typeChamps === "periode_mensuelle" && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-periode_mois`} className={labelClass}>
            Mois concerné
          </label>
          <input
            id={`${uid}-periode_mois`}
            name="periode_mois"
            type="month"
            defaultValue={document?.periode_mois ? document.periode_mois.slice(0, 7) : ""}
            className={input}
          />
        </div>
      )}

      {typeChamps === "recto_verso" ? (
        <div className="flex flex-col gap-1">
          <span className={labelClass}>Recto / Verso</span>
          <div className="flex flex-wrap items-start gap-4">
            <RectoVersoSlot
              label="Recto"
              name="fichier_recto"
              existing={existingRecto}
              onRemoveExisting={() => removeExistingFichier(existingRecto!)}
            />
            <RectoVersoSlot
              label="Verso"
              name="fichier_verso"
              existing={existingVerso}
              onRemoveExisting={() => removeExistingFichier(existingVerso!)}
            />
          </div>
          {existingHorsRectoVerso.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {existingHorsRectoVerso.map((fichier) => (
                <FichierThumb
                  key={fichier.id}
                  src={fichier.url}
                  estImage={fichier.fichier_type === "image"}
                  onRemove={() => removeExistingFichier(fichier)}
                  removeLabel="Supprimer ce fichier"
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span className={labelClass}>
            {document ? "Fichiers (photos ou PDF)" : "Fichiers (photos ou PDF)"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={`${uid}-document-fichiers`}
              className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-2xl border-[1.5px] border-dashed border-line text-ink-2 transition-colors hover:bg-surface-alt"
              aria-label="Ajouter des fichiers"
            >
              <FichierIcon />
            </label>
            <input
              ref={fileInputRef}
              type="file"
              id={`${uid}-document-fichiers`}
              name="fichiers"
              accept="image/*,application/pdf"
              multiple
              required={aucunFichier}
              className="hidden"
              onChange={handleFilesChange}
            />

            {fichiersVisibles.map((fichier) => (
              <FichierThumb
                key={fichier.id}
                src={fichier.url}
                estImage={fichier.fichier_type === "image"}
                onRemove={() => removeExistingFichier(fichier)}
                removeLabel="Supprimer ce fichier"
              />
            ))}

            {selectedFiles.map(
              (file, index) =>
                previews[index] && (
                  <FichierThumb
                    key={`${file.name}-${index}`}
                    src={previews[index]}
                    estImage={file.type.startsWith("image/")}
                    onRemove={() => removeSelectedFile(index)}
                    removeLabel="Retirer ce fichier de la sélection"
                  />
                )
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-notes`} className={labelClass}>
          Notes (optionnel)
        </label>
        <textarea id={`${uid}-notes`} name="notes" rows={3} defaultValue={document?.notes ?? ""} className={input} />
      </div>

      {state.error && (
        <p ref={erreurRef} className={errorText} role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Enregistrement..." : document ? "Enregistrer" : "Ajouter le document"}
      </button>
    </form>
  );
}
