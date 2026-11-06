"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { analyserElementsCollection, appliquerTitrage } from "@/app/actions/collection-titrage";
import { FadeInImage } from "@/components/FadeInImage";
import { Modal } from "@/components/Modal";
import { showErrorToast, showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { DESCRIPTION_MAX, TAILLE_PAQUET_TITRAGE, TITRE_MAX, libelleNature } from "@/lib/collection/titrage";
import { estTypeVideo } from "@/lib/collection/video";
import { queryKeys } from "@/lib/query/keys";
import type { Tables } from "@/lib/supabase/types";
import { errorText, input, primaryButton, secondaryButton } from "@/lib/ui";
import { pluriel } from "@/lib/pharmacie/format";

type Element = Tables<"collection_items">;

type Ligne = {
  element: Element;
  /** Titre éditable, proposé par Gemini. */
  titre: string;
  description: string;
  coche: boolean;
  /** Analyse impossible : l'élément reste tel quel. */
  erreur: string | null;
};

type Etape = "analyse" | "apercu" | "application";

// Garde-fou : un paquet qui ne répond pas (le serveur est limité à 60 s) ne
// doit jamais figer la fenêtre. Au-delà, ses éléments passent en erreur.
const DELAI_PAQUET_MS = 70_000;

function delai(ms: number) {
  return new Promise<"delai">((resolve) => setTimeout(() => resolve("delai"), ms));
}

function Miniature({ element }: { element: Element }) {
  const src = estTypeVideo(element.type) ? (element.thumbnail_url ?? element.url) : element.url;
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-alt">
      <FadeInImage src={src} alt="" fill sizes="48px" unoptimized={estTypeVideo(element.type)} className="object-cover" />
    </div>
  );
}

/**
 * Titrage par Gemini : analyse un lot d'éléments (un appel serveur par
 * élément, pour afficher la progression et isoler les échecs), montre les
 * propositions (titre et description modifiables, case à décocher), puis
 * n'applique que ce qui est validé. Rien n'est écrit avant « Appliquer ».
 */
