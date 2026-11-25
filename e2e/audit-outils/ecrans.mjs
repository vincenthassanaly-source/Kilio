#!/usr/bin/env node
// Copie du script du skill kilio-audit-module, avec deux correctifs pour le banc d'audit isolé :
// (1) Chromium installé sous /opt/pw-browsers dans une autre version que celle attendue ;
// (2) dans un espace réseau sans interface externe, Chromium se croit hors ligne et l'app
//     refuse d'écrire : on force navigator.onLine = true (init script de chaque contexte).
// Énumère les écrans d'un module Kilio et les capture (mobile, clair + sombre).
// Usage : node ecrans.mjs <module> [--liste] [--base URL] [--out DIR] [--themes clair,sombre]
// À lancer depuis la racine du dépôt Kilio.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const module_ = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && args[i - 1] !== "--liste"));
const racine = path.join(process.cwd(), "src/app/(app)");

if (!fs.existsSync(racine)) { console.error("Lancer depuis la racine du dépôt Kilio (src/app/(app) introuvable)."); process.exit(1); }

function pages(dir, rel = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (fs.existsSync(path.join(dir, e.name, "page.tsx"))) out.push(r);
    out.push(...pages(path.join(dir, e.name), r));
  }
  return out;
}

if (!module_) {
  const mods = fs.readdirSync(racine, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  console.log("Modules disponibles :\n" + mods.map((m) => `  ${m}`).join("\n"));
  process.exit(0);
}

const dirModule = path.join(racine, module_);
if (!fs.existsSync(dirModule)) { console.error(`Module « ${module_} » introuvable dans ${racine}`); process.exit(1); }

const segments = [];
if (fs.existsSync(path.join(dirModule, "page.tsx"))) segments.push("");
segments.push(...pages(dirModule));
// Groupes de routes « (x) » ne figurent pas dans l'URL.
const ecrans = segments.map((s) => {
  const route = "/" + [module_, ...s.split("/").filter(Boolean)].filter((x) => !/^\(.*\)$/.test(x)).join("/");
  return { route, dynamique: /\[[^\]]+\]/.test(route) };
});

if (args.includes("--liste")) {
  console.log(`${ecrans.length} écran(s) dans « ${module_} » :`);
  for (const e of ecrans) console.log(`  ${e.route}${e.dynamique ? "   (dynamique)" : ""}`);
  process.exit(0);
}

const base = flag("base", "http://localhost:3100").replace(/\/$/, "");
const out = path.resolve(flag("out", `reports/audit/${module_}/ecrans`));
const themes = flag("themes", "clair,sombre").split(",");
const vp = { width: 390, height: 844 }; // mobile uniquement : app pensée pour téléphone
fs.mkdirSync(out, { recursive: true });

import { readdirSync as _rd, existsSync as _ex } from "node:fs";
const _chrome = (() => { const b = "/opt/pw-browsers"; try { for (const d of _rd(b).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) for (const s of ["chrome-linux64/chrome", "chrome-linux/chrome"]) if (_ex(`${b}/${d}/${s}`)) return `${b}/${d}/${s}`; } catch {} return undefined; })();
const _enLigne = () => { Object.defineProperty(navigator, "onLine", { get: () => true }); };
const req = createRequire(path.join(process.cwd(), "package.json"));
let chromium;
try { ({ chromium } = req("playwright")); } catch { ({ chromium } = req("@playwright/test")); }
const browser = await chromium.launch(_chrome ? { executablePath: _chrome } : {});
const _nc = browser.newContext.bind(browser);
browser.newContext = async (o) => { const c = await _nc(o); await c.addInitScript(_enLigne); return c; };

// Résolution d'une route dynamique, niveau par niveau : à chaque segment [x], on suit
// le premier lien de la page courante qui colle au motif, en ignorant les routes
// statiques sœurs (ex. /pharmacie/revision n'est pas une matière).
const statiques = new Set(ecrans.filter((e) => !e.dynamique).map((e) => e.route));
async function resoudre(route, page) {
  const parts = route.split("/").filter(Boolean);
  let courant = "";
  for (let i = 0; i < parts.length; i++) {
    if (!/^\[.*\]$/.test(parts[i])) { courant += "/" + parts[i]; continue; }
    const motif = new RegExp("^" + courant.replace(/\//g, "\\/") + "\\/[^/]+$");
    await page.goto(base + (courant || "/"), { waitUntil: "networkidle" }).catch(() => {});
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    const trouve = hrefs.map((h) => (h || "").split("?")[0]).find((h) => motif.test(h) && !statiques.has(h));
    if (!trouve) return null;
    courant = trouve;
  }
  return courant;
}

const resultats = [];
{
  for (const theme of themes) {
    const ctx = await browser.newContext({
      viewport: vp, hasTouch: true,
      locale: "fr-FR", timezoneId: "Europe/Paris",
      colorScheme: theme === "sombre" ? "dark" : "light",
    });
    const page = await ctx.newPage();
    for (const e of ecrans) {
      let url = e.route;
      if (e.dynamique) url = await resoudre(e.route, page);
      const fichier = `${e.route.slice(1).replace(/[\/\[\]]/g, "_")}.${theme}.png`;
      if (!url) { resultats.push({ ...e, theme, statut: "non résolue" }); continue; }
      const rep = await page.goto(base + url, { waitUntil: "networkidle" }).catch(() => null);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(out, fichier), fullPage: true });
      resultats.push({ ...e, url, theme, fichier, statut: rep ? rep.status() : "erreur", titre: await page.title() });
    }
    await ctx.close();
  }
}
await browser.close();

fs.writeFileSync(path.join(out, "ecrans.json"), JSON.stringify(resultats, null, 2));
const cartes = resultats.map((r) => r.fichier
  ? `<figure><img loading="lazy" src="${r.fichier}"><figcaption>${r.route}<br>${r.theme} · HTTP ${r.statut}</figcaption></figure>`
  : `<figure class="nr"><figcaption>${r.route}<br>${r.theme} · ${r.statut}</figcaption></figure>`).join("\n");
fs.writeFileSync(path.join(out, "index.html"), `<!doctype html><meta charset="utf-8"><title>Écrans ${module_}</title>
<style>body{font:14px system-ui;margin:16px;background:#f4f4f4}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
figure{margin:0;background:#fff;padding:8px;border-radius:8px}img{width:100%;border:1px solid #ddd}.nr{color:#a00}</style>
<h1>Module « ${module_} » — ${ecrans.length} écran(s)</h1><main>${cartes}</main>`);
const ko = resultats.filter((r) => !r.fichier || r.statut >= 400);
console.log(`${resultats.length} capture(s) dans ${out} — ${ko.length} problème(s)`);
for (const r of ko) console.log(`  ! ${r.route} (${r.theme}) : ${r.statut}`);
