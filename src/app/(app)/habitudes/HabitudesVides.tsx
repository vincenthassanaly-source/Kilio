/** État vide : une phrase et la suite à donner, centrés sous la carte « Ajouter ». */
export function HabitudesVides({ depuisHistorique = false }: { depuisHistorique?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
      <p className="font-display text-heading-sm font-semibold text-ink">Aucune habitude pour l&apos;instant.</p>
      <p className="max-w-[28ch] text-label text-ink-2">{depuisHistorique
          ? "Ajoute-en depuis l'onglet Aujourd'hui pour voir ton historique."
          : "Ajoute-en avec la carte ci-dessus pour commencer ton suivi."}</p>
    </div>
  );
}

