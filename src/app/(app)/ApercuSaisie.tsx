"use client";

import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createSousTache, createTache, getListes } from "@/app/actions/taches";
import { createEvenement } from "@/app/actions/evenements";
import { showToast } from "@/components/toast/toast-store";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import {
  erreurElement,
  formDataTache,
  HEURE_PROPOSEE_PAR_DEFAUT,
  inputEvenement,
  libelleRappel,
  type ElementSaisie,
  type FrequenceSaisie,
} from "@/lib/saisie/compute";
import { FREQUENCE_LABELS } from "@/lib/date/recurrence";
import { DUREES_EVENEMENT, DUREE_EVENEMENT_PAR_DEFAUT } from "@/lib/evenements/compute";
import { DUREE_TOAST_AVERTISSEMENT_MS, libelleDuree } from "@/lib/taches/compute";
import { errorText, input, label as labelClass, primaryButton, secondaryButton } from "@/lib/ui";

const MESSAGE_ECHEC = "L'ajout a échoué. Réessaie.";
const puce = "rounded-full bg-surface-alt px-2 py-0.5 text-[11px] font-semibold text-ink-2";

function Puce({ children }: { children: string }) {
  return <span className={puce}>{children}</span>;
}

function CarteElement({
  e,
  listes,
  erreur,
  onChange,
  onRetirer,
}: {
  e: ElementSaisie;
  listes: { id: string; nom: string }[];
  erreur?: string;
  onChange: (patch: Partial<ElementSaisie>) => void;
  onRetirer: () => void;
}) {
  const uid = useId();
  const evenement = e.type === "evenement";
  const dateManquante = evenement && !e.date;
  const rappels: { valeur: string; label: string }[] = e.touteLaJournee
    ? [
        { valeur: "", label: "Aucun rappel" },
        { valeur: "1440", label: libelleRappel(1440, true) },
      ]
    : [
        { valeur: "", label: "Aucun rappel" },
        ...[0, 5, 15, 30, 60, 1440].map((m) => ({ valeur: String(m), label: libelleRappel(m) })),
      ];

  function changerType(type: ElementSaisie["type"]) {
    if (type === e.type) return;
    onChange({
      type,
      dureeMinutes: type === "evenement" ? (e.dureeMinutes ?? DUREE_EVENEMENT_PAR_DEFAUT) : e.dureeMinutes,
    });
  }

  function changerJourneeEntiere(valeur: boolean) {
    if (valeur) {
      onChange({
        touteLaJournee: true,
        heure: "",
        heureProposee: false,
        rappelMinutes: e.rappelMinutes === 1440 ? 1440 : null,
        rappelOrigine: e.rappelMinutes === 1440 ? e.rappelOrigine : null,
      });
    } else {
      onChange({
        touteLaJournee: false,
        heure: e.heure || HEURE_PROPOSEE_PAR_DEFAUT,
        heureProposee: !e.heure,
      });
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface-alt/40 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div role="group" aria-label="Type" className="flex rounded-full border border-line bg-surface p-0.5">
          {(["tache", "evenement"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={e.type === t}
              onClick={() => changerType(t)}
              className={`min-h-9 rounded-full px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
                e.type === t ? "bg-kcal text-on-kcal" : "text-ink-2"
              }`}
            >
              {t === "tache" ? "Tâche" : "Événement"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRetirer}
          className="min-h-11 px-2 text-[13px] font-semibold text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
        >
          Retirer
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-titre`} className={labelClass}>
          Titre
        </label>
        <input
          id={`${uid}-titre`}
          value={e.titre}
          maxLength={200}
          onChange={(ev) => onChange({ titre: ev.target.value })}
          className={input}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-date`} className={labelClass}>
            Date
          </label>
          <input
            id={`${uid}-date`}
            type="date"
            value={e.date}
            aria-invalid={dateManquante}
            onChange={(ev) => onChange({ date: ev.target.value })}
            className={`${input} ${dateManquante ? "border-alert" : ""}`}
          />
          {dateManquante && <span className={errorText}>À préciser</span>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-heure`} className={`${labelClass} flex items-center gap-1.5`}>
            Heure {e.heureProposee && <Puce>proposée</Puce>}
          </label>
          <input
            id={`${uid}-heure`}
            type="time"
            value={e.heure}
            disabled={e.touteLaJournee}
            onChange={(ev) => {
              const heure = ev.target.value;
              onChange({
                heure,
                heureProposee: false,
                ...(heure === "" ? { rappelMinutes: null, rappelOrigine: null } : {}),
              });
            }}
            className={`${input} tabular-nums disabled:opacity-50`}
          />
        </div>
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={e.touteLaJournee}
          onChange={(ev) => changerJourneeEntiere(ev.target.checked)}
          className="h-4 w-4 accent-[var(--accent-kcal)]"
        />
        Toute la journée
      </label>

      {evenement && !e.touteLaJournee && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-duree`} className={labelClass}>
            Durée
          </label>
          <select
            id={`${uid}-duree`}
            value={e.dureeMinutes ?? DUREE_EVENEMENT_PAR_DEFAUT}
            onChange={(ev) => onChange({ dureeMinutes: Number(ev.target.value) })}
            className={input}
          >
            {[...new Set<number>([...DUREES_EVENEMENT, e.dureeMinutes ?? DUREE_EVENEMENT_PAR_DEFAUT])]
              .sort((a, b) => a - b)
              .map((d) => (
                <option key={d} value={d}>
                  {libelleDuree(d)}
                </option>
              ))}
          </select>
        </div>
      )}

      {!evenement && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-liste`} className={`${labelClass} flex items-center gap-1.5`}>
            Liste {e.listeDeduite && <Puce>déduite</Puce>}
          </label>
          <select
            id={`${uid}-liste`}
            value={e.listeId}
            onChange={(ev) => onChange({ listeId: ev.target.value, listeDeduite: false })}
            className={input}
          >
            {listes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      {(e.heure || e.touteLaJournee) && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-rappel`} className={`${labelClass} flex items-center gap-1.5`}>
            Rappel
            {e.rappelOrigine === "defaut" && <Puce>par défaut</Puce>}
            {e.rappelOrigine === "arrondi" && <Puce>arrondi</Puce>}
          </label>
          <select
            id={`${uid}-rappel`}
            value={e.rappelMinutes === null ? "" : String(e.rappelMinutes)}
            onChange={(ev) =>
              onChange({
                rappelMinutes: ev.target.value === "" ? null : Number(ev.target.value),
                rappelOrigine: null,
              })
            }
            className={input}
          >
            {rappels.map((r) => (
              <option key={r.valeur} value={r.valeur}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-frequence`} className={labelClass}>
          Répétition
        </label>
        <select
          id={`${uid}-frequence`}
          value={e.frequence}
          onChange={(ev) =>
            onChange({
              frequence: ev.target.value as FrequenceSaisie | "",
              finRecurrence: ev.target.value ? e.finRecurrence : "",
            })
          }
          className={input}
        >
          <option value="">Aucune</option>
          {(Object.keys(FREQUENCE_LABELS) as FrequenceSaisie[]).map((f) => (
            <option key={f} value={f}>
              {FREQUENCE_LABELS[f]}
            </option>
          ))}
        </select>
      </div>

      {!evenement && (e.tagIds.length > 0 || e.nouveauxTags.length > 0) && (
        <p className="text-[13px] text-ink-2">
          Tags :{" "}
          {[
            ...e.nouveauxTags.map((t) => `${t} (nouveau)`),
            ...(e.tagIds.length > 0 ? [`${e.tagIds.length} existant${e.tagIds.length > 1 ? "s" : ""}`] : []),
          ].join(", ")}
        </p>
      )}

      {!evenement && e.sousTaches.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Sous-tâches">
          {e.sousTaches.map((s, i) => (
            <li key={`${i}-${s}`} className="flex items-center justify-between gap-2 text-sm text-ink">
              <span className="min-w-0 flex-1 truncate">• {s}</span>
              <button
                type="button"
                aria-label={`Retirer la sous-tâche « ${s} »`}
                onClick={() => onChange({ sousTaches: e.sousTaches.filter((_, j) => j !== i) })}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {erreur && (
        <p role="alert" className={errorText}>
          {erreur}
        </p>
      )}
    </li>
  );
}

/**
 * Aperçu modifiable des éléments compris par Gemini. Rien n'est écrit tant
 * que « Valider » n'est pas pressé ; un élément créé disparaît de la liste,
 * un élément en échec reste (avec son message) pour être corrigé ou réessayé
 * sans doublon.
 */
export function ApercuSaisie({ initiaux, onTermine }: { initiaux: ElementSaisie[]; onTermine: (ajoute: boolean) => void }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [elements, setElements] = useState(initiaux);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState(false);
  const { data: listes = [] } = useQuery({ queryKey: queryKeys.listes, queryFn: getListes });

  function maj(cle: string, patch: Partial<ElementSaisie>) {
    setElements((prev) => prev.map((e) => (e.cle === cle ? { ...e, ...patch } : e)));
    setErreurs((prev) => {
      if (!(cle in prev)) return prev;
      const reste = { ...prev };
      delete reste[cle];
      return reste;
    });
  }

  async function creer(e: ElementSaisie): Promise<{ erreur: string | null; avertissement?: string }> {
    const invalide = erreurElement(e);
    if (invalide) return { erreur: invalide };
    try {
      if (e.type === "evenement") {
        const r = await runAction(() => createEvenement(inputEvenement(e)), {
          silencieux: true,
          erreur: MESSAGE_ECHEC,
        });
        return { erreur: r.ok ? null : r.error };
      }
      const r = await createTache({ error: null }, formDataTache(e));
      if (r.error || !r.id) return { erreur: r.error ?? MESSAGE_ECHEC };
      let sousTachesEnEchec = 0;
      for (const titre of e.sousTaches) {
        const s = await createSousTache(r.id, titre);
        if (!s.ok) sousTachesEnEchec++;
      }
      const avertissements = [
        r.avertissement,
        sousTachesEnEchec > 0 ? `${sousTachesEnEchec} sous-tâche(s) n'ont pas pu être ajoutées.` : undefined,
      ].filter(Boolean);
      return { erreur: null, avertissement: avertissements.join(" ") || undefined };
    } catch {
      return { erreur: MESSAGE_ECHEC };
    }
  }

  async function valider() {
    if (enCours) return;
    setEnCours(true);
    const restants: ElementSaisie[] = [];
    const nouvellesErreurs: Record<string, string> = {};
    let crees = 0;
    const avertissements: string[] = [];
    for (const e of elements) {
      const r = await creer(e);
      if (r.erreur) {
        restants.push(e);
        nouvellesErreurs[e.cle] = r.erreur;
      } else {
        crees++;
        if (r.avertissement) avertissements.push(r.avertissement);
      }
    }
    setEnCours(false);
    if (crees > 0) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.taches });
      void queryClient.invalidateQueries({ queryKey: queryKeys.evenements });
      router.refresh();
      showToast(crees === 1 ? "1 élément ajouté" : `${crees} éléments ajoutés`);
      if (avertissements.length > 0) showToast(avertissements.join(" "), DUREE_TOAST_AVERTISSEMENT_MS);
    }
    if (restants.length === 0) {
      onTermine(true);
      return;
    }
    setElements(restants);
    setErreurs(nouvellesErreurs);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[13px] text-ink-2">Vérifie et corrige : rien n&apos;est ajouté avant « Valider ».</p>
      <ul className="flex flex-col gap-3">
        {elements.map((e) => (
          <CarteElement
            key={e.cle}
            e={e}
            listes={listes}
            erreur={erreurs[e.cle]}
            onChange={(patch) => maj(e.cle, patch)}
            onRetirer={() => setElements((prev) => prev.filter((x) => x.cle !== e.cle))}
          />
        ))}
      </ul>
      <div className="sticky bottom-0 flex gap-2 bg-surface pt-1">
        <button type="button" onClick={() => onTermine(false)} disabled={enCours} className={`${secondaryButton} min-h-11 flex-1`}>
          Annuler
        </button>
        <button
          type="button"
          onClick={valider}
          disabled={enCours || elements.length === 0}
          className={`${primaryButton} min-h-11 flex-1`}
        >
          {enCours ? "Ajout…" : elements.length > 1 ? `Valider (${elements.length})` : "Valider"}
        </button>
      </div>
    </div>
  );
}
