import Link from "next/link";
import { ErrorInline } from "@/components/ErrorInline";
import { linkButton } from "@/lib/ui";

// Document supprimé ou identifiant inconnu : même forme que « Collection
// introuvable » (CollectionDetailView), avec un retour vers la liste plutôt
// que vers l'accueil (404 racine).
export default function DocumentIntrouvable() {
  return (
    <div className="flex flex-col items-center gap-3">
      <ErrorInline titre="Document introuvable" message="Il a peut-être été supprimé." />
      <Link href="/documents" className={linkButton}>
        Retour aux documents
      </Link>
    </div>
  );
}
