"use client";

import { useId, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { interpreterSaisie } from "@/app/actions/saisie";
import { Modal } from "@/components/Modal";
import { runAction } from "@/lib/actions/runAction";
import { LONGUEUR_MAX_SAISIE, type ElementSaisie } from "@/lib/saisie/compute";
import { errorText, input } from "@/lib/ui";
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
          <div className="relative min-w-0 flex-1">
            {/* « + » : distingue d'un coup d'oeil la saisie (ajoute) de la
                recherche juste au-dessus (loupe), deux champs sinon identiques. */}
            <svg
              aria-hidden
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ink-3)"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <input
              id={`${uid}-texte`}
              type="text"
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Ajoute… ex. dentiste jeudi"
              enterKeyHint="send"
              autoComplete="off"
              maxLength={LONGUEUR_MAX_SAISIE}
              aria-describedby={erreur ? `${uid}-erreur` : undefined}
              className={`${input} min-h-11 w-full pl-10 placeholder:text-ink-2`}
            />
          </div>
          <button
            type="submit"
            disabled={enCours || texte.trim() === ""}
            aria-busy={enCours}
            className="min-h-11 min-w-[5.5rem] shrink-0 rounded-2xl bg-kcal px-4 text-label font-semibold text-on-kcal transition-[opacity,transform] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
          >
            {enCours ? "…" : "Ajouter"}
          </button>
        </div>
        {erreur && (
          <p id={`${uid}-erreur`} role="alert" className={errorText}>
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
