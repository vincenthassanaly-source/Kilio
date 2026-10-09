"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteEvenement, getEvenements, type Evenement } from "@/app/actions/evenements";
import { getPlanningTravail, getPlanningTravailExceptions } from "@/app/actions/planning-travail";
import { getTachesAvecRelations } from "@/app/actions/taches";
import { Modal } from "@/components/Modal";
import { showToast } from "@/components/toast/toast-store";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { supprimerAvecAnnulation } from "@/lib/actions/suppressionDifferee";
import { getCreneauxDuJour } from "@/lib/agenda/planning-travail";
import { plagesLibresDuJour, tachesDuJour, tachesEnRetard } from "@/lib/aujourdhui/compute";
import { parseISODate } from "@/lib/date/iso";
import { queryKeys } from "@/lib/query/keys";
import { useBackClose } from "@/hooks/useBackClose";
import { card, cardTight } from "@/lib/ui";
import { DashboardHabitudesSection } from "../DashboardHabitudesSection";
import { QuickAddFab } from "../QuickAddFab";
import { DayTimeline } from "./DayTimeline";
import { EnRetardSection } from "./EnRetardSection";
import { EvenementForm } from "./EvenementForm";
import { evenementsHoraires, evenementsJourneeEntiere } from "@/lib/evenements/compute";
import { PlanDuJourCard } from "./PlanDuJourCard";
import { TransitionLink } from "@/components/TransitionLink";
import { RepasRestantsCard } from "./RepasRestantsCard";
import { TachesDuJour } from "./TachesDuJour";
import { useHeureCourante } from "./useHeureCourante";

const DUREE_SURBRILLANCE_MS = 2600;

type Formulaire = { evenement?: Evenement } | null;

