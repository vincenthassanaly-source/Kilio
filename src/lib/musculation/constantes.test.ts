import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHAMPS_PAR_MODE,
  MODES_SAISIE,
  MODE_SAISIE_LABELS,
  MUSCLES,
  MUSCLE_LABELS,
  TYPES_SERIE,
  TYPE_SERIE_LABELS,
  compteDansLeVolume,
  estModeSaisie,
  estMuscle,
  estTypeSeance,
  estTypeSerie,
} from "./constantes";

const migration = readFileSync(join(process.cwd(), "scripts/migration-musculation-2026-10-11.sql"), "utf8");

describe("constantes musculation", () => {
  it("fournit un libellé pour chaque valeur", () => {
    expect(Object.keys(MUSCLE_LABELS).sort()).toEqual([...MUSCLES].sort());
    expect(Object.keys(MODE_SAISIE_LABELS).sort()).toEqual([...MODES_SAISIE].sort());
    expect(Object.keys(TYPE_SERIE_LABELS).sort()).toEqual([...TYPES_SERIE].sort());
    expect(Object.keys(CHAMPS_PAR_MODE).sort()).toEqual([...MODES_SAISIE].sort());
  });

  it("reste aligné avec les contraintes CHECK de la migration", () => {
    for (const valeur of [...MUSCLES, ...MODES_SAISIE, ...TYPES_SERIE]) {
      expect(migration).toContain(`'${valeur}'`);
    }
  });

  it("valide les valeurs", () => {
    expect(estMuscle("dos")).toBe(true);
    expect(estMuscle("nuque")).toBe(false);
    expect(estModeSaisie("duree")).toBe(true);
    expect(estModeSaisie(null)).toBe(false);
    expect(estTypeSerie("dropset")).toBe(true);
    expect(estTypeSerie("autre")).toBe(false);
    expect(estTypeSeance("PUSH")).toBe(true);
    expect(estTypeSeance("push")).toBe(false);
  });

  it("exclut l'échauffement du volume", () => {
    expect(compteDansLeVolume("echauffement")).toBe(false);
    expect(compteDansLeVolume("normale")).toBe(true);
    expect(compteDansLeVolume("echec")).toBe(true);
  });
});
