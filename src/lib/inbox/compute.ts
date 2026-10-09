// Logique pure de l'inbox : une capture est un texte libre, qui devient au tri
// une tâche, une note ou un événement. Le titre est la première ligne ; le
// reste (lignes suivantes, ou débord d'une première ligne trop longue) devient
// les notes de la tâche ou le contenu de la note.

export const TITRE_MAX = 200;

export type CaptureDecoupee = { titre: string; reste: string | null };

export function decouperCapture(texte: string): CaptureDecoupee {
  const propre = texte.trim();
  const [premiere, ...suite] = propre.split(/\r?\n/);
  let titre = premiere.trim();
  let debord = "";
  if (titre.length > TITRE_MAX) {
    // Coupe à la dernière espace avant la limite pour ne pas casser un mot.
    const coupe = titre.lastIndexOf(" ", TITRE_MAX);
    const index = coupe > TITRE_MAX / 2 ? coupe : TITRE_MAX;
    debord = titre.slice(index).trim();
    titre = titre.slice(0, index).trim();
  }
  const reste = [debord, ...suite].join("\n").trim();
  return { titre, reste: reste || null };
}

/** « 1 élément », « 12 éléments » : libellé du compteur de l'inbox. */
export function libelleNbInbox(n: number): string {
  if (n === 0) return "Inbox vide";
  return n === 1 ? "1 élément à trier" : `${n} éléments à trier`;
}

/** Compteur affiché sur une pastille : plafonné pour rester lisible. */
export function pastilleCompteur(n: number): string | null {
  if (n <= 0) return null;
  return n > 9 ? "9+" : String(n);
}
