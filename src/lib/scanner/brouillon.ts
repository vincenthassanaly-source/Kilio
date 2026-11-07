// Brouillon du scanner : les pages en cours sont gardées dans IndexedDB
// (Dexie, base locale « kilio-offline ») pour survivre à un rechargement de la
// PWA. Rien n'est envoyé au serveur ; le brouillon est vidé après export ou à
// la demande.

import { db } from "@/lib/offline/db";
import type { Filtre } from "./filtres";

export type PageBrouillon = {
  id: string;
  /** Position dans le document (0 = première page). */
  ordre: number;
  /** Page redressée sans filtre. */
  redresse: Blob;
  /** Page filtrée (exportée). */
  traite: Blob;
  filtre: Filtre;
  largeur: number;
  hauteur: number;
  cree_le: string;
};

export type NouvellePage = Pick<PageBrouillon, "redresse" | "traite" | "filtre" | "largeur" | "hauteur">;

export async function listerPages(): Promise<PageBrouillon[]> {
  return db.scanner_pages.orderBy("ordre").toArray();
}

/** Ajoute une page à la fin, ou à la place de `remplacerId` (reprendre une page). */
export async function ajouterPage(page: NouvellePage, remplacerId?: string): Promise<PageBrouillon> {
  return db.transaction("rw", db.scanner_pages, async () => {
    const existante = remplacerId ? await db.scanner_pages.get(remplacerId) : undefined;
    let ordre: number;
    if (existante) {
      ordre = existante.ordre;
      await db.scanner_pages.delete(existante.id);
    } else {
      const derniere = await db.scanner_pages.orderBy("ordre").last();
      ordre = derniere ? derniere.ordre + 1 : 0;
    }
    const nouvelle: PageBrouillon = { ...page, id: crypto.randomUUID(), ordre, cree_le: new Date().toISOString() };
    await db.scanner_pages.add(nouvelle);
    return nouvelle;
  });
}

export async function supprimerPage(id: string): Promise<void> {
  await db.scanner_pages.delete(id);
}

export async function viderBrouillon(): Promise<void> {
  await db.scanner_pages.clear();
}
