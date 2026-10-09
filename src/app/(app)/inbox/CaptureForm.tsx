"use client";

import { useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addInboxItem } from "@/app/actions/inbox";
import { runAction } from "@/lib/actions/runAction";
import { queryKeys } from "@/lib/query/keys";
import { errorText, input, label as labelClass, primaryButton } from "@/lib/ui";

/**
 * Capture rapide : un champ, un bouton. Reste ouvert après chaque ajout pour
 * enchaîner plusieurs idées (comme le formulaire de courses) ; la fermeture est
 * à la charge de l'appelant. Le tri se fait plus tard, dans l'inbox.
 */
export function CaptureForm({ onCaptured }: { onCaptured?: () => void }) {
  const uid = useId();
  const queryClient = useQueryClient();
  const champRef = useRef<HTMLTextAreaElement>(null);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [dernier, setDernier] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enCours) return;
    if (!texte.trim()) {
      setErreur("Écris quelque chose à capturer.");
      champRef.current?.focus();
      return;
    }
    setErreur(null);
    setEnCours(true);
    const capture = texte.trim();
    const resultat = await runAction(() => addInboxItem(capture), {
      silencieux: true,
      erreur: "La capture a échoué. Réessaie.",
    });
    setEnCours(false);
    if (!resultat.ok) {
      setErreur(resultat.error);
      return;
    }
    setTexte("");
    setDernier(capture);
    void queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
    onCaptured?.();
    champRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-texte`} className={labelClass}>
          Idée, tâche, rendez-vous…
        </label>
        <textarea
          id={`${uid}-texte`}
          ref={champRef}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            // Souris + clavier : Entrée envoie, Maj+Entrée ajoute une ligne. Sur écran
            // tactile, il n'y a pas de Maj+Entrée : Entrée reste un retour à la ligne
            // (sinon impossible d'écrire les détails sous le titre) et le bouton envoie.
            const tactile = window.matchMedia?.("(pointer: coarse)").matches ?? false;
            if (e.key === "Enter" && !e.shiftKey && !tactile) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={3}
          autoFocus
          placeholder="Vide ta tête, tu trieras plus tard"
          className={`${input} resize-none`}
        />
      </div>
      {erreur && (
        <p role="alert" className={errorText}>
          {erreur}
        </p>
      )}
      {dernier && !erreur && (
        <p role="status" className="truncate text-[13px] text-ink-2">
          Capturé : {dernier}
        </p>
      )}
      <button type="submit" disabled={enCours} className={primaryButton}>
        {enCours ? "Envoi…" : "Capturer"}
      </button>
    </form>
  );
}
