import { TransitionLink } from "@/components/TransitionLink";

const ONGLETS = [
  { cle: "cours", libelle: "Cours", href: "/pharmacie" },
  { cle: "referentiel", libelle: "Référentiel", href: "/pharmacie/referentiel" },
  { cle: "huiles", libelle: "Huiles", nom: "Huiles essentielles", href: "/pharmacie/huiles-essentielles" },
] as const;

// Trois entrées du module : le cahier de cours (matières, notions, cartes), le
// référentiel médicaments (classes, molécules, pathologies, protocoles) et les
// huiles essentielles. Le libellé court tient dans un tiers de l'écran ; le
// nom complet (qui contient le libellé) est celui annoncé aux lecteurs d'écran.
export function OngletsPharmacie({ actif }: { actif: (typeof ONGLETS)[number]["cle"] }) {
  return (
    <nav aria-label="Sections de la Pharmacie" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-alt p-1">
      {ONGLETS.map((onglet) => {
        const estActif = onglet.cle === actif;
        return (
          <TransitionLink
            key={onglet.cle}
            href={onglet.href}
            aria-current={estActif ? "page" : undefined}
            aria-label={"nom" in onglet ? onglet.nom : undefined}
            className={`flex min-h-11 items-center justify-center rounded-xl px-3 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal ${
              estActif ? "bg-surface text-ink shadow-card" : "text-ink-2"
            }`}
          >
            {onglet.libelle}
          </TransitionLink>
        );
      })}
    </nav>
  );
}
