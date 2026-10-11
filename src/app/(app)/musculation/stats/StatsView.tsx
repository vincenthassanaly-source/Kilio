"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getExercicesPratiques, getResumePeriode } from "@/app/actions/musculation";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Skeleton } from "@/components/skeletons/Skeleton";
import { MUSCLE_LABELS } from "@/lib/musculation/constantes";
import { formaterDateLongue, formaterDureeS } from "@/lib/musculation/historique";
import { formaterPoids } from "@/lib/musculation/seance";
import { joursDePeriode, type TypePeriode } from "@/lib/musculation/stats";
import { queryKeys } from "@/lib/query/keys";
import { card, cardTight, errorText, metaText, nameText, navArrowButton, screenTitle, sectionTitle } from "@/lib/ui";

const OPTIONS = [
  { value: "semaine", label: "Semaine" },
  { value: "mois", label: "Mois" },
] as const;

const formatJourMois = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const formatMois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

function enDate(date: string): Date {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
}

function libellePeriode(type: TypePeriode, debut: string, fin: string): string {
  return type === "mois"
    ? formatMois.format(enDate(debut))
    : `${formatJourMois.format(enDate(debut))} – ${formatJourMois.format(enDate(fin))}`;
}

function Tuile({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className={`${card} flex flex-col gap-0.5 !p-3.5`}>
      <span className={metaText}>{libelle}</span>
      <span className="font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">{valeur}</span>
    </div>
  );
}

/** Jours de la période, une pastille pleine les jours où l'on s'est entraîné (lundi en premier). */
function Calendrier({ debut, fin, jours }: { debut: string; fin: string; jours: string[] }) {
  const tous = joursDePeriode(debut, fin);
  const entraines = new Set(jours);
  // Décalage du premier jour par rapport au lundi (0 = lundi).
  const vide = (enDate(debut).getUTCDay() + 6) % 7;
  const JOURS = ["L", "M", "M", "J", "V", "S", "D"];
  return (
    <div className="grid grid-cols-7 gap-1.5" role="img" aria-label={`${jours.length} jour${jours.length > 1 ? "s" : ""} d'entraînement sur ${tous.length}`}>
      {JOURS.map((j, i) => (
        <span key={i} aria-hidden="true" className="text-center text-[11px] font-semibold text-ink-3">
          {j}
        </span>
      ))}
      {Array.from({ length: vide }, (_, i) => (
        <span key={`vide-${i}`} aria-hidden="true" />
      ))}
      {tous.map((jour) => {
        const fait = entraines.has(jour);
        return (
          <span
            key={jour}
            title={fait ? `Séance le ${formaterDateLongue(jour)}` : undefined}
            className={`flex h-9 items-center justify-center rounded-xl text-[13px] tabular-nums ${
              fait ? "bg-kcal font-semibold text-on-kcal" : "bg-surface-alt text-ink-2"
            }`}
          >
            {Number(jour.slice(8))}
          </span>
        );
      })}
    </div>
  );
}

/** Séries de travail par muscle principal : une barre fine par muscle, valeur au bout. */
function RepartitionMuscles({ parMuscle }: { parMuscle: { muscle: keyof typeof MUSCLE_LABELS; nbSeries: number }[] }) {
  if (parMuscle.length === 0) return <p className={metaText}>Aucune série sur cette période.</p>;
  const max = Math.max(...parMuscle.map((m) => m.nbSeries));
  return (
    <ul className="flex flex-col gap-2">
      {parMuscle.map((m) => (
        <li key={m.muscle} className="grid grid-cols-[96px_1fr_auto] items-center gap-2">
          <span className="truncate text-[13.5px] text-ink">{MUSCLE_LABELS[m.muscle]}</span>
          <span className="h-3 overflow-hidden" aria-hidden="true">
            <span
              className="block h-3 rounded-r-[4px]"
              style={{ width: `${Math.max(4, (m.nbSeries / max) * 100)}%`, background: "var(--accent-musculation)" }}
            />
          </span>
          <span className="text-[13.5px] font-semibold tabular-nums text-ink">{m.nbSeries}</span>
        </li>
      ))}
    </ul>
  );
}

