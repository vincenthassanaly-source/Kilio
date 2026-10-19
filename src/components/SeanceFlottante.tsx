"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { showErrorToast } from "@/components/toast/toast-store";
import { vibrate } from "@/lib/haptics";
import { EVENEMENT_BROUILLON, EVENEMENT_BROUILLON_MAJ, ecrireBrouillon, lireBrouillon } from "@/lib/musculation/brouillon";
import { synchroniserRappelRepos } from "@/lib/musculation/rappelRepos";
import { basculerSerie, formaterMinutes, prochaineSerie, type Brouillon } from "@/lib/musculation/seance";
import { deverrouillerAudio, signalerFinRepos, useMinuteurRepos } from "@/lib/musculation/useMinuteurRepos";
import { barreBasseMasquee } from "@/lib/navigation/immersif";

const URL_SEANCE = "/musculation/seance";

const boutonAction =
  "flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-kcal px-3.5 text-[13.5px] font-semibold text-on-kcal transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

const IconeCoche = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/**
 * Mini-barre « séance en cours », visible sur toutes les pages sauf l'écran de
 * séance lui-même (qui a sa propre barre de repos). Un tap la rouvre ; elle porte
 * le minuteur de repos (sonnerie + vibration à la fin, même hors de la séance) et
 * valide la prochaine série d'un geste. Elle disparaît d'elle-même quand la séance
 * est terminée ou abandonnée.
 */
export function SeanceFlottante() {
  const pathname = usePathname();
  const surSeance = barreBasseMasquee(pathname);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);

  // Relit la séance du téléphone : au montage, au retour sur une autre page, et à chaque
  // écriture (début, fin, validation depuis cette barre). Sur l'écran de séance, qui écrit
  // à chaque saisie, on ne lit pas : la relecture a lieu en le quittant.
  useEffect(() => {
    if (surSeance) return;
    let actif = true;
    const lire = () => {
      void lireBrouillon().then((lu) => {
        if (actif) setBrouillon(lu);
      });
    };
    lire();
    window.addEventListener(EVENEMENT_BROUILLON, lire);
    window.addEventListener(EVENEMENT_BROUILLON_MAJ, lire);
    return () => {
      actif = false;
      window.removeEventListener(EVENEMENT_BROUILLON, lire);
      window.removeEventListener(EVENEMENT_BROUILLON_MAJ, lire);
    };
  }, [surSeance]);

  // Un seul émetteur de son : sur l'écran de séance, c'est SeanceView qui sonne.
  const repos = !surSeance && brouillon ? brouillon.repos : null;
  const restant = useMinuteurRepos(repos, signalerFinRepos);

  if (surSeance || !brouillon) return null;

  const suivante = prochaineSerie(brouillon);
  const enRepos = brouillon.repos !== null;
  const fini = enRepos && restant <= 0;
  const progression = brouillon.repos
    ? fini
      ? 100
      : Math.max(0, Math.min(100, ((brouillon.repos.dureeS - restant) / brouillon.repos.dureeS) * 100))
    : 0;

  async function valider() {
    deverrouillerAudio();
    vibrate(15);
    try {
      // Relecture juste avant d'écrire : la séance a pu changer depuis le dernier affichage.
      const courant = await lireBrouillon();
      const cible = courant ? prochaineSerie(courant) : null;
      if (!courant || !cible) return;
      const apres = basculerSerie(courant, cible.cle, cible.serieId, new Date().toISOString());
      await ecrireBrouillon(apres, true);
      synchroniserRappelRepos(apres);
    } catch {
      showErrorToast("Impossible de valider la série.");
    }
  }

  const titre = enRepos ? (fini ? "Repos terminé" : "Repos") : "Série en cours";
  const libelleSuivante = suivante
    ? `${suivante.nom} · série ${suivante.rang}/${suivante.nbSeries}`
    : "Toutes les séries sont validées";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      // Au-dessus de la barre du bas (≈ 66 px de haut + 14 px de marge) + 8 px d'écart.
      className="fixed inset-x-0 z-40 flex justify-center px-3"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 88px)", viewTransitionName: "seance-flottante" }}
    >
      <div className="relative flex w-full max-w-md items-center gap-2 overflow-hidden rounded-[22px] border border-line bg-surface p-2 pl-0 shadow-card">
        <Link
          href={URL_SEANCE}
          className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-[16px] py-1 pl-3.5 pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal"
        >
          <span className="sr-only">Retourner à la séance en cours, {brouillon.nom}.</span>
          <span className="flex items-baseline gap-2">
            <span className="text-[12.5px] font-medium text-ink-2">{titre}</span>
            {enRepos && (
              <span
                role="timer"
                aria-live="off"
                className={`font-display text-[22px] font-semibold leading-none tabular-nums tracking-[-0.02em] ${
                  fini ? "text-kcal" : "text-ink"
                }`}
              >
                {fini ? "C'est reparti" : formaterMinutes(restant)}
              </span>
            )}
          </span>
          <span className="truncate text-[12.5px] text-ink-2">{libelleSuivante}</span>
        </Link>

        {suivante ? (
          <button
            type="button"
            onClick={() => void valider()}
            aria-label={`Valider la série ${suivante.rang} sur ${suivante.nbSeries} de ${suivante.nom}`}
            className={boutonAction}
          >
            <IconeCoche />
            Valider
          </button>
        ) : (
          <Link href={URL_SEANCE} className={boutonAction}>
            Terminer
          </Link>
        )}

        {enRepos && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-surface-alt" aria-hidden="true">
            <div
              className="h-full bg-kcal transition-[width] duration-300 ease-linear motion-reduce:transition-none"
              style={{ width: `${progression}%` }}
            />
          </div>
        )}

        {fini && (
          <span role="status" className="sr-only">
            Repos terminé, prochaine série
          </span>
        )}
      </div>
    </motion.div>
  );
}
