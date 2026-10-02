import { TransitionLink } from "@/components/TransitionLink";
import { cardTight, metaText, nameText, screenTitle } from "@/lib/ui";

const ICONE_HALTERE = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--accent-sport)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3.5 9.5v5M6.5 7v10M17.5 7v10M20.5 9.5v5M6.5 12h11" />
  </svg>
);

export default function SportPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={screenTitle}>Sport</h1>
      <TransitionLink href="/sport/exercices" className={`${cardTight} flex items-center gap-3`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-surface-alt">
          {ICONE_HALTERE}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={nameText}>Exercices</span>
          <span className={metaText}>Bibliothèque avec démonstration en images</span>
        </span>
      </TransitionLink>
    </div>
  );
}
