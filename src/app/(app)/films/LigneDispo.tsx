import { resumerDispo } from "@/lib/films/dispo";
import { urlLogo, type Disponibilite } from "@/lib/films/types";

const LOGOS_MAX = 3;

/** Où regarder le film : logos des plateformes d'abonnement puis une phrase.
 * Les plateformes de l'utilisateur passent en premier et la phrase se teinte en
 * vert Kilio quand le film est chez elles. Le texte porte l'information : les
 * logos aident seulement à balayer la liste. */
export function LigneDispo({
  dispo,
  mesIds,
  className = "",
  sansLogos = false,
}: {
  dispo: Disponibilite | null;
  mesIds: ReadonlySet<number>;
  className?: string;
  /** Texte seul, pour les emplacements étroits (tuiles de suggestions). */
  sansLogos?: boolean;
}) {
  const r = resumerDispo(dispo, mesIds);
  const logos = sansLogos ? [] : r.fournisseurs.filter((f) => urlLogo(f.logo)).slice(0, LOGOS_MAX);
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      {logos.length > 0 && (
        <span aria-hidden="true" className="flex shrink-0 -space-x-1.5">
          {logos.map((f) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={f.id}
              src={urlLogo(f.logo) ?? undefined}
              alt=""
              width={24}
              height={24}
              loading="lazy"
              decoding="async"
              className="h-6 w-6 rounded-lg object-cover ring-2 ring-surface"
            />
          ))}
        </span>
      )}
      <p className={`min-w-0 line-clamp-2 text-small leading-snug ${r.surMesPlateformes ? "font-semibold text-kcal" : "text-ink-2"}`}>{r.texte}</p>
    </div>
  );
}
