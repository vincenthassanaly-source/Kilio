import { redirect } from "next/navigation";

// « Aujourd'hui » et l'ancien « Accueil » ne font plus qu'un : l'écran du jour
// vit à la racine. Cette route ne sert plus qu'aux anciens liens et favoris.
export default function AujourdhuiRedirection() {
  redirect("/");
}
