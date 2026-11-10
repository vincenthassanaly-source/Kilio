"use client";

import { useId, useState } from "react";
import { label as labelClass } from "@/lib/ui";

// Pastilles proposées pour les listes et les tags. Les couleurs sont stockées
// en hex (colonne `couleur`) : elles approchent les teintes de modules de
// DESIGN.md (oklch 0,55 0,14) plutôt qu'un sélecteur libre, et « Aucune » est
// un vrai choix (valeur vide = pas de couleur).
const COULEURS = [
  { nom: "Vert", hex: "#00794d" },
  { nom: "Bleu", hex: "#007eb3" },
  { nom: "Violet", hex: "#7a5bbf" },
  { nom: "Rose", hex: "#b8438b" },
  { nom: "Rouge", hex: "#c0392b" },
  { nom: "Orange", hex: "#c2620a" },
  { nom: "Ocre", hex: "#9a7b0a" },
  { nom: "Turquoise", hex: "#0e8a8a" },
] as const;

const bouton =
  "relative flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

/**
 * Choix de couleur par pastilles prédéfinies, avec « Aucune ». Publie la
 * valeur sous `name` (champ caché) : vide = aucune couleur. Une couleur
 * existante hors palette (ancien sélecteur libre) reste proposée et conservée
 * tant qu'on n'en choisit pas une autre.
 */
export function CouleurPicker({ name = "couleur", defaultValue }: { name?: string; defaultValue?: string | null }) {
  const uid = useId();
  const [valeur, setValeur] = useState(defaultValue ?? "");
  const options: { nom: string; hex: string }[] = [
    ...(defaultValue && !COULEURS.some((c) => c.hex.toLowerCase() === defaultValue.toLowerCase())
      ? [{ nom: "Personnalisée", hex: defaultValue }]
      : []),
    ...COULEURS,
  ];

  return (
    <div className="flex flex-col gap-1">
      <span id={`${uid}-couleur`} className={labelClass}>
        Couleur (optionnel)
      </span>
      <input type="hidden" name={name} value={valeur} />
      <div role="radiogroup" aria-labelledby={`${uid}-couleur`} className="flex flex-wrap gap-1">
        <button
          type="button"
          role="radio"
          aria-checked={valeur === ""}
          aria-label="Aucune couleur"
          onClick={() => setValeur("")}
          className={bouton}
        >
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-small text-ink-2 ${
              valeur === "" ? "border-kcal" : "border-control-border"
            }`}
            aria-hidden="true"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="8" />
              <path d="M6.3 17.7L17.7 6.3" />
            </svg>
          </span>
        </button>
        {options.map((c) => {
          const actif = valeur.toLowerCase() === c.hex.toLowerCase();
          return (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={actif}
              aria-label={c.nom}
              onClick={() => setValeur(c.hex)}
              className={bouton}
            >
              <span
                className={`h-7 w-7 rounded-full border-2 ${actif ? "border-ink" : "border-transparent"}`}
                style={{ backgroundColor: c.hex }}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
