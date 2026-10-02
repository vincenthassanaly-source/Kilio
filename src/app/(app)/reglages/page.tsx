import { connection } from "next/server";
import { getReglagesNettoyage } from "@/app/actions/nettoyage";
import { TransitionLink } from "@/components/TransitionLink";
import { screenTitle, sectionTitle } from "@/lib/ui";
import { AppearanceRow } from "./AppearanceRow";
import { NettoyageAutoRow } from "./NettoyageAutoRow";
import { NotificationsRow } from "./NotificationsRow";

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

function VersionIcon() {
  return (
    <svg {...INFO_ICON_PROPS}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
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
  const reglagesNettoyage = await getReglagesNettoyage();

  return (
    <div className="flex flex-col gap-5">
      <h1 className={screenTitle}>Réglages</h1>

      <div className="flex flex-col gap-2.5">
        <h2 className={sectionTitle}>Préférences</h2>
        <div className="rounded-[22px] border border-line bg-surface px-4 shadow-card">
          <TransitionLink
            href="/plus"
            className="flex items-center justify-between gap-3 py-3.5"
          >
            <span className="flex items-center gap-2.5 text-[14px] font-medium text-ink">
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
          <NettoyageAutoRow reglages={reglagesNettoyage} />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <h2 className={sectionTitle}>À propos</h2>
        <div className="rounded-[22px] border border-line bg-surface px-4 shadow-card">
          <div className="flex items-center justify-between gap-3 py-3.5">
            <span className="flex items-center gap-2.5 text-[14px] font-medium text-ink">
              <span className="text-ink-3">
                <ProfilIcon />
              </span>
              Profil
            </span>
            <span className="text-[13px] font-medium text-ink-2">Vincent</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line py-3.5">
            <span className="flex items-center gap-2.5 text-[14px] font-medium text-ink">
              <span className="text-ink-3">
                <VersionIcon />
              </span>
              Version
            </span>
            <span className="text-[13px] font-medium text-ink-3">0.1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
