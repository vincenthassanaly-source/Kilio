"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { addJournalEntry, type JournalFormState } from "@/app/actions/journal";
import { showActionToast } from "@/components/toast/toast-store";
import { MESSAGE_HORS_LIGNE } from "@/lib/actions/runAction";
import {
  AJOUT_LABELS,
  MOMENTS_REPAS,
  MOMENT_LABELS,
  momentParDefaut,
  type MomentRepas,
  type Nutrition,
} from "@/lib/nutrition/compute";
import { queryKeys } from "@/lib/query/keys";
import { errorText, ghostButton, primaryButton } from "@/lib/ui";
import { SegmentedControl } from "@/components/SegmentedControl";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";
const boutonPortion = `flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-base text-ink transition active:scale-[0.97] ${focusRing}`;

function fmt(n: number) {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

const CHIPS: { key: keyof Nutrition; label: string; unit: string; color: string }[] = [
  { key: "kcal", label: "kcal", unit: "", color: "var(--accent-kcal)" },
  { key: "proteines", label: "protéines", unit: "g", color: "var(--accent-protein)" },
  { key: "glucides", label: "glucides", unit: "g", color: "var(--accent-carbs)" },
  { key: "lipides", label: "lipides", unit: "g", color: "var(--accent-fat)" },
];

type DetailValues = {
  sucres_portion: number | null;
  satures_portion: number | null;
  fibres_portion: number | null;
  sel_portion: number | null;
  sucres_100g: number | null;
  satures_100g: number | null;
  fibres_100g: number | null;
  sel_100g: number | null;
};

const DETAIL_FIELDS: { portionKey: keyof DetailValues; g100Key: keyof DetailValues; label: string }[] = [
  { portionKey: "sucres_portion", g100Key: "sucres_100g", label: "dont sucres" },
  { portionKey: "satures_portion", g100Key: "satures_100g", label: "dont saturés" },
  { portionKey: "fibres_portion", g100Key: "fibres_100g", label: "fibres" },
  { portionKey: "sel_portion", g100Key: "sel_100g", label: "sel" },
];

export function RecetteMacros({
  recetteId,
  nom,
  perPortion,
  detail,
}: {
  recetteId: string;
  nom: string;
  perPortion: Nutrition;
  detail?: DetailValues;
}) {
  const [count, setCount] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  // Pré-rempli selon l'heure, à l'ouverture de la fiche (constat R-P0-1).
  const [moment, setMoment] = useState<MomentRepas>(() => {
    const d = new Date();
    return momentParDefaut(d.getHours() + d.getMinutes() / 60);
  });

  // « Portions consommées » enregistre enfin quelque chose : le compteur
  // part dans le Journal du jour via addJournalEntry (type recette).
  const [etat, formAction, enCours] = useActionState<JournalFormState, FormData>(
    async (precedent, formData) => {
      try {
        const resultat = await addJournalEntry(precedent, formData);
        if (resultat.ok) {
          queryClient.invalidateQueries({ queryKey: queryKeys.catalogueJournal });
          queryClient.invalidateQueries({ queryKey: ["resume-nutrition"] });
          showActionToast(`${count} portion${count > 1 ? "s" : ""} de « ${nom} » ajoutée${count > 1 ? "s" : ""} ${AJOUT_LABELS[moment]}`, {
            label: "Voir",
            ariaLabel: "Voir le journal du jour",
            onAction: () => router.push("/nutrition/journal"),
          });
        }
        return resultat;
      } catch {
        return { error: MESSAGE_HORS_LIGNE };
      }
    },
    { error: null }
  );

  const hasDetail =
    detail != null &&
    DETAIL_FIELDS.some((f) => detail[f.portionKey] != null || detail[f.g100Key] != null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-label font-semibold text-ink">Portions consommées</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCount((n) => Math.max(1, n - 1))}
            className={boutonPortion}
            aria-label="Retirer une portion"
          >
            −
          </button>
          <span className="w-5 text-center font-display text-base font-semibold text-ink tabular-nums" aria-live="polite">
            {count}
          </span>
          <button
            type="button"
            onClick={() => setCount((n) => n + 1)}
            className={boutonPortion}
            aria-label="Ajouter une portion"
          >
            +
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {CHIPS.map((chip) => (
          <div key={chip.key} className="rounded-xl bg-surface-alt px-1.5 py-2.5 text-center">
            <div className="font-display text-base font-semibold tabular-nums" style={{ color: chip.color }}>
              {fmt(perPortion[chip.key] * count)}
              {chip.unit}
            </div>
            <div className="mt-0.5 text-micro text-ink-3">{chip.label}</div>
          </div>
        ))}
      </div>

      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="type" value="recette" />
        <input type="hidden" name="recette_id" value={recetteId} />
        <input type="hidden" name="quantite" value={count} />
        <input type="hidden" name="moment" value={moment} />
        <SegmentedControl
          ariaLabel="Moment du repas"
          taille="sm"
          options={MOMENTS_REPAS.map((m) => ({ value: m, label: MOMENT_LABELS[m] }))}
          value={moment}
          onChange={setMoment}
        />
        <button type="submit" disabled={enCours} className={`${primaryButton} min-h-12 w-full`}>
          {enCours ? "Ajout…" : "Ajouter au journal"}
        </button>
        {etat.error && (
          <p role="alert" className={errorText}>
            {etat.error}
          </p>
        )}
      </form>

      {hasDetail && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setDetailOpen((o) => !o)}
            className={`self-start ${ghostButton}`}
          >
            {detailOpen ? "Masquer le détail" : "Voir le détail nutritionnel"}
          </button>
          {detailOpen && (
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-small">
                <thead>
                  <tr className="border-b border-line bg-surface-alt text-ink-2">
                    <th className="px-2.5 py-1.5 text-left font-medium">Valeur nutritionnelle</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Par portion</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Pour 100g</th>
                  </tr>
                </thead>
                <tbody>
                  {DETAIL_FIELDS.map((f) => {
                    const parPortion = detail![f.portionKey];
                    const par100g = detail![f.g100Key];
                    if (parPortion == null && par100g == null) return null;
                    return (
                      <tr key={f.label} className="border-b border-line last:border-0">
                        <td className="px-2.5 py-1.5 text-ink">{f.label}</td>
                        <td className="px-2.5 py-1.5 text-right text-ink">
                          {parPortion != null ? `${fmt(parPortion)} g` : "—"}
                        </td>
                        <td className="px-2.5 py-1.5 text-right text-ink">
                          {par100g != null ? `${fmt(par100g)} g` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
