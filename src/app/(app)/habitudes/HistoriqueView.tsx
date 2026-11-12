"use client";

import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ErrorInline } from "@/components/ErrorInline";
import { getHistoriqueHabitude } from "@/app/actions/habitudes";
import { queryKeys } from "@/lib/query/keys";
import type { Tables } from "@/lib/supabase/types";
import { input, navArrowButton } from "@/lib/ui";
import { useSwipeHorizontal, type SensSwipe } from "@/hooks/useSwipeHorizontal";
import { toISODate } from "@/lib/date/iso";

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function intensite(habitude: Tables<"habitudes">, valeur: number | undefined): number {
  if (!valeur || valeur <= 0) return 0;
  if (habitude.type === "quantifiee" && habitude.valeur_cible) {
    return Math.min(1, valeur / habitude.valeur_cible);
  }
  return 1;
}

export function HistoriqueView({
  habitudes,
  isError = false,
}: {
  habitudes: Tables<"habitudes">[];
  isError?: boolean;
}) {
  const [choixId, setHabitudeId] = useState("");
  // Id effectif : retombe sur la première habitude tant que le choix est vide
  // ou périmé (données arrivées après coup, habitude archivée ailleurs).
  const habitudeId = habitudes.some((h) => h.id === choixId) ? choixId : (habitudes[0]?.id ?? "");
  const [mois, setMois] = useState(() => startOfMonth(new Date()));
  // Sens du dernier changement de mois (swipe ou boutons ←/→), pilote le
  // sens de l'animation `agenda-glisse-*` rejouée ci-dessous.
  const [sens, setSens] = useState<SensSwipe>("suivant");

  const swipeHandlers = useSwipeHorizontal((sensSwipe) => {
    setSens(sensSwipe);
    setMois(sensSwipe === "suivant" ? addMonths(mois, 1) : subMonths(mois, 1));
  });

  const habitude = habitudes.find((h) => h.id === habitudeId);

  const moisISO = toISODate(startOfMonth(mois));
  const {
    data: entries = [],
    isFetching,
    isError: historiqueEnErreur,
    refetch,
  } = useQuery({
    queryKey: queryKeys.historiqueHabitude(habitudeId, moisISO),
    queryFn: () => getHistoriqueHabitude(habitudeId, moisISO, toISODate(endOfMonth(mois))),
    enabled: !!habitudeId,
  });

  if (isError && habitudes.length === 0) {
    return <ErrorInline message="Impossible de charger les habitudes." />;
  }
  if (habitudes.length === 0) {
    return <p className="text-ink-2">Aucune habitude pour l&apos;instant.</p>;
  }

  const valeurParDate = new Map(entries.map((e) => [e.date, e.valeur]));
  const monthStart = startOfMonth(mois);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(mois) });
  const decalage = (monthStart.getDay() + 6) % 7; // lundi = 0

  return (
    <div className="flex flex-col gap-4">
      <select
        value={habitudeId}
        onChange={(e) => setHabitudeId(e.target.value)}
        className={input}
      >
        {habitudes.map((h) => (
          <option key={h.id} value={h.id}>
            {h.icone ? `${h.icone} ` : ""}
            {h.nom}
          </option>
        ))}
      </select>

      {habitude && (
        <div
          data-swipe-zone
          onTouchStart={swipeHandlers.onTouchStart}
          onTouchMove={swipeHandlers.onTouchMove}
          onTouchEnd={swipeHandlers.onTouchEnd}
        >
          <div
            key={format(mois, "yyyy-MM")}
            className={`flex flex-col gap-3 ${
              sens === "suivant" ? "agenda-glisse-suivant" : "agenda-glisse-precedent"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setSens("precedent");
                  setMois(subMonths(mois, 1));
                }}
                className={navArrowButton}
                aria-label="Mois précédent"
              >
                ←
              </button>
              <span className="text-sm font-semibold capitalize text-ink">
                {format(mois, "MMMM yyyy", { locale: fr })}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSens("suivant");
                  setMois(addMonths(mois, 1));
                }}
                className={navArrowButton}
                aria-label="Mois suivant"
              >
                →
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-micro font-semibold text-ink-2">
              {WEEKDAY_LABELS.map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>

            {historiqueEnErreur && (
              <ErrorInline message="Impossible de charger l'historique." retry={() => refetch()} />
            )}

            <div className={`grid grid-cols-7 gap-1 transition-opacity ${isFetching && !historiqueEnErreur ? "opacity-60" : ""}`}>
              {Array.from({ length: decalage }).map((_, i) => (
                <span key={`vide-${i}`} />
              ))}
              {days.map((day) => {
                const iso = toISODate(day);
                const ratio = intensite(habitude, valeurParDate.get(iso));
                const inMonth = isSameMonth(day, mois);
                const valeur = valeurParDate.get(iso);
                const etat =
                  ratio === 0
                    ? "non fait"
                    : habitude.type === "quantifiee" && habitude.valeur_cible
                      ? ratio >= 1
                        ? `fait, ${valeur} sur ${habitude.valeur_cible}`
                        : `${valeur} sur ${habitude.valeur_cible}`
                      : "fait";

                return (
                  <div
                    key={iso}
                    aria-current={isToday(day) ? "date" : undefined}
                    className={`flex aspect-square flex-col items-center justify-center rounded-xl border text-small tabular-nums ${
                      isToday(day) ? "border-habitudes" : "border-line"
                    } ${inMonth ? "text-ink" : "text-ink-3"} ${
                      ratio > 0
                        ? "bg-[color-mix(in_oklch,var(--accent-habitudes)_var(--mix),transparent)] dark:bg-[color-mix(in_oklch,var(--accent-habitudes)_var(--mix-sombre),transparent)]"
                        : ""
                    }`}
                    style={
                      ratio > 0
                        ? ({
                            "--mix": `${15 + ratio * 70}%`,
                            // Thème sombre : opacité plafonnée à 40 % pour garder
                            // le texte `ink` clair à plus de 4,5:1.
                            "--mix-sombre": `${15 + ratio * 25}%`,
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    {format(day, "d")}
                    <span className="sr-only">
                      {format(day, "EEEE d MMMM", { locale: fr })} : {etat}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