export function AujourdhuiView({ today }: { today: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [formulaire, setFormulaire] = useState<Formulaire>(null);
  // Événements masqués le temps du toast « Annuler » d'une suppression.
  const [masques, setMasques] = useState<ReadonlySet<string>>(() => new Set());
  const [tacheSurlignee, setTacheSurlignee] = useState<string | null>(null);

  useBackClose(formulaire !== null, () => setFormulaire(null));

  const { data: taches, isLoading: tachesChargent } = useQuery({
    queryKey: queryKeys.taches,
    queryFn: getTachesAvecRelations,
  });
  const { data: evenements = [] } = useQuery({
    queryKey: queryKeys.evenementsDuJour(today),
    queryFn: () => getEvenements(today, today),
  });
  // Planning de travail : sans mutation côté app, donc relu à chaque visite
  // (même choix que l'Agenda).
  const { data: creneaux = [] } = useQuery({
    queryKey: queryKeys.planningTravail,
    queryFn: getPlanningTravail,
    staleTime: 0,
  });
  const { data: exceptions = [] } = useQuery({
    queryKey: queryKeys.planningTravailExceptions,
    queryFn: getPlanningTravailExceptions,
    staleTime: 0,
  });

  const creneauxDuJour = useMemo(
    () => getCreneauxDuJour(creneaux, parseISODate(today), exceptions),
    [creneaux, exceptions, today]
  );
  const enRetard = useMemo(() => tachesEnRetard(taches ?? [], today), [taches, today]);
  const duJour = useMemo(() => tachesDuJour(taches ?? [], today), [taches, today]);
  const horodatees = useMemo(() => duJour.filter((t) => !t.fait && t.heure), [duJour]);
  const evenementsVisibles = useMemo(() => evenements.filter((e) => !masques.has(e.id)), [evenements, masques]);
  const evenementsHorairesVisibles = useMemo(() => evenementsHoraires(evenementsVisibles), [evenementsVisibles]);
  const evenementsJournee = useMemo(() => evenementsJourneeEntiere(evenementsVisibles), [evenementsVisibles]);
  const maintenant = useHeureCourante();
  // Trous libres du jour : partagés par la frise (affichage) et par « Planifier »
  // (créneaux proposés), pour que les deux ne se contredisent jamais.
  const libres = useMemo(
    () =>
      plagesLibresDuJour({
        maintenant,
        creneauxTravail: creneauxDuJour,
        blocs: [
          ...horodatees.map((t) => ({ heure: t.heure, heure_fin: t.heure_fin })),
          ...evenementsHorairesVisibles.map((e) => ({ heure: e.heure, heure_fin: e.heure_fin })),
        ],
      }),
    [maintenant, creneauxDuJour, horodatees, evenementsHorairesVisibles]
  );

  // Retire la surbrillance une fois jouée : le scroll de la ligne ne doit pas
  // se rejouer aux rendus suivants.
  useEffect(() => {
    if (tacheSurlignee === null) return;
    const timer = window.setTimeout(() => setTacheSurlignee(null), DUREE_SURBRILLANCE_MS);
    return () => window.clearTimeout(timer);
  }, [tacheSurlignee]);

  const dateLabel = parseISODate(today).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  function fermerFormulaire() {
    setFormulaire(null);
  }

  function handleSaved() {
    const modification = formulaire?.evenement !== undefined;
    fermerFormulaire();
    showToast(modification ? "Événement modifié" : "Événement ajouté");
    void queryClient.invalidateQueries({ queryKey: queryKeys.evenements });
    // L'événement peut avoir été déplacé à un autre jour : les écrans serveur
    // (Agenda) relisent leurs données.
    router.refresh();
  }

  function handleSupprimer(evenement: Evenement) {
    fermerFormulaire();
    supprimerAvecAnnulation({
      texte: `« ${evenement.titre} » supprimé`,
      ariaLabel: `Annuler la suppression de « ${evenement.titre} »`,
      masquer: () => setMasques((m) => new Set(m).add(evenement.id)),
      restaurer: () =>
        setMasques((m) => {
          const suivant = new Set(m);
          suivant.delete(evenement.id);
          return suivant;
        }),
      supprimer: () => deleteEvenement(evenement.id),
      erreur: `Impossible de supprimer « ${evenement.titre} ». Réessaie.`,
      onSupprime: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.evenements }).then(() =>
          setMasques((m) => {
            const suivant = new Set(m);
            suivant.delete(evenement.id);
            return suivant;
          })
        );
      },
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-[calc(env(safe-area-inset-bottom)+110px)]">
      <p className="-mt-3 text-[13.5px] font-medium text-ink-2 first-letter:uppercase">{dateLabel}</p>

      {tachesChargent ? (
        <Skeleton className="h-24 w-full rounded-[22px]" />
      ) : (
        <EnRetardSection taches={enRetard} today={today} />
      )}

      {!tachesChargent && <PlanDuJourCard taches={taches ?? []} libres={libres} today={today} />}

      <DayTimeline
        taches={horodatees}
        evenements={evenementsHorairesVisibles}
        evenementsJournee={evenementsJournee}
        creneaux={creneauxDuJour}
        libres={libres}
        maintenant={maintenant}
        onAddEvenement={() => setFormulaire({})}
        onSelectEvenement={(evenement) => setFormulaire({ evenement })}
        onSelectTache={setTacheSurlignee}
      />

      {tachesChargent ? (
        <Skeleton className="h-32 w-full rounded-[22px]" />
      ) : (
        <TachesDuJour
          taches={duJour}
          today={today}
          libres={libres}
          tacheSurlignee={tacheSurlignee}
          onTacheCreee={setTacheSurlignee}
        />
      )}

      <DashboardHabitudesSection today={today} className={card} />

      <RepasRestantsCard today={today} />

      {/* Revue hebdomadaire : mise en avant le dimanche, accessible tous les jours. */}
      <TransitionLink
        href="/revue"
        className={`${cardTight} flex min-h-11 items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2 ${
          parseISODate(today).getDay() === 0 ? "border-kcal/60" : ""
        }`}
      >
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold text-ink">Revue de la semaine</span>
          <span className="text-[12.5px] text-ink-2">Bilan, retards à replanifier, 7 prochains jours</span>
        </span>
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-3">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </TransitionLink>

      <QuickAddFab />

      <AnimatePresence>
        {formulaire && (
          <Modal
            key="evenement"
            title={formulaire.evenement ? "Modifier l'événement" : "Nouvel événement"}
            onClose={fermerFormulaire}
          >
            <EvenementForm
              evenement={formulaire.evenement}
              dateParDefaut={today}
              onSaved={handleSaved}
              onSupprimer={formulaire.evenement ? () => handleSupprimer(formulaire.evenement!) : undefined}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
