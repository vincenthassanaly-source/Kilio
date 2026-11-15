// Seed d'audit du module Courses : données FICTIVES (aucun article réel).
// Table `courses_items` : articles « à prendre » répartis sur plusieurs rayons
// (dont un libellé très long et des libellés hors dictionnaire, rangés dans
// « Autres ») et articles « pris » avec `termine_le` (l'historique qui alimente
// les suggestions d'habituels du formulaire d'ajout).
const u = (n) => `c0a5e000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const aPrendre = [
  "Tomates cerises",
  "Bananes",
  "Courgettes",
  "Baguette tradition",
  "Yaourts nature",
  "Beurre demi-sel",
  "Œufs",
  "Blanc de poulet, 600 g",
  "Riz basmati",
  "Huile d'olive",
  "Glace vanille",
  "Eau pétillante",
  "Dentifrice",
  "Sacs poubelle 30 L",
  "Piles AAA",
  "Papier cadeau et ruban doré pour l'anniversaire de la voisine du troisième étage (grand format)",
].map((libelle, i) => ({
  id: u(i + 1),
  libelle,
  coche: false,
  termine_le: null,
  created_at: `__DAY(${i < 6 ? 0 : i < 12 ? -1 : -3})__T${String(18 - (i % 10)).padStart(2, "0")}:${String(10 + i).padStart(2, "0")}:00+00:00`,
  updated_at: `__DAY(${i < 6 ? 0 : i < 12 ? -1 : -3})__T${String(18 - (i % 10)).padStart(2, "0")}:${String(10 + i).padStart(2, "0")}:00+00:00`,
}));

const pris = [
  ["Lait demi-écrémé", -2],
  ["Pain de mie", -2],
  ["Café moulu", -2],
  ["Lait demi-écrémé", -9],
  ["Pommes golden", -9],
  ["Lessive liquide", -9],
  ["Pâtes complètes", -16],
  ["Lait d'avoine", -16],
].map(([libelle, jour], i) => ({
  id: u(100 + i),
  libelle,
  coche: true,
  termine_le: `__DAY(${jour})__T17:${String(20 + i).padStart(2, "0")}:00+00:00`,
  created_at: `__DAY(${jour - 2})__T08:${String(10 + i).padStart(2, "0")}:00+00:00`,
  updated_at: `__DAY(${jour})__T17:${String(20 + i).padStart(2, "0")}:00+00:00`,
}));

export default {
  courses_items: [...aPrendre, ...pris],
};
