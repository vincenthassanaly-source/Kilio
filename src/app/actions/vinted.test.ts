// @vitest-environment node
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ecritures, fauxSupabase, type Repondre, type RepondreStockage } from "@/test/fake-supabase";

const etat = vi.hoisted(() => ({ client: null as unknown, revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: etat.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => etat.client }));

import {
  ajouterPhotosAnnonce,
  changerStatutAnnonce,
  creerAnnonce,
  enregistrerReglagesVinted,
  getReglagesVinted,
  modifierAnnonce,
  reordonnerPhotosAnnonce,
  supprimerAnnonce,
  supprimerPhotoAnnonce,
} from "./vinted";

const ID = "11111111-1111-4111-8111-111111111111";
const BUCKET = "vinted-images";
const URL_PUBLIQUE = `https://stockage.test/storage/v1/object/public/${BUCKET}`;

function brancher(repondre?: Repondre, stockage?: RepondreStockage) {
  const fake = fauxSupabase(repondre, stockage);
  etat.client = fake.client;
  return fake;
}

async function photo(nom = "p.png") {
  const buffer = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).png().toBuffer();
  return new File([new Uint8Array(buffer)], nom, { type: "image/png" });
}

function form(photos: File[]) {
  const f = new FormData();
  photos.forEach((p) => f.append("photos", p));
  return f;
}

const CHAMPS = {
  titre: " Robe verte ",
  description: "Jolie robe",
  hashtags: ["#Robe", "robe", "Été"],
  categorie: "Robes",
  marque: "Zara",
  taille: "M",
  etat: "Bon état",
  couleur: "Vert",
  matiere: "Coton",
  prix: 12.349,
  colis: "Petit",
};

const ANNONCE_COMPLETE = {
  id: ID,
  titre: "Robe",
  description: "Jolie",
  categorie: "Robes",
  etat: "Bon état",
  prix: 10,
  colis: "Petit",
  vinted_photos: [{ id: "p1", url: `${URL_PUBLIQUE}/${ID}/a.jpg`, ordre: 0 }],
};

beforeEach(() => {
  etat.revalidatePath.mockClear();
});

describe("creerAnnonce", () => {
  it("crée un brouillon avec le colis par défaut des réglages", async () => {
    const fake = brancher((a) => {
      if (a.table === "vinted_reglages") return { data: { colis_defaut: "Moyen", hashtags_communs: [] } };
      if (a.action === "insert") return { data: { id: ID } };
    });
    const resultat = await creerAnnonce();
    expect(resultat).toEqual({ ok: true, data: { id: ID } });
    expect(ecritures(fake.appels, "vinted_annonces", "insert")[0].payload).toEqual({ colis: "Moyen" });
    expect(etat.revalidatePath).toHaveBeenCalledWith("/vinted");
  });

  it("retourne l'erreur sans lever", async () => {
    brancher((a) => (a.action === "insert" ? { error: { message: "ko" } } : undefined));
    expect(await creerAnnonce()).toEqual({ ok: false, error: "ko" });
  });
});

describe("modifierAnnonce", () => {
  it("nettoie les champs : trim, hashtags normalisés sans doublon, prix arrondi", async () => {
    const fake = brancher();
    expect(await modifierAnnonce(ID, CHAMPS)).toEqual({ ok: true, data: undefined });

    const payload = ecritures(fake.appels, "vinted_annonces", "update")[0].payload as Record<string, unknown>;
    expect(payload).toMatchObject({ titre: "Robe verte", hashtags: ["#robe", "#ete"], prix: 12.35 });
    expect(etat.revalidatePath).toHaveBeenCalledWith(`/vinted/${ID}`);
  });

  it("refuse un titre ou une description trop longs, ou un prix invalide, sans écrire", async () => {
    const fake = brancher();
    expect((await modifierAnnonce(ID, { ...CHAMPS, titre: "x".repeat(101) })).ok).toBe(false);
    expect((await modifierAnnonce(ID, { ...CHAMPS, description: "y".repeat(2001) })).ok).toBe(false);
    expect((await modifierAnnonce(ID, { ...CHAMPS, prix: -1 })).ok).toBe(false);
    expect(ecritures(fake.appels, "vinted_annonces")).toHaveLength(0);
  });
});

describe("changerStatutAnnonce", () => {
  it("refuse « Prêt » tant qu'il manque des champs, en les nommant", async () => {
    const fake = brancher((a) => {
      if (a.table === "vinted_annonces") return { data: { ...ANNONCE_COMPLETE, vinted_photos: [], prix: null } };
      if (a.table === "vinted_reglages") return { data: { colis_defaut: "", hashtags_communs: [] } };
    });
    const resultat = await changerStatutAnnonce(ID, "pret");
    expect(resultat).toEqual({ ok: false, error: "Il manque : au moins une photo, un prix." });
    expect(ecritures(fake.appels, "vinted_annonces")).toHaveLength(0);
  });

  it("passe en « Prêt » quand l'annonce est complète", async () => {
    const fake = brancher((a) => {
      if (a.table === "vinted_annonces" && a.action === "select") return { data: ANNONCE_COMPLETE };
      if (a.table === "vinted_reglages") return { data: { colis_defaut: "", hashtags_communs: [] } };
    });
    expect((await changerStatutAnnonce(ID, "pret")).ok).toBe(true);
    expect(ecritures(fake.appels, "vinted_annonces", "update")[0].payload).toMatchObject({ statut: "pret" });
  });

  it("autorise « Publié » sans contrôle et refuse un statut inconnu", async () => {
    const fake = brancher();
    expect((await changerStatutAnnonce(ID, "publie")).ok).toBe(true);
    expect(fake.appels.filter((a) => a.action === "select")).toHaveLength(0);
    expect((await changerStatutAnnonce(ID, "archive" as never)).ok).toBe(false);
  });
});

