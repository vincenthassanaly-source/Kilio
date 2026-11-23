import { ghostButton } from "@/lib/ui";

/** État vide : une phrase et la suite à donner (même feuille que le « + » flottant). */
export function HabitudesVides({
  depuisHistorique = false,
  onAjouter,
}: {
  depuisHistorique?: boolean;
  onAjouter?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
      <p className="text-heading-sm font-semibold text-ink">Aucune habitude pour l&apos;instant.</p>
      <p className="max-w-[28ch] text-label text-ink-2">
        {depuisHistorique
          ? "Ajoute-en depuis l'onglet Aujourd'hui pour voir ton historique."
          : "Ajoute-en une pour commencer ton suivi."}
      </p>
      {onAjouter && (
        <button type="button" onClick={onAjouter} className={`${ghostButton} mt-2`}>
          Ajouter une habitude
        </button>
      )}
    </div>
  );
}
