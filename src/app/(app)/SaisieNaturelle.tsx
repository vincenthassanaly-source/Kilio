"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { interpreterSaisie } from "@/app/actions/saisie";
import { Modal } from "@/components/Modal";
import { runAction } from "@/lib/actions/runAction";
import { LONGUEUR_MAX_SAISIE, type ElementSaisie } from "@/lib/saisie/compute";
import { errorText, inputAvecIcone, primaryButton } from "@/lib/ui";
import { ApercuSaisie } from "./ApercuSaisie";

/**
 * Barre « Ajoute… » de l'accueil : une phrase libre, interprétée par Gemini
 * seulement à la demande (bouton ou Entrée), puis un aperçu modifiable. Le
 * texte tapé est conservé tant que rien n'a été ajouté.
 */
export function SaisieNaturelle({
  valeur,
  onValeur,
  prefixe,
}: {
  // Texte contrôlé : partagé avec la recherche dans le champ unique de l'accueil.
  valeur?: string;
  onValeur?: (texte: string) => void;
  // Remplace l'icône « + » (sélecteur de mode du champ unique).
  prefixe?: ReactNode;
} = {}) {
  const uid = useId();
  const [texteInterne, setTexteInterne] = useState("");
  const texte = valeur ?? texteInterne;
  const setTexte = onValeur ?? setTexteInterne;
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
            {prefixe ?? (
              // « + » : signale la saisie (ajoute), distincte de la recherche (loupe).
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
            )}
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
              className={`${inputAvecIcone} min-h-11 w-full placeholder:text-ink-2 ${prefixe ? "pl-[5.5rem]" : ""}`}
            />
          </div>
          {/* Pendant l'interprétation, le mot reste (transparent) pour garder la
              largeur et le nom du bouton ; une roue tourne à sa place. */}
          <button
            type="submit"
            disabled={enCours || texte.trim() === ""}
            aria-busy={enCours}
            className={`${primaryButton} relative min-h-11 min-w-[5.5rem] shrink-0 py-0 text-label`}
          >
            <span className={enCours ? "opacity-0" : undefined}>Ajouter</span>
            {enCours && (
              <span
                aria-hidden
                className="absolute inset-0 m-auto h-4 w-4 animate-spin rounded-full border-2 border-on-kcal/35 border-t-on-kcal motion-reduce:animate-none"
              />
            )}
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
