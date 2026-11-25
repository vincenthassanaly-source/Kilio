#!/usr/bin/env node
// Copie du script du skill kilio-audit-module, avec deux correctifs pour le banc d'audit isolé :
// (1) Chromium installé sous /opt/pw-browsers dans une autre version que celle attendue ;
// (2) dans un espace réseau sans interface externe, Chromium se croit hors ligne et l'app
//     refuse d'écrire : on force navigator.onLine = true (init script de chaque contexte).
// Rejoue des parcours utilisateur dans l'app Kilio et capture l'écran après CHAQUE étape.
// Usage : node parcours.mjs <parcours.json | dossier> [--base URL] [--mock URL] [--out DIR]
//         [--reset] [--stop-on-fail] [--full-page]
// À lancer depuis la racine du dépôt Kilio.
//
// Format d'un parcours (JSON) :
// { "nom": "creer-tache", "theme": "clair|sombre",
//   "etapes": [ { "action": "goto", "url": "/taches", "note": "ouvrir les tâches" },
//               { "action": "click", "cible": "role=button[name=/ajouter/i]" },
//               { "action": "fill", "cible": "role=textbox", "valeur": "Acheter du pain" },
//               { "action": "press", "touche": "Enter" },
//               { "action": "expect_text", "texte": "Acheter du pain" } ] }
// Actions : goto, click, dblclick, hover, fill, press, select, check, uncheck, scroll,
//           wait (ms), reload, back, expect_text, expect_absent, screenshot.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const cible = args.find((a, i) => !a.startsWith("--") && !(i > 0 && ["--base", "--mock", "--out"].includes(args[i - 1])));
if (!cible) { console.error("Usage : node parcours.mjs <parcours.json | dossier> [--base URL] [--mock URL] [--out DIR] [--reset] [--stop-on-fail] [--full-page]"); process.exit(1); }

const base = flag("base", "http://localhost:3100").replace(/\/$/, "");
const mock = flag("mock", "");
const out = path.resolve(flag("out", "reports/audit/module/parcours"));
const vp = { width: 390, height: 844 }; // mobile uniquement

const fichiers = fs.statSync(cible).isDirectory()
  ? fs.readdirSync(cible).filter((f) => f.endsWith(".json")).map((f) => path.join(cible, f))
  : [cible];

import { readdirSync as _rd, existsSync as _ex } from "node:fs";
const _chrome = (() => { const b = "/opt/pw-browsers"; try { for (const d of _rd(b).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) for (const s of ["chrome-linux64/chrome", "chrome-linux/chrome"]) if (_ex(`${b}/${d}/${s}`)) return `${b}/${d}/${s}`; } catch {} return undefined; })();
const _enLigne = () => { Object.defineProperty(navigator, "onLine", { get: () => true }); };
const req = createRequire(path.join(process.cwd(), "package.json"));
let chromium;
try { ({ chromium } = req("playwright")); } catch { ({ chromium } = req("@playwright/test")); }
const browser = await chromium.launch(_chrome ? { executablePath: _chrome } : {});
const _nc = browser.newContext.bind(browser);
browser.newContext = async (o) => { const c = await _nc(o); await c.addInitScript(_enLigne); return c; };

const getJson = async (u) => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch { return null; } };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const html = [];
let totalProblemes = 0;

