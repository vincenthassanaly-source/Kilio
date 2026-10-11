"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { enregistrerRoutine, getEntrainement, getRoutine, supprimerEntrainement } from "@/app/actions/musculation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { TYPE_SERIE_LABELS } from "@/lib/musculation/constantes";
import {
  formaterDateLongue,
  formaterDureeS,
  heureParisDe,
  routineDepuisEntrainement,
  volumeDeSeries,
  type EntrainementDetail,
} from "@/lib/musculation/historique";
import type { RoutineDetail } from "@/lib/musculation/routines";
import { formaterPoids, libellePrecedent } from "@/lib/musculation/seance";
import { queryKeys } from "@/lib/query/keys";
import { card, dangerButton, errorText, input, metaText, nameText, primaryButton, screenTitle, secondaryButton, sectionTitle } from "@/lib/ui";

function Contenu({ detail }: { detail: EntrainementDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modalRoutine, setModalRoutine] = useState(false);
  const [nomRoutine, setNomRoutine] = useState(detail.titre);
  const [routineACibler, setRoutineACibler] = useState<RoutineDetail | null>(null);
  const [suppression, setSuppression] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const volume = Math.round(detail.exercices.reduce((v, e) => v + volumeDeSeries(e.series), 0));
  const nbSeries = detail.exercices.reduce((n, e) => n + e.series.length, 0);

  async function creerRoutine() {
    setEnCours(true);
    const entree = routineDepuisEntrainement(detail, { nom: nomRoutine, typeSeance: detail.typeSeance, dossierId: null });
    const resultat = await runAction(() => enregistrerRoutine(entree));
    setEnCours(false);
    if (!resultat.ok) return;
    setModalRoutine(false);
    void queryClient.invalidateQueries({ queryKey: queryKeys.musculationRoutines });
    showToast("Routine créée depuis cette séance");
  }

  async function preparerMiseAJour() {
    if (!detail.routineId) return;
    setEnCours(true);
    const resultat = await runAction(() => getRoutine(detail.routineId!));
    setEnCours(false);
    if (!resultat.ok) return;
    if (!resultat.data) {
      showToast("Cette routine n'existe plus.");
      return;
    }
    setRoutineACibler(resultat.data);
  }

  async function mettreAJourRoutine() {
    if (!routineACibler) return;
    setEnCours(true);
    const entree = routineDepuisEntrainement(detail, {
      id: routineACibler.id,
      nom: routineACibler.nom,
      typeSeance: routineACibler.typeSeance,
      dossierId: routineACibler.dossierId,
    });
    const resultat = await runAction(() => enregistrerRoutine(entree));
    setEnCours(false);
    if (!resultat.ok) return;
    const { id } = routineACibler;
    setRoutineACibler(null);
    void queryClient.invalidateQueries({ queryKey: queryKeys.musculationRoutines });
    void queryClient.invalidateQueries({ queryKey: queryKeys.musculationRoutine(id) });
    showToast("Routine mise à jour");
  }

  async function supprimer() {
    setEnCours(true);
    const resultat = await runAction(() => supprimerEntrainement(detail.id));
    setEnCours(false);
    setSuppression(false);
    if (!resultat.ok) return;
    void queryClient.invalidateQueries({ queryKey: ["musculation-historique"] });
    queryClient.removeQueries({ queryKey: queryKeys.musculationEntrainement(detail.id) });
    showToast("Séance supprimée");
    router.replace("/musculation/historique");
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className={screenTitle}>{detail.titre}</h1>
        <p className={metaText}>
          {formaterDateLongue(detail.date)} · {heureParisDe(detail.debutA)} · {formaterDureeS(detail.dureeS)}
        </p>
        <p className={metaText}>
          {detail.exercices.length} exercice{detail.exercices.length > 1 ? "s" : ""} · {nbSeries} série{nbSeries > 1 ? "s" : ""}
          {volume > 0 ? ` · ${formaterPoids(volume)} kg` : ""}
        </p>
      </div>

      {detail.exercices.map((exercice) => {
        let rang = 0;
        return (
          <section key={exercice.cle} className={`${card} flex flex-col gap-2`} aria-label={exercice.nom}>
            <h2 className={sectionTitle}>{exercice.nom}</h2>
            <ol className="flex flex-col gap-1">
              {exercice.series.map((s, i) => {
                if (s.type !== "echauffement") rang += 1;
                return (
                  <li key={i} className="flex items-baseline gap-3 text-[14px] tabular-nums text-ink">
                    <span className="w-6 text-center font-semibold text-ink-2">{s.type === "echauffement" ? "É" : rang}</span>
                    <span>{libellePrecedent(exercice.mode, s)}</span>
                    {s.type !== "normale" && <span className="text-[12.5px] text-ink-2">{TYPE_SERIE_LABELS[s.type]}</span>}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      <div className="flex flex-col gap-2">
        <Link href={`/musculation/historique/${detail.id}/modifier`} className={`${primaryButton} h-12 text-center leading-[1.6]`}>
          Modifier la séance
        </Link>
        <button type="button" className={secondaryButton} onClick={() => setModalRoutine(true)} disabled={enCours}>
          Enregistrer comme routine
        </button>
        {detail.routineId && (
          <button type="button" className={secondaryButton} onClick={() => void preparerMiseAJour()} disabled={enCours}>
            Mettre à jour la routine
          </button>
        )}
        <button type="button" className={dangerButton} onClick={() => setSuppression(true)} disabled={enCours}>
          Supprimer la séance
        </button>
      </div>

      <AnimatePresence>
        {modalRoutine && (
          <Modal key="routine" title="Enregistrer comme routine" onClose={() => setModalRoutine(false)}>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void creerRoutine();
              }}
            >
              <input
                value={nomRoutine}
                maxLength={80}
                onChange={(e) => setNomRoutine(e.target.value)}
                aria-label="Nom de la routine"
                autoComplete="off"
                className={input}
              />
              <p className={metaText}>
                Les exercices, séries et repos de cette séance deviennent les cibles de la routine
                {detail.typeSeance ? ` (type ${detail.typeSeance})` : ""}.
              </p>
              <button type="submit" className={primaryButton} disabled={enCours || nomRoutine.trim() === ""}>
                Créer la routine
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={routineACibler !== null}
        titre="Mettre à jour la routine ?"
        confirmer="Mettre à jour la routine"
        destructif={false}
        enCours={enCours}
        onClose={() => setRoutineACibler(null)}
        onConfirm={() => void mettreAJourRoutine()}
      >
        <p>
          Les exercices et séries de « {routineACibler?.nom} » seront remplacés par ceux de cette séance. Son nom, son type et son
          dossier ne changent pas.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={suppression}
        titre="Supprimer la séance ?"
        confirmer="Supprimer la séance"
        enCours={enCours}
        onClose={() => setSuppression(false)}
        onConfirm={() => void supprimer()}
      >
        <p>
          « {detail.titre} » du {formaterDateLongue(detail.date)} et ses {nbSeries} série{nbSeries > 1 ? "s" : ""} seront supprimées.
        </p>
      </ConfirmDialog>
    </div>
  );
}

export function EntrainementDetailView({ id }: { id: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.musculationEntrainement(id),
    queryFn: () => getEntrainement(id),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-48 w-full rounded-[22px]" />
      </div>
    );
  }
  if (isError) return <p className={errorText}>Impossible de charger la séance. Vérifie ta connexion.</p>;
  if (!data) return <p className={nameText}>Cette séance n&apos;existe plus.</p>;
  return <Contenu detail={data} />;
}
