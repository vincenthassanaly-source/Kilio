import { describe, expect, it } from "vitest";
import { argumentsAExecuter, idsActionsRemplacees } from "./flush-policy";

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
