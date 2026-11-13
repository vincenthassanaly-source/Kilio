"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getMesuresRecentes } from "@/app/actions/sante";
import { queryKeys } from "@/lib/query/keys";
import { card, sectionTitle } from "@/lib/ui";
import { PeseeForm } from "../nutrition/bilan/PeseeForm";

/** Nombre de jours sans relevé à partir duquel la pesée de la semaine est proposée. */
const DELAI_PESEE_JOURS = 7;

const joursDepuis = (date: string, today: string) =>
  Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);

/**
 * Pesée de la semaine : n'apparaît dans Aujourd'hui que lorsqu'aucun relevé n'a
 * été saisi depuis 7 jours (ou jamais), pour que la mesure du ventre ne dépende
 * pas d'y penser. Disparaît dès le relevé enregistré.
 *
 * C'est le seul endroit où l'on saisit une pesée (le Bilan ne fait que
 * consulter) : son bouton « Peser » mène ici avec `?peser=1`, qui affiche la
 * carte même si un relevé est récent et la met en vue.
 */
export function PeseeCard({ today }: { today: string }) {
  const demandee = useSearchParams().get("peser") === "1";
  const ref = useRef<HTMLElement>(null);
  const { data: mesures } = useQuery({
    queryKey: queryKeys.mesuresRecentes,
    queryFn: () => getMesuresRecentes(5),
  });

  const visible = !!mesures && (demandee || !mesures[0] || joursDepuis(mesures[0].date, today) >= DELAI_PESEE_JOURS);

  // Arrivée depuis le Bilan : la carte est mise en vue une fois affichée.
  useEffect(() => {
    if (demandee && visible) {
      ref.current?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }
  }, [demandee, visible]);

  if (!mesures || !visible) return null;
  const dernier = mesures[0];

  return (
    <section ref={ref} className={`${card} flex flex-col gap-3`} aria-label="Pesée de la semaine">
      <div className="flex flex-col gap-0.5">
        <h2 className={sectionTitle}>Pesée de la semaine</h2>
        <p className="text-small leading-snug text-ink-2">
          {dernier && joursDepuis(dernier.date, today) < DELAI_PESEE_JOURS
            ? "Nouveau relevé : poids et tour de taille, en 10 secondes."
            : dernier
            ? `Dernier relevé il y a ${joursDepuis(dernier.date, today)} jours : poids et tour de taille, en 10 secondes.`
            : "Un premier relevé : poids et tour de taille, en 10 secondes."}
        </p>
      </div>
      <PeseeForm today={today} mesures={mesures} compact />
    </section>
  );
}