for (const f of fichiers) {
  const p = JSON.parse(fs.readFileSync(f, "utf8"));
  const nom = p.nom ?? path.basename(f, ".json");
  const dossier = path.join(out, nom);
  fs.mkdirSync(dossier, { recursive: true });
  if (mock && args.includes("--reset")) await fetch(`${mock}/__reset`).catch(() => {});

  const ctx = await browser.newContext({
    viewport: vp, hasTouch: true,
    locale: "fr-FR", timezoneId: "Europe/Paris", colorScheme: p.theme === "sombre" ? "dark" : "light",
  });
  const page = await ctx.newPage();
  let evenements = [];
  page.on("console", (m) => { if (m.type() === "error") evenements.push(`console.error : ${m.text()}`); });
  page.on("pageerror", (e) => evenements.push(`exception : ${e.message}`));
  page.on("requestfailed", (r) => evenements.push(`requête échouée : ${r.method()} ${r.url()} (${r.failure()?.errorText})`));
  page.on("response", (r) => { if (r.status() >= 400) evenements.push(`HTTP ${r.status()} : ${r.request().method()} ${r.url()}`); });

  let ecritures = (mock && (await getJson(`${mock}/__writes`))) || [];
  const etapes = [];
  let stop = false;

  for (const [i, e] of (p.etapes ?? []).entries()) {
    if (stop) break;
    evenements = [];
    const t0 = Date.now();
    let erreur = null;
    const loc = () => page.locator(e.cible);
    try {
      switch (e.action) {
        case "goto": await page.goto(base + e.url, { waitUntil: "networkidle", timeout: 15000 }); break;
        case "click": await loc().first().click({ timeout: 5000 }); break;
        case "dblclick": await loc().first().dblclick({ timeout: 5000 }); break;
        case "hover": await loc().first().hover({ timeout: 5000 }); break;
        case "fill": await loc().first().fill(e.valeur ?? "", { timeout: 5000 }); break;
        case "press": e.cible ? await loc().first().press(e.touche, { timeout: 5000 }) : await page.keyboard.press(e.touche); break;
        case "select": await loc().first().selectOption(e.valeur, { timeout: 5000 }); break;
        case "check": await loc().first().check({ timeout: 5000 }); break;
        case "uncheck": await loc().first().uncheck({ timeout: 5000 }); break;
        case "scroll": await page.mouse.wheel(0, e.pixels ?? 600); break;
        case "wait": await page.waitForTimeout(e.ms ?? 500); break;
        case "reload": await page.reload({ waitUntil: "networkidle" }); break;
        case "back": await page.goBack({ waitUntil: "networkidle" }); break;
        case "expect_text": await page.getByText(e.texte).first().waitFor({ state: "visible", timeout: 5000 }); break;
        case "expect_absent": await page.getByText(e.texte).first().waitFor({ state: "hidden", timeout: 5000 }); break;
        case "screenshot": break;
        default: throw new Error(`action inconnue : ${e.action}`);
      }
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
    } catch (err) { erreur = String(err.message).split("\n")[0]; }

    const anomalies = [...evenements];
    const debordement = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1).catch(() => false);
    if (debordement) anomalies.push("débordement horizontal de la page");
    let nouvelles = [];
    if (mock) {
      const w = (await getJson(`${mock}/__writes`)) || [];
      nouvelles = w.slice(ecritures.length); ecritures = w;
    }
    const fichier = `${String(i + 1).padStart(2, "0")}-${e.action}.png`;
    await page.screenshot({ path: path.join(dossier, fichier), fullPage: args.includes("--full-page") }).catch(() => {});
    const statut = erreur ? "échec" : anomalies.length ? "anomalie" : "ok";
    if (statut !== "ok") totalProblemes++;
    etapes.push({ n: i + 1, ...e, statut, erreur, anomalies, ecritures: nouvelles, url: page.url(), ms: Date.now() - t0, fichier });
    if (erreur && args.includes("--stop-on-fail")) stop = true;
  }
  await ctx.close();

  fs.writeFileSync(path.join(dossier, "parcours.json"), JSON.stringify({ nom, ...p, etapes }, null, 2));
  const cartes = etapes.map((s) => `<figure class="${s.statut}"><img loading="lazy" src="${s.fichier}">
<figcaption><b>${s.n}. ${esc(s.action)}</b> ${esc(s.note ?? s.cible ?? s.url ?? s.texte ?? "")}<br>
<span class="tag">${s.statut}</span> ${s.erreur ? `<br>${esc(s.erreur)}` : ""}
${s.anomalies.map((a) => `<br>⚠ ${esc(a)}`).join("")}
${s.ecritures.length ? `<br>✎ ${s.ecritures.length} écriture(s) base` : ""}</figcaption></figure>`).join("\n");
  html.push(`<h2>${esc(nom)} <small>(mobile, ${p.theme ?? "clair"})</small></h2><div class="film">${cartes}</div>`);
  console.log(`${nom} : ${etapes.length} étape(s), ${etapes.filter((s) => s.statut !== "ok").length} problème(s)`);
  for (const s of etapes.filter((s) => s.statut !== "ok")) console.log(`  ! étape ${s.n} (${s.action}) : ${s.erreur ?? s.anomalies.join(" ; ")}`);
}
await browser.close();

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "index.html"), `<!doctype html><meta charset="utf-8"><title>Parcours utilisateur</title>
<style>body{font:14px system-ui;margin:16px;background:#f4f4f4}.film{display:flex;gap:12px;overflow-x:auto;padding-bottom:12px}
figure{margin:0;flex:0 0 220px;background:#fff;padding:8px;border-radius:8px;border:2px solid #ccc}img{width:100%;border:1px solid #ddd}
.ok{border-color:#3a3}.anomalie{border-color:#e90}.échec{border-color:#c33}.tag{font-weight:600}small{color:#666}</style>
<h1>Parcours utilisateur</h1>${html.join("\n")}`);
console.log(`Planche : ${path.join(out, "index.html")} — ${totalProblemes} étape(s) à examiner`);
