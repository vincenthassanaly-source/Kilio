"use client";

import { Fragment, useId, useMemo, useState } from "react";
import {
  COULEURS_PARTI,
  LIBELLE_COULEUR,
  decouperTermes,
  fondLeger,
  varCouleurParti,
  varCouleurTheme,
  type CouleurParti,
  type Terme,
} from "@/lib/opinions/couleurs";
import { LIBELLE_THEME, type Theme } from "@/lib/opinions/types";
import { label } from "@/lib/ui";

// Les couleurs distinguent, elles ne jugent : elles ne remplacent jamais le texte
// (nom du parti, nom du thème) et ne dépendent d'aucun score.

/** Pastille d'identité d'un parti. Décorative : le nom du parti est toujours à côté. */
export function PastilleParti({ couleur, className = "" }: { couleur: CouleurParti; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: varCouleurParti(couleur) }}
    />
  );
}

/** Étiquette discrète d'un thème : point de couleur + nom, sur un fond léger. */
export function EtiquetteTheme({ theme }: { theme: Theme }) {
  const teinte = varCouleurTheme(theme);
  return (
    <span
      className="inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[13px] font-semibold uppercase tracking-wide text-ink-2"
      style={{ backgroundColor: fondLeger(teinte, 16) }}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: teinte }} />
      {LIBELLE_THEME[theme]}
    </span>
  );
}

const cleTerme = (terme: Terme) => terme.terme.toLocaleLowerCase("fr");

/**
 * Texte d'une proposition avec ses mots-clés surlignés (fond léger à la teinte du
 * thème). Un terme défini a un fond un peu plus soutenu, sans soulignement : un tap
 * ouvre sa définition sous le texte, un second tap ou Échap la referme. La définition est
 * placée dans le flux (pas flottante) pour ne jamais déborder de l'écran.
 */
export function TexteProposition({ texte, termes, theme }: { texte: string; termes: readonly Terme[]; theme: Theme }) {
  const idBulle = useId();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const segments = useMemo(() => decouperTermes(texte, termes), [texte, termes]);
  const teinte = varCouleurTheme(theme);
  const definie = ouvert === null ? null : (termes.find((t) => cleTerme(t) === ouvert) ?? null);

  return (
    <div
      className="flex flex-col gap-2"
      onKeyDown={(e) => {
        if (e.key === "Escape" && ouvert !== null) {
          e.stopPropagation();
          setOuvert(null);
        }
      }}
    >
      <p className="text-[14.5px] leading-relaxed text-ink">
        {segments.map((segment, index) => {
          if (segment.terme === null) return <Fragment key={index}>{segment.texte}</Fragment>;
          const cle = cleTerme(segment.terme);
          if (!segment.terme.definition) {
            return (
              <mark
                key={index}
                className="rounded px-0.5 text-inherit"
                style={{ backgroundColor: fondLeger(teinte, 24) }}
              >
                {segment.texte}
              </mark>
            );
          }
          const actif = ouvert === cle;
          return (
            <button
              key={index}
              type="button"
              aria-expanded={actif}
              aria-controls={idBulle}
              aria-label={`${segment.texte}, définition`}
              onClick={() => setOuvert(actif ? null : cle)}
              className="rounded px-0.5 text-inherit transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal motion-reduce:transition-none"
              style={{ backgroundColor: fondLeger(teinte, actif ? 48 : 34) }}
            >
              {segment.texte}
            </button>
          );
        })}
      </p>
      {definie?.definition && (
        <p
          id={idBulle}
          role="note"
          className="rounded-xl border border-line border-l-4 bg-surface-alt px-3 py-2 text-[13px] leading-snug text-ink-2"
          style={{ borderLeftColor: teinte }}
        >
          <strong className="font-semibold text-ink">{definie.terme}</strong> : {definie.definition}
        </p>
      )}
    </div>
  );
}

/** Choix de la teinte d'un parti : boutons radio natifs (clavier, lecteurs d'écran). */
export function SelecteurCouleur({
  valeur,
  onChange,
  utilisees = [],
}: {
  valeur: CouleurParti;
  onChange: (couleur: CouleurParti) => void;
  /** Teintes déjà prises par d'autres partis : signalées, jamais interdites. */
  utilisees?: readonly string[];
}) {
  const nom = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={label}>Couleur</legend>
      <div className="flex flex-wrap gap-1">
        {COULEURS_PARTI.map((couleur) => {
          const choisie = couleur === valeur;
          const prise = utilisees.includes(couleur);
          return (
            <label key={couleur} className="relative cursor-pointer">
              <input
                type="radio"
                name={nom}
                value={couleur}
                checked={choisie}
                onChange={() => onChange(couleur)}
                className="peer sr-only"
              />
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-transform active:scale-95 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-kcal motion-reduce:transition-none ${
                  choisie ? "ring-2 ring-ink" : ""
                }`}
                style={{ backgroundColor: varCouleurParti(couleur) }}
              >
                {choisie && (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="text-on-accent"
                  >
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                )}
              </span>
              <span className="sr-only">
                {LIBELLE_COULEUR[couleur]}
                {prise && !choisie ? " (déjà utilisée par un autre parti)" : ""}
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-ink-3">Sert à repérer le parti sur les cartes, les pistes d&apos;axes et le classement.</p>
    </fieldset>
  );
}