describe("ajouterPhotosAnnonce", () => {
  it("compresse en JPEG sous le dossier de l'annonce et numérote à la suite", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: [{ ordre: 4 }, { ordre: 3 }] } : undefined));
    const resultat = await ajouterPhotosAnnonce(ID, form([await photo("a.png"), await photo("b.png")]));

    expect(resultat).toEqual({ ok: true, data: { ajoutees: 2 } });
    expect(fake.stockage.map((s) => [s.bucket, s.contentType])).toEqual([[BUCKET, "image/jpeg"], [BUCKET, "image/jpeg"]]);
    const lignes = ecritures(fake.appels, "vinted_photos", "insert")[0].payload as Record<string, unknown>[];
    expect(lignes.map((l) => [l.annonce_id, l.ordre])).toEqual([[ID, 5], [ID, 6]]);
    expect(String(lignes[0].url)).toMatch(new RegExp(`^${URL_PUBLIQUE}/${ID}/[0-9a-f-]{36}\\.jpg$`));
  });

  it("ne fait rien sans photo et refuse de dépasser 20 photos", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: Array.from({ length: 20 }, (_, i) => ({ ordre: i })) } : undefined));
    expect(await ajouterPhotosAnnonce(ID, form([]))).toEqual({ ok: true, data: { ajoutees: 0 } });
    const resultat = await ajouterPhotosAnnonce(ID, form([await photo()]));
    expect(resultat.ok).toBe(false);
    expect(fake.stockage).toHaveLength(0);
  });

  it("efface les fichiers déjà envoyés si l'insertion échoue", async () => {
    const fake = brancher((a) => (a.action === "insert" ? { error: { message: "insert ko" } } : a.action === "select" ? { data: [] } : undefined));
    const resultat = await ajouterPhotosAnnonce(ID, form([await photo()]));
    expect(resultat).toEqual({ ok: false, error: "insert ko" });
    expect(fake.stockage.map((s) => s.action)).toEqual(["upload", "remove"]);
  });
});

describe("photos : suppression et ordre", () => {
  it("supprime le fichier du stockage puis la ligne", async () => {
    const fake = brancher((a) => (a.action === "select" ? { data: { url: `${URL_PUBLIQUE}/${ID}/a.jpg`, annonce_id: ID } } : undefined));
    expect((await supprimerPhotoAnnonce("p1")).ok).toBe(true);
    expect(fake.stockage).toEqual([expect.objectContaining({ action: "remove", chemins: [`${ID}/a.jpg`] })]);
    expect(ecritures(fake.appels, "vinted_photos", "delete")).toHaveLength(1);
  });

  it("enregistre l'ordre photo par photo", async () => {
    const fake = brancher();
    expect((await reordonnerPhotosAnnonce(ID, ["b", "a"])).ok).toBe(true);
    expect(ecritures(fake.appels, "vinted_photos", "update").map((a) => a.payload)).toEqual([{ ordre: 0 }, { ordre: 1 }]);
  });
});

describe("supprimerAnnonce", () => {
  it("efface les fichiers puis l'annonce", async () => {
    const fake = brancher((a) =>
      a.table === "vinted_photos" && a.action === "select" ? { data: [{ url: `${URL_PUBLIQUE}/${ID}/a.jpg` }, { url: `${URL_PUBLIQUE}/${ID}/b.jpg` }] } : undefined
    );
    expect((await supprimerAnnonce(ID)).ok).toBe(true);
    expect(fake.stockage[0].chemins).toEqual([`${ID}/a.jpg`, `${ID}/b.jpg`]);
    expect(ecritures(fake.appels, "vinted_annonces", "delete")).toHaveLength(1);
  });

  it("garde l'annonce si les fichiers ne peuvent pas être effacés", async () => {
    const fake = brancher(
      (a) => (a.table === "vinted_photos" && a.action === "select" ? { data: [{ url: `${URL_PUBLIQUE}/${ID}/a.jpg` }] } : undefined),
      () => ({ error: { message: "stockage ko" } })
    );
    expect(await supprimerAnnonce(ID)).toEqual({ ok: false, error: "stockage ko" });
    expect(ecritures(fake.appels, "vinted_annonces")).toHaveLength(0);
  });
});

describe("réglages", () => {
  it("lit des valeurs par défaut quand la ligne manque", async () => {
    brancher();
    expect(await getReglagesVinted()).toEqual({ signature: "", colis_defaut: "", hashtags_communs: [], hashtags_par_categorie: {} });
  });

  it("normalise signature, hashtags communs et par catégorie à l'enregistrement", async () => {
    const fake = brancher();
    await enregistrerReglagesVinted({
      signature: "  Envoi rapide ",
      colis_defaut: " Petit ",
      hashtags_communs: ["Vinted", "#vinted"],
      hashtags_par_categorie: { " Robes ": ["Robe", "Été"], "Vide": [] },
    });
    expect(ecritures(fake.appels, "vinted_reglages", "upsert")[0].payload).toMatchObject({
      id: true,
      signature: "Envoi rapide",
      colis_defaut: "Petit",
      hashtags_communs: ["#vinted"],
      hashtags_par_categorie: { robes: ["#robe", "#ete"] },
    });
  });
});
