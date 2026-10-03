// Planche de validation des poses extraites : pour chaque exercice, les 2 photos
// d'origine à côté des 2 poses dessinées (départ / arrivée), avec une case à
// cocher « ✓ bon » / « ✗ à écarter ». Page autonome (images en base64).
//
// Usage :
//   node scripts/sport/poses/planche-validation.mjs <dossier-travail> <sortie.html>
//        [--statut a_valider|auto|tous] [--echantillon N] [--ids id1,id2,…]
//
// Lit <dossier-travail>/poses.json et <dossier-travail>/telechargements/.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { construireSilhouette, zonesDuMuscle } from "../../../src/lib/sport/silhouette.ts";

const [travailArg, sortieArg, ...options] = process.argv.slice(2);
if (!travailArg || !sortieArg) {
  console.error("Usage : planche-validation.mjs <dossier-travail> <sortie.html> [--statut …] [--echantillon N] [--ids …]");
  process.exit(1);
}
const option = (nom) => {
  const i = options.indexOf(nom);
  return i >= 0 ? options[i + 1] : undefined;
};
const travail = path.resolve(travailArg);
const statut = option("--statut") ?? "a_valider";
const echantillon = option("--echantillon") ? Number(option("--echantillon")) : null;
const ids = option("--ids")?.split(",");

const poses = JSON.parse(await readFile(path.join(travail, "poses.json"), "utf8"));
const exercices = JSON.parse(await readFile(path.join(travail, "exercises.json"), "utf8"));
const parId = new Map(exercices.map((e) => [e.id, e]));

let retenus = Object.entries(poses).filter(([id, p]) => (ids ? ids.includes(id) : statut === "tous" || p.statut === statut));
if (echantillon) {
  // Échantillon reproductible : un pas régulier plutôt qu'un tirage aléatoire.
  const pas = Math.max(1, Math.floor(retenus.length / echantillon));
  retenus = retenus.filter((_, i) => i % pas === 0).slice(0, echantillon);
}

function svg(p, t, zones) {
  const { formes, sol } = construireSilhouette(p, t, zones);
  const corps = (arriere) =>
    formes
      .filter((f) => f.arriere === arriere)
      .map((f) => {
        const c = f.cible ? "#e8590c" : arriere ? "#7d8590" : "#2b2f36";
        return f.type === "trait"
          ? `<path d="${f.d}" stroke="${c}" stroke-width="${f.largeur.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
          : `<circle cx="${f.cx.toFixed(1)}" cy="${f.cy.toFixed(1)}" r="${f.r.toFixed(1)}" fill="${f.cible ? c : "#2b2f36"}"/>`;
      })
      .join("");
  return `<svg viewBox="0 0 200 260"><ellipse cx="100" cy="${sol.toFixed(1)}" rx="70" ry="4" fill="#e4e0d6"/>${corps(true)}${corps(false)}</svg>`;
}

async function miniature(id, i) {
  try {
    const tampon = await sharp(path.join(travail, "telechargements", id, `${i}.jpg`)).resize({ height: 200 }).jpeg({ quality: 55 }).toBuffer();
    return `<img src="data:image/jpeg;base64,${tampon.toString("base64")}" alt="photo ${i}">`;
  } catch {
    return `<div class="vide">pas de photo</div>`;
  }
}

const cartes = [];
for (const [id, p] of retenus) {
  const source = parId.get(id);
  const muscle = source?.primaryMuscles?.[0] ?? "";
  const dessins = p.a
    ? `<div class="ligne">${svg(p, 0, zonesDuMuscle(muscle))}${svg(p, 1, zonesDuMuscle(muscle))}</div>`
    : `<div class="ligne"><div class="vide">pas de pose</div></div>`;
  const photos = `<div class="ligne">${await miniature(id, 0)}${(source?.images?.length ?? 0) > 1 ? await miniature(id, 1) : ""}</div>`;
  cartes.push(`<article class="carte" data-id="${id}"><h3>${source?.name ?? id}</h3>
    <p class="meta">${id} · confiance ${p.confiance} ${p.raisons?.length ? "· " + p.raisons.join(", ") : ""}</p>
    ${photos}${dessins}
    <div class="choix"><label><input type="radio" name="${id}" value="ok"> ✓ bon</label><label><input type="radio" name="${id}" value="non"> ✗ écarter</label></div></article>`);
}

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kilio – validation des poses</title><style>
:root{--bg:#f6f4ef;--card:#fff;--ink:#1f2328;--ink2:#5b636b;--line:#e4e0d6}
@media(prefers-color-scheme:dark){:root{--bg:#14161a;--card:#1d2026;--ink:#eef0f2;--ink2:#a2abb4;--line:#2c3038}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.4 system-ui,sans-serif;padding:16px}
.haut{position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:2;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
button{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:8px 16px;min-height:44px;cursor:pointer}
.grille{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.carte{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:10px}
.carte h3{margin:0;font-size:14px}.meta{margin:2px 0 8px;color:var(--ink2);font-size:12px;word-break:break-all}
.ligne{display:flex;gap:6px;margin-bottom:6px}.ligne>*{flex:1;min-width:0;height:130px;width:50%;object-fit:contain;border-radius:10px;background:var(--bg)}
.vide{display:flex;align-items:center;justify-content:center;color:var(--ink2)}
.choix{display:flex;gap:10px}.choix label{flex:1;border:1px solid var(--line);border-radius:12px;padding:10px;text-align:center;cursor:pointer;min-height:44px}
.carte:has(input[value=ok]:checked){outline:2px solid #2f9e44}.carte:has(input[value=non]:checked){outline:2px solid #e03131}
</style></head><body>
<div class="haut"><strong id="compte"></strong><button id="copier" type="button">Copier la liste des rejets</button><span id="etat"></span></div>
<p style="color:var(--ink2)">Pour chaque exercice : photos en haut, dessin départ → arrivée en dessous. Coche ✗ si le dessin est faux (membres mal placés, mauvais corps, personnes multiples…). Tout ce qui n'est pas coché ✗ est accepté.</p>
<div class="grille">${cartes.join("\n")}</div>
<script>
const cle="kilio-validation-poses";let etat={};try{etat=JSON.parse(localStorage.getItem(cle)||"{}")}catch{}
const maj=()=>{const non=Object.keys(etat).filter(k=>etat[k]==="non");document.getElementById("compte").textContent=non.length+" rejet(s) / ${retenus.length}"};
document.querySelectorAll("input[type=radio]").forEach(r=>{if(etat[r.name]===r.value)r.checked=true;r.addEventListener("change",()=>{etat[r.name]=r.value;try{localStorage.setItem(cle,JSON.stringify(etat))}catch{}maj()})});
document.getElementById("copier").onclick=async()=>{const non=Object.keys(etat).filter(k=>etat[k]==="non").join(",");try{await navigator.clipboard.writeText(non);document.getElementById("etat").textContent="Copié ("+non.split(",").filter(Boolean).length+")"}catch{document.getElementById("etat").textContent=non}};
maj();
</script></body></html>`;

await writeFile(path.resolve(sortieArg), html);
console.log(`${retenus.length} exercices -> ${sortieArg}`);
