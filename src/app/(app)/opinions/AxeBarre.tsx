import { decrireMoyenne, type AxeProfil } from "@/lib/opinions/profil";
import { metaText } from "@/lib/ui";

// Barre divergente : le centre est « équilibré », la barre part du centre vers
// le pôle de gauche (-2) ou de droite (+2). Le texte (description + nombre
// d'idées) double toujours la barre : la couleur ne porte jamais seule le sens.
// Partagée par le Profil (idées validées) et les cartes de parti (propositions).
export function AxeBarre({
  profil,
  unite = "idée",
  qualificatif = "validée",
}: {
  profil: AxeProfil;
  unite?: string;
  qualificatif?: string;
}) {
  const { axe, moyenne, nombre } = profil;
  const pluriel = nombre > 1 ? "s" : "";
  const comptage = `${nombre} ${unite}${pluriel}`;
  const description = decrireMoyenne(axe, moyenne);
  const demiLargeur = moyenne === null ? 0 : (Math.abs(moyenne) / 2) * 50;
  const gauche = moyenne === null ? 50 : moyenne < 0 ? 50 - demiLargeur : 50;
  const ariaLabel =
    moyenne === null
      ? `${axe.label} : aucune donnée sur cet axe`
      : `${axe.label} : ${description}, sur ${comptage}${qualificatif ? ` ${qualificatif}${pluriel}` : ""}`;

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body font-semibold text-ink">{axe.label}</span>
        <span className={`${metaText} text-right`}>
          {description}
          {nombre > 0 && ` · ${comptage}`}
        </span>
      </div>
      <div role="img" aria-label={ariaLabel} className="relative h-3 rounded-full bg-surface-alt">
        <span
          aria-hidden="true"
          className="absolute top-0 h-3 rounded-full bg-[var(--accent-opinions)] transition-[left,width] duration-300 motion-reduce:transition-none"
          style={{ left: `${gauche}%`, width: `${demiLargeur}%` }}
        />
        <span aria-hidden="true" className="absolute -top-1 left-1/2 h-5 w-px bg-control-border" />
      </div>
      <div className="flex justify-between gap-3 text-caption text-ink-3" aria-hidden="true">
        <span>‹ {axe.gauche}</span>
        <span className="text-right">{axe.droite} ›</span>
      </div>
    </li>
  );
}
