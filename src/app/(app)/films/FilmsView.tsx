"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { AttributionTmdb } from "./AttributionTmdb";
import { lireEtatFilms, memoriserEtatFilms, type OngletFilms } from "./etatFilms";
import { ListeFilms } from "./ListeFilms";
import { RechercheFilms } from "./RechercheFilms";

const ONGLETS: { value: OngletFilms; label: string }[] = [
  { value: "decouvrir", label: "Découvrir" },
  { value: "liste", label: "Ma liste" },
];

export function FilmsView() {
  const [onglet, setOnglet] = useState<OngletFilms>(() => lireEtatFilms().onglet);

  function choisir(valeur: OngletFilms) {
    setOnglet(valeur);
    memoriserEtatFilms({ onglet: valeur });
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl<OngletFilms> ariaLabel="Section des films" options={ONGLETS} value={onglet} onChange={choisir} glissant />
      {onglet === "decouvrir" ? <RechercheFilms /> : <ListeFilms onDecouvrir={() => choisir("decouvrir")} />}
      <AttributionTmdb />
    </div>
  );
}
