"use client";

import { useId, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { interpreterSaisie } from "@/app/actions/saisie";
import { Modal } from "@/components/Modal";
import { runAction } from "@/lib/actions/runAction";
import { LONGUEUR_MAX_SAISIE, type ElementSaisie } from "@/lib/saisie/compute";
import { errorText } from "@/lib/ui";
import { ApercuSaisie } from "./ApercuSaisie";

/**
 * Barre « Ajoute… » de l'accueil : une phrase libre, interprétée par Gemini
 * seulement à la demande (bouton ou Entrée), puis un aperçu modifiable. Le
 * texte tapé est conservé tant que rien n'a été ajouté.
 */
export function SaisieNaturelle() {
  const uid = useId();
  const [texte, setTexte] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [apercu, setApercu] = useState<ElementSaisie[] | null>(null);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const phrase = texte.trim();
    if (!phrase || enCours) return;
    setEnCours(true);
    setErreur(null);
    const resultat = await runAction(() => interpreterSaisie(phrase), {
      silencieux: true,
      erreur: "Impossible d'interpréter la phrase. Réessaie.",
    });
    setEnCours(false);
    if (resultat.ok) setApercu(resultat.data);
    else setErreur(resultat.error);
  }

  return (
    <>
      <form onSubmit={envoyer} className="flex flex-col gap-1.5" aria-label="Ajouter en langage naturel">
        <div className="flex items-center gap-2">
          <label htmlFor={`${uid}-texte`} className="sr-only">
            Ajouter une tâche ou un événement en une phrase
          </label>
          <input
            id={`${uid}-texte`}
            type="text"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Ajoute… ex. dentiste jeudi 14 h, rappelle-moi"
            enterKeyHint="send"
            autoComplete="off"
            maxLength={LONGUEUR_MAX_SAISIE}
            className="min-h-11 min-w-0 flex-1 rounded-2xl border border-line bg-surface-alt px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink-2 focus:border-kcal/60 focus-visible:ring-2 focus-visible:ring-kcal"
          />
          <button
            type="submit"
            disabled={enCours || texte.trim() === ""}
            className="min-h-11 shrink-0 rounded-2xl bg-kcal px-4 text-[14px] font-semibold text-on-kcal transition-[opacity,transform] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
          >
            {enCours ? "…" : "Ajouter"}
          </button>
        </div>
        {erreur && (
          <p role="alert" className={errorText}>
            {erreur}
          </p>
        )}
      </form>

      <AnimatePresence>
        {apercu && (
          <Modal key="apercu-saisie" title="Vérifie avant d'ajouter" onClose={() => setApercu(null)}>
            <ApercuSaisie
              initiaux={apercu}
              onTermine={(ajoute) => {
                if (ajoute) setTexte("");
                setApercu(null);
              }}
            />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
