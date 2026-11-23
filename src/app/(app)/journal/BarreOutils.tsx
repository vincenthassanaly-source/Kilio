"use client";

import { EPAISSEURS, type Epaisseur } from "@/lib/vidage/traits";
import type { Outil } from "./FeuilleCanvas";

type Props = {
  outil: Outil;
  onOutil: (outil: Outil) => void;
  epaisseur: Epaisseur;
  onEpaisseur: (epaisseur: Epaisseur) => void;
  peutAnnuler: boolean;
  peutRetablir: boolean;
  onAnnuler: () => void;
  onRetablir: () => void;
  /** Faux sur une feuille vide : rien à transcrire. */
  peutTranscrire: boolean;
  enTranscription: boolean;
  onTranscrire: () => void;
};

// Diamètre du point qui représente chaque épaisseur (px).
const DIAMETRE: Record<Epaisseur, number> = { 1: 4, 2: 8, 3: 13 };
const LIBELLE_EPAISSEUR: Record<Epaisseur, string> = { 1: "Trait fin", 2: "Trait moyen", 3: "Trait épais" };

/** Épaisseur suivante (fin → moyen → épais → fin) : un seul bouton pour les trois. */
export function epaisseurSuivante(e: Epaisseur): Epaisseur {
  return EPAISSEURS[(EPAISSEURS.indexOf(e) + 1) % EPAISSEURS.length];
}

// Boutons de 40 px collés (sans écart ni pseudo-élément débordant) : chaque
// zone de tap est exactement le bouton visible, jamais à cheval sur sa
// voisine. 44 px dès que la barre a la place.
const bouton =
  "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition-[color,background-color,opacity,transform] min-[26rem]:h-11 min-[26rem]:w-11 active:scale-[0.94] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal";

const separateur = "mx-0.5 h-6 w-px shrink-0 bg-line min-[26rem]:mx-1";

function Icone({ children }: { children: React.ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function Rotation() {
  return (
    <svg className="animate-spin motion-reduce:animate-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

/**
 * Barre d'outils flottante en bas de l'écran : stylo, gomme, épaisseur, annuler / rétablir, transcrire.
 * Tient dans 360 px avec le mot « Transcrire » : l'épaisseur est un seul bouton qui fait défiler
 * fin / moyen / épais (le point montre l'épaisseur active).
 */
export function BarreOutils({
  outil,
  onOutil,
  epaisseur,
  onEpaisseur,
  peutAnnuler,
  peutRetablir,
  onAnnuler,
  onRetablir,
  peutTranscrire,
  enTranscription,
  onTranscrire,
}: Props) {
  const libelleTranscrire = enTranscription ? "Transcription en cours…" : "Transcrire";
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-[calc(env(safe-area-inset-bottom)+14px)] min-[26rem]:px-3">
      <div
        role="toolbar"
        aria-label="Outils d'écriture"
        className="flex max-w-full items-center rounded-full border border-line bg-surface/95 p-1 shadow-float backdrop-blur min-[26rem]:gap-0.5 min-[26rem]:p-1.5"
      >
        <button
          type="button"
          aria-label="Stylo"
          aria-pressed={outil === "stylo"}
          onClick={() => onOutil("stylo")}
          className={`${bouton} ${outil === "stylo" ? "bg-kcal-soft text-kcal" : ""}`}
        >
          <Icone>
            <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z" />
            <path d="M14.5 6.5l3 3" />
          </Icone>
        </button>
        <button
          type="button"
          aria-label="Gomme"
          aria-pressed={outil === "gomme"}
          onClick={() => onOutil("gomme")}
          className={`${bouton} ${outil === "gomme" ? "bg-kcal-soft text-kcal" : ""}`}
        >
          <Icone>
            <path d="M19 20H9L4.3 15.3a1.4 1.4 0 0 1 0-2l8.9-8.9a1.4 1.4 0 0 1 2 0l4.5 4.5a1.4 1.4 0 0 1 0 2L12 18" />
            <path d="M8 11l5 5" />
          </Icone>
        </button>
        <button
          type="button"
          aria-label={`Épaisseur : ${LIBELLE_EPAISSEUR[epaisseur].toLowerCase()}`}
          onClick={() => onEpaisseur(epaisseurSuivante(epaisseur))}
          className={bouton}
        >
          <span className="rounded-full bg-ink" style={{ width: DIAMETRE[epaisseur], height: DIAMETRE[epaisseur] }} />
        </button>

        <span className={separateur} aria-hidden="true" />

        <button type="button" aria-label="Annuler" disabled={!peutAnnuler} onClick={onAnnuler} className={bouton}>
          <Icone>
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </Icone>
        </button>
        <button type="button" aria-label="Rétablir" disabled={!peutRetablir} onClick={onRetablir} className={bouton}>
          <Icone>
            <path d="M15 14l5-5-5-5" />
            <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
          </Icone>
        </button>

        <span className={separateur} aria-hidden="true" />

        {/* Action principale : vert Kilio (accent unique), le mot toujours visible dès 360 px. */}
        <button
          type="button"
          aria-busy={enTranscription}
          disabled={!peutTranscrire || enTranscription}
          onClick={onTranscrire}
          // Largeur minimale du mot : la barre ne rétrécit pas quand la rotation le remplace.
          className="relative flex h-10 min-w-[6.25rem] shrink-0 items-center justify-center gap-1.5 rounded-full bg-kcal px-3.5 text-label font-semibold text-on-kcal transition-[opacity,transform] active:scale-[0.96] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2 min-[26rem]:h-11 min-[26rem]:px-4"
        >
          {enTranscription && <Rotation />}
          <span className={enTranscription ? "sr-only" : undefined}>{libelleTranscrire}</span>
        </button>
      </div>
    </div>
  );
}
