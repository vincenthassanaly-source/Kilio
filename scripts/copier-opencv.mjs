// Copie OpenCV.js (WASM embarqué, ~10 Mo) vers public/vendor/ pour que le
// scanner le charge à la demande, hors du bundle principal, et que le service
// worker le garde en cache pour l'usage hors ligne. Lancé avant dev et build.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(racine, "node_modules/@techstark/opencv-js/dist/opencv.js");
const cible = resolve(racine, "public/vendor/opencv.js");

if (!existsSync(source)) {
  console.error("copier-opencv : @techstark/opencv-js introuvable, lance `npm install`.");
  process.exit(1);
}
mkdirSync(dirname(cible), { recursive: true });
copyFileSync(source, cible);
console.log("copier-opencv : public/vendor/opencv.js à jour");
