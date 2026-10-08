import { META_NIVEAU, parseContenu, type Niveau } from "@/lib/pharmacie/contenu";

// Pictogrammes distincts par niveau : la couleur n'est jamais le seul
// vecteur d'information (daltonisme, écran en plein soleil au comptoir).
const ICONES: Record<Niveau, string[]> = {
  bleu: ["M12 5v14", "M6 13l6 6 6-6"],
  vert: ["M5 12.5l4.5 4.5L19 7.5"],
  orange: ["M10.3 4.2 2.7 18a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z", "M12 9v4", "M12 17h.01"],
  rouge: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "m15 9-6 6", "m9 9 6 6"],
  gris: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 11v5", "M12 8h.01"],
  // Catégories : une forme simple par couleur.
  violet: ["M12 3l9 9-9 9-9-9z"],
  rose: ["M12 20.5s-8-4.6-8-10.4A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8 2.5c0 5.8-8 10.4-8 10.4z"],
  jaune: ["M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"],
  turquoise: ["M12 3.5s6.5 6.6 6.5 11a6.5 6.5 0 0 1-13 0c0-4.4 6.5-11 6.5-11z"],
  marron: ["M5 5h14v14H5z"],
  indigo: ["M12 4l9 16H3z"],
  lime: ["M12 2.5l8.5 5v9l-8.5 5-8.5-5v-9z"],
};

export function IconeNiveau({ niveau, taille = 16 }: { niveau: Niveau; taille?: number }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke={META_NIVEAU[niveau].couleur}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {ICONES[niveau].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/**
 * Rend le contenu d'une notion ou d'une carte. Sans balise `[couleur]`, le
 * rendu est exactement le paragraphe d'avant ; une ligne balisée devient une
 * rangée avec barre latérale, fond teinté, pictogramme et libellé
 * accessible. Le texte reste en encre normale (contraste identique en clair
 * et en sombre) ; seule la barre et le pictogramme portent la couleur.
 */
export function ContenuColore({
  contenu,
  className = "whitespace-pre-line text-[14.5px] leading-[1.55] text-ink",
  titresSections = false,
}: {
  contenu: string;
  /** Classes du texte (taille, graisse, couleur) appliquées aux paragraphes comme aux rangées. */
  className?: string;
  /** Lignes de titre (texte tout en MAJUSCULES) : en gras, avec de l'espace au-dessus. */
  titresSections?: boolean;
}) {
  const blocs = parseContenu(contenu);
  const titre = (texte: string) => titresSections && estTitreSection(texte);

  if (blocs.length === 1 && blocs[0].type === "texte") {
    return <p className={className}>{blocs[0].texte}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {blocs.map((bloc, i) =>
        bloc.type === "texte" ? (
          <p key={i} className={`${className} ${titre(bloc.texte) ? "mt-2 font-bold" : ""}`}>
            {bloc.texte}
          </p>
        ) : (
          <div
            key={i}
            className={`flex items-start gap-2 rounded-xl border-l-4 py-2 pl-2.5 pr-3 ${titre(bloc.texte) ? "mt-2" : ""}`}
            style={{
              borderLeftColor: META_NIVEAU[bloc.niveau].couleur,
              background: `color-mix(in oklch, ${META_NIVEAU[bloc.niveau].couleur} 12%, transparent)`,
            }}
          >
            <span className="mt-[3px]">
              <IconeNiveau niveau={bloc.niveau} />
            </span>
            <p className={`${className} ${titre(bloc.texte) ? "font-bold" : ""}`}>
              <span className="sr-only">{META_NIVEAU[bloc.niveau].libelle} : </span>
              {bloc.texte}
            </p>
          </div>
        )
      )}
    </div>
  );
}

/** Titre de section : au moins 3 lettres et aucune minuscule (« INTERACTIONS », « À ÉVITER »). */
function estTitreSection(texte: string): boolean {
  const t = texte.trim();
  return (t.match(/\p{L}/gu)?.length ?? 0) >= 3 && t === t.toUpperCase();
}
