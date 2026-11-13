"use client";

import { useEffect, useRef } from "react";

// Éléments de présentation communs aux modales de réorganisation Gemini
// (documents/ReorganiserModal, collection/ReorganiserCollectionsModal).

export function FlecheIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-ink-3">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Case à cocher dont la zone de toucher fait 44 px de haut, comme dans TriVracModal. */
export function Case({
  checked,
  indeterminate = false,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (coche: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="relative flex h-11 w-5 shrink-0 cursor-pointer items-center justify-center after:absolute after:-inset-x-2 after:inset-y-0 after:content-['']">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="h-5 w-5 accent-[var(--accent-kcal)]"
      />
    </label>
  );
}
