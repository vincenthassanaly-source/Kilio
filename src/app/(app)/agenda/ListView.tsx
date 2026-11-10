"use client";

import { useState } from "react";
import { compareAsc, format, startOfToday } from "date-fns";
import { fr } from "date-fns/locale";
import type { TacheAvecRelations } from "@/app/actions/taches";
import type { Tables } from "@/lib/supabase/types";
import type { Evenement } from "@/app/actions/evenements";
import { libellePlage } from "@/lib/evenements/compute";
import { TaskCard } from "../taches/TasksList";
import { FerieBadge } from "@/components/FerieBadge";
import { sectionTitle } from "@/lib/ui";
import { ArchivedTasksSection } from "./ArchivedTasksSection";
import { parseISODate, toISODate } from "@/lib/date/iso";
import { majusculePremiere } from "./date-utils";
import { sortByHeure } from "./date-utils";

export function ListView({
  taches,
  evenements = [],
  feries,
  listes,
  tags,
  onSelectEvenement,
  fenetreEvenements,
}: {
  taches: TacheAvecRelations[];
  evenements?: Evenement[];
  feries?: ReadonlyMap<string, string>;
  onSelectEvenement?: (evenement: Evenement) => void;
  listes: Tables<"listes_taches">[];
  tags: Tables<"tags">[];
  // Période couverte par `evenements` (dates ISO) : annoncée en bas de liste.
  fenetreEvenements?: { debut: string; fin: string };
}) {
  const [passesOuverts, setPassesOuverts] = useState(false);
  const aujourdhuiIso = toISODate(startOfToday());
  const actives = taches.filter((t) => !t.fait);
  const archivees = taches
    .filter((t) => t.fait)
    .sort((a, b) => {
      const dateCompare = (b.echeance ?? "").localeCompare(a.echeance ?? "");
      if (dateCompare !== 0) return dateCompare;
      return (b.heure ?? "").localeCompare(a.heure ?? "");
    });

  const withDate = actives.filter((t) => t.echeance);
  const withoutDate = actives.filter((t) => !t.echeance);

  const groups = new Map<string, TacheAvecRelations[]>();
  for (const t of withDate) {
    const list = groups.get(t.echeance!) ?? [];
    list.push(t);
    groups.set(t.echeance!, list);
  }

  const evenementsParJour = new Map<string, Evenement[]>();
  for (const e of evenements) {
    const list = evenementsParJour.get(e.date) ?? [];
    list.push(e);
    evenementsParJour.set(e.date, list);
  }

  const sortedDates = Array.from(new Set([...groups.keys(), ...evenementsParJour.keys()])).sort((a, b) =>
    compareAsc(parseISODate(a), parseISODate(b))
  );

  const passes = sortedDates.filter((iso) => iso < aujourdhuiIso);
  const avenir = sortedDates.filter((iso) => iso >= aujourdhuiIso);

  function rendreJour(iso: string) {
        const dayTaches = (groups.get(iso) ?? []).sort(sortByHeure);
        const dayEvenements = evenementsParJour.get(iso) ?? [];
    return (
          <div key={iso} className="flex flex-col gap-2">
            <h2 className={sectionTitle}>
              {iso === aujourdhuiIso ? "Aujourd'hui · " : ""}
              {majusculePremiere(format(parseISODate(iso), "EEEE d MMMM yyyy", { locale: fr }))}
            </h2>
            {feries?.has(iso) && <FerieBadge nom={feries.get(iso)!} className="self-start" />}
            <ul className="flex flex-col gap-2.5">
              {dayEvenements.map((evenement) => (
                <li key={evenement.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEvenement?.(evenement)}
                    disabled={!onSelectEvenement}
                    aria-label={`Événement ${evenement.titre}, ${libellePlage(evenement.heure, evenement.heure_fin)}. Modifier`}
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-agenda px-3 py-2 text-left text-label font-semibold text-on-agenda focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    <span className="tabular-nums">{libellePlage(evenement.heure, evenement.heure_fin)}</span>
                    <span className="truncate">{evenement.titre}</span>
                  </button>
                </li>
              ))}
              {dayTaches.map((tache) => (
                <TaskCard key={tache.id} tache={tache} listes={listes} tags={tags} colorByListe />
              ))}
            </ul>
          </div>
        );
  }

  if (sortedDates.length === 0 && withoutDate.length === 0 && archivees.length === 0) {
    return <p className="text-ink-2">Rien d&apos;agendé pour l&apos;instant. Ajoute une tâche ou un événement avec le bouton +.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {passes.length > 0 && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setPassesOuverts((v) => !v)}
            aria-expanded={passesOuverts}
            className="flex min-h-11 w-full items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
          >
            <span className={sectionTitle}>Jours passés ({passes.length})</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`text-ink-2 transition-transform duration-200 ${passesOuverts ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {passesOuverts && passes.map((iso) => rendreJour(iso))}
        </div>
      )}
      {avenir.map((iso) => rendreJour(iso))}

      {withoutDate.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className={sectionTitle}>Sans date</h2>
          <ul className="flex flex-col gap-2.5">
            {withoutDate.map((tache) => (
              <TaskCard key={tache.id} tache={tache} listes={listes} tags={tags} colorByListe />
            ))}
          </ul>
        </div>
      )}

      <ArchivedTasksSection taches={archivees} listes={listes} tags={tags} />

      {fenetreEvenements && (
        <p className="text-center text-caption text-ink-2">
          Événements affichés du {format(parseISODate(fenetreEvenements.debut), "d MMM", { locale: fr })} au{" "}
          {format(parseISODate(fenetreEvenements.fin), "d MMM yyyy", { locale: fr })}.
        </p>
      )}
    </div>
  );
}
