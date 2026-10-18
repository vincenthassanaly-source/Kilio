import type { ExplicationProposition as Explication } from "@/lib/opinions/partis";
import { metaText } from "@/lib/ui";

const BLOCS: { cle: keyof Explication; titre: string }[] = [
  { cle: "concret", titre: "Ce que ça change" },
  { cle: "pour", titre: "Le meilleur argument pour" },
  { cle: "contre", titre: "Le meilleur argument contre" },
];

// Les deux arguments ont le même rang visuel (même titre, même corps) : aucun
// camp n'est mis en avant, et la couleur ne porte jamais seule le sens.
export function ExplicationProposition({ explication }: { explication: Explication | null }) {
  if (explication === null) {
    return <p className={metaText}>Pas encore expliquée.</p>;
  }

  return (
    <details className="group rounded-xl border border-line bg-surface-alt">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 text-[13.5px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal">
        Comprendre cette proposition
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="flex flex-col gap-3 border-t border-line px-3 py-3">
        {BLOCS.flatMap(({ cle, titre }) =>
          explication[cle] ? (
            <section key={cle} className="flex flex-col gap-1">
              <h4 className="text-xs font-semibold text-ink-3">{titre}</h4>
              <p className="text-[14px] leading-relaxed text-ink">{explication[cle]}</p>
            </section>
          ) : (
            []
          )
        )}
        <p className="text-xs text-ink-3">Une aide pour réfléchir, pas une source : le texte du programme fait foi.</p>
      </div>
    </details>
  );
}
