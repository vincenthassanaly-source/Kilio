// Envoie les poses dessinées dans sport_exercices.poses (migration
// scripts/migration-sport-poses-2026-10-03.sql à appliquer avant).
//
// Usage :
//   node scripts/sport/poses/televerser-poses.mjs <poses.json> [--rejets id1,id2,…] [--inclure-a-valider] [--simuler]
//
// - Par défaut seules les poses au statut « auto » sont envoyées.
// - --inclure-a-valider ajoute celles à valider à la main : à n'utiliser qu'après
//   la relecture de la planche (planche-validation.mjs), en passant les
//   exercices écartés dans --rejets.
// - --rejets retire des ids de l'envoi, quel que soit leur statut ; leur colonne
//   `poses` est remise à NULL (l'app retombe sur la photo).
// - --simuler affiche le décompte sans rien écrire.
//
// Exige NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY. Rejouable.
import { readFile } from "node:fs/promises";
import path from "node:path";

const [fichier, ...options] = process.argv.slice(2);
if (!fichier) {
  console.error("Usage : televerser-poses.mjs <poses.json> [--rejets id1,id2,…] [--inclure-a-valider] [--simuler]");
  process.exit(1);
}
const rejets = new Set((options.includes("--rejets") ? options[options.indexOf("--rejets") + 1] : "").split(",").filter(Boolean));
const inclureAValider = options.includes("--inclure-a-valider");
const simuler = options.includes("--simuler");

const poses = JSON.parse(await readFile(path.resolve(fichier), "utf8"));
const aEnvoyer = [];
const aEffacer = [];
for (const [id, p] of Object.entries(poses)) {
  const exploitable = p.a && p.b && (p.statut === "auto" || inclureAValider);
  if (rejets.has(id) || !exploitable) aEffacer.push(id);
  else aEnvoyer.push({ id, poses: { v: 1, a: p.a, b: p.b } });
}
console.log(`${aEnvoyer.length} poses à envoyer, ${aEffacer.length} remises à NULL (photo conservée)`);
if (simuler) process.exit(0);

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// `update` ligne par ligne : un upsert devrait renseigner les colonnes NOT NULL de chaque ligne.
let faites = 0;
const PARALLELISME = 8;
async function enParallele(elements, tache) {
  let suivant = 0;
  await Promise.all(
    Array.from({ length: PARALLELISME }, async () => {
      while (suivant < elements.length) await tache(elements[suivant++]);
    }),
  );
}
await enParallele(aEnvoyer, async ({ id, poses: valeur }) => {
  const { error } = await supabase.from("sport_exercices").update({ poses: valeur }).eq("id", id);
  if (error) throw new Error(`${id} : ${error.message}`);
  if (++faites % 200 === 0) console.log(`${faites}/${aEnvoyer.length}`);
});
for (let debut = 0; debut < aEffacer.length; debut += 100) {
  const { error } = await supabase.from("sport_exercices").update({ poses: null }).in("id", aEffacer.slice(debut, debut + 100));
  if (error) throw new Error(error.message);
}
console.log(`terminé : ${aEnvoyer.length} poses envoyées, ${aEffacer.length} remises à NULL`);