export function StatsView() {
  const [type, setType] = useState<TypePeriode>("semaine");
  const [decalage, setDecalage] = useState(0);

  const periode = useQuery({
    queryKey: queryKeys.musculationResume(type, decalage),
    queryFn: () => getResumePeriode(type, decalage),
    placeholderData: keepPreviousData,
  });
  const exercices = useQuery({ queryKey: queryKeys.musculationExercicesPratiques, queryFn: getExercicesPratiques });

  const donnees = periode.data;
  return (
    <div className="flex flex-col gap-4 pb-8">
      <h1 className={screenTitle}>Statistiques</h1>

      <SegmentedControl
        options={OPTIONS}
        value={type}
        onChange={(v) => {
          setType(v);
          setDecalage(0);
        }}
        ariaLabel="Période"
        glissant
      />

      <div className="flex items-center justify-between gap-2">
        <button type="button" className={navArrowButton} onClick={() => setDecalage((d) => d - 1)} aria-label="Période précédente">
          ‹
        </button>
        <span className={`${nameText} capitalize`} aria-live="polite">
          {donnees ? libellePeriode(type, donnees.debut, donnees.fin) : "…"}
        </span>
        <button type="button" className={navArrowButton} onClick={() => setDecalage((d) => Math.min(0, d + 1))} disabled={decalage === 0} aria-label="Période suivante">
          ›
        </button>
      </div>

      {periode.isError && <p className={errorText}>Impossible de charger les statistiques. Vérifie ta connexion.</p>}
      {!donnees && periode.isLoading && <Skeleton className="h-40 w-full rounded-[22px]" />}

      {donnees && (
        <div className={`flex flex-col gap-4 transition-opacity ${periode.isPlaceholderData ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-3">
            <Tuile libelle="Séances" valeur={String(donnees.resume.nbSeances)} />
            <Tuile libelle="Durée" valeur={donnees.resume.nbSeances ? formaterDureeS(donnees.resume.dureeS) : "–"} />
            <Tuile libelle="Séries" valeur={String(donnees.resume.nbSeries)} />
            <Tuile libelle="Volume" valeur={donnees.resume.volume ? `${formaterPoids(donnees.resume.volume)} kg` : "–"} />
          </div>

          <section className={`${card} flex flex-col gap-3`} aria-label="Assiduité">
            <h2 className={sectionTitle}>Assiduité</h2>
            <Calendrier debut={donnees.debut} fin={donnees.fin} jours={donnees.resume.jours} />
          </section>

          <section className={`${card} flex flex-col gap-3`} aria-label="Répartition par muscle">
            <h2 className={sectionTitle}>Séries par muscle</h2>
            <RepartitionMuscles parMuscle={donnees.resume.parMuscle} />
          </section>
        </div>
      )}

      <section className="flex flex-col gap-3" aria-label="Exercices">
        <h2 className={sectionTitle}>Progression par exercice</h2>
        {exercices.isLoading && <Skeleton className="h-16 w-full rounded-[20px]" />}
        {exercices.data && exercices.data.length === 0 && <p className={metaText}>Tes exercices apparaîtront ici après ta première séance.</p>}
        {exercices.data && exercices.data.length > 0 && (
          <ul className="flex flex-col gap-2">
            {exercices.data.map((e) => (
              <li key={e.id}>
                <Link href={`/musculation/stats/${e.id}`} className={`${cardTight} flex flex-col gap-0.5`}>
                  <span className={nameText}>{e.nom}</span>
                  <span className={metaText}>
                    {MUSCLE_LABELS[e.muscle]} · {e.nbSeances} séance{e.nbSeances > 1 ? "s" : ""} · dernière le {formaterDateLongue(e.derniereSeance)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
