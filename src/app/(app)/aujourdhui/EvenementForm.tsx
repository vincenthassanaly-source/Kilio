"use client";

import { useId, useRef, useState } from "react";
import { createEvenement, updateEvenement, type Evenement } from "@/app/actions/evenements";
import { FREQUENCE_LABELS } from "@/lib/date/recurrence";
import type { Enums } from "@/lib/supabase/types";
import { Switch } from "@/components/Switch";
import { runAction } from "@/lib/actions/runAction";
import { DUREE_EVENEMENT_PAR_DEFAUT, DUREES_EVENEMENT, dureeEvenement } from "@/lib/evenements/compute";
import { libelleDuree } from "@/lib/taches/compute";
import { heureParis } from "@/lib/date/paris";
import { dangerButton, errorText, input, label as labelClass, primaryButton } from "@/lib/ui";

const RAPPELS: { valeur: string; label: string; journeeEntiere?: boolean }[] = [
  { valeur: "", label: "Aucun rappel" },
  { valeur: "5", label: "5 min avant" },
  { valeur: "15", label: "15 min avant" },
  { valeur: "30", label: "30 min avant" },
  { valeur: "60", label: "1 h avant" },
  { valeur: "1440", label: "La veille", journeeEntiere: true },
];

// Prochaine demi-heure pleine : un rendez-vous se saisit rarement « maintenant ».
function heureParDefaut(): string {
  const [h, m] = heureParis().split(":").map(Number);
  const minutes = Math.min(Math.ceil((h * 60 + m + 1) / 30) * 30, 23 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Formulaire d'un événement léger : titre, date, heure, durée. Sert à la
 * création et à la modification (`evenement` fourni). La suppression est
 * déléguée à l'appelant (`onSupprimer`) qui gère l'annulation.
 */
export function EvenementForm({
  evenement,
  titreInitial,
  dateParDefaut,
  onSaved,
  onSupprimer,
}: {
  evenement?: Evenement;
  // Pré-remplit le titre d'un nouvel événement (tri d'une capture d'inbox).
  titreInitial?: string;
  dateParDefaut: string;
  onSaved: () => void;
  onSupprimer?: () => void;
}) {
  const uid = useId();
  const titreRef = useRef<HTMLInputElement>(null);
  const [titre, setTitre] = useState(evenement?.titre ?? titreInitial ?? "");
  // Occurrence d'une série : on édite la série, donc sa date de départ.
  const [date, setDate] = useState(evenement?.dateOrigine ?? evenement?.date ?? dateParDefaut);
  const [journeeEntiere, setJourneeEntiere] = useState(evenement?.toute_la_journee ?? false);
  const [rappel, setRappel] = useState(evenement?.rappel_minutes ? String(evenement.rappel_minutes) : "");
  const [frequence, setFrequence] = useState<string>(evenement?.recurrence_frequence ?? "");
  const [finRecurrence, setFinRecurrence] = useState(evenement?.recurrence_fin ?? "");
  // Rappel et répétition : repliés pour un ajout rapide, ouverts s'ils sont déjà réglés.
  const [optionsOuvertes, setOptionsOuvertes] = useState(
    Boolean(evenement?.rappel_minutes || evenement?.recurrence_frequence)
  );
  const [heure, setHeure] = useState(evenement ? evenement.heure.slice(0, 5) : heureParDefaut);
  const [duree, setDuree] = useState(
    String(evenement ? (dureeEvenement(evenement.heure, evenement.heure_fin) ?? DUREE_EVENEMENT_PAR_DEFAUT) : DUREE_EVENEMENT_PAR_DEFAUT)
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Durée existante hors de la liste proposée (saisie ailleurs) : conservée.
  const dureesProposees: number[] = [...DUREES_EVENEMENT];
  if (!dureesProposees.includes(Number(duree))) dureesProposees.push(Number(duree));
  dureesProposees.sort((a, b) => a - b);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enCours) return;
    if (!titre.trim()) {
      setErreur("Le titre est requis.");
      titreRef.current?.focus();
      return;
    }
    setErreur(null);
    setEnCours(true);
    const donnees = {
      titre,
      date,
      heure,
      dureeMinutes: Number(duree),
      toute_la_journee: journeeEntiere,
      rappelMinutes: rappel ? Number(rappel) : null,
      recurrenceFrequence: (frequence || null) as Enums<"frequence_recurrence"> | null,
      recurrenceFin: frequence ? finRecurrence || null : null,
    };
    // `silencieux` : l'erreur s'affiche ici, sous les champs, la saisie reste.
    const resultat = await runAction(
      () => (evenement ? updateEvenement(evenement.id, donnees) : createEvenement(donnees)),
      { silencieux: true, erreur: "L'enregistrement a échoué. Réessaie." }
    );
    setEnCours(false);
    if (resultat.ok) onSaved();
    else setErreur(resultat.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-titre`} className={labelClass}>
          Titre
        </label>
        <input
          id={`${uid}-titre`}
          ref={titreRef}
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Dentiste, appel, déjeuner…"
          autoComplete="off"
          autoFocus={!evenement}
          className={input}
        />
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-[14px] font-medium text-ink">Journée entière</span>
        <Switch
          checked={journeeEntiere}
          label="Journée entière"
          onToggle={() => {
            const suivant = !journeeEntiere;
            setJourneeEntiere(suivant);
            // « La veille » est le seul rappel d'une journée entière.
            if (suivant && rappel && rappel !== "1440") setRappel("1440");
          }}
        />
      </div>

      <div className={journeeEntiere ? "flex flex-col gap-1" : "grid grid-cols-2 gap-3"}>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-date`} className={labelClass}>
            Date
          </label>
          <input id={`${uid}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </div>
        {!journeeEntiere && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-heure`} className={labelClass}>
              Heure
            </label>
            <input id={`${uid}-heure`} type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={`${input} tabular-nums`} />
          </div>
        )}
      </div>

      {!journeeEntiere && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-duree`} className={labelClass}>
            Durée
          </label>
          <select id={`${uid}-duree`} value={duree} onChange={(e) => setDuree(e.target.value)} className={input}>
            {dureesProposees.map((d) => (
              <option key={d} value={d}>
                {libelleDuree(d)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          aria-expanded={optionsOuvertes}
          aria-controls={`${uid}-options`}
          onClick={() => setOptionsOuvertes((v) => !v)}
          className="relative flex min-h-11 items-center justify-between gap-2 text-left text-[14px] font-semibold text-kcal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
        >
          <span>
            Rappel et répétition
            {!optionsOuvertes && (rappel || frequence) && (
              <span className="ml-2 text-[12.5px] font-medium text-ink-2">
                {[rappel ? "rappel" : null, frequence ? FREQUENCE_LABELS[frequence as Enums<"frequence_recurrence">].toLowerCase() : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </span>
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform ${optionsOuvertes ? "rotate-90" : ""}`}>
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {optionsOuvertes && (
          <div id={`${uid}-options`} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-rappel`} className={labelClass}>
            Rappel
          </label>
          <select id={`${uid}-rappel`} value={rappel} onChange={(e) => setRappel(e.target.value)} className={input}>
            {RAPPELS.filter((r) => (journeeEntiere ? r.valeur === "" || r.journeeEntiere : true)).map((r) => (
              <option key={r.valeur} value={r.valeur}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className={frequence ? "grid grid-cols-2 gap-3" : "flex flex-col gap-1"}>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-freq`} className={labelClass}>
              Répétition
            </label>
            <select id={`${uid}-freq`} value={frequence} onChange={(e) => setFrequence(e.target.value)} className={input}>
              <option value="">Aucune</option>
              {(Object.keys(FREQUENCE_LABELS) as Enums<"frequence_recurrence">[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCE_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          {frequence && (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${uid}-finrec`} className={labelClass}>
                Jusqu&apos;au (facultatif)
              </label>
              <input id={`${uid}-finrec`} type="date" value={finRecurrence} min={date} onChange={(e) => setFinRecurrence(e.target.value)} className={input} />
            </div>
          )}
        </div>
          </div>
        )}
      </div>

      {erreur && (
        <p role="alert" className={errorText}>
          {erreur}
        </p>
      )}

      <div className="flex items-center gap-2.5">
        <button type="submit" disabled={enCours} className={`${primaryButton} flex-1`}>
          {enCours ? "Enregistrement…" : evenement ? "Enregistrer" : "Ajouter"}
        </button>
        {evenement && onSupprimer && (
          <button type="button" onClick={onSupprimer} disabled={enCours} className={dangerButton}>
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}
