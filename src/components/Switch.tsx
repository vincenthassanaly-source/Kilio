// Interrupteur des Réglages (Notifications, Nettoyage auto). Piste visible de
// 44×26 px, zone de tap étendue à 44×44 par un pseudo-élément transparent
// (même technique que `zoneTap44` dans lib/ui.ts), pastille déplacée par
// `transform` (et non `left`) pour une animation sur le compositeur.
export function Switch({
  checked,
  onToggle,
  label,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className="relative h-[26px] w-11 shrink-0 rounded-full transition-colors after:absolute after:-inset-y-2 after:inset-x-0 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcal focus-visible:ring-offset-2"
      // Piste éteinte bordée par --control-border (≥ 3:1, T5).
      style={{
        background: checked ? "var(--accent-kcal)" : "var(--surface-alt)",
        boxShadow: checked ? undefined : "inset 0 0 0 1.5px var(--control-border)",
      }}
    >
      <span
        aria-hidden
        className="absolute left-0.5 top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform duration-150 ease-out"
        style={{ transform: checked ? "translateX(18px)" : "translateX(0)" }}
      />
    </button>
  );
}
