"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfToday,
  startOfWeek,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import type { Tables } from "@/lib/supabase/types";
import type { Evenement } from "@/app/actions/evenements";
import { getCreneauxDuJour } from "@/lib/agenda/planning-travail";
import { PeriodHeader } from "./PeriodHeader";
import { toISODate } from "@/lib/date/iso";

type Tache = Tables<"taches">;

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

// "jour travaillé" n'est annoncé que si des créneaux de planning-travail
// existent effectivement ce jour-là (cf. `jourTravaille` ci-dessous) : ne
// pas l'annoncer par défaut évite de donner une fausse information à un
// utilisateur de lecteur d'écran un jour sans créneau.
function monthCellAriaLabel(day: Date, count: number, nbEvenements: number, jourTravaille: boolean): string {
  const dateLabel = format(day, "EEEE d MMMM", { locale: fr });
  const tachesLabel = count === 0 ? "aucune tâche" : count === 1 ? "1 tâche" : `${count} tâches`;
  const evenementsLabel =
    nbEvenements === 0 ? "" : nbEvenements === 1 ? ", 1 événement" : `, ${nbEvenements} événements`;
  return `${dateLabel}, ${tachesLabel}${evenementsLabel}${jourTravaille ? ", jour travaillé" : ""}`;
}

export function MonthView({
  taches,
  evenements = [],
  creneaux,
  exceptions,
  selectedDate,
  onChangeDate,
  onSelectDay,
}: {
  taches: Tache[];
  evenements?: Evenement[];
  creneaux: Tables<"horaires_travail_creneaux">[];
  exceptions: Tables<"horaires_travail_exceptions">[];
  selectedDate: Date;
  onChangeDate: (date: Date) => void;
  onSelectDay: (date: Date) => void;
}) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const countByDay = new Map<string, number>();
  for (const t of taches) {
    if (!t.echeance || t.fait) continue;
    countByDay.set(t.echeance, (countByDay.get(t.echeance) ?? 0) + 1);
  }

  const evenementsByDay = new Map<string, number>();
  for (const e of evenements) {
    evenementsByDay.set(e.date, (evenementsByDay.get(e.date) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-3">
      <PeriodHeader
        title={format(selectedDate, "MMMM yyyy", { locale: fr })}
        capitalizeTitle
        prevLabel="Mois précédent"
        nextLabel="Mois suivant"
        onPrev={() => onChangeDate(subMonths(selectedDate, 1))}
        onNext={() => onChangeDate(addMonths(selectedDate, 1))}
        showToday={!isSameMonth(selectedDate, new Date())}
        onToday={() => onChangeDate(startOfToday())}
      />

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-ink-2">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const iso = toISODate(day);
          const count = countByDay.get(iso) ?? 0;
          const nbEvenements = evenementsByDay.get(iso) ?? 0;
          const inMonth = isSameMonth(day, selectedDate);
          const jourTravaille = getCreneauxDuJour(creneaux, day, exceptions).length > 0;

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-label={monthCellAriaLabel(day, count, nbEvenements, jourTravaille)}
              aria-current={isToday(day) ? "date" : undefined}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border text-[13px] ${
                isToday(day) ? "border-agenda" : "border-line"
              } ${inMonth ? "text-ink" : "text-ink-3"} ${jourTravaille ? "" : "bg-surface"}`}
              style={jourTravaille ? { backgroundColor: "var(--accent-planning-travail-soft)" } : undefined}
            >
              <span>{format(day, "d")}</span>
              {(count > 0 || nbEvenements > 0) && (
                <span className="flex items-center gap-0.5">
                  {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-agenda" />}
                  {nbEvenements > 0 && <span className="h-1.5 w-1.5 rounded-[2px] bg-agenda" />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Légende décorative : le statut "jour travaillé"/nombre de tâches
          est déjà annoncé par case via monthCellAriaLabel ci-dessus, donc
          masquée aux lecteurs d'écran pour ne pas doubler l'annonce. */}
      <div aria-hidden className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-ink-2">
        <span className="flex items-center gap-1">
          <span
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ backgroundColor: "var(--accent-planning-travail-soft)" }}
          />
          jour travaillé
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-agenda" />
          tâche(s)
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-[2px] bg-agenda" />
          événement(s)
        </span>
      </div>
    </div>
  );
}