export function TitrageModal({
  collectionId,
  lot,
  onClose,
}: {
  collectionId: string;
  /** Éléments à décrire (déjà limités à la taille d'un lot). */
  lot: Element[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [etape, setEtape] = useState<Etape>("analyse");
  const [analyses, setAnalyses] = useState(0);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [erreurApplication, setErreurApplication] = useState<string | null>(null);
  const arret = useRef(false);

  useEffect(() => {
    // Annulation propre à CETTE exécution de l'effet (StrictMode en
    // développement : voir TriVracModal).
    let annule = false;
    const echec = (element: Element, erreur: string): Ligne => ({
      element,
      titre: element.titre ?? "",
      description: "",
      coche: false,
      erreur,
    });
    (async () => {
      const resultats: Ligne[] = [];
      // Paquets de TAILLE_PAQUET_TITRAGE : le serveur analyse un paquet en
      // parallèle (les appels serveur d'un même écran passent l'un après
      // l'autre, appeler élément par élément n'irait pas plus vite).
      for (let debut = 0; debut < lot.length; debut += TAILLE_PAQUET_TITRAGE) {
        if (annule || arret.current) return;
        const paquet = lot.slice(debut, debut + TAILLE_PAQUET_TITRAGE);
        let stop = false;
        try {
          const resultat = await Promise.race([
            runAction(() => analyserElementsCollection(paquet.map((e) => e.id)), { silencieux: true }),
            delai(DELAI_PAQUET_MS),
          ]);
          if (annule || arret.current) return;
          if (resultat === "delai") {
            for (const element of paquet) resultats.push(echec(element, "L'analyse a pris trop de temps. Réessaie."));
          } else if (!resultat.ok) {
            for (const element of paquet) resultats.push(echec(element, resultat.error));
          } else {
            paquet.forEach((element, i) => {
              const r = resultat.data[i];
              if (!r) {
                resultats.push(echec(element, "Pas de réponse pour cet élément."));
              } else if (r.statut === "echec") {
                resultats.push(echec(element, r.erreur));
                if (r.quota) stop = true;
              } else {
                resultats.push({ element, titre: r.proposition.titre, description: r.proposition.description, coche: true, erreur: null });
              }
            });
            if (stop) {
              setAvertissement("Quota Gemini atteint : les éléments restants n'ont pas été analysés. Réessaie plus tard.");
            }
          }
        } catch {
          if (annule || arret.current) return;
          for (const element of paquet) resultats.push(echec(element, "L'analyse a échoué de façon inattendue."));
        }
        setAnalyses(resultats.length);
        if (stop) break;
      }
      if (annule || arret.current) return;
      setLignes(resultats);
      setEtape("apercu");
    })();
    return () => {
      annule = true;
    };
    // Le lot est figé à l'ouverture de la fenêtre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function modifier(id: string, changements: Partial<Pick<Ligne, "titre" | "description" | "coche">>) {
    setLignes((courantes) => courantes.map((l) => (l.element.id === id ? { ...l, ...changements } : l)));
  }

  const aAppliquer = lignes.filter((l) => l.coche && !l.erreur);
  const titresVides = aAppliquer.some((l) => l.titre.trim() === "");

  function fermer() {
    arret.current = true;
    onClose();
  }

  async function appliquer() {
    setErreurApplication(null);
    setEtape("application");
    const resultat = await runAction(
      () =>
        appliquerTitrage(
          collectionId,
          aAppliquer.map((l) => ({ id: l.element.id, titre: l.titre, description: l.description }))
        ),
      { silencieux: true }
    );
    if (!resultat.ok) {
      setErreurApplication(resultat.error);
      setEtape("apercu");
      return;
    }
    const { appliques, echecs } = resultat.data;
    queryClient.invalidateQueries({ queryKey: queryKeys.collection(collectionId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.collections });
    if (echecs > 0) showErrorToast(`${pluriel(echecs, "élément")} n'${echecs > 1 ? "ont" : "a"} pas pu être décrit${echecs > 1 ? "s" : ""}.`);
    if (appliques > 0) showToast(`${pluriel(appliques, "élément")} décrit${appliques > 1 ? "s" : ""}`);
    onClose();
  }

  return (
    <Modal title="Décrire" onClose={fermer}>
      {etape === "analyse" && (
        <div className="flex flex-col gap-4 pb-1" aria-busy="true">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink" aria-live="polite">
              Gemini regarde tes éléments… {analyses} / {lot.length}
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
            {lot.map((element, index) => (
              <li key={element.id} className="flex items-center gap-3">
                <Miniature element={element} />
                <span className={`min-w-0 flex-1 truncate text-sm ${index < analyses ? "text-ink-3" : "text-ink"}`}>
                  {element.titre || libelleNature(element.type)}
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
            Vérifie les propositions : rien n&apos;est modifié avant « Appliquer ». Décoche un élément pour le laisser tel quel.
          </p>

          <ul className="flex flex-col gap-2.5">
            {lignes.map((ligne) => (
              <li
                key={ligne.element.id}
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
                        onChange={(e) => modifier(ligne.element.id, { coche: e.target.checked })}
                        aria-label={`Appliquer la description de ${ligne.element.titre || libelleNature(ligne.element.type)}`}
                        className="h-5 w-5 accent-[var(--accent-kcal)]"
                      />
                    </label>
                  )}
                  <Miniature element={ligne.element} />
                  <p className="min-w-0 flex-1 truncate text-small text-ink-3">
                    {libelleNature(ligne.element.type)}
                    {ligne.element.titre ? ` · Avant : ${ligne.element.titre}` : ""}
                  </p>
                </div>

                {ligne.erreur ? (
                  <p role="alert" className={errorText}>
                    {ligne.erreur}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <input
                      value={ligne.titre}
                      maxLength={TITRE_MAX}
                      onChange={(e) => modifier(ligne.element.id, { titre: e.target.value })}
                      disabled={!ligne.coche || etape === "application"}
                      aria-label="Titre proposé"
                      aria-invalid={ligne.coche && ligne.titre.trim() === ""}
                      className={`${input} w-full disabled:opacity-60`}
                    />
                    <textarea
                      value={ligne.description}
                      maxLength={DESCRIPTION_MAX}
                      rows={3}
                      onChange={(e) => modifier(ligne.element.id, { description: e.target.value })}
                      disabled={!ligne.coche || etape === "application"}
                      aria-label="Description proposée"
                      className={`${input} w-full resize-none disabled:opacity-60`}
                    />
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
              disabled={etape === "application" || aAppliquer.length === 0 || titresVides}
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
