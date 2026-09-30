"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { enregistrerEntreeObjectif, supprimerEntreeObjectif } from "@/app/actions/objectifs";
import { queryKeys } from "@/lib/query/keys";
import { runAction } from "@/lib/actions/runAction";
import type { Tables } from "@/lib/supabase/types";
import { card, dangerButton, errorText, ghostButton, input, label as labelClass, metaText, sectionTitle } from "@/lib/ui";
import { toISODate } from "@/lib/date/iso";

function EvolutionChart({
  entries,
  cible,
}: {
  entries: Tables<"objectif_entries">[];
  cible: number | null;
}) {
  if (entries.length < 2) return null;

  const width = 320;
  const height = 100;
  const padding = 8;

  const valeurs = entries.map((e) => e.valeur);
  const min = Math.min(...valeurs, cible ?? Infinity);
  const max = Math.max(...valeurs, cible ?? -Infinity);
  const range = max - min || 1;

  const points = entries.map((e, i) => {
    const x = padding + (i / (entries.length - 1)) * (width - padding * 2);
    const y = height - padding - ((e.valeur - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const cibleY =
    cible != null ? height - padding - ((cible - min) / range) * (height - padding * 2) : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Évolution de la valeur dans le temps"
    >
      {cibleY != null && (
        <line
          x1={padding}
          y1={cibleY}
          x2={width - padding}
          y2={cibleY}
          stroke="var(--line)"
          strokeDasharray="4 3"
          strokeWidth={1}
        />
      )}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="var(--accent-kcal)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Saisie ponctuelle (au plus une fois par jour), pas une bascule répétée :
// reste en Server Action + useTransition, sans rendu optimiste local (même
// patron que SousTachesList dans taches/TasksList.tsx). `invalidateQueries`
// remplace la reconciliation par prop qu'assurait `revalidatePath` avant le
// passage de la page détail en lecture côté client (TanStack Query) :
// cette Server Action continue d'appeler `revalidatePath`, mais ce
// mécanisme n'a plus d'effet sur le cache TanStack de cette page.
export function ObjectifSuiviValeur({
  objectifId,
  objectif,
  entries,
}: {
  objectifId: string;
  objectif: Tables<"objectifs">;
  entries: Tables<"objectif_entries">[];
}) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => toISODate(new Date()));
  const valeurInputRef = useRef<HTMLInputElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const dateId = useId();
  const valeurId = useId();
  const erreurId = useId();

  const valeurExistante = entries.find((e) => e.date === date)?.valeur;

  const derniere = entries[entries.length - 1] ?? null;
  const ratio =
    objectif.valeur_cible != null
      ? Math.min(1, Math.max(0, (derniere?.valeur ?? 0) / objectif.valeur_cible))
      : null;

  // Champ vide : refusé en ligne (plus d'enregistrement de 0 qui écrasait
  // la mesure du jour) ; la valeur brute part au serveur, qui refuse aussi.
  function enregistrer() {
    const saisie = valeurInputRef.current?.value.trim() ?? "";
    if (saisie === "") {
      setErreur(
        valeurExistante !== undefined
          ? "Champ vide : saisis une valeur, ou utilise « Supprimer la mesure »."
          : "Saisis une valeur avant d'enregistrer."
      );
      valeurInputRef.current?.focus();
      return;
    }
    setErreur(null);
    startTransition(async () => {
      const resultat = await runAction(() => enregistrerEntreeObjectif(objectifId, date, saisie), {
        silencieux: true,
        onError: setErreur,
      });
      if (resultat.ok) queryClient.invalidateQueries({ queryKey: queryKeys.objectif(objectifId) });
    });
  }

  function supprimerMesure() {
    setErreur(null);
    startTransition(async () => {
      const resultat = await runAction(() => supprimerEntreeObjectif(objectifId, date), {
        silencieux: true,
        onError: setErreur,
      });
      if (resultat.ok) queryClient.invalidateQueries({ queryKey: queryKeys.objectif(objectifId) });
    });
  }

  return (
    <div className={`${card} flex flex-col gap-4`}>
      <h2 className={sectionTitle}>Évolution</h2>

      {objectif.valeur_cible != null && (
        <div className="flex flex-col gap-1.5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-alt">
            <div
              className="h-full rounded-full bg-kcal transition-[width]"
              style={{ width: `${(ratio ?? 0) * 100}%` }}
            />
          </div>
          <span className={metaText}>
            {derniere ? derniere.valeur : 0}
            {objectif.unite ? ` ${objectif.unite}` : ""} / {objectif.valeur_cible}
            {objectif.unite ? ` ${objectif.unite}` : ""}
          </span>
        </div>
      )}

      <EvolutionChart entries={entries} cible={objectif.valeur_cible} />

      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={dateId} className={labelClass}>
            Date
          </label>
          <input
            id={dateId}
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setErreur(null);
            }}
            className={`${input} w-full min-w-0`}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={valeurId} className={labelClass}>
            Valeur{objectif.unite ? ` (${objectif.unite})` : ""}
          </label>
          <input
            key={date}
            id={valeurId}
            ref={valeurInputRef}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={valeurExistante ?? ""}
            onChange={() => erreur && setErreur(null)}
            aria-invalid={erreur ? true : undefined}
            aria-describedby={erreur ? erreurId : undefined}
            className={input}
          />
        </div>
        <button type="button" disabled={isPending} onClick={enregistrer} className={`${ghostButton} min-h-11`}>
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      {erreur && (
        <p id={erreurId} role="alert" className={errorText}>
          {erreur}
        </p>
      )}
      {valeurExistante !== undefined && (
        <button
          type="button"
          disabled={isPending}
          onClick={supprimerMesure}
          className={`${dangerButton} min-h-11 self-start`}
        >
          Supprimer la mesure du {new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
        </button>
      )}
    </div>
  );
}
