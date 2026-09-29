import Link from "next/link";
import { card, linkButton } from "@/lib/ui";

// 404 racine : URL inconnue, ou notFound() levé dans une page (fiche
// supprimée…). Rendu dans le layout racine, donc thème et polices déjà
// appliqués ; le conteneur défile comme celui de error.tsx (le <body> est en
// overflow-hidden).
export default function NotFound() {
  return (
    <div
      className="flex-1 overflow-y-auto px-4"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 24px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
      }}
    >
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className={`${card} flex w-full max-w-sm flex-col items-center gap-3`}>
          <p className="font-display text-[17px] font-semibold text-ink">Page introuvable</p>
          <p className="text-sm text-ink-3">
            Cette page n&apos;existe pas ou a été supprimée.
          </p>
          <Link href="/" className={linkButton}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
