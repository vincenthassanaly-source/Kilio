// Fonctionnalités framer-motion (animations, gestes, drag, layout) chargées à
// la demande par <LazyMotion> (voir providers.tsx) : le composant `m` du bundle
// initial ne contient que le noyau, le reste arrive dans un chunk séparé.
export { domMax as default } from "framer-motion";
