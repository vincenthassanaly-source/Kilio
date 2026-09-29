import Link from "next/link";
import { card, errorText, linkButton, primaryButton } from "@/lib/ui";

function AlertIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent-alert)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 9v4" />
      <path d="M12 16.5h.01" />
      <path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z" />
    </svg>
  );
}

/** Contenu visuel commun aux deux error.tsx (racine et groupe `(app)`) :
 * un fallback rassurant plutôt que l'écran blanc par défaut de Next.js.
 * `retry` relance le rendu du segment (y compris côté serveur, contrairement
 * à `reset`) ; le lien vers l'accueil sert de
 * secours si l'erreur persiste après le retry. */
export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className={`${card} flex w-full max-w-sm flex-col items-center gap-3`}>
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "color-mix(in oklch, var(--accent-alert) 12%, transparent)" }}
        >
          <AlertIcon />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-display text-[17px] font-semibold text-ink">Une erreur est survenue</p>
          <p className={errorText}>
            Quelque chose s&apos;est mal passé de notre côté. Vous pouvez réessayer, ou revenir à l&apos;accueil.
          </p>
        </div>
        <div className="flex w-full flex-col items-center gap-2 pt-1">
          <button type="button" onClick={retry} className={`${primaryButton} w-full`}>
            Réessayer
          </button>
          <Link href="/" className={linkButton}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
