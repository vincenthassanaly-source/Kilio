#!/usr/bin/env node
// Assemble le rapport unique d'un module : écrans au repos + pellicule d'usage + problèmes.
// Usage : node rapport.mjs <module> [--dir reports/audit/<module>]
import fs from "node:fs";
import path from "node:path";

const module_ = process.argv[2];
if (!module_) { console.error("Usage : node rapport.mjs <module> [--dir DIR]"); process.exit(1); }
const i = process.argv.indexOf("--dir");
const dir = path.resolve(i >= 0 ? process.argv[i + 1] : `reports/audit/${module_}`);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const lire = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);

const ecrans = lire(path.join(dir, "ecrans", "ecrans.json")) ?? [];
const pdir = path.join(dir, "parcours");
const parcours = fs.existsSync(pdir)
  ? fs.readdirSync(pdir, { withFileTypes: true }).filter((d) => d.isDirectory())
      .map((d) => ({ d: d.name, ...(lire(path.join(pdir, d.name, "parcours.json")) ?? { etapes: [] }) }))
  : [];

const problemes = [
  ...ecrans.filter((e) => !e.fichier || e.statut >= 400).map((e) => `Écran ${e.route} (${e.theme}) : ${e.statut}`),
  ...parcours.flatMap((p) => p.etapes.filter((s) => s.statut !== "ok")
    .map((s) => `Parcours « ${p.nom} » étape ${s.n} (${s.action}) : ${s.erreur ?? s.anomalies.join(" ; ")}`)),
];

const vignette = (src, legende, cls = "") => `<figure class="${cls}">${src ? `<img loading="lazy" src="${src}">` : ""}<figcaption>${esc(legende)}</figcaption></figure>`;
const reposHtml = ecrans.map((e) => e.fichier
  ? vignette(`ecrans/${e.fichier}`, `${e.route} · ${e.theme} · HTTP ${e.statut}`, e.statut >= 400 ? "ko" : "ok")
  : vignette("", `${e.route} · ${e.theme} · ${e.statut}`, "ko")).join("\n");
const usageHtml = parcours.map((p) => `<h3>${esc(p.nom)}</h3><div class="film">${p.etapes.map((s) =>
  vignette(`parcours/${p.d}/${s.fichier}`, `${s.n}. ${s.action} ${s.note ?? s.cible ?? s.url ?? s.texte ?? ""} — ${s.statut}${s.erreur ? " : " + s.erreur : ""}${s.anomalies.map((a) => " ⚠ " + a).join("")}`, s.statut)).join("\n")}</div>`).join("\n");

fs.writeFileSync(path.join(dir, "index.html"), `<!doctype html><meta charset="utf-8"><title>Audit ${esc(module_)}</title>
<style>body{font:14px system-ui;margin:16px;background:#f4f4f4}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
.film{display:flex;gap:12px;overflow-x:auto;padding-bottom:12px}.film figure{flex:0 0 200px}
figure{margin:0;background:#fff;padding:8px;border-radius:8px;border:2px solid #ccc}img{width:100%;border:1px solid #ddd}
.ok{border-color:#3a3}.anomalie{border-color:#e90}.échec,.ko{border-color:#c33}li{margin:2px 0}</style>
<h1>Audit du module « ${esc(module_)} »</h1>
<h2>Problèmes (${problemes.length})</h2><ul>${problemes.map((p) => `<li>${esc(p)}</li>`).join("") || "<li>Aucun détecté automatiquement</li>"}</ul>
<h2>Écrans au repos (${new Set(ecrans.map((e) => e.route)).size})</h2><main>${reposHtml}</main>
<h2>Usage réel (${parcours.length} parcours)</h2>${usageHtml}`);
console.log(`Rapport : ${path.join(dir, "index.html")} — ${problemes.length} problème(s)`);
