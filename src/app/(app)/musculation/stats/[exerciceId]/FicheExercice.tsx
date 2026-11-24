"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStatsExercice } from "@/app/actions/musculation";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { MODE_SAISIE_LABELS, MUSCLE_LABELS } from "@/lib/musculation/constantes";
import { formaterDateLongue } from "@/lib/musculation/historique";
import { formaterPoids } from "@/lib/musculation/seance";
import type { MetriqueProgression, RecordsExercice, ValeurRecord } from "@/lib/musculation/stats";
import { queryKeys } from "@/lib/query/keys";
import { SegmentedControl } from "@/components/SegmentedControl";
import { card, metaText, screenTitle, sectionTitle } from "@/lib/ui";
import { GraphiqueProgression } from "../GraphiqueProgression";
import { ErrorInline } from "@/components/ErrorInline";
import { BackLink } from "@/components/BackLink";

const METRIQUES: { value: MetriqueProgression; label: string; titre: string }[] = [
  { value: "e1rm", label: "1RM estimé", titre: "1RM estimé par séance" },
  { value: "poids", label: "Charge max", titre: "Charge maximale par séance" },
  { value: "volume", label: "Volume", titre: "Volume (poids × reps) par séance" },
];

const RECORDS: { cle: keyof RecordsExercice; libelle: string; unite: string }[] = [
  { cle: "poidsMax", libelle: "Charge max", unite: "kg" },
  { cle: "e1rmMax", libelle: "1RM estimé", unite: "kg" },
  { cle: "volumeSerieMax", libelle: "Volume d'une série", unite: "kg" },
  { cle: "volumeSeanceMax", libelle: "Volume d'une séance", unite: "kg" },
  { cle: "repsMax", libelle: "Répétitions max", unite: "reps" },
  { cle: "dureeMax", libelle: "Durée max", unite: "s" },
  { cle: "distanceMax", libelle: "Distance max", unite: "m" },
];

function CarteRecord({ libelle, unite, record }: { libelle: string; unite: string; record: ValeurRecord }) {
  return (
    <div className={`${card} flex flex-col gap-0.5 !p-3.5`}>
      <span className={metaText}>{libelle}</span>
      <span className="font-display text-heading font-semibold leading-tight tracking-[-0.02em] text-ink">
        {formaterPoids(record.valeur)} <span className="text-label font-medium text-ink-2">{unite}</span>
      </span>
      <span className="text-caption text-ink-3">{formaterDateLongue(record.date)}</span>
    </div>
  );
}

export function FicheExercice({ exerciceId }: { exerciceId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.musculationStatsExercice(exerciceId),
    queryFn: () => getStatsExercice(exerciceId),
  });
  const [choix, setChoix] = useState<MetriqueProgression | null>(null);

  // Le lien de retour reste en place pendant le chargement et en cas d'erreur : l'écran n'est jamais une impasse.
  const retour = <BackLink href="/musculation/stats">Statistiques</BackLink>;
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {retour}
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-48 w-full rounded-card" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="flex flex-col gap-4">
        {retour}
        {isError ? (
          <ErrorInline titre="Chargement impossible" message="Impossible de charger l'exercice. Vérifie ta connexion." retry={() => refetch()} />
        ) : (
          <ErrorInline titre="Exercice introuvable" message="Cet exercice n'existe pas." />
        )}
      </div>
    );
  }

  const { exercice, stats } = data;
  const disponibles = METRIQUES.filter((m) => stats.progression[m.value].length > 0);
  const metrique = disponibles.find((m) => m.value === choix) ?? disponibles[0];
  const records = RECORDS.filter((r) => stats.records[r.cle]);

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex flex-col gap-4">
        {retour}
        <div className="flex flex-col gap-1">
          <h1 className={screenTitle}>{exercice.nom}</h1>
          <p className={metaText}>
            {MUSCLE_LABELS[exercice.muscle]}
            {exercice.materiel ? ` · ${exercice.materiel}` : ""} · {MODE_SAISIE_LABELS[exercice.mode]} · {stats.nbSeances} séance
            {stats.nbSeances > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {stats.nbSeances === 0 && <p className={metaText}>Pas encore de séance avec cet exercice.</p>}

      {records.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Records">
          <h2 className={sectionTitle}>Records</h2>
          <div className="grid grid-cols-2 gap-3">
            {records.map((r) => (
              <CarteRecord key={r.cle} libelle={r.libelle} unite={r.unite} record={stats.records[r.cle]!} />
            ))}
          </div>
        </section>
      )}

      {metrique && (
        <section className={`${card} flex flex-col gap-3`} aria-label="Progression">
          <h2 className={sectionTitle}>{metrique.titre}</h2>
          {/* Choix de 2 à 3 mesures : contrôle segmenté du système, comme Semaine / Mois des statistiques. */}
          {disponibles.length > 1 && (
            <SegmentedControl options={disponibles} value={metrique.value} onChange={setChoix} ariaLabel="Mesure" taille="sm" />
          )}
          <GraphiqueProgression
            points={stats.progression[metrique.value].map((p) => ({ date: p.date, valeur: p.valeur }))}
            unite="kg"
            libelle={metrique.titre}
          />
        </section>
      )}
    </div>
  );
}
