"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { analyserDocumentVrac, appliquerTriVrac } from "@/app/actions/documents-vrac";
import type { DocumentAvecFichiers } from "@/app/actions/documents";
import { Modal } from "@/components/Modal";
import { showErrorToast, showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { CATEGORIE_MAX, NOM_MAX } from "@/lib/documents/tri";
import { errorText, input, primaryButton, secondaryButton } from "@/lib/ui";

type Ligne = {
  id: string;
  document: DocumentAvecFichiers;
  /** Nom éditable, proposé par Gemini. */
  nom: string;
  categorie: string | null;
  coche: boolean;
  /** Analyse impossible : le document reste en vrac. */
  erreur: string | null;
};

type Etape = "analyse" | "apercu" | "application";

function PdfIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3.5h9l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z" />
      <path d="M9 13h6M9 16.5h4" />
    </svg>
  );
}

function Miniature({ document }: { document: DocumentAvecFichiers }) {
  const premier = document.fichiers[0] ?? null;
  const src = premier ? (premier.fichier_type === "image" ? premier.url : premier.apercu_url) : null;
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-alt text-ink-2">
      {src ? (
        <Image src={src} alt="" width={48} height={48} className="h-full w-full object-cover object-top" />
      ) : (
        <PdfIcon />
      )}
    </div>
  );
}

