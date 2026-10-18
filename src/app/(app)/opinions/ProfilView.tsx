import { TransitionLink } from "@/components/TransitionLink";
import { calculerProfil, decrireMoyenne, sujetsACreuser, trouverTensions, type AxeProfil, type IdeePourProfil } from "@/lib/opinions/profil";
import { AXES, LIBELLE_THEME } from "@/lib/opinions/types";
import { card, cardTight, metaText, pillTag, sectionTitle } from "@/lib/ui";

// Barre divergente : le centre est « équilibré », la barre part du centre vers
// le pôle de gauche (-2) ou de droite (+2). Le texte (description + nombre
// d'idées) double toujours la barre : la couleur ne porte jamais seule le sens.
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
        <span className="text-[15px] font-semibold text-ink">{axe.label}</span>
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
      <div className="flex justify-between text-xs text-ink-3" aria-hidden="true">
        <span>‹ {axe.gauche}</span>
        <span>{axe.droite} ›</span>
      </div>
    </li>
  );
}

export function ProfilView({ idees }: { idees: readonly IdeePourProfil[] }) {
  const profil = calculerProfil(idees);
  const nombreValidees = idees.filter((i) => i.statut === "validee").length;
  const tensions = trouverTensions(idees);
  const sujets = sujetsACreuser(idees);

  if (nombreValidees === 0) {
    return (
      <p className="text-ink-2">
        Ton profil se dessine à partir des idées <strong className="font-semibold text-ink">validées</strong>. Note une
        idée, choisis son thème, place-la sur les axes puis valide-la.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={`${card} flex flex-col gap-4`} aria-labelledby="profil-positions">
        <div className="flex flex-col gap-1">
          <h2 id="profil-positions" className={sectionTitle}>
            Tes positions
          </h2>
          <p className="text-xs text-ink-3">
            {nombreValidees} idée{nombreValidees > 1 ? "s" : ""} validée{nombreValidees > 1 ? "s" : ""}. Chaque barre va
            d&apos;un pôle à l&apos;autre ; une idée certaine pèse plus qu&apos;une hésitation.
          </p>
        </div>
        <ul className="flex flex-col gap-5">
          {profil.map((p) => (
            <AxeBarre key={p.axe.id} profil={p} />
          ))}
        </ul>
      </section>

      {tensions.length > 0 && (
        <section className="flex flex-col gap-2.5" aria-labelledby="profil-tensions">
          <div className="flex flex-col gap-1">
            <h2 id="profil-tensions" className={sectionTitle}>
              Tensions à examiner
            </h2>
            <p className="text-xs text-ink-3">
              Deux idées validées d&apos;un même thème qui s&apos;opposent sur un axe : contradiction, ou nuance assumée ?
            </p>
          </div>
          <ul className="flex flex-col gap-2.5">
            {tensions.map((t) => (
              <li key={`${t.a.id}-${t.b.id}-${t.axe}`} className={`${cardTight} flex flex-col gap-2`}>
                <p className="flex flex-wrap gap-1.5">
                  <span className={pillTag}>{LIBELLE_THEME[t.theme]}</span>
                  <span className={pillTag}>{AXES.find((a) => a.id === t.axe)?.label}</span>
                </p>
                {[t.a, t.b].map((idee) => (
                  <TransitionLink
                    key={idee.id}
                    href={`/opinions/${idee.id}`}
                    className="min-h-11 text-[14.5px] leading-snug text-ink underline-offset-2 hover:underline"
                  >
                    « {idee.position} »
                  </TransitionLink>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sujets.length > 0 && (
        <section className={`${card} flex flex-col gap-3`} aria-labelledby="profil-sujets">
          <div className="flex flex-col gap-1">
            <h2 id="profil-sujets" className={sectionTitle}>
              Sujets à creuser
            </h2>
            <p className="text-xs text-ink-3">Des thèmes sur lesquels tu n&apos;as encore validé aucune idée.</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {sujets.map((s) => (
              <li key={s.theme} className={pillTag}>
                {LIBELLE_THEME[s.theme]}
                {s.brouillons > 0 && ` · ${s.brouillons} brouillon${s.brouillons > 1 ? "s" : ""}`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
