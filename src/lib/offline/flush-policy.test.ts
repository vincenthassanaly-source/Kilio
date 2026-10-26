import { describe, expect, it } from "vitest";
import { argumentsAExecuter, decisionApresEchec, idsActionsRemplacees } from "./flush-policy";

describe("decisionApresEchec", () => {
  const action = { module: "taches", action_name: "setTacheFait", payload: ["t1", true] };
  const T0 = Date.parse("2026-10-26T10:00:00.000Z");

  it("garde l'action tant que le premier échec date de moins de 10 min, même au 3e échec", () => {
    const decision = decisionApresEchec(
      { ...action, tentatives: 2, premier_echec_le: new Date(T0).toISOString() },
      false,
      T0 + 2 * 60_000
    );
    expect(decision).toMatchObject({ type: "reessayer_plus_tard", tentatives: 3 });
  });

  it("abandonne au 3e échec une fois 10 min écoulées depuis le premier", () => {
    const decision = decisionApresEchec(
      { ...action, tentatives: 2, premier_echec_le: new Date(T0).toISOString() },
      false,
      T0 + 10 * 60_000
    );
    expect(decision).toEqual({ type: "abandonner_et_continuer" });
  });

  it("pose la date du premier échec au premier échec non réseau", () => {
    expect(decisionApresEchec(action, false, T0)).toEqual({
      type: "reessayer_plus_tard",
      tentatives: 1,
      premier_echec_le: new Date(T0).toISOString(),
    });
  });

  it("n'abandonne rien quand la date du premier échec est illisible", () => {
    const decision = decisionApresEchec({ ...action, tentatives: 5, premier_echec_le: "n'importe quoi" }, false, T0);
    expect(decision.type).toBe("reessayer_plus_tard");
  });

  it("ne compte pas une erreur réseau", () => {
    expect(decisionApresEchec({ ...action, tentatives: 2 }, true, T0)).toMatchObject({
      type: "reessayer_plus_tard",
      tentatives: 2,
    });
  });
});

const coche = (id: number, tacheId: string, fait: boolean) => ({
  id,
  module: "taches",
  action_name: "setTacheFait",
  payload: [tacheId, fait, "2026-09-30"],
});

describe("idsActionsRemplacees", () => {
  it("remplace la coche en attente de la même tâche (coche puis décoche hors ligne)", () => {
    const enAttente = [coche(1, "t1", true)];
    const nouvelle = { module: "taches", action_name: "setTacheFait", payload: ["t1", false, "2026-09-30"] };
    expect(idsActionsRemplacees(enAttente, nouvelle)).toEqual([1]);
  });

  it("remplace aussi un doublon identique", () => {
    const enAttente = [coche(1, "t1", true), coche(2, "t1", true)];
    const nouvelle = { module: "taches", action_name: "setTacheFait", payload: ["t1", true, "2026-09-30"] };
    expect(idsActionsRemplacees(enAttente, nouvelle)).toEqual([1, 2]);
  });

  it("ne touche pas aux coches des autres tâches", () => {
    const enAttente = [coche(1, "t1", true), coche(2, "t2", true)];
    const nouvelle = { module: "taches", action_name: "setTacheFait", payload: ["t1", false, null] };
    expect(idsActionsRemplacees(enAttente, nouvelle)).toEqual([1]);
  });

  it("ne remplace pas une autre action de la même tâche", () => {
    const enAttente = [{ id: 1, module: "taches", action_name: "deleteTache", payload: ["t1"] }];
    const nouvelle = { module: "taches", action_name: "setTacheFait", payload: ["t1", true, null] };
    expect(idsActionsRemplacees(enAttente, nouvelle)).toEqual([]);
  });

  it("laisse intactes les actions qui ne posent pas un état absolu (courses, notes…)", () => {
    const enAttente = [{ id: 1, module: "courses", action_name: "toggleCourseItem", payload: ["c1", true] }];
    const nouvelle = { module: "courses", action_name: "toggleCourseItem", payload: ["c1", false] };
    expect(idsActionsRemplacees(enAttente, nouvelle)).toEqual([]);
  });

  it("ignore les entrées sans id", () => {
    const enAttente = [{ module: "taches", action_name: "setTacheFait", payload: ["t1", true] }];
    const nouvelle = { module: "taches", action_name: "setTacheFait", payload: ["t1", false] };
    expect(idsActionsRemplacees(enAttente, nouvelle)).toEqual([]);
  });
});

describe("argumentsAExecuter", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";

  it("retire les ids temporaires d'une suppression groupée", () => {
    const action = { module: "courses", action_name: "deleteCourseItems", payload: [["temp-a", UUID]] };
    expect(argumentsAExecuter(action)).toEqual([[UUID]]);
  });

  it("retire les articles temporaires d'une restauration groupée", () => {
    const action = {
      module: "courses",
      action_name: "restoreCourseItems",
      payload: [[{ id: "temp-a" }, { id: UUID }]],
    };
    expect(argumentsAExecuter(action)).toEqual([[{ id: UUID }]]);
  });

  it("renvoie null quand il ne reste que des ids temporaires", () => {
    const action = { module: "courses", action_name: "deleteCourseItems", payload: [["temp-a"]] };
    expect(argumentsAExecuter(action)).toBeNull();
  });

  it("ne touche pas aux autres actions", () => {
    const action = { module: "courses", action_name: "toggleCourseItem", payload: [UUID, true] };
    expect(argumentsAExecuter(action)).toBe(action.payload);
  });
});