function pluriel(n: number, mot: string) {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

/**
 * Tri du vrac par Gemini : analyse un lot de documents (un appel serveur par
 * document, pour afficher la progression et isoler les échecs), montre les
 * propositions (nom et catégorie modifiables, case à décocher), puis
 * n'applique que ce qui est validé. Rien n'est écrit avant « Appliquer ».
 */
export function TriVracModal({
  lot,
  categories,
  onClose,
  onIgnores,
}: {
  /** Documents à analyser (déjà limités à la taille d'un lot). */
  lot: DocumentAvecFichiers[];
  categories: string[];
  onClose: () => void;
  /** Documents restés en vrac (échec ou décochés) : le prochain tri passe aux suivants. */
  onIgnores: (ids: string[]) => void;
}) {
  const [etape, setEtape] = useState<Etape>("analyse");
  const [analyses, setAnalyses] = useState(0);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [erreurApplication, setErreurApplication] = useState<string | null>(null);
  const arret = useRef(false);

  useEffect(() => {
    arret.current = false;
    const nouvelles: string[] = [];
    (async () => {
      const resultats: Ligne[] = [];
      for (const [index, document] of lot.entries()) {
        if (arret.current) return;
        const resultat = await runAction(() => analyserDocumentVrac(document.id, nouvelles), {
          silencieux: true,
        });
        if (arret.current) return;
        if (!resultat.ok) {
          resultats.push({ id: document.id, document, nom: document.nom, categorie: null, coche: false, erreur: resultat.error });
        } else if (!resultat.data.ok) {
          resultats.push({ id: document.id, document, nom: document.nom, categorie: null, coche: false, erreur: resultat.data.erreur });
          if (resultat.data.quota) {
            setAvertissement("Quota Gemini atteint : les documents restants n'ont pas été analysés. Relance le tri plus tard.");
            setAnalyses(index + 1);
            break;
          }
        } else {
          const { nom, categorie } = resultat.data.proposition;
          if (categorie && !categories.includes(categorie) && !nouvelles.includes(categorie)) nouvelles.push(categorie);
          resultats.push({ id: document.id, document, nom, categorie, coche: true, erreur: null });
        }
        setAnalyses(index + 1);
      }
      setLignes(resultats);
      setEtape("apercu");
    })();
    return () => {
      arret.current = true;
    };
    // Le lot est figé à l'ouverture de la fenêtre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Catégories proposées par Gemini et absentes de la liste : créées seulement à l'application.
  const nouvelles = useMemo(() => {
    const vues: string[] = [];
    for (const { categorie } of lignes) {
      if (categorie && !categories.includes(categorie) && !vues.includes(categorie)) vues.push(categorie);
    }
    return vues;
  }, [lignes, categories]);

  function modifier(id: string, changements: Partial<Pick<Ligne, "nom" | "categorie" | "coche">>) {
    setLignes((courantes) => courantes.map((l) => (l.id === id ? { ...l, ...changements } : l)));
  }

  const aAppliquer = lignes.filter((l) => l.coche && !l.erreur);
  const nomsVides = aAppliquer.some((l) => l.nom.trim() === "");

  function fermer() {
    arret.current = true;
    const restes = lignes.filter((l) => !l.coche || l.erreur).map((l) => l.id);
    if (restes.length > 0) onIgnores(restes);
    onClose();
  }

  async function appliquer() {
    setErreurApplication(null);
    setEtape("application");
    const resultat = await runAction(
      () => appliquerTriVrac(aAppliquer.map((l) => ({ id: l.id, nom: l.nom, categorie: l.categorie }))),
      { silencieux: true }
    );
    if (!resultat.ok) {
      setErreurApplication(resultat.error);
      setEtape("apercu");
      return;
    }
    const { appliques, echecs } = resultat.data;
    const restes = lignes.filter((l) => !l.coche || l.erreur).map((l) => l.id);
    if (restes.length > 0) onIgnores(restes);
    if (echecs > 0) showErrorToast(`${pluriel(echecs, "document")} n'${echecs > 1 ? "ont" : "a"} pas pu être trié${echecs > 1 ? "s" : ""}.`);
    if (appliques > 0) showToast(`${pluriel(appliques, "document")} trié${appliques > 1 ? "s" : ""}`);
    onClose();
  }

  return (
    <Modal title="Trier le vrac" onClose={fermer}>
      {etape === "analyse" && (
        <div className="flex flex-col gap-4 pb-1" aria-busy="true">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink" aria-live="polite">
              Gemini lit tes documents… {analyses} / {lot.length}
            </p>
            <div
              role="progressbar"
              aria-label="Progression de l'analyse"
              aria-valuemin={0}
              aria-valuemax={lot.length}
              aria-valuenow={analyses}
              className="h-2 overflow-hidden rounded-full bg-surface-alt"
            >
              <div
                className="h-full rounded-full bg-kcal transition-[width] duration-300 ease-out"
                style={{ width: `${lot.length === 0 ? 0 : (analyses / lot.length) * 100}%` }}
              />
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {lot.map((document, index) => (
              <li key={document.id} className="flex items-center gap-3">
                <Miniature document={document} />
                <span className={`min-w-0 flex-1 truncate text-sm ${index < analyses ? "text-ink-3" : "text-ink"}`}>
                  {document.nom}
                </span>
                {index < analyses && (
                  <span className="text-xs font-semibold text-kcal" aria-label="Analysé">
                    ✓
                  </span>
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={fermer} className={secondaryButton}>
            Arrêter
          </button>
        </div>
      )}

      {etape !== "analyse" && (
        <div className="flex flex-col gap-3">
          {avertissement && (
            <p role="alert" className={errorText}>
              {avertissement}
            </p>
          )}
          <p className="text-sm text-ink-2">
            Vérifie les propositions : rien n&apos;est modifié avant « Appliquer ». Décoche un document pour le laisser en vrac.
          </p>
          {nouvelles.length > 0 && (
            <p className="rounded-xl bg-kcal-soft px-3 py-2 text-[13px] font-medium text-kcal">
              Nouvelle{nouvelles.length > 1 ? "s" : ""} catégorie{nouvelles.length > 1 ? "s" : ""} proposée
              {nouvelles.length > 1 ? "s" : ""} : {nouvelles.join(", ")}
            </p>
          )}

          <ul className="flex flex-col gap-2.5">
            {lignes.map((ligne) => (
              <li
                key={ligne.id}
                className={`flex flex-col gap-2 rounded-2xl border border-line p-3 ${ligne.coche ? "bg-surface" : "bg-surface-alt/60"}`}
              >
                <div className="flex items-center gap-3">
                  {ligne.erreur ? (
                    <div className="h-11 w-5 shrink-0" aria-hidden="true" />
                  ) : (
                    <label className="relative flex h-11 w-5 shrink-0 cursor-pointer items-center justify-center after:absolute after:-inset-x-2 after:inset-y-0 after:content-['']">
                      <input
                        type="checkbox"
                        checked={ligne.coche}
                        disabled={etape === "application"}
                        onChange={(e) => modifier(ligne.id, { coche: e.target.checked })}
                        aria-label={`Appliquer le tri de ${ligne.document.nom}`}
                        className="h-5 w-5 accent-[var(--accent-kcal)]"
                      />
                    </label>
                  )}
                  <Miniature document={ligne.document} />
                  <p className="min-w-0 flex-1 truncate text-[12.5px] text-ink-3">Avant : {ligne.document.nom}</p>
                </div>

                {ligne.erreur ? (
                  <p role="alert" className={errorText}>
                    {ligne.erreur} Il reste en vrac.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <input
                      value={ligne.nom}
                      maxLength={NOM_MAX}
                      onChange={(e) => modifier(ligne.id, { nom: e.target.value })}
                      disabled={!ligne.coche || etape === "application"}
                      aria-label={`Nom proposé pour ${ligne.document.nom}`}
                      aria-invalid={ligne.coche && ligne.nom.trim() === ""}
                      className={`${input} w-full disabled:opacity-60`}
                    />
                    <select
                      value={ligne.categorie ?? ""}
                      onChange={(e) => modifier(ligne.id, { categorie: e.target.value || null })}
                      disabled={!ligne.coche || etape === "application"}
                      aria-label={`Catégorie proposée pour ${ligne.document.nom}`}
                      className={`${input} w-full disabled:opacity-60`}
                    >
                      <option value="">Sans catégorie</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {nouvelles.map((c) => (
                        <option key={c} value={c}>
                          {c.slice(0, CATEGORIE_MAX)} (nouvelle)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {erreurApplication && (
            <p role="alert" className={errorText}>
              {erreurApplication}
            </p>
          )}

          <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-surface px-4 pb-1 pt-3">
            <button type="button" onClick={fermer} disabled={etape === "application"} className={`${secondaryButton} flex-1`}>
              Annuler
            </button>
            <button
              type="button"
              onClick={appliquer}
              disabled={etape === "application" || aAppliquer.length === 0 || nomsVides}
              className={`${primaryButton} flex-[2]`}
            >
              {etape === "application" ? "Application…" : `Appliquer (${aAppliquer.length})`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
