// L'onglet « Nutrition » de la barre du bas ouvre directement le Carnet
// alimentaire, en un tap : il n'y a plus d'écran-hub. La même page est servie
// à `/nutrition` (route de l'onglet) et à `/nutrition/journal` (sous-navigation,
// lien « jour » du Bilan), sans redirection : une redirection ferait attendre
// `useViewTransitionNavigate` un pathname `/nutrition` qui ne viendrait jamais.
// Bilan, Menus et Recettes restent atteignables par `NutritionSubNav`.
export { default } from "./journal/page";
