import { connection } from "next/server";
import { getReglagesBriefing } from "@/app/actions/briefing";
import { getReglagesNettoyage } from "@/app/actions/nettoyage";
import { TransitionLink } from "@/components/TransitionLink";
import { screenTitle, sectionTitle } from "@/lib/ui";
import { AlertesNutritionRow } from "./AlertesNutritionRow";
import { AppearanceRow } from "./AppearanceRow";
import { BilanHebdoRow } from "./BilanHebdoRow";
import { BriefingRow } from "./BriefingRow";
import { NettoyageAutoRow } from "./NettoyageAutoRow";
import { RevueHebdoRow } from "./RevueHebdoRow";
import { NotificationsRow } from "./NotificationsRow";
import { VidageRow } from "./VidageRow";

const INFO_ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ProfilIcon() {
  return (
    <svg {...INFO_ICON_PROPS}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </svg>
  );
}

function NavigationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-kcal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default async function ReglagesPage() {
  await connection();
  const [reglagesNettoyage, reglagesBriefing] = await Promise.all([getReglagesNettoyage(), getReglagesBriefing()]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className={screenTitle}>Réglages</h1>

      <div className="flex flex-col gap-2.5">
        <h2 className={sectionTitle}>Préférences</h2>
        <div className="rounded-card border border-line bg-surface px-4 shadow-card">
          <TransitionLink
            href="/plus"
            className="flex items-center justify-between gap-3 py-3.5"
          >
            <span className="flex items-center gap-2.5 text-label font-medium text-ink">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "color-mix(in oklch, var(--accent-kcal) 12%, transparent)" }}
              >
                <NavigationIcon />
              </span>
              Personnaliser la navigation
            </span>
            <span className="text-ink-3">
              <ChevronIcon />
            </span>
          </TransitionLink>
          <div className="border-t border-line">
            <AppearanceRow />
          </div>
          <NotificationsRow />
          <BriefingRow reglages={reglagesBriefing} />
          <RevueHebdoRow reglages={reglagesBriefing} />
          <AlertesNutritionRow reglages={reglagesBriefing} />
          <BilanHebdoRow reglages={reglagesBriefing} />
          <VidageRow reglages={reglagesBriefing} />
          <NettoyageAutoRow reglages={reglagesNettoyage} />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <h2 className={sectionTitle}>À propos</h2>
        <div className="rounded-card border border-line bg-surface px-4 shadow-card">
          <div className="flex items-center justify-between gap-3 py-3.5">
            <span className="flex items-center gap-2.5 text-label font-medium text-ink">
              <span className="text-ink-3">
                <ProfilIcon />
              </span>
              Profil
            </span>
            <span className="text-small font-medium text-ink-2">Vincent</span>
          </div>
        </div>
      </div>
    </div>
  );
}
