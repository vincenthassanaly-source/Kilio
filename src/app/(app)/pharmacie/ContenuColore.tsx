import { META_NIVEAU, grouperSections, parseContenu, type ElementContenu, type Niveau } from "@/lib/pharmacie/contenu";

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
  /** Fiche du référentiel : un titre en MAJUSCULES ouvre une carte de section (voir `grouperSections`). */
  titresSections?: boolean;
}) {
  const blocs = parseContenu(contenu);

  if (blocs.length === 1 && blocs[0].type === "texte") {
    return <p className={className}>{blocs[0].texte}</p>;
  }

  if (titresSections) return <ContenuSections elements={grouperSections(blocs)} className={className} />;

  return (
    <div className="flex flex-col gap-1.5">
      {blocs.map((bloc, i) =>
        bloc.type === "texte" ? (
          <p key={i} className={className}>
            {bloc.texte}
          </p>
        ) : (
          <div key={i} className="flex items-start gap-2 rounded-xl border-l-4 py-2 pl-2.5 pr-3" style={styleNiveau(bloc.niveau)}>
            <span className="mt-[3px]">
              <IconeNiveau niveau={bloc.niveau} />
            </span>
            <p className={className}>
              <span className="sr-only">{META_NIVEAU[bloc.niveau].libelle} : </span>
              {bloc.texte}
            </p>
          </div>
        )
      )}
    </div>
  );
}

function styleNiveau(niveau: Niveau) {
  return {
    borderLeftColor: META_NIVEAU[niveau].couleur,
    background: `color-mix(in oklch, ${META_NIVEAU[niveau].couleur} 12%, transparent)`,
  };
}

/**
 * Fiche du référentiel : une carte par section (titre en majuscules), dont la
 * couleur est celle du titre. Les lignes sont en liste : une ligne de la
 * couleur de la section porte une simple puce ; une ligne d'une autre couleur
 * garde son pictogramme et son libellé accessible, et une ligne rouge passe en
 * gras pour rester repérable au milieu d'une section orange.
 */
function ContenuSections({ elements, className }: { elements: ElementContenu[]; className: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      {elements.map((el, i) => {
        if (el.type === "texte") {
          return (
            <p key={i} className={className}>
              {el.texte}
            </p>
          );
        }
        if (el.type === "ligne") {
          return (
            <div key={i} className="flex items-start gap-2 rounded-xl border-l-4 py-2 pl-2.5 pr-3" style={styleNiveau(el.niveau)}>
              <span className="mt-[3px]">
                <IconeNiveau niveau={el.niveau} />
              </span>
              <p className={className}>
                <span className="sr-only">{META_NIVEAU[el.niveau].libelle} : </span>
                {el.texte}
              </p>
            </div>
          );
        }
        return (
          <section
            key={i}
            aria-label={el.titre}
            className="flex flex-col gap-2 rounded-xl border-l-4 py-2.5 pl-3 pr-3"
            style={styleNiveau(el.niveau)}
          >
            <h3 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-ink">
              <IconeNiveau niveau={el.niveau} />
              {el.titre}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {el.lignes.map((ligne, j) =>
                ligne.sousTitre ? (
                  <li key={j} className="mt-1 text-[13.5px] font-semibold text-ink-2 first:mt-0">
                    {ligne.texte}
                  </li>
                ) : (
                  <li key={j} className="flex items-start gap-2">
                    {ligne.niveau === el.niveau ? (
                      <span
                        aria-hidden="true"
                        className="mt-[9px] size-1.5 shrink-0 rounded-full"
                        style={{ background: META_NIVEAU[ligne.niveau].couleur }}
                      />
                    ) : (
                      <span className="mt-[3px]">
                        <IconeNiveau niveau={ligne.niveau} />
                      </span>
                    )}
                    <p className={`${className} ${ligne.niveau === "rouge" ? "font-semibold" : ""}`}>
                      {ligne.niveau !== el.niveau && <span className="sr-only">{META_NIVEAU[ligne.niveau].libelle} : </span>}
                      {ligne.texte}
                    </p>
                  </li>
                )
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
