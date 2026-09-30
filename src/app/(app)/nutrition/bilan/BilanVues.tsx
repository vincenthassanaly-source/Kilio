import type { ReactNode } from "react";
import { TransitionLink } from "@/components/TransitionLink";
import type { JourBilan } from "@/lib/nutrition/bilan";
import { card, cardTight, sectionTitle } from "@/lib/ui";

// Vues présentationnelles du Bilan (rendu serveur, aucune interactivité
// propre : chaque jour est un lien vers le Journal à cette date).

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2";

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

const dateUTC = (date: string) => new Date(`${date}T00:00:00Z`);

const libelleCourt = (date: string) =>
  dateUTC(date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", timeZone: "UTC" });

const libelleLong = (date: string) =>
  dateUTC(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

// Lundi = 0.
const indexSemaine = (date: string) => (dateUTC(date).getUTCDay() + 6) % 7;

const hrefJournal = (date: string) => `/nutrition/journal?date=${date}`;

const pluriel = (n: number) => (n > 1 ? "jours" : "jour");

function libelleStatut(jour: JourBilan): string {
  switch (jour.statut) {
    case "reussi":
      return "dans les clous";
    case "rate":
      return jour.cible && Math.round(jour.consomme.kcal) > jour.cible.kcal
        ? "kcal dépassées"
        : "protéines en dessous de l'objectif";
    case "en_cours":
      return "journée en cours";
    case "vide":
      return "aucun repas saisi";
    case "sans_objectif":
      return "pas d'objectif pour ce type de jour";
  }
}

// Teinte du cercle : le verdict ne repose jamais sur la couleur seule, chaque
// statut a aussi son glyphe (voir `Glyphe`).
function classesMarque(jour: Pick<JourBilan, "statut" | "gravite">): string {
  switch (jour.statut) {
    case "reussi":
      return "bg-kcal text-on-kcal";
    case "rate":
      return jour.gravite === "marque" ? "bg-alert/15 text-alert" : "bg-warning/15 text-warning";
    case "en_cours":
      return "border border-dashed border-ink-3 text-ink-2";
    case "vide":
    case "sans_objectif":
      return "bg-surface-alt text-ink-3";
  }
}

function AlerteIcone({ taille = 10 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5 22 20.5H2L12 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17.5" r="1" fill="currentColor" />
    </svg>
  );
}

function Glyphe({ statut }: { statut: JourBilan["statut"] }) {
  switch (statut) {
    case "reussi":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "rate":
      return <AlerteIcone taille={16} />;
    case "en_cours":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      );
    case "vide":
    case "sans_objectif":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M8 12h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
  }
}

function CercleStatut({
  jour,
  className = "h-9 w-9",
}: {
  jour: Pick<JourBilan, "statut" | "gravite">;
  className?: string;
}) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full ${className} ${classesMarque(jour)}`}>
      <Glyphe statut={jour.statut} />
    </span>
  );
}

export function BandeSemaine({ jours }: { jours: JourBilan[] }) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {jours.map((jour, i) => {
        const estAujourdhui = i === jours.length - 1;
        const jourSemaine = dateUTC(jour.date)
          .toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" })
          .replace(".", "");
        return (
          <TransitionLink
            key={jour.date}
            href={hrefJournal(jour.date)}
            aria-label={`${libelleLong(jour.date)} : ${libelleStatut(jour)}`}
            className={`flex min-h-11 flex-col items-center gap-1.5 rounded-xl py-1 ${FOCUS}`}
          >
            <span
              aria-hidden="true"
              className={`text-[11px] capitalize ${estAujourdhui ? "font-bold text-ink" : "font-medium text-ink-3"}`}
            >
              {estAujourdhui ? "Auj." : jourSemaine}
            </span>
            <CercleStatut jour={jour} />
          </TransitionLink>
        );
      })}
    </div>
  );
}

const ENTETES_SEMAINE = ["L", "M", "M", "J", "V", "S", "D"];

export function CalendrierMois({ jours }: { jours: JourBilan[] }) {
  const decalage = jours.length > 0 ? indexSemaine(jours[0].date) : 0;

  return (
    <div className="mx-auto grid w-full max-w-sm grid-cols-7 gap-1.5">
      {ENTETES_SEMAINE.map((lettre, i) => (
        <span key={i} aria-hidden="true" className="pb-0.5 text-center text-[11px] font-medium text-ink-3">
          {lettre}
        </span>
      ))}
      {Array.from({ length: decalage }, (_, i) => (
        <span key={`decalage-${i}`} aria-hidden="true" />
      ))}
      {jours.map((jour, i) => {
        const estAujourdhui = i === jours.length - 1;
        return (
          <TransitionLink
            key={jour.date}
            href={hrefJournal(jour.date)}
            aria-label={`${libelleLong(jour.date)} : ${libelleStatut(jour)}`}
            className={`flex aspect-square items-center justify-center rounded-xl text-[12px] font-semibold tabular-nums ${classesMarque(jour)} ${
              estAujourdhui ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
            } ${FOCUS}`}
          >
            {Number(jour.date.slice(8))}
          </TransitionLink>
        );
      })}
    </div>
  );
}

export function LegendeStatuts() {
  const exemples: { jour: Pick<JourBilan, "statut" | "gravite">; libelle: string }[] = [
    { jour: { statut: "reussi", gravite: null }, libelle: "Dans les clous" },
    { jour: { statut: "rate", gravite: "leger" }, libelle: "Hors objectif" },
    { jour: { statut: "vide", gravite: null }, libelle: "Sans saisie" },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
      {exemples.map(({ jour, libelle }) => (
        <li key={libelle} className="flex items-center gap-1.5">
          <CercleStatut jour={jour} className="h-5 w-5 [&_svg]:h-3 [&_svg]:w-3" />
          {libelle}
        </li>
      ))}
    </ul>
  );
}

export function DetailJours({ jours }: { jours: JourBilan[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {[...jours].reverse().map((jour) => {
        const { cible, consomme } = jour;
        const kcal = Math.round(consomme.kcal);
        const proteines = Math.round(consomme.proteines);
        const kcalDepassees = cible != null && kcal > cible.kcal;
        const proteinesBasses =
          cible != null && jour.statut !== "en_cours" && jour.nbRepas > 0 && proteines < cible.proteines;
        const classeKcal = kcalDepassees
          ? jour.gravite === "marque"
            ? "font-bold text-alert"
            : "font-semibold text-warning"
          : "text-ink-2";

        return (
          <li key={jour.date}>
            <TransitionLink href={hrefJournal(jour.date)} className={`${cardTight} flex items-center gap-3 ${FOCUS}`}>
              <CercleStatut jour={jour} className="h-8 w-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold capitalize text-ink">{libelleCourt(jour.date)}</p>
                <p className="text-xs text-ink-2">{jour.jourType === "entrainement" ? "Entraînement" : "Repos"}</p>
              </div>
              {jour.nbRepas === 0 ? (
                <p className="text-xs text-ink-3">Aucun repas saisi</p>
              ) : (
                <div className="flex flex-col items-end gap-0.5 text-[11.5px] tabular-nums">
                  <p className={`flex items-center gap-1 ${classeKcal}`}>
                    {kcalDepassees && <AlerteIcone />}
                    {nombre.format(kcal)}
                    {cible ? ` / ${nombre.format(cible.kcal)}` : ""} kcal
                  </p>
                  <p className={`flex items-center gap-1 ${proteinesBasses ? "font-semibold text-warning" : "text-ink-2"}`}>
                    {proteinesBasses && <AlerteIcone />}
                    {nombre.format(proteines)}
                    {cible ? ` / ${nombre.format(cible.proteines)}` : ""} g prot.
                  </p>
                </div>
              )}
            </TransitionLink>
          </li>
        );
      })}
    </ul>
  );
}

export function ResumeTaux({
  reussis,
  evalues,
  periode,
}: {
  reussis: number;
  evalues: number;
  periode: string;
}) {
  if (evalues === 0) {
    return (
      <p className="text-[13.5px] text-ink-2 text-pretty">
        Aucun jour jugé sur {periode} : saisis tes repas dans le Journal.
      </p>
    );
  }
  const pct = Math.round((reussis / evalues) * 100);
  return (
    <p className="text-[13.5px] text-ink-2 text-pretty">
      <span className="font-semibold text-ink">
        {reussis} {pluriel(reussis)} sur {evalues}
      </span>{" "}
      dans les clous sur {periode} ({pct} %).
    </p>
  );
}

export function LigneSerie({ jours, tronquee }: { jours: number; tronquee: boolean }) {
  return (
    <p className="text-[13.5px] text-ink-2 text-pretty">
      {jours === 0 ? (
        "Pas de série en cours."
      ) : (
        <>
          Série en cours :{" "}
          <span className="font-semibold text-ink">
            {jours}
            {tronquee ? "+" : ""} {pluriel(jours)}
          </span>{" "}
          de suite.
        </>
      )}
    </p>
  );
}

export function SectionBilan({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className={sectionTitle}>{titre}</h2>
      {children}
    </section>
  );
}

export const carteBilan = `${card} flex flex-col gap-4`;
