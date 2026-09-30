import { TransitionLink } from "@/components/TransitionLink";

const ONGLETS = [
  { cle: "cours", libelle: "Cours", href: "/pharmacie" },
  { cle: "referentiel", libelle: "Référentiel", href: "/pharmacie/referentiel" },
] as const;

// Deux entrées du module : le cahier de cours (matières, notions, cartes) et le
// référentiel médicaments (classes, molécules, pathologies, protocoles).
export function OngletsPharmacie({ actif }: { actif: (typeof ONGLETS)[number]["cle"] }) {
  return (
    <nav aria-label="Sections de la Pharmacie" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-alt p-1">
      {ONGLETS.map((onglet) => {
        const estActif = onglet.cle === actif;
        return (
          <TransitionLink
            key={onglet.cle}
            href={onglet.href}
            aria-current={estActif ? "page" : undefined}
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
