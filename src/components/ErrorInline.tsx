import { AlerteIcon } from "@/components/icons";
import { errorText, secondaryButton } from "@/lib/ui";

/** État d'erreur (ou « introuvable ») affiché à la place d'une liste ou d'une
 * page de détail : message en clair, bouton « Réessayer » quand un `retry`
 * est fourni, annoncé aux lecteurs d'écran (`role="alert"`). `titre` rend un
 * `<h1>` : à passer sur les pages de détail, dont le titre habituel n'existe
 * pas tant que le contenu n'est pas chargé. Jamais de message technique
 * ici : le détail d'une erreur va dans la console, pas à l'écran.
 * Cadre à contour fin teinté et sans fond ni ombre : il tient seul comme dans
 * une carte (Aujourd'hui) sans créer de carte imbriquée. */
export function ErrorInline({
  message,
  retry,
  titre,
}: {
  message: string;
  retry?: () => void;
  titre?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-row border border-alert/30 px-4 py-5 text-center" role="alert">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full text-alert"
        style={{ background: "color-mix(in oklch, var(--accent-alert) 12%, transparent)" }}
      >
        <AlerteIcon size={20} />
      </span>
      {titre && <h1 className="font-display text-heading-sm font-semibold text-ink">{titre}</h1>}
      <p className={errorText}>{message}</p>
      {retry && (
        <button type="button" onClick={retry} className={secondaryButton}>
          Réessayer
        </button>
      )}
    </div>
  );
}
