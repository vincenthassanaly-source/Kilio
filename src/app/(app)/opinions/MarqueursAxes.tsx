import { formaterMoyenne, placerMarqueurs, type Marqueur } from "@/lib/opinions/partis";
import { varCouleurParti } from "@/lib/opinions/couleurs";
import { AXES, type Axe, type AxeId } from "@/lib/opinions/types";

const HAUTEUR_LIGNE_PX = 28;

// Une piste par axe : la position de chaque étiquette vaut la moyenne du parti
// (ou la mienne) entre le pôle de gauche (-2) et celui de droite (+2) ; le trait
// central est la position équilibrée. Chaque parti garde sa couleur partout ;
// mon étiquette « Moi » prend l'accent du module. Les étiquettes qui se gênent
// passent sur une ligne en dessous. Le sens ne repose jamais sur la couleur :
// chaque étiquette porte son nom et le résumé chiffré est lu par les lecteurs
// d'écran.
function PisteAxe({ axe, marqueurs }: { axe: Axe; marqueurs: readonly Marqueur[] }) {
  const { places, lignes } = placerMarqueurs(marqueurs);
  const resume = places.map((m) => `${m.libelle} ${formaterMoyenne(m.valeur)}`).join(", ");

  return (
    <li className="flex flex-col gap-1.5">
      <span className="text-[15px] font-semibold text-ink">{axe.label}</span>
      {places.length === 0 ? (
        <p className="text-xs text-ink-3">Aucune donnée sur cet axe.</p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`${axe.label} : ${resume}`}
            className="relative mx-5"
            style={{ height: lignes * HAUTEUR_LIGNE_PX + 4 }}
          >
            <span aria-hidden="true" className="absolute inset-x-0 top-[11px] h-0.5 rounded-full bg-line" />
            <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-control-border" />
            {places.map((m) => (
              <span
                key={m.id}
                aria-hidden="true"
                className={`absolute -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold text-on-accent ring-2 ring-surface ${
                  m.moi || !m.couleur ? "bg-[var(--accent-opinions)]" : ""
                }`}
                style={{
                  left: `${m.pourcent}%`,
                  top: m.ligne * HAUTEUR_LIGNE_PX + 2,
                  ...(m.moi || !m.couleur ? {} : { backgroundColor: varCouleurParti(m.couleur) }),
                }}
              >
                {m.libelle}
              </span>
            ))}
          </div>
          <div className="mx-5 flex justify-between text-xs text-ink-3" aria-hidden="true">
            <span>‹ {axe.gauche}</span>
            <span>{axe.droite} ›</span>
          </div>
        </>
      )}
    </li>
  );
}

export function MarqueursAxes({ parAxe }: { parAxe: Record<AxeId, readonly Marqueur[]> }) {
  return (
    <ul className="flex flex-col gap-5">
      {AXES.map((axe) => (
        <PisteAxe key={axe.id} axe={axe} marqueurs={parAxe[axe.id]} />
      ))}
    </ul>
  );
}
