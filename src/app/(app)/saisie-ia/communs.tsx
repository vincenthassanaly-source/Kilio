// Petits éléments d'interface partagés par les modules de « Ajouter avec l'IA ».

function IconeAttention() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-[3px] shrink-0">
      <path d="M12 4l9 16H3L12 4z" />
      <path d="M12 10v4M12 17.5v.01" />
    </svg>
  );
}

export function Avertissements({ textes }: { textes: string[] }) {
  return (
    <>
      {textes.map((texte) => (
        <p key={texte} className="flex items-start gap-1.5 text-[12.5px] text-ink-2">
          <IconeAttention />
          <span>{texte}</span>
        </p>
      ))}
    </>
  );
}

/** « 1 tâche » / « 3 tâches » : `{n}` est remplacé dans la forme plurielle. */
export const pluriel = (n: number, un: string, plusieurs: string) =>
  n === 1 ? un : plusieurs.replace("{n}", String(n));
