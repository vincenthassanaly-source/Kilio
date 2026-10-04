"use client";

import { useId, useRef, useState } from "react";
import { createEvenement, updateEvenement, type Evenement } from "@/app/actions/evenements";
import { runAction } from "@/lib/actions/runAction";
import { DUREE_EVENEMENT_PAR_DEFAUT, DUREES_EVENEMENT, dureeEvenement } from "@/lib/evenements/compute";
import { libelleDuree } from "@/lib/taches/compute";
import { heureParis } from "@/lib/date/paris";
import { dangerButton, errorText, input, label as labelClass, primaryButton } from "@/lib/ui";

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
  dateParDefaut,
  onSaved,
  onSupprimer,
}: {
  evenement?: Evenement;
  dateParDefaut: string;
  onSaved: () => void;
  onSupprimer?: () => void;
}) {
  const uid = useId();
  const titreRef = useRef<HTMLInputElement>(null);
  const [titre, setTitre] = useState(evenement?.titre ?? "");
  const [date, setDate] = useState(evenement?.date ?? dateParDefaut);
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
    const donnees = { titre, date, heure, dureeMinutes: Number(duree) };
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

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-date`} className={labelClass}>
            Date
          </label>
          <input id={`${uid}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-heure`} className={labelClass}>
            Heure
          </label>
          <input id={`${uid}-heure`} type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={`${input} tabular-nums`} />
        </div>
      </div>

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
