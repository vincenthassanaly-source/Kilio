import { describe, expect, it } from "vitest";
import { estUuid } from "./uuid";

describe("estUuid", () => {
  it("accepte un UUID, quelle que soit la casse", () => {
    expect(estUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(estUuid("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
  });

  it("refuse tout ce qui pourrait détourner un filtre PostgREST", () => {
    expect(estUuid("")).toBe(false);
    expect(estUuid("123e4567-e89b-12d3-a456-426614174000,id.neq.0")).toBe(false);
    expect(estUuid("x\n123e4567-e89b-12d3-a456-426614174000")).toBe(false);
  });
});
