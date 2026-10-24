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

const bouton =
  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink transition active:scale-[0.94] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal";

function Icone({ children }: { children: React.ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function Rotation() {
  return (
    <svg className="animate-spin motion-reduce:animate-none" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

/** Barre d'outils flottante en bas de l'écran : stylo, gomme, épaisseur, annuler / rétablir, transcrire. */
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
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+14px)]">
      <div
        role="toolbar"
        aria-label="Outils d'écriture"
        className="flex items-center gap-0.5 rounded-full border border-line bg-surface/95 p-1.5 shadow-card backdrop-blur"
      >
        <button
          type="button"
          aria-label="Stylo"
          aria-pressed={outil === "stylo"}
          onClick={() => onOutil("stylo")}
          className={`${bouton} ${outil === "stylo" ? "bg-surface-alt" : ""}`}
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
          className={`${bouton} ${outil === "gomme" ? "bg-surface-alt" : ""}`}
        >
          <Icone>
            <path d="M19 20H9L4.3 15.3a1.4 1.4 0 0 1 0-2l8.9-8.9a1.4 1.4 0 0 1 2 0l4.5 4.5a1.4 1.4 0 0 1 0 2L12 18" />
            <path d="M8 11l5 5" />
          </Icone>
        </button>

        <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />

        {EPAISSEURS.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={LIBELLE_EPAISSEUR[e]}
            aria-pressed={epaisseur === e}
            onClick={() => onEpaisseur(e)}
            className={`${bouton} ${epaisseur === e ? "bg-surface-alt" : ""}`}
          >
            <span className="rounded-full bg-ink" style={{ width: DIAMETRE[e], height: DIAMETRE[e] }} />
          </button>
        ))}

        <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />

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

        <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />

        {/* Le mot s'affiche quand la barre a la place ; sur un petit écran, l'icône seule garde le nom accessible. */}
        <button
          type="button"
          aria-label={libelleTranscrire}
          aria-busy={enTranscription}
          disabled={!peutTranscrire || enTranscription}
          onClick={onTranscrire}
          className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-3 text-sm font-medium text-surface transition active:scale-[0.96] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal min-[30rem]:px-4"
        >
          {enTranscription ? (
            <Rotation />
          ) : (
            <Icone>
              <path d="M5 6h14M5 12h14M5 18h9" />
            </Icone>
          )}
          <span className="hidden min-[30rem]:inline">{libelleTranscrire}</span>
        </button>
      </div>
    </div>
  );
}
