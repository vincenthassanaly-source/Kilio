const THEME_STORAGE_KEY = "kilio-theme";
const THEME_COOKIE_KEY = "kilio-theme";
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an

// Couleur de la barre d'état / du navigateur (meta theme-color) : le fond
// réel de l'app (--background de globals.css converti en hex), T16. L'ancien
// sombre (#292f2d) ne correspondait pas au fond (≈ oklch 0,17).
export const THEME_COLOR_CLAIR = "#f7f5ec";
export const THEME_COLOR_SOMBRE = "#071212";

// Injecté en inline script dans <head> pour appliquer la classe `dark` avant
// le premier paint (évite le flash de thème clair). Seul point d'application
// du thème au chargement : le layout racine ne lit plus le cookie côté
// serveur, pour rester dans la coquille statique (Cache Components). Le
// script étant synchrone et placé avant <body>, la classe est posée avant
// tout rendu, comme l'était la classe SSR. Priorité inchangée : cookie >
// localStorage > préférence système.
export const themeInitScript = `
(function () {
  try {
    var match = document.cookie.match(/(?:^|; )${THEME_COOKIE_KEY}=([^;]*)/);
    var stored = match ? match[1] : localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var dark = stored ? stored === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
    // theme-color suit le thème choisi (T16), pas seulement la préférence
    // système : les balises meta sont posées plus loin dans <head>.
    var couleur = dark ? ${JSON.stringify("#071212")} : ${JSON.stringify("#f7f5ec")};
    document.addEventListener("DOMContentLoaded", function () {
      document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
        m.setAttribute("content", couleur);
      });
    });
  } catch (e) {}
})();
`;

/**
 * Bascule clair/sombre, partagée par le bouton de l'en-tête et Réglages :
 * classe `dark`, localStorage ET cookie (lu en priorité par
 * themeInitScript — Réglages n'écrivait que localStorage, et le choix était
 * perdu au rechargement), puis meta theme-color (T16).
 */
export function basculerTheme() {
  choisirTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
}

/** Choix d'apparence de Réglages : forcé clair, forcé sombre, ou celui du système. */
export type PreferenceTheme = "light" | "dark" | "system";

function appliquerClasseEtMeta(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute("content", dark ? THEME_COLOR_SOMBRE : THEME_COLOR_CLAIR);
  });
}

function systemeSombre(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Préférence enregistrée (même priorité que themeInitScript : cookie > localStorage), sinon « system ». */
export function lirePreferenceTheme(): PreferenceTheme {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE_KEY}=([^;]*)`));
  let stocke: string | null = match ? match[1] : null;
  if (!stocke) {
    try {
      stocke = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {}
  }
  return stocke === "dark" || stocke === "light" ? stocke : "system";
}

/**
 * Applique et retient un choix d'apparence. « system » efface le choix
 * forcé (cookie et localStorage) : themeInitScript retombe alors sur
 * `prefers-color-scheme` au prochain chargement.
 */
export function choisirTheme(preference: PreferenceTheme) {
  if (preference === "system") {
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {}
    document.cookie = `${THEME_COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
    appliquerClasseEtMeta(systemeSombre());
    return;
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {}
  document.cookie = `${THEME_COOKIE_KEY}=${preference}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
  appliquerClasseEtMeta(preference === "dark");
}

/**
 * En mode « system », suit le changement de thème du système tant que la
 * page est ouverte (themeInitScript ne le lit qu'au chargement). Renvoie la
 * fonction de désabonnement.
 */
export function suivreThemeSysteme(): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const media = matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (lirePreferenceTheme() === "system") appliquerClasseEtMeta(media.matches);
  };
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
