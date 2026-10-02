// Import de la bibliothèque d'exercices du module Sport (free-exercise-db,
// domaine public / Unlicense : https://github.com/yuhonas/free-exercise-db).
//
// Deux étapes, rejouables (upsert, identifiants stables) :
//
//   node scripts/sport/importer-exercices.mjs construire [dossier-sortie]
//     Télécharge le jeu de données et les images, applique les traductions
//     françaises (scripts/sport/data/traductions-fr.json), convertit les
//     images en WebP 600 px et écrit <sortie>/rows.json + <sortie>/images/.
//
//   node scripts/sport/importer-exercices.mjs televerser [dossier-sortie]
//     Envoie rows.json dans la table sport_exercices et les images dans le
//     bucket public sport-exercices. Exige NEXT_PUBLIC_SUPABASE_URL et
//     SUPABASE_SERVICE_ROLE_KEY dans l'environnement.
//
// La migration scripts/migration-sport-exercices-2026-10-02.sql doit avoir été
// appliquée avant « televerser ».

import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RACINE_DONNEES = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main";
const ICI = path.dirname(fileURLToPath(import.meta.url));
const FICHIER_TRADUCTIONS = path.join(ICI, "data", "traductions-fr.json");
const BUCKET = "sport-exercices";
const LARGEUR_IMAGE = 600;
const PARALLELISME = 8;

async function telecharger(url, type) {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`${url} -> HTTP ${reponse.status}`);
  return type === "json" ? reponse.json() : Buffer.from(await reponse.arrayBuffer());
}

/** Exécute `tache` sur chaque élément avec au plus `PARALLELISME` appels simultanés. */
async function enParallele(elements, tache) {
  let suivant = 0;
  const travailleurs = Array.from({ length: PARALLELISME }, async () => {
    while (suivant < elements.length) {
      const element = elements[suivant++];
      await tache(element);
    }
  });
  await Promise.all(travailleurs);
}

/**
 * Type de mesure déduit de la catégorie : étirements, cardio et exercices
 * statiques (gainage…) se mesurent en durée, le reste en poids × répétitions.
 */
export function typeMesure(exercice) {
  if (exercice.category === "stretching" || exercice.category === "cardio") return "duree";
  if (exercice.force === "static" && exercice.category === "strength") return "duree";
  return "poids_reps";
}

export function construireLigne(exercice, traduction) {
  return {
    id: exercice.id,
    nom_fr: traduction.nom,
    nom_en: exercice.name,
    muscle_principal: exercice.primaryMuscles[0] ?? "autre",
    muscles_secondaires: exercice.secondaryMuscles ?? [],
    equipement: exercice.equipment ?? null,
    categorie: exercice.category,
    niveau: exercice.level ?? null,
    mecanique: exercice.mechanic ?? null,
    type_mesure: typeMesure(exercice),
    instructions_fr: traduction.instructions,
    // Les images sont converties en WebP : <id>/0.webp, <id>/1.webp.
    images: exercice.images.map((_, i) => `${exercice.id}/${i}.webp`),
  };
}

async function construire(sortie) {
  const traductions = JSON.parse(await readFile(FICHIER_TRADUCTIONS, "utf8"));
  const exercices = await telecharger(`${RACINE_DONNEES}/dist/exercises.json`, "json");

  const manquants = exercices.filter((e) => !traductions[e.id]);
  if (manquants.length > 0) {
    throw new Error(`${manquants.length} exercice(s) sans traduction, ex. ${manquants[0].id}`);
  }

  const lignes = exercices.map((e) => construireLigne(e, traductions[e.id]));
  await mkdir(path.join(sortie, "images"), { recursive: true });
  await writeFile(path.join(sortie, "rows.json"), JSON.stringify(lignes));

  const images = exercices.flatMap((e) => e.images.map((source, i) => ({ id: e.id, source, i })));
  let faites = 0;
  await enParallele(images, async ({ id, source, i }) => {
    const brut = await telecharger(`${RACINE_DONNEES}/exercises/${source}`, "binaire");
    const webp = await sharp(brut).resize({ width: LARGEUR_IMAGE, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    await mkdir(path.join(sortie, "images", id), { recursive: true });
    await writeFile(path.join(sortie, "images", id, `${i}.webp`), webp);
    faites += 1;
    if (faites % 200 === 0) console.log(`${faites}/${images.length} images`);
  });
  console.log(`${lignes.length} exercices, ${images.length} images -> ${sortie}`);
}

async function televerser(sortie) {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const lignes = JSON.parse(await readFile(path.join(sortie, "rows.json"), "utf8"));
  for (let debut = 0; debut < lignes.length; debut += 100) {
    const { error } = await supabase.from("sport_exercices").upsert(lignes.slice(debut, debut + 100), { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  console.log(`${lignes.length} lignes envoyées`);

  const dossiers = await readdir(path.join(sortie, "images"));
  await enParallele(dossiers, async (id) => {
    for (const fichier of await readdir(path.join(sortie, "images", id))) {
      const contenu = await readFile(path.join(sortie, "images", id, fichier));
      const { error } = await supabase.storage.from(BUCKET).upload(`${id}/${fichier}`, contenu, {
        contentType: "image/webp",
        upsert: true,
        cacheControl: "31536000",
      });
      if (error) throw new Error(`${id}/${fichier} : ${error.message}`);
    }
  });
  console.log(`${dossiers.length} dossiers d'images envoyés`);
}

const [commande, sortieArg] = process.argv.slice(2);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sortie = path.resolve(sortieArg ?? "sport-import");
  if (commande === "construire") await construire(sortie);
  else if (commande === "televerser") await televerser(sortie);
  else {
    console.error("Usage : importer-exercices.mjs <construire|televerser> [dossier-sortie]");
    process.exit(1);
  }
}
