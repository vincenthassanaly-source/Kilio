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
  const dark = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", dark);
  const valeur = dark ? "dark" : "light";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, valeur);
  } catch {}
  document.cookie = `${THEME_COOKIE_KEY}=${valeur}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute("content", dark ? THEME_COLOR_SOMBRE : THEME_COLOR_CLAIR);
  });
}
